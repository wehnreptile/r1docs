# Data Model - Postgres & Redis

The DMS uses **Postgres for durable truth** and **Redis for live, high-churn coordination state**.
This document pins down both, including every Redis key, its type, fields, and TTL.

---

## 1. Postgres changes

### 1.1 `orders` table

No new columns are required for the happy path - `Order.java` already has:

- `delivery_agent_id` (`User` FK) - the assigned agent.
- `agentAssignedAt`, `orderPickedUpAt`, `orderDeliveredAt`, `orderReadyForPickupAt` - lifecycle
  timestamps.
- `orderStatus` - gains the `AGENT_ASSIGNED` value (see the ordinal-safety note in
  [`order-status-and-state-machines.md`](/docs/backend-gateway/delivery-state-machines#12--critical-migration-note-enum-ordinal-safety)).

### 1.2 `delivery_agents` table

Add fields needed for notification and (optionally) for crash-recovery of the live pool:

| New column | Type | Purpose |
|------------|------|---------|
| `fcm_token` | `varchar` (nullable) | Current device push token. Updated on login / duty-ON / token refresh. |
| `fcm_token_updated_at` | `int` (epoch s, nullable) | Staleness tracking for tokens. |

> `score` already exists on `DeliveryAgent` and is reused by the matcher as a secondary ranking
> signal (see [`matching-and-assignment.md`](/docs/backend-gateway/delivery-matching)).

Optional (only if we want Redis to be fully rebuildable from Postgres, see §4):

| Optional column | Type | Purpose |
|-----------------|------|---------|
| `duty_status` | enum/`varchar` | Last known ON/OFF, for warm-start of the pool after a Redis flush. |

### 1.3 What stays *out* of Postgres

Live location, `IDLE/OFFERED/BUSY`, active offers, blacklists, and the pending queue are **not**
persisted per-update in Postgres. They change every few seconds/minutes and belong in Redis. Postgres
only records the **outcomes** that matter forever (who was assigned, when each milestone happened).

---

## 2. Redis key schema

> **Conventions:** all keys are namespaced under `dms:` (delivery management system). `{orderId}` /
> `{agentId}` are integer ids. All timestamps are **epoch seconds** unless noted. TTLs are tunable
> (see [`assumptions-and-decisions.md`](/docs/backend-gateway/delivery-assumptions)).

### 2.1 Live agent pool - geo index

| Key | Type | Members | Purpose |
|-----|------|---------|---------|
| `dms:agents:geo` | **GEO** (sorted set) | `agentId` at `(lng, lat)` | The spatial index of **on-duty** agents. Populated on duty-ON / each location update via `GEOADD`. Queried with `GEOSEARCH dms:agents:geo FROMLONLAT <lng> <lat> BYRADIUS <r> km ASC` to get nearest agents to a store. |

> A geo member only encodes a point - not status. We intersect the geo result with the per-agent
> state hash (below) to keep only `IDLE` agents.

### 2.2 Per-agent live state

| Key | Type | Fields | TTL | Purpose |
|-----|------|--------|-----|---------|
| `dms:agent:{agentId}` | **HASH** | `status` (`IDLE`/`OFFERED`/`BUSY`), `lat`, `lng`, `lastReportedTime`, `currentOrderId` (nullable), `score`, `fcmToken` | sliding, e.g. `2 × heartbeatInterval` (see §3) | Authoritative live state for one agent. Re-set on every location heartbeat. |

This mirrors the existing `DeliveryAgentCacheEntity` (`agentId`, `location`, `lastReportedTime`,
`status`, `orderDetails`) - the Redis hash is its persistent form.

### 2.3 Active offers

| Key | Type | Fields / members | TTL | Purpose |
|-----|------|------------------|-----|---------|
| `dms:offer:{orderId}` | **HASH** | `agentId`, `offeredAt`, `expiresAt`, `state` (`PENDING`), `attempt` (n-th offer for this order) | `offerTimeout + grace` (safety net) | The single active offer for an order. |
| `dms:offers:expiry` | **ZSET** | member = `orderId`, score = `expiresAt` | - | Drives the timeout sweeper: `ZRANGEBYSCORE … 0 now` returns expired offers. The **primary** expiry mechanism (not Redis key TTL, which is only a backstop). |

> **Why a ZSET and not just key-TTL?** Key expiry in Redis is lazy and keyspace-notifications are
> best-effort - neither is reliable enough to *trigger* re-offer logic. The ZSET lets the sweeper
> deterministically poll "what expired" on a fixed cadence. The hash TTL is only garbage-collection
> insurance.

### 2.4 Per-order blacklist

| Key | Type | Members | TTL | Purpose |
|-----|------|---------|-----|---------|
| `dms:blacklist:{orderId}` | **SET** | `agentId`s that rejected / timed out on this order | safety TTL (e.g. a few hours) | Agents here are excluded from re-matching for this order. **Explicitly `DEL`eted when the order is accepted** (per product decision) or otherwise leaves the pipeline. The TTL is only a leak-guard for abandoned orders. |

### 2.5 Pending-order queue

| Key | Type | Members | Purpose |
|-----|------|---------|---------|
| `dms:orders:pending` | **ZSET** | member = `orderId`, score = `readyForPickupAt` (FIFO-ish by readiness) | Orders that are `READY_FOR_PICKUP` but currently have **no eligible agent**. The retry loop drains this when agents free up or on a periodic sweep. |

### 2.6 Distributed coordination (multi-instance safety)

| Key | Type | Purpose |
|-----|------|---------|
| `dms:lock:sweeper` | string + `SET NX PX` | Ensures only one app instance runs the timeout/pending sweep at a time. |
| `dms:lock:order:{orderId}` | string + `SET NX PX` | Short-lived lock around per-order match/offer mutations so concurrent triggers don't double-offer one order. |

---

## 3. Heartbeat, freshness & eviction

- Agents report location via REST (see [`api-contracts.md`](/docs/backend-gateway/delivery-api-contracts)) every **~3 minutes**
  (the cadence from `agents-mapping.md`).
- Each report refreshes `dms:agent:{agentId}` (and its sliding TTL) and re-`GEOADD`s the point.
- An agent whose `lastReportedTime` is older than the **staleness window** (e.g. `2.5 ×
  heartbeatInterval`) is treated as **unavailable** by the matcher even if still present, and is
  garbage-collected by TTL. This prevents offering orders to agents whose app died.
- A `BUSY` agent going stale mid-delivery is **not** silently freed - it's surfaced to admin (see
  [`edge-cases-and-failure-handling.md`](/docs/backend-gateway/delivery-edge-cases)).

---

## 4. Redis durability stance

Redis here is **rebuildable coordination state**, not the system of record:

- **Agent pool** can be rebuilt: agents re-register on their next heartbeat (and, if we add
  `duty_status` to Postgres, warm-started from there).
- **Offers in flight** during a Redis loss are recovered conservatively: any order in
  `READY_FOR_PICKUP` with no active offer is simply re-matched by the pending sweep. Worst case an
  agent gets a duplicate offer - handled idempotently (see edge-cases doc).
- **Order truth** (status, assigned agent, timestamps) is always in Postgres and is never lost.

Run Redis with AOF persistence enabled to minimise churn after a restart, but the system stays
**correct** even on a cold Redis because Postgres + the pending sweep can always reconstruct what
needs delivering.

---

## 5. Mapping to existing code

| Concept here | Existing type | Change |
|--------------|---------------|--------|
| Agent pool | `DeliveryAgentsCache` (interface) | Keep interface; replace `DeliveryAgentsCacheImpl` (in-memory map) with a `RedisDeliveryAgentsCacheImpl`. |
| Agent state | `DeliveryAgentCacheEntity` | Serialize to `dms:agent:{id}` hash. Add `OFFERED` to `AgentStatus`. |
| Order in flight | `OrderDetails` | Carries `orderId`, `storeLocation` (pickup), `deliveryLocation` (drop), `orderStatus`. Populated from the order via `OrderStatusPort`. |
| Distance | `DistanceFinder` | Unchanged. Haversine (`@Primary`) for matching; GraphHopper available for ETA later. |
| Pending queue | `pendingOrders` (`ConcurrentLinkedQueue` in current impl) | Replace with Redis ZSET `dms:orders:pending`. |

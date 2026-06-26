# Assumptions, Decisions & Open Questions

This document makes every design choice **explicit** - both the ones confirmed with product and the
secondary ones made within those bounds - so nothing is a hidden assumption. Anything you disagree
with is a one-line change here plus its downstream doc.

---

## 1. Confirmed product decisions (locked)

These were explicitly decided. They drive the whole design.

| # | Decision | Choice |
|---|----------|--------|
| P1 | Assignment model | **Offer → accept/reject with timeout** (Zomato/Swiggy style). |
| P2 | Offer timeout | **5 minutes, configurable** (`dms.offer.timeout-seconds`). No response = reject. |
| P3 | Reject/timeout | Agent **blacklisted for that order**; never re-offered the same order. |
| P4 | Blacklist lifetime | **Temporary**; **evicted when the order is accepted** by another agent. Safety TTL as leak-guard. |
| P5 | Realtime channel | **FCM push only.** No WebSockets. Responses + location over REST. |
| P6 | Live pool store | **Redis with GEO.** |
| P7 | Status granularity | Add **only** `AGENT_ASSIGNED` (`READY_FOR_PICKUP → AGENT_ASSIGNED → PICKED_UP → DELIVERED`). |

---

## 2. Secondary decisions made within those bounds

These follow logically from §1 and the existing code. Flagged so they're visible, not buried.

| # | Decision | Rationale | Reversible? |
|---|----------|-----------|-------------|
| D1 | **Add `OFFERED` to `AgentStatus`** (currently only `IDLE`/`BUSY`). | A reserved state is required so a pending offer doesn't let the agent be double-offered. Without it the offer model is unsafe. | Low cost; needed for correctness. |
| D2 | **Append `AGENT_ASSIGNED` at the end of the `OrderStatus` enum** (not insert in the middle). | Enum is `@Enumerated(ORDINAL)`; inserting mid-list corrupts existing rows. See state-machines doc §1.2. | Alternative is migrating to `EnumType.STRING` (bigger change). |
| D3 | **Trigger via after-commit Spring event** (`OrderReadyForPickupEvent`), not a direct call. | Keeps the dependency one-way and makes future extraction trivial; guarantees we only match committed orders. | Easy. |
| D4 | **DMS↔order via `OrderGateway` port.** | Decouples DMS from order schema for future split. | Easy. |
| D5 | **Matching = nearest-first (Haversine), `W_SCORE=0` in v1.** | Matches the literal requirement ("nearest IDLE agent"); scoring hook left in place. | Flip a weight. |
| D6 | **Expiry via a polled ZSET + sweeper**, not Redis key-TTL/keyspace-notifications. | Key expiry/notifications are best-effort and can't reliably *trigger* re-offer logic. | - |
| D7 | **Offers/blacklist/pending live in Redis, not JVM timers.** | Survives instance crashes & enables multi-instance + future extraction. | - |
| D8 | **Customer live-tracking = REST polling** of `/order/{id}/track`. | Consistent with the FCM-only / no-WebSocket decision (P5); reuses agent heartbeat location. | Could add push later. |
| D9 | **Agent identity verified on `PICKED_UP`/`DELIVERED`** (must be the assigned agent). | Prevents another agent advancing someone's order. | - |
| D10 | **Manual admin assignment bypasses the offer flow** (direct `IDLE→BUSY`). | It's the human escape hatch for escalated/pending orders; consent isn't needed when a human decides. | - |
| D11 | **New deps:** Redis client (`spring-boot-starter-data-redis`) + `firebase-admin`. | Required by P5/P6; neither is currently in `pom.xml`. | - |
| D12 | **`fcm_token` stored on `delivery_agents`** (+ mirrored in Redis). | Durable token home; Redis copy avoids a DB hit per push. | - |

---

## 3. Tunable parameters & default rationale

| Property | Default | Why this default |
|----------|---------|------------------|
| `dms.offer.timeout-seconds` | `300` | The agreed 5-min window (P2). Generous enough for an agent to notice + decide; short enough to retry within delivery SLA. |
| `dms.sweeper.interval-ms` | `10000` | Adds ≤10s slop to a 5-min timeout (0.5 KB-ish cost per tick) - negligible lateness, cheap. |
| `dms.match.initial-radius-km` | `3` | Urban pharmacy density; most pickups have an agent within 3 km. |
| `dms.match.max-radius-km` | `8` | Beyond this, delivery time/cost is poor; better to queue + escalate. |
| `dms.match.radius-growth-factor` | `2` | Few expansion steps (3→6→8) keep the common case one cheap query. |
| `dms.match.candidate-count` | `10` | Enough to survive a few reservation-race losses without re-querying. |
| `dms.blacklist.safety-ttl-seconds` | `7200` | Leak-guard only; real eviction is on accept (P4). |
| `dms.agent.heartbeat-seconds` | `180` | The 3-min cadence from `agents-mapping.md`. |
| `dms.agent.staleness-factor` | `2.5` | Tolerates one missed heartbeat before declaring an agent unavailable. |
| `dms.pending.escalation-seconds` | `900` | 15 min waiting ⇒ a human should look. |
| `dms.assigned.stuck-seconds` | `1800` | Assigned-but-not-picked-up for 30 min ⇒ flag for reassignment. |

All are externalised to `application.properties` so ops can tune without a rebuild.

---

## 4. Things assumed about existing infra (please confirm)

| # | Assumption | If wrong… |
|---|-----------|-----------|
| A1 | A **Redis instance** is (or will be) available to `pharma-service`. None is wired in `pom.xml`/properties today. | Need to provision Redis before implementation; otherwise the in-memory cache stays as a stop-gap (loses crash-safety + multi-instance). |
| A2 | A **Firebase project + service-account** exists for FCM, and the agent app is already integrated with FCM to receive tokens. | Notifications can't be sent; would need to set up Firebase first. |
| A3 | `Store.lat/lng` is the correct **pickup** location and `Address.latitude/longitude` is the correct **drop** location. | Matching uses the wrong coordinates. |
| A4 | The agent app reports location every ~3 min (per `agents-mapping.md`) and will call the new `/offer/respond` + `/fcm-token` endpoints. | Heartbeat/staleness tuning and the offer flow assume this client behaviour. |
| A5 | `pharma-service` runs (or will run) **multiple instances** eventually - hence the distributed locks. If always single-instance, the locks are cheap no-ops but harmless. | None - design is safe either way. |

---

## 5. Open questions for product / future iterations

These are **not** blocking the current design but should be decided before/while building:

1. **Payout/earnings** - the offer shows `payout` (= `deliveryPartnerFee`). Is that the agent's take,
   or is there a separate agent-fee model? (Currently assumed to be the displayed figure.)
2. **Agent `score`** - what feeds it (ratings? on-time %?) and when do we turn on score-weighted
   matching (`W_SCORE > 0`)? Field exists but is unpopulated.
3. **Reassignment after pickup failure** - if an assigned agent can't reach the store, is there an
   agent-initiated "cancel/return" action, or admin-only? (Currently admin-only via reassignment.)
4. **Cancellation by customer** post-`AGENT_ASSIGNED** - allowed? With what compensation to the
   agent? (Out of current scope.)
5. **Batching** - multiple nearby orders to one agent. Explicitly deferred; the model is one-order-
   per-agent for now.
6. **Distance vs ETA** - when do we switch matching from Haversine to GraphHopper road ETA (heavier
   CPU/RAM)? Hook exists.
7. **Geofencing pickup/delivery confirmation** - should `PICKED_UP`/`DELIVERED` require the agent to
   be within N meters of the store/customer? (Not enforced today.)

---

## 6. Change log of this design

| Date | Change |
|------|--------|
| 2026-06-26 | Initial HLD + LLD authored. Decisions P1-P7 confirmed with product; D1-D12 derived. |

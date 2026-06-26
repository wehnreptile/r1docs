# Edge Cases & Failure Handling

The long tail of "what if…". Each row states the scenario, the system's response, and where it's
enforced. Many of these reference the concurrency guards in
[`offer-lifecycle-and-scheduler.md`](/docs/backend-gateway/delivery-offer-lifecycle#6-concurrency--idempotency-summary).

---

## 1. Agent behaviour

| Scenario | Handling |
|----------|----------|
| Agent rejects an offer | Blacklisted for that order; freed to `IDLE`; order re-matched to next-best. |
| Agent ignores offer (no response) | Sweeper expires it after `offerTimeout` (5 min); handled exactly like a reject. |
| Agent goes OFF duty while holding a pending offer (`OFFERED`) | Offer auto-rejected first (blacklist + re-match), then agent removed from pool. |
| Agent tries to go OFF duty while `BUSY` (mid-delivery) | Rejected with `409` - must complete or be reassigned by admin. (Existing `markAgentOffDuty` guard.) |
| Agent accepts after the offer already expired / went to someone else | `confirmAgent` CAS fails + `offer.agentId` mismatch → `409 OfferExpired`. App shows "no longer available." |
| Same agent double-taps ACCEPT (duplicate FCM) | First wins; second sees `state != PENDING` → idempotent `200` "already assigned." |
| Agent accepts but never picks up | Order sits in `AGENT_ASSIGNED`. A **stuck-order monitor** (extension of the sweeper) flags assignments older than `ASSIGNED_STUCK_THRESHOLD` for admin to reassign. |
| Agent app dies after accepting (no heartbeat) while `BUSY` | Agent goes **stale** but is **not** auto-freed (an order is on them). Surfaced to admin; admin can reassign (which frees the old agent and offers anew). |
| Wrong agent attempts `PICKED_UP`/`DELIVERED` | Mutator checks acting agent == `order.deliveryAgent` → `403`. |

---

## 2. No-capacity scenarios

| Scenario | Handling |
|----------|----------|
| No idle agents anywhere when order becomes ready | Order → `dms:orders:pending`; retried when an agent frees up + on each sweep. |
| All in-range agents are already blacklisted for this order | Radius expands (matching doc §2); if still none, → pending. |
| Order pending beyond `PENDING_ESCALATION_THRESHOLD` (15 min) | Flagged in admin "orders awaiting agent"; admin can manually assign or contact agents. |
| Every reachable agent has rejected/timed-out the order | Stays pending + escalated; will retry as new agents come on duty (their ids aren't in the blacklist). |

---

## 3. Concurrency / races

| Scenario | Handling |
|----------|----------|
| Two orders ready simultaneously both pick the same nearest idle agent | Lua CAS `IDLE→OFFERED` - exactly one reserves; the loser's orchestrator picks next-best. |
| Two triggers for the same order (e.g. event + admin) | `dms:lock:order:{orderId}` + `activeOffer` check ⇒ only one offer exists. |
| Agent ACCEPT and sweeper EXPIRE collide on one offer | Both contend for `dms:lock:order:{orderId}`; first wins, second no-ops on `state != PENDING`. |
| Multiple app instances run the sweeper | `dms:lock:sweeper` (`SET NX PX`) → one runner per tick. |

---

## 4. Infra failures

| Scenario | Handling |
|----------|----------|
| **FCM send fails** (offline device, bad token) | Logged + metered; offer **not** rolled back - the 5-min timeout re-offers. Invalid tokens flagged for refresh. |
| **Redis down** | Matching/offers can't proceed; new READY orders are **not lost** - they're in Postgres as `READY_FOR_PICKUP`. On recovery, the pending sweep re-matches every `READY_FOR_PICKUP` order lacking an active offer. Agents re-register on next heartbeat. |
| **Redis cold start / flushed** | Pool rebuilds from agent heartbeats (+ optional `duty_status` warm-start). In-flight offers are lost → those orders look "unoffered" → re-matched by sweep. Worst case: a duplicate offer, handled idempotently. |
| **App instance crash mid-offer** | Offer record + expiry ZSET are in Redis, not heap → another instance's sweeper still expires it on time. No timer is lost. (This is the core reason offers live in Redis, not in-JVM timers.) |
| **Postgres write fails on `assign`** (after agent accepted) | The whole accept is transactional via `OrderGateway.assign`; on failure the agent is **not** confirmed `BUSY` (CAS rolled back / compensated) and the offer is left to expire → re-offer. Agent told "couldn't confirm, retry." |
| **GraphHopper OOM / unavailable** | Not on the hot path - matching uses Haversine (`@Primary`). Only ETA display degrades. |

---

## 5. Order lifecycle interference

| Scenario | Handling |
|----------|----------|
| Store rejects/cancels order while an offer is pending | Order → `REJECTED`; orchestrator cancels the active offer (`OFFER_CANCELLED` push), frees the agent, evicts blacklist, removes from pending. |
| Store marks `READY_FOR_PICKUP` twice | Second event is idempotent - `attemptAssign` sees an active offer (or assignment) and no-ops. |
| Admin manually assigns an order that also has an auto-offer in flight | Manual assign takes the per-order lock; if an offer is `PENDING` it is cancelled first, then the manual agent is reserved. Single winner. |
| Customer changes delivery address after `AGENT_ASSIGNED` | Blocked - existing rule prevents address change while an active order references it (see order-status-update doc). Drop location is therefore stable post-assignment. |

---

## 6. Data-integrity invariants (assert/monitor these)

1. An order is in **at most one** of: active offer / pending queue / assigned. Never two.
2. An agent has **at most one** `currentOrderId` and its status reflects it
   (`OFFERED`/`BUSY` ⇒ non-null; `IDLE` ⇒ null).
3. `order.deliveryAgent` is non-null **iff** status ≥ `AGENT_ASSIGNED`.
4. No `agentId` appears in `dms:blacklist:{orderId}` after that order is accepted (blacklist evicted).
5. Every member of `dms:offers:expiry` has a matching `dms:offer:{orderId}` hash (sweeper reconciles
   orphans by `ZREM`).

A lightweight **reconciliation job** (low frequency) can verify 1-4 and emit alerts on violation -
cheap insurance against subtle bugs in the early days.

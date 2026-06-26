# LLD - Offer Lifecycle, Blacklist & Schedulers

This document details the **offer → accept / reject / timeout** machine, the **per-order blacklist**,
and the two background loops (the **timeout sweeper** and the **pending-order retry**). It builds on
the matching engine in [`matching-and-assignment.md`](/docs/backend-gateway/delivery-matching).

---

## 1. Components

| Component | Responsibility |
|-----------|----------------|
| `OfferManager` | CRUD over offer records + blacklist + expiry ZSET. Pure Redis bookkeeping. |
| `AssignmentOrchestrator` | Drives transitions: create offer, handle accept/reject, react to timeouts, re-match, escalate. |
| `OfferTimeoutSweeper` | `@Scheduled` job: detect expired offers and drain the pending queue. |

```java
public interface OfferManager {
  Offer createOffer(int orderId, AgentCandidate agent, Duration ttl);   // → PENDING
  Optional<Offer> activeOffer(int orderId);
  void closeOffer(int orderId);                  // ACCEPTED path
  void blacklistAgent(int orderId, int agentId); // REJECTED / EXPIRED path
  void evictBlacklist(int orderId);              // on ACCEPT or order leaving pipeline
  List<Integer> expiredOrderIds(long nowEpoch);  // from dms:offers:expiry ZSET
}
```

---

## 2. Creating an offer

When the orchestrator has a reserved agent (see matching doc §4):

```
createOffer(orderId, agent, ttl):
  expiresAt = now + ttl                          # ttl = offerTimeout (default 5 min, configurable)
  HSET  dms:offer:{orderId}  agentId, offeredAt=now, expiresAt, state=PENDING, attempt=n
  EXPIRE dms:offer:{orderId}  ttl + GRACE        # backstop GC only
  ZADD  dms:offers:expiry  expiresAt  orderId    # PRIMARY expiry trigger
  fcmNotifier.sendOffer(agent, orderPayload)     # see notifications doc
```

The offer carries everything the agent needs to decide (built from `OrderStatusPort`): pickup store
name + address, drop area, distance, estimated payout (`deliveryPartnerFee`), and `expiresAt` so the
app can show a live countdown.

---

## 3. Agent responds: `POST /delivery/offer/respond`

```
respond(agentId, orderId, action):              # action ∈ {ACCEPT, REJECT}
  acquire dms:lock:order:{orderId}
  try:
    offer = OfferManager.activeOffer(orderId)
    # ---- idempotency / validity guards ----
    if offer is null:                  throw OfferExpiredException     # already resolved
    if offer.agentId != agentId:       throw OfferNotForYouException   # stale/forged
    if offer.state != PENDING:         throw OfferAlreadyResolved      # double tap

    if action == ACCEPT:
        confirmAgent(agentId, orderId)            # CAS OFFERED→BUSY (Lua)
        orderStatusPort.assign(orderId, agentId)  # READY_FOR_PICKUP → AGENT_ASSIGNED, set FK + ts
        OfferManager.closeOffer(orderId)          # DEL offer hash + ZREM expiry
        OfferManager.evictBlacklist(orderId)      # ← product rule: blacklist gone on accept
        ZREM dms:orders:pending orderId           # (defensive) ensure not in pending
        fcmNotifier.sendAssignmentConfirmed(agentId, orderId)
    else: # REJECT
        handleDecline(orderId, agentId, reason=REJECTED)
  finally:
    release dms:lock:order:{orderId}
```

`handleDecline` is shared by REJECT and EXPIRED:

```
handleDecline(orderId, agentId, reason):
  OfferManager.blacklistAgent(orderId, agentId)   # SADD dms:blacklist:{orderId} agentId
  releaseAgent(agentId, orderId)                  # CAS OFFERED→IDLE (Lua)
  OfferManager.closeOffer(orderId)                # remove the now-dead offer
  triggerRematch(orderId)                         # attemptAssign(orderId) - next-best, excl. blacklist
  emit metric: offer.{rejected|expired}
```

**Blacklist semantics (per product decision):**

- On **REJECT** or **timeout**, the agent is added to `dms:blacklist:{orderId}` → we never re-offer
  *this* order to *that* agent.
- The blacklist is **temporary**: it is **`DEL`eted the moment the order is accepted** by another
  agent (`evictBlacklist`). It also has a safety TTL so an abandoned order can't leak the key forever.
- The blacklist is **per-order**, not global - an agent who declined order #1 is still a first-class
  candidate for order #2.

---

## 4. The timeout sweeper

The 5-minute "no response = reject" rule needs something to fire when the agent stays silent. We use
a **scheduled poll over the expiry ZSET** (not Redis key-expiry, which can't reliably trigger logic).

```java
@Scheduled(fixedDelayString = "${dms.sweeper.interval-ms:10000}")  // every ~10s
public void sweep() {
  if (!tryAcquire("dms:lock:sweeper", leaseMs)) return;  // single-instance via SET NX PX
  try {
    sweepExpiredOffers();
    drainPendingQueue();
  } finally { releaseLock("dms:lock:sweeper"); }
}
```

### 4.1 Expired-offer handling

```
sweepExpiredOffers():
  for orderId in ZRANGEBYSCORE dms:offers:expiry 0 now:     # everything past its expiresAt
      offer = activeOffer(orderId)
      if offer != null and offer.state == PENDING:
          handleDecline(orderId, offer.agentId, reason=EXPIRED)   # same path as reject
      ZREM dms:offers:expiry orderId
```

Because EXPIRED reuses `handleDecline`, an unanswered offer behaves **exactly** like a rejection:
agent blacklisted for the order, agent freed, order re-matched to the next-best candidate.

### 4.2 Choosing the sweep interval vs the offer timeout

- `offerTimeout` (default **300s / 5 min**, configurable via `dms.offer.timeout-seconds`) is the
  business SLA the agent sees.
- `sweeperInterval` (default **10s**) only bounds how *late* we notice an expiry. Worst-case real
  timeout = `offerTimeout + sweeperInterval`. 10s slop on a 5-min window is negligible. Keep the
  sweep frequent and cheap; keep the timeout a business knob.

---

## 5. The pending-order retry loop

Orders with no eligible agent sit in `dms:orders:pending`. They are retried two ways (see matching doc
§6): event-driven when an agent frees up, and via the sweeper:

```
drainPendingQueue():
  for orderId in ZRANGE dms:orders:pending 0 BATCH_LIMIT:    # oldest first
      if order no longer READY_FOR_PICKUP (e.g. cancelled):
          ZREM dms:orders:pending orderId; continue
      attemptAssign(orderId)        # if it places, attemptAssign removes it from pending
      if pending age > PENDING_ESCALATION_THRESHOLD:
          flagForAdmin(orderId)
```

`attemptAssign` (matching doc §5) removes the order from pending on success (offer created) and
re-adds/leaves it if still nobody is available.

---

## 6. Concurrency & idempotency summary

| Risk | Guard |
|------|-------|
| Two orders grab the same idle agent | Lua CAS `IDLE→OFFERED` reservation (one winner). |
| Two triggers offer the same order twice | `dms:lock:order:{orderId}` + `activeOffer` check in `attemptAssign`. |
| Agent accepts *and* the sweeper expires the same offer | Both take `dms:lock:order:{orderId}`; whoever runs first wins, the other sees `state != PENDING` and no-ops. |
| Agent accepts after expiry/re-offer to someone else | `confirmAgent` CAS fails (agent already `IDLE`/reserved elsewhere) **and** `offer.agentId != agentId` → `OfferAlreadyResolved`. |
| Duplicate FCM → double ACCEPT tap | Second tap sees `state != PENDING` → idempotent no-op (200 with "already assigned"). |
| Multiple app instances run the sweeper | `dms:lock:sweeper` (`SET NX PX`). |

Every cross-machine mutation funnels through the orchestrator under a per-order lock, so the order /
offer / agent state machines (see [state machines doc](/docs/backend-gateway/delivery-state-machines)) can
never diverge.

---

## 7. Tunable parameters (all configurable)

| Property | Default | Meaning |
|----------|---------|---------|
| `dms.offer.timeout-seconds` | `300` | Offer accept/reject window (the 5-min rule). |
| `dms.sweeper.interval-ms` | `10000` | How often expired offers / pending orders are swept. |
| `dms.match.initial-radius-km` | `3` | First search radius around the store. |
| `dms.match.max-radius-km` | `8` | Largest radius before giving up to pending. |
| `dms.match.radius-growth-factor` | `2` | Radius multiplier per retry. |
| `dms.match.candidate-count` | `10` | Max candidates pulled per GEOSEARCH. |
| `dms.blacklist.safety-ttl-seconds` | `7200` | Leak-guard TTL on per-order blacklist. |
| `dms.agent.heartbeat-seconds` | `180` | Expected agent location cadence (3 min). |
| `dms.agent.staleness-factor` | `2.5` | Multiplier on heartbeat after which an agent is "stale". |
| `dms.pending.escalation-seconds` | `900` | Pending age that triggers admin escalation. |

See [`assumptions-and-decisions.md`](/docs/backend-gateway/delivery-assumptions) for rationale on each default.

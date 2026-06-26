# LLD - Matching & Optimal Assignment

This is the low-level design of **how the best agent is chosen** for an order and **how that agent is
atomically reserved**. The offer/timeout machinery that wraps this is in
[`offer-lifecycle-and-scheduler.md`](/docs/backend-gateway/delivery-offer-lifecycle).

---

## 1. Inputs & contract

The matcher answers one question:

> *Given a pickup location and a set of agents we must not use, who is the single best candidate?*

```java
public interface AgentMatcher {
  /**
   * Returns the best eligible agent for the order's pickup location, excluding any agent in
   * {@code blacklistedAgentIds}. Empty if no eligible agent exists right now.
   */
  Optional<AgentCandidate> bestCandidate(GeoLocation pickup, Set<Integer> blacklistedAgentIds);

  /**
   * Returns up to {@code limit} ranked candidates (for the admin recommendation API).
   */
  List<AgentCandidate> rankedCandidates(GeoLocation pickup, Set<Integer> blacklistedAgentIds, int limit);
}
```

`AgentCandidate` = `{ agentId, location, distanceMeters, score, etaSeconds? }`.

This refines the existing `DeliveryAgentsCache.findAndAssignAgent(OrderDetails)`, splitting it into
**pure selection** (`AgentMatcher`, no side effects) and **reservation** (`DeliveryAgentsCache`,
mutating). Keeping selection side-effect-free makes it reusable for the admin "recommend agents" API
and unit-testable.

---

## 2. Candidate search algorithm

```
bestCandidate(pickup, blacklist):
  radius = INITIAL_RADIUS_KM            # e.g. 3 km
  while radius <= MAX_RADIUS_KM:        # e.g. up to 8 km
    raw = GEOSEARCH dms:agents:geo
            FROMLONLAT pickup.lng pickup.lat
            BYRADIUS radius km ASC COUNT (K)   # nearest-first, capped
    eligible = []
    for agentId, distance in raw:
        state = HGETALL dms:agent:{agentId}
        if state.status != IDLE:            continue   # OFFERED / BUSY excluded
        if agentId in blacklist:            continue   # rejected/timed-out this order
        if isStale(state.lastReportedTime): continue   # dead app
        eligible.add(candidate(agentId, distance, state.score))
    if eligible not empty:
        return pickBest(eligible)
    radius *= RADIUS_GROWTH_FACTOR        # widen and retry, e.g. ×2
  return Optional.empty()                 # nobody - caller enqueues to pending
```

Key points:

- **`GEOSEARCH … ASC`** returns nearest-first, so we naturally prefer close agents.
- We **expand the radius** in steps rather than searching a huge radius up front - keeps the common
  case cheap and avoids offering to far-away agents unless necessary.
- All filtering (`status`, `blacklist`, `staleness`) happens against the per-agent hash. The geo
  index only narrows *space*.

---

## 3. Scoring - "best" beyond pure distance

The product requirement is *nearest IDLE agent*. Distance is the dominant factor, but a tiny bit of
blending avoids pathological picks (e.g. a marginally-closer agent with a terrible rating). The
default `pickBest` is:

```
cost(agent) = distanceMeters
            - W_SCORE * normalizedScore(agent)      # better-rated agents slightly favoured
pickBest = argmin(cost)
```

Defaults for **v1**:

- `W_SCORE = 0` → **pure nearest-first** (exactly the current behaviour, fully predictable).
- The hook is in place so we can turn on score/fairness blending later without restructuring.

Future signals (documented, not built now): agent acceptance-rate, current load fairness, predicted
ETA via GraphHopper (`DistanceFinder` already supports road distance), and direction-of-travel.

> **Distance source.** `RadianDistanceFinderImpl` (Haversine, `@Primary`) is used for matching -
> cheap and good enough for ranking. `DistanceFinderImpl` (GraphHopper road distance) is reserved for
> showing realistic ETAs and is heavier on CPU/RAM, so it is not on the hot matching path.

---

## 4. Atomic reservation (the race that must not happen)

Selection is side-effect-free; **reservation** is where concurrency bites. Two orders becoming ready
at the same moment can both pick the same nearest idle agent. Only one may win.

Reservation is therefore a **Redis compare-and-set via a Lua script** (atomic on the Redis server):

```lua
-- reserve_agent.lua
-- KEYS[1] = dms:agent:{agentId}
-- ARGV[1] = expected status (IDLE)
-- ARGV[2] = new status (OFFERED)
-- ARGV[3] = orderId
if redis.call('HGET', KEYS[1], 'status') == ARGV[1] then
    redis.call('HSET', KEYS[1], 'status', ARGV[2], 'currentOrderId', ARGV[3])
    return 1            -- reserved
else
    return 0            -- lost the race; caller retries with next candidate
end
```

Reservation flow in the orchestrator:

```
reserve(candidate, orderId):
  if EVAL reserve_agent.lua == 1:
      return RESERVED
  else:
      # someone else grabbed this agent between select and reserve
      return RACE_LOST   # orchestrator picks the next-best candidate and retries
```

The corresponding **release** (on reject/expire) and **confirm** (on accept) are also Lua CAS scripts
(`OFFERED→IDLE` and `OFFERED→BUSY` respectively), each verifying the agent still holds *this* order to
stay idempotent.

> This replaces the unsynchronised `candidateAgent.setStatus(BUSY)` mutation in the current
> in-memory `DeliveryAgentsCacheImpl`, which is not safe across instances or even across threads
> without external locking.

---

## 5. Putting it together - the assignment attempt

```
attemptAssign(orderId):
  acquire dms:lock:order:{orderId}          # serialize concurrent triggers for one order
  try:
    if order already has active offer: return    # idempotent: don't double-offer
    pickup    = orderStatusPort.pickupLocation(orderId)
    blacklist = SMEMBERS dms:blacklist:{orderId}
    while true:
        candidate = matcher.bestCandidate(pickup, blacklist)
        if candidate empty:
            enqueuePending(orderId)          # ZADD dms:orders:pending
            return
        if reserve(candidate, orderId) == RESERVED:
            offerManager.createOffer(orderId, candidate, ttl)   # → PENDING + ZSET + FCM
            return
        else:
            blacklist += candidate.agentId   # transient: just for this matching pass
            # loop: try next-best
  finally:
    release dms:lock:order:{orderId}
```

Note the two flavours of "exclude this agent":

- **Per-order blacklist** (`dms:blacklist:{orderId}`, durable across the order's life) - agents who
  *rejected/timed-out* this order.
- **Transient pass-local exclusion** - agents we *lost the reservation race* to during this single
  matching pass. These are not persisted to the blacklist (they may be perfectly good for this order
  later); they're just skipped for the remainder of this attempt.

---

## 6. When nobody is available

If `bestCandidate` returns empty across all radii, the order is added to `dms:orders:pending`. It is
retried by:

1. **Event-driven retry** - when any agent transitions to `IDLE` (goes on duty, or finishes a
   delivery), the orchestrator pops the **oldest** pending order whose pickup is within range of that
   newly-free agent and attempts assignment. (Cheap, low-latency.)
2. **Periodic sweep** - the `OfferTimeoutSweeper` also drains `dms:orders:pending` on its fixed
   cadence as a safety net (covers the case where an agent was already idle but the order arrived
   with none in range, then someone moved closer).

Escalation: an order that stays pending beyond `PENDING_ESCALATION_THRESHOLD` (e.g. 15 min) is
flagged for **admin attention** (visible in the admin "orders awaiting agent" view), so a human can
manually assign or contact agents.

---

## 7. Admin recommendation & manual override

The admin "recommend agents for an order" feature reuses `matcher.rankedCandidates(pickup, blacklist,
limit=5)` - same engine, no reservation, returns the top-5 nearest IDLE agents sorted by distance
(this is exactly point 6 of `agents-mapping.md`).

Manual assignment (`POST /delivery/orders/{id}/assign`) bypasses the offer flow: it reserves the
chosen agent (CAS `IDLE→BUSY`), sets the order to `AGENT_ASSIGNED`, and pushes an FCM
*assignment* (not an *offer*) to the agent. Used as the human escape hatch when auto-assignment can't
place an order.

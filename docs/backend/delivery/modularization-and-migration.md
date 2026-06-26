# Modularization & Future Migration

The DMS lives inside `pharma-service` today but is built to be **lifted out into a standalone
delivery-service** later with minimal rework. This document defines the package layout, the
**ports** that form the module boundary, and the step-by-step extraction playbook.

---

## 1. The one rule

> **Dependencies only ever point _into_ the DMS via events, and _out_ of the DMS via ports.**
> Nothing in `order`, `cart`, `store`, etc. may import a DMS internal class, and the DMS may not
> import order/store internals - only the narrow port interfaces and shared model types.

If that rule holds, extraction is mechanical: replace in-process event/port wiring with network
calls. If it's violated, extraction means untangling a web of imports. So the rule is the design.

---

## 2. Package layout (`com.reptile.pharmacy.delivery`)

```
delivery/
├── DeliveryController.java          # REST surface (agent/admin/customer)  [exists]
├── DeliveryService.java / impl/     # thin app-service over the orchestrator [exists]
│
├── orchestration/
│   ├── AssignmentOrchestrator.java  # the brain - drives all cross-machine transitions
│   └── impl/
│
├── matching/                        # [exists]
│   ├── AgentMatcher.java            # pure selection (new, split from cache)
│   ├── DeliveryAgentsCache.java     # live pool port  [exists]
│   └── impl/RedisDeliveryAgentsCacheImpl.java   # replaces in-memory impl
│
├── offer/
│   ├── OfferManager.java            # offers + blacklist + expiry bookkeeping
│   ├── OfferTimeoutSweeper.java     # @Scheduled expiry + pending drain
│   └── impl/
│
├── routing/                         # distance/ETA  [exists]
│   ├── DistanceFinder.java
│   └── impl/ (Haversine @Primary, GraphHopper)
│
├── notification/
│   └── FcmNotifier.java + impl/     # FCM push (outbound port)
│
├── port/                            # the module boundary
│   ├── OrderGateway.java            # OUTBOUND: read pickup/drop, move order status
│   └── (inbound) DeliveryTrigger    # how "order ready" enters the DMS
│
├── event/
│   └── OrderReadyForPickupListener.java   # in-process @EventListener (today)
│
└── model/                           # DTOs/enums  [exists: AgentStatus, DutyStatus, GeoLocation, ...]
    └── (+ OFFERED added to AgentStatus, Offer, AgentCandidate, OfferPayload)
```

---

## 3. The ports

### 3.1 Inbound - how work enters the DMS

The order domain must **not** call DMS classes directly. Instead, after the
`READY_FOR_PICKUP` status is committed, it publishes a domain event:

```java
// published by the order domain, after-commit
public record OrderReadyForPickupEvent(int orderId) {}
```

```java
// in the delivery module
@Component
class OrderReadyForPickupListener {
  private final AssignmentOrchestrator orchestrator;

  @TransactionalEventListener(phase = AFTER_COMMIT)   // only after the status is durably saved
  public void on(OrderReadyForPickupEvent e) {
    orchestrator.attemptAssign(e.orderId());
  }
}
```

> **Why `AFTER_COMMIT`:** the DMS must never start matching for an order whose `READY_FOR_PICKUP`
> write later rolls back. Publishing after commit guarantees the trigger reflects committed truth.
> The publish point is `OrderServiceImpl.updateStatus(...)` (or `OrderStatusMutatorImpl`) - emit the
> event when `to == READY_FOR_PICKUP`.

### 3.2 Outbound - how the DMS reads/writes the order world

```java
public interface OrderGateway {
  /** Pickup (store) + drop (customer address) coordinates for an order. */
  OrderLocations locations(int orderId);

  /** Order detail needed to build an offer payload (store name, drop area, payout, item count). */
  OfferContext offerContext(int orderId);

  /** Move READY_FOR_PICKUP → AGENT_ASSIGNED, set deliveryAgent + agentAssignedAt. (SYSTEM authority.) */
  void assign(int orderId, int agentId);

  /** Current status, for guards/idempotency. */
  OrderStatus status(int orderId);
}
```

`OrderGateway`'s **in-process implementation** lives near the order domain (or in an adapter package)
and uses `OrderRepository` / `Store` / `Address` directly. The DMS only sees the interface.

This single interface is the only place the DMS knows about orders. It deliberately hides the order
schema - the DMS never touches `OrderRepository` itself.

---

## 4. Why this maps cleanly to a separate service

| In-process today | Standalone delivery-service tomorrow |
|------------------|--------------------------------------|
| `OrderReadyForPickupEvent` via Spring `@TransactionalEventListener` | Same event published to a **message broker** (Kafka/SQS/Rabbit); DMS consumes it. The order domain becomes a producer; an outbox pattern preserves the after-commit guarantee. |
| `OrderGateway` in-process bean | `OrderGateway` becomes a **REST/gRPC client** to pharma-service's order API. Same interface, new impl. |
| `FcmNotifier` | Unchanged - already self-contained (Firebase only). Moves with the DMS. |
| Redis (`dms:*` keys) | Moves with the DMS as **its own** Redis. Already isolated by the `dms:` namespace. |
| Postgres `orders` / `delivery_agents` | DMS owns `delivery_agents` + its own delivery tables; reads order facts via `OrderGateway`. The agent-assignment write becomes an order-API call. |

Because the agent pool, offers, blacklist, and pending queue are **already** in Redis (not in the
service's heap), the DMS is effectively stateless-in-JVM today - the single biggest prerequisite for
extraction is already satisfied.

---

## 5. What to avoid (anti-patterns that would block extraction)

- Injecting `OrderRepository`, `StoreRepository`, or `Order` JPA entities into DMS classes. Use
  `OrderGateway` + DTOs.
- The order domain importing `AssignmentOrchestrator` / `DeliveryAgentsCache` and calling it
  synchronously inside the status-update transaction. Use the after-commit event.
- Sharing the same Redis keys between DMS and non-DMS code. Keep everything under `dms:`.
- Putting delivery-only columns on the `orders` table beyond the FK + timestamps already there.
  Delivery-specific data belongs in delivery-owned tables.

---

## 6. Migration checklist (when the time comes)

1. Stand up `delivery-service` with its own Redis + the `delivery_agents` table (and any
   delivery-owned tables).
2. Re-implement `OrderGateway` as a REST/gRPC client; add the corresponding order API to
   pharma-service (read locations/context, assign-agent).
3. Replace the Spring event with broker publish (outbox) on the producer side and a consumer in
   delivery-service.
4. Move `delivery.*` packages over as-is; only the two port impls change.
5. Point the agent app + admin portal at the new service's base URL (or route via the gateway).
6. Migrate `delivery_agents` data; cut over.

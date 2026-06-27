# Delivery Management System

This is the home for the **Delivery Management System (DMS)** design - the subsystem that takes
over once a store owner marks an order **`READY_FOR_PICKUP`** and drives it all the way to
**`DELIVERED`**.

The DMS is responsible for two things:

1. **Optimal assignment** - finding the best available delivery agent (an agent who is `IDLE` and
   nearby the pickup store) and offering the order to them.
2. **Lifecycle execution** - driving the order through `AGENT_ASSIGNED → PICKED_UP → DELIVERED`,
   handling rejections, timeouts, re-assignment, and edge cases along the way.

It is modelled on how realtime logistics platforms (Zomato, Swiggy, Rapido, Uber, Ola) solve the
same problem, adapted to our scale and our current monolith.

---

## Where this lives (and where it's going)

For now the DMS lives **inside `pharma-service`** under the package
`com.reptile.pharmacy.delivery`. It is deliberately **modularised** so that it can later be lifted
out into a **standalone delivery-service** with minimal churn. See
[Modularization & Migration](/docs/backend-gateway/delivery-modularization) for the seams that make
this possible.

> **Design principle:** the rest of `pharma-service` talks to the DMS only through a small set of
> **ports** (interfaces) and **events** - never by reaching into delivery internals. The DMS, in
> turn, talks back to the order domain only through an outbound port. Today both sides of those
> ports are in-process method calls; tomorrow they become RPC calls.

---

## Reading order

| #   | Document                                                                              | What it covers                                                                                                               |
| --- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | [`hld.md`](/docs/backend-gateway/delivery-hld)                                        | High-level design: components, responsibilities, end-to-end flow, sequence diagrams                                          |
| 2   | [`order-status-and-state-machines.md`](/docs/backend-gateway/delivery-state-machines) | The new `AGENT_ASSIGNED` order status, the order / offer / agent state machines, and transition ownership                    |
| 3   | [`data-model.md`](/docs/backend-gateway/delivery-data-model)                          | Postgres changes + the full Redis key schema (GEO index, agent state, offers, blacklist, pending queue)                      |
| 4   | [`matching-and-assignment.md`](/docs/backend-gateway/delivery-matching)               | LLD of optimal agent selection: candidate search, scoring, atomic reservation                                                |
| 5   | [`offer-lifecycle-and-scheduler.md`](/docs/backend-gateway/delivery-offer-lifecycle)  | LLD of the offer → accept/reject/timeout machine, per-order blacklist, the timeout sweeper, and the pending-order retry loop |
| 6   | [`notifications-fcm.md`](/docs/backend-gateway/delivery-notifications)                | FCM push design: token management, payloads, delivery reliability                                                            |
| 7   | [`api-contracts.md`](/docs/backend-gateway/delivery-api-contracts)                    | All REST endpoints (agent, admin, customer) with request/response bodies                                                     |
| 8   | [`modularization-and-migration.md`](/docs/backend-gateway/delivery-modularization)    | Package layout, ports, and the playbook to extract a standalone service                                                      |
| 9   | [`edge-cases-and-failure-handling.md`](/docs/backend-gateway/delivery-edge-cases)     | Concurrency, crashes, stale agents, idempotency, and the long tail                                                           |
| 10  | [`assumptions-and-decisions.md`](/docs/backend-gateway/delivery-assumptions)          | Every decision taken (and why), open questions, and tunable parameters                                                       |

---

## Confirmed product decisions

These were explicitly decided before this design was written. They are load-bearing - changing any
of them changes the design.

| Decision                      | Choice                                                                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Assignment model**          | **Offer → accept/reject with a timeout** (Zomato/Swiggy style). System offers the order to the best agent.                                                                                                                            |
| **Offer timeout**             | **5 minutes**, **configurable**. No response = treated as a reject.                                                                                                                                                                   |
| **Reject / timeout handling** | The agent is **blacklisted for that order** so we never re-offer the same order to them. The blacklist is **temporary** and is **evicted when the order is finally accepted** by some other agent (or the order leaves the pipeline). |
| **Realtime channel**          | **FCM push notifications only.** No WebSockets. Agents respond via REST; agent location is reported via REST polling.                                                                                                                 |
| **Live agent pool store**     | **Redis with GEO** (`GEOADD` / `GEOSEARCH`) for the agent pool and matching.                                                                                                                                                          |
| **Order status granularity**  | Add **one** intermediary status - **`AGENT_ASSIGNED`** - between `READY_FOR_PICKUP` and `PICKED_UP`. No finer-grained statuses for now.                                                                                               |

See [`assumptions-and-decisions.md`](/docs/backend-gateway/delivery-assumptions) for the full rationale and the
list of secondary assumptions made within these bounds.

---

## Glossary

| Term                      | Meaning                                                                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agent**                 | A delivery partner (`UserRole.DELIVERY_PARTNER`), persisted as `DeliveryAgent`.                                                                                                                                             |
| **On-duty / Off-duty**    | Whether an agent is currently working. Only **on-duty** agents are in the live pool and eligible for offers.                                                                                                                |
| **IDLE / OFFERED / BUSY** | The agent's live availability. `IDLE` = free, `OFFERED` = reserved for a pending offer, `BUSY` = actively delivering.                                                                                                       |
| **Offer**                 | A time-boxed proposal of one order to one agent. Exactly one active offer per order at a time.                                                                                                                              |
| **Blacklist (per-order)** | The set of agents who have rejected / timed out on a given order and must not be re-offered it.                                                                                                                             |
| **Pending queue**         | Orders that are `READY_FOR_PICKUP` but have no eligible agent right now, awaiting retry.                                                                                                                                    |
| **Pickup location**       | The store's `(lat, lng)` - where the order is collected.                                                                                                                                                                    |
| **Drop location**         | The customer's delivery `Address (latitude, longitude)` - where the order is delivered. Alongside the coordinates we also persist the source **`addressId`** and the consumer's **`userId`** (from the address-book table). |

---

## Address lifecycle guard (why we keep `addressId` + `userId`)

The drop `(lat, lng)` always originates from a saved address-book entry, so for every order we carry its **`addressId`** and the consumer's **`userId`** through the delivery pipeline.

We need these identifiers to **protect addresses that have an in-flight order**:

- When a consumer tries to **update** or **delete** an address through the existing address-book API, that API does **not** read the delivery cache directly. It first **asks DMS** whether the given `addressId` is referenced by any **ongoing / pending order**.
- If DMS reports an active order for that `addressId`, the update/delete is **aborted**: the operation is terminated and an exception is thrown back to the user who attempted the action.
- If DMS reports no active order, the address-book operation proceeds normally.

This keeps a delivery's drop location immutable for the lifetime of the order and prevents an agent from being routed to an address that was changed or removed mid-delivery.

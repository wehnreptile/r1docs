# API Contracts

All DMS endpoints. They follow the existing `pharma-service` conventions: the standard
`Response<T> { success, data, message, errors }` envelope, role enforcement via the
`AuthorizationAnnotations` (`@DeliveryPartnerOnly`, `@AdminOnly`, `@ConsumerOnly`), and the
authenticated user resolved from the JWT (never trusted from the request body).

> **Convention reminder:** the request-body `agentId` in the existing `AgentLocationRequest` is
> ignored for authorization - the acting agent is always derived from the token (as
> `DeliveryServiceImpl.updateAgentLocation` already does via `authenticationFacade`).

---

## 1. Agent APIs (`@DeliveryPartnerOnly`)

### 1.1 Go ON / OFF duty + report location

Already implemented as `POST /delivery/agent/location` (see `DeliveryController`). This is the single
heartbeat + duty endpoint.

**`POST`** `/delivery/agent/location`

```json
{ "latitude": 17.4401, "longitude": 78.3489, "dutyStatus": "ON" }
```

- `dutyStatus: ON` → upsert into the live pool (`GEOADD` + agent hash, status `IDLE` if newly
  joining), record location + `lastReportedTime`.
- `dutyStatus: OFF` → remove from pool; **rejected with 409** if the agent is `BUSY` (mid-delivery) -
  matches the existing `markAgentOffDuty` guard. If `OFFERED`, the pending offer is auto-rejected
  first (see state-machines doc §3).
- Called periodically (~3 min) by the app for location heartbeats with `dutyStatus: ON`.

`200` → empty body. `409` → `"Agent cannot go off-duty while delivering an order."`

### 1.2 Register / refresh FCM token

**`POST`** `/delivery/agent/fcm-token`

```json
{ "token": "fcm-device-token-..." }
```

Stores on `delivery_agents.fcm_token` and mirrors into the agent's Redis hash. `200` → empty.

### 1.3 Respond to an offer

**`POST`** `/delivery/offer/respond`

```json
{ "orderId": 39033, "action": "ACCEPT" }   // action: ACCEPT | REJECT
```

Server validates the offer is still `PENDING` and belongs to this agent (offer doc §3).

| Outcome | HTTP | `message` |
|---------|------|-----------|
| Accepted | `200` | `"Order assigned to you."` |
| Rejected | `200` | `"Offer declined."` |
| Offer already expired / resolved | `409` | `"This order is no longer available."` |
| Offer not addressed to this agent | `403` | `"This offer is not assigned to you."` |

On accept, the order moves `READY_FOR_PICKUP → AGENT_ASSIGNED` and the per-order blacklist is evicted.

### 1.4 Fetch my current active work (reconciliation / missed-push recovery)

**`GET`** `/delivery/agent/me/active`

Returns the agent's current pending offer **or** active assignment, so the app can self-heal after a
missed FCM push or a cold start.

```json
{
  "success": true,
  "data": {
    "kind": "OFFER",                 // OFFER | ASSIGNMENT | NONE
    "orderId": 39033,
    "expiresAt": 1750930000,         // present for OFFER
    "status": "AGENT_ASSIGNED",      // present for ASSIGNMENT
    "pickup": { "storeName": "...", "address": "...", "lat": 17.44, "lng": 78.35 },
    "drop":   { "area": "...", "lat": 17.46, "lng": 78.36 }
  },
  "message": null, "errors": []
}
```

### 1.5 Advance the order (pickup / deliver)

Reuses the **existing** `POST /order/status/update` with role `DELIVERY_PARTNER`:

```json
{ "orderId": 39033, "from": "AGENT_ASSIGNED", "to": "PICKED_UP" }
```
```json
{ "orderId": 39033, "from": "PICKED_UP", "to": "DELIVERED" }
```

The mutator additionally verifies the acting agent **is** `order.deliveryAgent` (state-machines doc
§1.4). On `DELIVERED`, the orchestrator frees the agent (`BUSY→IDLE`) so they re-enter matching. No
new endpoint needed.

---

## 2. Admin APIs (`@AdminOnly`)

### 2.1 List agents in the live pool

**`GET`** `/delivery/agents?status=IDLE|BUSY|OFFERED` *(status optional → all)*

```json
{
  "success": true,
  "data": [
    { "agentId": 302, "name": "Ravi", "contact": "+91...", "status": "IDLE",
      "location": { "lat": 17.44, "lng": 78.35 }, "lastReportedTime": 1750929820,
      "currentOrderId": null }
  ],
  "message": null, "errors": []
}
```

### 2.2 List orders awaiting an agent

**`GET`** `/delivery/orders/awaiting`

Returns orders in `READY_FOR_PICKUP` (incl. those in the pending queue and those with a live offer),
with how long they've been waiting and whether they've breached the escalation threshold.

### 2.3 Recommend agents for an order

**`GET`** `/delivery/orders/{orderId}/recommendations?limit=5`

Returns up to 5 nearest IDLE agents (excluding the order's blacklist), sorted by distance ascending -
the `AgentMatcher.rankedCandidates` engine (matching doc §7).

```json
{
  "success": true,
  "data": [
    { "agentId": 302, "distanceMeters": 1150, "score": 87, "location": { "lat": 17.44, "lng": 78.35 } },
    { "agentId": 318, "distanceMeters": 2240, "score": 75, "location": { "lat": 17.45, "lng": 78.36 } }
  ],
  "message": null, "errors": []
}
```

### 2.4 Manually assign an order to an agent

**`POST`** `/delivery/orders/{orderId}/assign`

```json
{ "agentId": 302 }
```

Bypasses the offer flow: CAS-reserves the agent `IDLE→BUSY`, sets order `→AGENT_ASSIGNED`, pushes
`ASSIGNMENT_CONFIRMED`. Used as the escape hatch for escalated/pending orders.

| Outcome | HTTP | `message` |
|---------|------|-----------|
| Assigned | `200` | `"Order assigned."` |
| Agent not IDLE | `409` | `"Selected agent is no longer available."` |
| Order not in an assignable state | `409` | `"Order cannot be assigned in its current status."` |

---

## 3. Customer APIs (`@ConsumerOnly`)

### 3.1 Track an order

**`GET`** `/order/{orderId}/track`

Returns the order status + (once `AGENT_ASSIGNED`) the agent's last-known location for live tracking
via **polling** (no WebSocket). Only the order's owner may call it.

```json
{
  "success": true,
  "data": {
    "orderId": 39033,
    "status": "PICKED_UP",
    "agent": { "name": "Ravi", "contact": "+91...", "location": { "lat": 17.45, "lng": 78.36 },
               "lastReportedTime": 1750929950 },
    "timeline": {
      "readyForPickupAt": 1750929000,
      "agentAssignedAt": 1750929200,
      "pickedUpAt": 1750929700,
      "deliveredAt": null
    }
  },
  "message": null, "errors": []
}
```

Before `AGENT_ASSIGNED`, `agent` is `null`. Agent location is read from `dms:agent:{id}` (the same
heartbeat the agent already reports), so no extra plumbing.

---

## 4. Endpoint summary

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| POST | `/delivery/agent/location` | Agent | Duty ON/OFF + location heartbeat *(exists)* |
| POST | `/delivery/agent/fcm-token` | Agent | Register/refresh push token |
| POST | `/delivery/offer/respond` | Agent | Accept/reject an offer |
| GET | `/delivery/agent/me/active` | Agent | Current offer/assignment (reconcile) |
| POST | `/order/status/update` | Agent | `AGENT_ASSIGNED→PICKED_UP→DELIVERED` *(exists)* |
| GET | `/delivery/agents` | Admin | List live pool |
| GET | `/delivery/orders/awaiting` | Admin | Orders waiting for an agent |
| GET | `/delivery/orders/{id}/recommendations` | Admin | Top-N nearest idle agents |
| POST | `/delivery/orders/{id}/assign` | Admin | Manual assignment |
| GET | `/order/{id}/track` | Customer | Poll status + agent location |

# Admin Delivery APIs (`@AdminOnly`)

Same conventions as the DMS API Contracts doc apply here: the `Response<T> { success, data, message,
errors }` envelope, `@AdminOnly` enforcement, and the acting admin resolved from the JWT.

This doc covers three admin-only delivery endpoints, complementing the agent-management and
order-assignment endpoints already defined in the main API Contracts doc.

---

### 1. List ongoing orders near a location

**`GET`** `/delivery/orders`

Returns all active (inflight) orders placed from stores within a given radius of a point, optionally
filtered by status. Used by admins to get a geographic view of in-progress deliveries — e.g. to spot
a cluster of stuck orders in a region.

**Query params**

| Param | Type | Required | Notes |
|---|---|---|---|
| `latitude` | `Double` | yes | Center point latitude |
| `longitude` | `Double` | yes | Center point longitude |
| `radiusKm` | `Double` | no (default `10.0`) | Search radius in km |
| `status` | `OrderStatus` | yes | Filters to a single order status (e.g. `READY_FOR_PICKUP`, `AGENT_ASSIGNED`, `PICKED_UP`) |

```json
{
  "success": true,
  "data": [
    {
      "orderId": 39033,
      "storeDetails": {
        "id": 12,
        "name": "...",
        "location": { "lat": 17.44, "lng": 78.35 }
      },
      "consumerDetails": {
        "userId": 501,
        "name": "...",
        "location": { "lat": 17.46, "lng": 78.36 }
      },
      "orderStatus": "PICKED_UP",
      "agentDetails": {
        "agentId": 302,
        "name": "Ravi",
        "status": "BUSY",
        "contactNo": "+91...",
        "lastReportedLocation": { "lat": 17.45, "lng": 78.36 },
        "lastReportedTime": 1750929950,
        "isEligibleForceMap": false
      }
    }
  ],
  "message": "success", "errors": []
}
```

> `agentDetails` is `null` for orders still in `READY_FOR_PICKUP` (no agent assigned yet). When
> present, `isEligibleForceMap` is computed against *this* order's §3 conditions — see §2 for how
> that differs from the unscoped `/agents/active` listing.

`200` → list (possibly empty) of matching orders. No agent, so no 404/409 case — an empty radius
match just returns `[]`.

---

### 2. List currently active agents

**`GET`** `/delivery/agents/active`

Returns all agents currently in the live pool (i.e. on duty — `IDLE`, `BUSY`, or `OFFERED`), regardless
of status.
 

```json
{
  "success": true,
  "data": [
    {
      "agentId": 302,
      "name": "Ravi",
      "status": "IDLE",
      "contactNo": "+91...",
      "lastReportedLocation": { "lat": 17.44, "lng": 78.35 },
      "lastReportedTime": 1750929820,
      "isEligibleForceMap": true
    }
  ],
  "message": "success", "errors": []
}
```

`200` → list of active agents (empty array if none on duty).

> `isEligibleForceMap` evaluates the §3 eligibility criteria against whatever context is available
> at the calling endpoint. Here, there's no order in scope, so only the order-agnostic condition
> applies — agent on duty and `IDLE`. When `AgentDetails` is embedded inside an `AdminOrderView`
> (§1), all three §3 conditions are evaluated against that specific order — agent `IDLE`, order
> `READY_FOR_PICKUP`, and distance ≤10 km to that order's store.

---

### 3. Force-map an agent to an order

**`POST`** `/delivery/orders/{orderId}/map/{agentId}`

Manual override that bypasses the normal offer/recommendation flow entirely and directly assigns a
specific agent to a specific order, with eligibility checked server-side rather than trusting the
admin's pick blindly.

**Path params:** `orderId` (`int`), `agentId` (`int`). No request body.

**Eligibility criteria** (validated server-side before mapping):

1. Agent must be **on duty and `IDLE`** — not `OFF_DUTY`, `BUSY`, or `OFFERED`.
2. Order must be in status **`READY_FOR_PICKUP`**.
3. Distance between the agent's last-reported location and the order's store must be **≤ 10 km**.

If all three pass: agent is reserved `IDLE → BUSY` (CAS), order moves
`READY_FOR_PICKUP → AGENT_ASSIGNED`, and the assignment-confirmed push is sent to the agent.

| Outcome | HTTP | `message` |
|---|---|---|
| Mapped successfully | `200` | — (empty body) |
| Agent off-duty / busy / already offered | `409` | `"Selected agent is not available (off-duty, busy, or already offered)."` |
| Order not `READY_FOR_PICKUP` | `409` | `"Order cannot be force-mapped in its current status."` |
| Agent farther than 10 km from store | `409` | `"Selected agent is too far from the store for this order."` |
| Order or agent doesn't exist | `404` | `"Order or agent not found."` |

> Each `409` case returns a `message` specific to the condition that failed (as above), rather than
> one generic conflict message — so the admin UI can surface *why* the mapping was rejected.

---

## Endpoint summary

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| GET | `/delivery/orders` | Admin | Ongoing orders near a location, filtered by status |
| GET | `/delivery/agents/active` | Admin | List all on-duty agents (unfiltered) |
| POST | `/delivery/orders/{orderId}/map/{agentId}` | Admin | Force-map agent to order (path params, with eligibility checks) |
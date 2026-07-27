# Admin Delivery APIs (`@AdminOnly`)

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
| `latitude` | `Double` | yes | Center point latitude. Missing → `400`. |
| `longitude` | `Double` | yes | Center point longitude. Missing → `400`. |
| `radius` | `Double` | no (default `5000`) | Search radius in **meters**. Upper limit `50000`; values above are rejected with `400`. |
| `orderStatus` | `OrderStatus` | yes | Must be one of `ORDER_PLACED`, `ORDER_ACCEPTED`, `ORDER_READY_FOR_PICKUP`, `AGENT_ASSIGNED`, `PICKED_UP`. Any other value → `400`. |

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
  "message": "Fetched orders successfully within 5000 meters radius from given location",
  "errors": []
}
```

> `agentDetails` is `null` for orders still in `ORDER_READY_FOR_PICKUP` (no agent assigned yet). When
> present, `isEligibleForceMap` is computed against *this* order's §3 conditions — see §2 for how
> that differs from the region-scoped `/agents/active` listing.

`200` → list (possibly empty) of matching orders. No agent, so no 404/409 case — an empty radius
match just returns `[]`. Missing/invalid `latitude`, `longitude`, `orderStatus`, or an out-of-range
`radius` → `400`.

---

### 2. List currently active agents near a location

**`GET`** `/delivery/agents/active`

Returns agents currently in the live pool (i.e. on duty — `IDLE`, `BUSY`, or `OFFERED`) that fall
within a given radius of a point, so the admin sees only agents relevant to the region in view.

**Query params**

| Param | Type | Required | Notes |
|---|---|---|---|
| `latitude` | `Double` | yes | Center point latitude. Missing → `400`. |
| `longitude` | `Double` | yes | Center point longitude. Missing → `400`. |
| `radius` | `Double` | no (default `5000`) | Search radius in **meters**. Upper limit `50000`; values above are rejected with `400`. |

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
  "message": "Fetched agents successfully within 5000 meters radius from given location",
  "errors": []
}
```

`200` → list of active agents within the region (empty array if none). Missing `latitude`/`longitude`
or an out-of-range `radius` → `400`.

> `isEligibleForceMap` evaluates the §3 eligibility criteria against whatever context is available
> at the calling endpoint. Here, there's no order in scope, so only the order-agnostic condition
> applies — agent on duty and `IDLE` or `OFFERED`. When `AgentDetails` is embedded inside an
> `AdminOrderView` (§1), all three §3 conditions are evaluated against that specific order — agent
> `IDLE` or `OFFERED`, order `ORDER_READY_FOR_PICKUP`, and distance ≤10 km to that order's store.

---

### 3. Force-map an agent to an order

**`POST`** `/delivery/orders/{orderId}/map/{agentId}`

Manual override that bypasses the normal offer/recommendation flow entirely and directly assigns a
specific agent to a specific order, with eligibility checked server-side rather than trusting the
admin's pick blindly.

**Path params:** `orderId` (`int`), `agentId` (`int`). No request body.

**Eligibility criteria** (validated server-side before mapping):

1. Agent must be **on duty** and either `IDLE` or `OFFERED` — not `OFF_DUTY` or `BUSY`.
2. Order must be in status **`ORDER_READY_FOR_PICKUP`**.
3. Distance between the agent's last-reported location and the order's store must be **≤ 10 km**.

If all three pass: agent is reserved `IDLE`/`OFFERED → BUSY` (CAS), order moves
`ORDER_READY_FOR_PICKUP → AGENT_ASSIGNED`, and the assignment-confirmed push is sent to the agent.

| Outcome | HTTP | `message` |
|---|---|---|
| Mapped successfully | `200` | — (empty body) |
| Agent off-duty / busy | `409` | `"Selected agent is not available (off-duty or busy)."` |
| Order not `ORDER_READY_FOR_PICKUP` | `409` | `"Order cannot be force-mapped in its current status."` |
| Agent farther than 10 km from store | `409` | `"Selected agent is too far from the store for this order."` |
| Order or agent doesn't exist | `404` | `"Order or agent not found."` |

> Each `409` case returns a `message` specific to the condition that failed (as above), rather than
> one generic conflict message — so the admin UI can surface *why* the mapping was rejected.

---

## Endpoint summary

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| GET | `/delivery/orders` | Admin | Ongoing orders near a location, filtered by status |
| GET | `/delivery/agents/active` | Admin | On-duty agents within a region near a location |
| POST | `/delivery/orders/{orderId}/map/{agentId}` | Admin | Force-map agent to order (path params, with eligibility checks) |

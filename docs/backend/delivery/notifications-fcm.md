# LLD - Realtime Notifications (FCM)

The DMS pushes to the delivery agent's device **only via Firebase Cloud Messaging (FCM)**. There are
**no WebSockets**. Agents respond and report location over plain REST. This document covers token
management, payloads, and - crucially - why correctness does **not** depend on push delivery.

---

## 1. Why FCM-only is safe

A push notification is best-effort: the device may be offline, throttled, or the token stale. The DMS
is designed so a **lost push never breaks an order**:

- The offer has a server-side **5-minute timeout** tracked in Redis (`dms:offers:expiry`). If the
  agent never sees the push, the offer simply **expires and re-offers** to the next agent - identical
  to a rejection.
- The agent app can also **pull** its current offer/assignment via REST on foreground/resume
  (`GET /delivery/agent/me/active`), so a missed push self-heals when the app reopens.
- All state-changing actions (accept, reject, picked-up, delivered) are REST calls. FCM is a
  *wake-up signal*, never the channel of record.

This is exactly why WebSockets aren't needed: the only realtime requirement is "nudge the agent that
something is waiting," and the timeout loop makes even that nudge non-critical.

---

## 2. Token management

| Event | Action |
|-------|--------|
| Agent logs in / app start | App sends device token → `POST /delivery/agent/fcm-token { token }` → stored on `delivery_agents.fcm_token` (+ `fcm_token_updated_at`) and mirrored into `dms:agent:{id}` hash. |
| FCM token refresh (device) | App re-posts the new token; old token overwritten. |
| Goes ON duty | Token is (re)confirmed as part of the duty call so the pool always has a current token. |
| Send fails with `UNREGISTERED` / `INVALID_ARGUMENT` | Token marked invalid; agent flagged; for an in-flight offer, fall through to timeout (re-offer). |

The token lives in **both** Postgres (durable) and the Redis agent hash (hot path) so the notifier
doesn't hit the DB on every send.

---

## 3. Message types

All messages are **data messages** (not notification-only) so the app controls presentation and can
act on them in the background.

### 3.1 `DELIVERY_OFFER` (the important one)

Sent when an order is offered to an agent.

```json
{
  "type": "DELIVERY_OFFER",
  "orderId": "39033",
  "expiresAt": "1750930000",
  "offerTimeoutSeconds": "300",
  "pickup": {
    "storeName": "Apollo Pharmacy, Gachibowli",
    "address": "Plot 12, Gachibowli, Hyderabad",
    "lat": "17.4401",
    "lng": "78.3489"
  },
  "drop": {
    "area": "Kondapur",
    "lat": "17.4615",
    "lng": "78.3640"
  },
  "distanceMeters": "2150",
  "payout": "38.0",
  "itemsCount": "4"
}
```

The app shows an accept/reject sheet with a countdown to `expiresAt`. High-priority delivery
(`android priority: high`) so it surfaces promptly.

### 3.2 `ASSIGNMENT_CONFIRMED`

Sent after the agent's `ACCEPT` is processed - confirms the order is theirs and carries pickup
navigation details. (Also the payload for **admin manual assignment**, where there was no prior
offer.)

### 3.3 `OFFER_CANCELLED`

Sent if an offer is withdrawn before the agent acts - e.g. the order was cancelled/rejected by the
store, or (rare) admin force-reassigned. Lets the app dismiss the offer sheet instead of waiting for
the countdown.

### 3.4 Optional customer-side pushes

Out of scope for v1 mechanics but the same `FcmNotifier` can later push `ORDER_PICKED_UP` /
`OUT_FOR_DELIVERY` / `DELIVERED` to the customer device. Customer live-tracking in v1 is **REST
polling** of the order-tracking endpoint (see [`api-contracts.md`](/docs/backend-gateway/delivery-api-contracts)).

---

## 4. `FcmNotifier` contract

```java
public interface FcmNotifier {
  void sendOffer(AgentCandidate agent, OfferPayload payload);
  void sendAssignmentConfirmed(int agentId, int orderId);
  void sendOfferCancelled(int agentId, int orderId);
}
```

- Backed by the **Firebase Admin SDK** (`firebase-admin`), initialised once from a service-account
  credential (env/secret, not committed). This is a **new dependency** to add to `pom.xml`.
- Sends are **fire-and-forget with logging**; a failed send is logged + metered but does **not** roll
  back the offer (the timeout covers it).
- Calls are made **outside** the per-order Redis lock to avoid holding the lock across a network I/O
  to Google.

---

## 5. Reliability & ordering notes

- **At-least-once, possibly out-of-order.** The app must treat each message idempotently keyed by
  `orderId` + `type`, and always reconcile against `GET /delivery/agent/me/active` on resume.
- **Stale offers.** If a push arrives for an offer that already expired server-side, the app's
  `ACCEPT` will be rejected with `OfferExpiredException` (see offer doc §3) - the app shows "this
  order is no longer available."
- **No silent failures for assignment truth.** The *authoritative* fact that an order is assigned
  lives in Postgres and Redis; FCM only informs. Reconciliation always favours the server state.

---

## 6. Module placement

`FcmNotifier` lives in `com.reptile.pharmacy.delivery.notification`. It is an **outbound port** of the
DMS - when the DMS becomes a separate service, this implementation moves with it unchanged, since it
already depends only on Firebase + the DMS's own payload types, not on anything else in
`pharma-service`.

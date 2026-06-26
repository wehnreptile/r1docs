# Cart Details

This document describes the **cart details** API — the consolidated view a consumer sees when they
open a cart, just before checkout. It returns the cart's line items, the bill summary (including the
delivery fee for the chosen address), the available billing methods, and a flag indicating whether
an order may be placed right now.

## Functional Requirements

- **Single screen payload:** Opening a cart should return everything the cart/checkout screen needs
  in one call — items, pricing, payment options, and order eligibility.
- **Address-aware billing:** The bill must reflect the delivery address the consumer selected, since
  the delivery fee depends on the store-to-address distance.
- **Billing methods:** The response advertises the payment methods on offer. Only **Cash on Delivery
  (COD)** is enabled today, but the set is environment-controlled so new methods can be turned on
  without a client or call-site change.
- **Order placement gate:** The response tells the client whether the consumer can place an order,
  and if not, why — with both a machine-readable code and a human-readable message.

## API: Get Cart Details

### Endpoint

`POST /cart/details`

> **Authorization:** Consumer only.
>
> This was historically `GET /cart/details?storeId=...`. It is now a `POST` so it can carry the
> selected address and cart id in the body.

### Request Body

```json
{
  "storeId": 101,
  "cartId": 39302,
  "userSelectedAddressId": 28392
}
```

| Field                   | Type    | Required | Notes                                              |
| ----------------------- | ------- | -------- | -------------------------------------------------- |
| `storeId`               | integer | Yes      | The store the cart belongs to.                     |
| `cartId`                | integer | Yes      | Must match the user's cart for `storeId`.          |
| `userSelectedAddressId` | integer | Yes      | Delivery address; drives the delivery fee.         |

All three fields are mandatory. A missing field fails validation with `400 Bad Request`.

### Success Response

- **Status Code:** `200 OK`

```json
{
  "success": true,
  "data": {
    "cartId": 39302,
    "storeId": 101,
    "items": [
      {
        "skuId": 390,
        "name": "Dolo 650",
        "quantity": 4,
        "price": 10.0,
        "discount": 5.0,
        "discountedPrice": 9.5,
        "totalPrice": 40.0,
        "totalDicountedPrice": 38.0,
        "inStock": true,
        "maxOrderLimit": 50
      }
    ],
    "billSummary": {
      "itemsTotal": 40.0,
      "discountedItemsTotal": 38.0,
      "totalDiscount": 5.0,
      "platformFee": 0.0,
      "deliveryFee": 24.0,
      "packingFee": 0.0,
      "handlingFee": 0.0,
      "grossOrderValue": 62.0
    },
    "billingMethods": [{ "method": "COD", "label": "Cash on Delivery" }],
    "orderPlacement": {
      "allowed": true,
      "reasonCode": null,
      "reason": null
    }
  },
  "message": null,
  "errors": []
}
```

#### `orderPlacement`

A control flag that tells the client whether the **Place Order** action should be enabled.

| Field        | Type    | Description                                                                 |
| ------------ | ------- | --------------------------------------------------------------------------- |
| `allowed`    | boolean | `true` when the order can be placed. `reasonCode`/`reason` are null.        |
| `reasonCode` | enum    | Machine-readable cause when blocked. One of `STORE_CLOSED`, `STOCK_LIMIT_EXCEEDED`. |
| `reason`     | string  | Human-readable message to display when blocked.                             |

The client should branch on `reasonCode` (not the message text) and surface `reason` to the user.

##### Blocking constraints

1. **`STORE_CLOSED`** — the store is outside its operating window for the current day. Store timings
   are stored as seconds-from-midnight plus an operational-days bitmask. Evaluation is done in
   **IST (Asia/Kolkata)** for now.

   > **TODO / known limitation:** Timezone is hardcoded to IST. Stores may eventually sit in other
   > timezones; the plan is to persist a per-store timezone (or derive it from the store location)
   > and evaluate timings in the store's own zone. Today, a store with **no timing configured** is
   > treated as **open** so a missing setup never blocks ordering.

2. **`STOCK_LIMIT_EXCEEDED`** — any single line item's quantity exceeds `MAX_STOCK_LIMIT` (**50**).
   The limit is **per line item**, not per cart: `60` units of one drug is blocked, but `30 + 30` of
   two different drugs is allowed.

When more than one constraint is violated, `STORE_CLOSED` takes precedence and is reported first.

#### `billingMethods`

The enabled payment methods, in display order. Controlled by the `billing.methods.enabled` property
(a comma-separated list of `BillingMethod` enum names; defaults to `COD`). Unknown names in the
config are ignored so a typo or a not-yet-released method never breaks the cart. Today this list
always contains only COD.

### Error Responses

#### 1. Validation failure

- **Trigger:** Any of `storeId`, `cartId`, or `userSelectedAddressId` is missing/null.
- **Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "cartId cannot be null",
  "data": null,
  "errors": []
}
```

#### 2. Store not found

- **Trigger:** No store exists for `storeId`.
- **Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Store with id 101 not found",
  "data": null,
  "errors": []
}
```

#### 3. No cart for store

- **Trigger:** The user has no cart at the given store.
- **Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "No cart found for this store",
  "data": null,
  "errors": []
}
```

#### 4. Cart / store mismatch

- **Trigger:** A cart exists for the store, but its id does not match the supplied `cartId` (stale or
  tampered request).
- **Status Code:** `400 Bad Request`

```json
{
  "success": false,
  "message": "Cart does not belong to this store",
  "data": null,
  "errors": []
}
```

#### 5. Invalid address

- **Trigger:** `userSelectedAddressId` does not belong to the authenticated user (or doesn't exist).
- **Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Invalid address",
  "data": null,
  "errors": []
}
```

## Edge Cases & Behaviour Notes

| Scenario                                        | Behaviour                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Store has no `storeTiming` configured           | Treated as **open** — `STORE_CLOSED` is not raised (fail-open, by design).                  |
| Overnight store hours (e.g. 22:00 → 02:00)      | Handled — the window is treated as spanning midnight.                                       |
| Store closed **and** an item over the limit     | `STORE_CLOSED` wins; it is reported first.                                                  |
| Item quantity exactly `50`                      | Allowed. The block triggers only on `> 50`.                                                 |
| Address belongs to another user                 | `404 Invalid address` (lookup is scoped to the authenticated user).                         |
| `billing.methods.enabled` contains a typo       | The unknown entry is silently dropped; remaining valid methods are returned.                |
| Empty `billing.methods.enabled`                 | An empty `billingMethods` list is returned (no payment methods on offer).                   |
| Delivery fee                                    | Computed from the store-to-address distance. With no distance it is `null`/omitted.         |

## Related

- The same `CartResponse` shape (now including `billingMethods` and `orderPlacement`) is also
  returned by `PUT /cart/update` and as the stale-cart fallback of `POST /order/create`. In those
  paths there is no selected address, so the delivery fee is not populated.
- See [Order Creation](order-create) for the checkout flow that consumes this view.

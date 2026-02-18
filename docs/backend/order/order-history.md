# In-Depth Guide to the Order History API

This document provides a comprehensive specification for the Order History API, a unified endpoint designed to provide users with access to past and ongoing orders.

## Core Functional Requirements

The primary goal of this API is to serve as a single, powerful interface for all user roles to query the order database. The API must be flexible enough to accommodate the unique needs and permission levels of each user type.

- **Unified Access:** All users, regardless of their role (Consumer, Store Owner, Delivery Agent), will use this same API to retrieve order information.

- **Powerful Filtering and Search:** The API must support robust filtering capabilities. Users must be able to narrow down results by:
  - A specified date range (`timeline`).
  - One or more order statuses (`statuses`).
  - A direct search for a specific `order_id`.

- **Role-Based Data Views:** This is a critical security and privacy feature. The API must tailor the data returned in the response based on the role of the user making the request. The goal is to provide each user with the information necessary for their function, and nothing more.
  - **Store Owner View:** The store owner's primary use case is to monitor the overall business operations. They need to see historical order data for accounting and analytics, and they need to view and act upon ongoing orders to manage their fulfillment workflow.
  - **Delivery Agent View:** The delivery agent is focused on the logistics of pickup and delivery. They require access to past orders for their records and need to see active, ongoing orders to perform their duties. Their view will include specific contact information necessary for delivery coordination.
  - **Consumer View:** The consumer's view is centered on their own orders. They need to be able to look up their order history and view the specific details of any single order they have placed.

- **Pagination:** To ensure performance and prevent overwhelming clients with massive datasets, all responses from this endpoint must be paginated.

## API Endpoint Specification

### Endpoint Definition

- **Method:** `POST`
- **Endpoint:** `/order/history`

### Security and Authorization

Access to this endpoint is strictly controlled. Only authenticated and authorized users can successfully make a request. The user's role, derived from their authentication token, is a critical component for the role-based data shaping.

## Detailed Request Payload Structure

The request body is a JSON object containing filters and pagination settings.

```json
{
  "filters": {
    "statuses": [], // e.g., ["ORDER_PLACED", "ORDER_READY_FOR_PICKUP"]
    "timeline": { "start": "epoch_in_millis", "end": "epoch_in_millis" },
    "searchQuery": "ORDER_ID"
  },
  "pagination": {
    "pageSize": 10,
    "pageNumber": 3
  }
}
```

- **`filters`**: An object containing all the criteria to apply to the search.
  - **`statuses`**: An array of strings representing the `ORDER_STATUS` enums to filter by. If the array is empty, it is assumed no status filter is applied.
  - **`timeline`**: An object specifying the date range for the query. Both `start` and `end` values should be provided as epoch timestamps in milliseconds. If no date filter is required, this object can be set to null. By default, orders are retrieved in reverse chronological order (latest to oldest).
  - **`searchQuery`**: A string used for a direct lookup by `ORDER_ID`. This can be optional ideally used to fetch only one single order details.

- **`pagination`**: An object controlling the paginated response.
  - **`pageSize`**: The number of orders to return per page. A hard limit (e.g., 50) must be enforced on the server to prevent abuse.
  - **`pageNumber`**: The specific page number of the result set to retrieve.

## Detailed Response Payload Structure

The response is a JSON object that includes pagination details and the list of order objects, carefully structured according to the user's role.

```json
{
  "success": true,
  "data": {
    "pagination": {
      "pageSize": 10,
      "pageNumber": 3
    },
    "orders": [
      {
        "orderId": 3902,
        "statusTimelines": { "t0": "epoch_in_millis", "t1": "epoch_in_millis" },
        "orderStatus": "ORDER_STATUS_ENUM",
        "reasonForRejection": "",
        "items": [
          {
            "skuId": 2903,
            "productName": "Vitamin C 1000mg",
            "price": 399,
            "discount": 10,
            "discountedPrice": 322,
            "quantity": 3
          }
        ],
        "priceDetails": {
          "itemsTotal": 3932,
          "overallDiscount": 4,
          "dicountedPrice": 2930,
          "platformFee": 10,
          "deliveryFee": 30,
          "orderValue": "Overall price of the order"
        },
        "contactDetails": {
          "consumerContact": "",
          "agentContact": "",
          "storeOwnerCOntact": ""
        }
      }
    ]
  },
  "errors": [],
  "message": "Order history fetched successfully"
}
```

- **`orders`**: An array of order objects.
  - **`orderId`**: The unique identifier for the order.
  - **`statusTimelines`**: An object that chronicles the entire history of the order's status changes, with keys like `t0`, `t1`, `t2`...`t5` mapping to the corresponding epoch timestamps.
  - **`orderStatus`**: The current status of the order.
  - **`reasonForRejection`**: An optional field. This field will only be populated with a descriptive string if the `orderStatus` is `REJECTED`.
  - **`items`**: An array of objects, each representing an item in the order. **Visibility:** This array is only visible to the **Pharmacy Owner** and the **Consumer**. It is hidden from Delivery Agents to protect business data and simplify their view.
  - **`priceDetails`**: An object containing a breakdown of the order's financial details.
    - `itemsTotal`: The sum of the original, non-discounted prices of all items.
    - `overallDiscount`: The total discount amount. **Visibility:** Visible to **Consumer** and **Store Owner** only.
    - `dicountedPrice`: The final price of the items after all discounts.
    - `platformFee`: Any applicable platform fees. **Visibility:** Visible to **Consumer** only.
    - `deliveryFee`: The fee for delivery. **Visibility:** Visible to the **Delivery Agent** and **Consumer**.
    - `orderValue`: The final, total cost of the order for the consumer.
  - **`contactDetails`**: An object containing contact information, with strict visibility rules.
    - `consumerContact`: The consumer's contact number. **Visibility:** **Delivery Agent** only.
    - `agentContact`: The delivery agent's contact number. **Visibility:** **Consumer** only.
    - `storeOwnerCOntact`: The store owner's contact number. **Visibility:** **Delivery Agent** only.

# Order Creation Flow

This document outlines the process and requirements for creating a new order within the system.

## Functional Requirements

The order creation and management system must support the following capabilities:

- **Consumer Order Placement:** Consumers must be able to place orders directly from the application.
- **Store Notification:** When an order is placed, the relevant store owner must be notified.
- **Order Management for Store Owners:** Store owners need the ability to view and manage all incoming and ongoing orders.
- **Automated Agent Assignment:** The system should automatically assign orders that are ready for delivery to available delivery agents.
- **Status Updates:** All parties involved in an order (consumer, store owner, delivery agent) should be able to update the order's status as it progresses through the fulfillment workflow.
- **Order Details for Consumers:** Consumers must be able to view the detailed information for any of their individual orders.
- **Consumer Order History:** Consumers need to be able to access their past orders within a specified date range, with pagination for large result sets.
- **Advanced Order Filtering for Store Owners:** Store owners require the ability to filter and search for orders based on their status, a time range, or a specific Order ID, with pagination.
- **Delivery Agent Order History:** Delivery agents must be able to view a history of their completed and in-progress deliveries for a given date range, with a clear distinction for ongoing orders.

## System Logic for Order Placement

When a consumer initiates an order, the following steps and validations occur:

1.  **Input from Consumer:** The consumer submits their `cartId` and the `addressId` for delivery. The request also includes the item details (SKU, quantity, and price) as displayed to them in the app.

2.  **Price and Availability Volatility:** The system must account for potential changes in price or stock availability that can occur between the time the consumer views the items and when they place the order.
    - _Example Scenario:_ A consumer adds a chocolate bar for ₹10 and a cookie for ₹12 to their cart. By the time they check out, the cookie's price might have dropped to ₹11. The system must handle this discrepancy.

3.  **Validation:**
    - The system first validates the existence and validity of the provided `cartId` and `addressId`.
    - It then cross-references the prices and quantities of the items in the cart against the current master product data.

4.  **Order Creation:** If all validations pass, a new `Order` entity is created in the system.

## Data Models

The following data structures are used in the order creation process:

### Cart and Address

```java
// Represents an item within the shopping cart
public class CartItem {
    int cartItemId;
    int skuId;      // Stock Keeping Unit identifier
    int quantity;   // Must be greater than 0
    float price;    // Price per item as shown to the user
    float discount;
    float discountedPrice;
}

// Represents the user's shopping cart
public class Cart {
    int cartId;
    List<CartItem> cartItems;
}

// Represents a delivery address
class Address {
    int addressId;
}
```

### Order

```java
// Represents a completed order
public class Order {
    int id;
    List<OrderItem> orderItems;
    int addressId;
    OrderStatus orderStatus;
    int userId;
    int storeId;
    float price;           // Sum of all orderItem prices
    float discount;        // The overall discount applied to the order
    float discountedPrice; // The final price after discount
    // A timeline of all status changes should be maintained
}

// Represents an individual item within an order
public class OrderItem {
    int id;
    int skuId;
    int quantity;
    float price;           // e.g., 35
    float discount;        // e.g., 10%
    float discountedPrice; // e.g., 31.5
}
```

_Calculation Example:_

```
Item 1: Dolo 650 (4 units) @ ₹10/unit, 5% discount => ₹38
Item 2: Citrizine (2 units) @ ₹3/unit, 0% discount => ₹6

Total Price: ₹46
Total Discounted Price: ₹44
```

## API: Create Order

### Endpoint

`POST /order/create`

### Request Body

```json
{
  "cartId": 39302,
  "addressId": 28392,
  "cartItems": [
    {
      "skuId": 390,
      "quantity": 3,
      "pricePerItem": 10,
      "discount": 10,
      "discountedPrice": 27,
      "maxOrderLimit": 10
    },
    {
      "skuId": 400,
      "quantity": 2,
      "pricePerItem": 20,
      "discount": 10,
      "discountedPrice": 36,
      "maxOrderLimit": 5
    }
  ],
  "platformFee": 15,
  "deliveryAgentFee": 15,
  "totalPrice": 63,
  "orderValue": 93
}
```

**Note:** The client application should perform a preliminary check to ensure that the `quantity` for each item does not exceed the `maxOrderLimit` _before_ calling this API endpoint.

### Success Response

- **Status Code:** `201 Created`

```json
{
  "success": true,
  "data": {
    "orderId": 32939
  },
  "message": "Your order placed successfully.",
  "errors": []
}
```

### Error Responses

#### 1. Invalid Cart or Address

- **Trigger:** The provided `cartId` or `addressId` does not exist or is invalid.
- **Status Code:** `404 Not Found`

```json
{
  "success": false,
  "message": "Cart or AddressId not found.",
  "data": null,
  "errors": []
}
```

#### 2. Price or Availability Mismatch

- **Trigger:** The price, discount, or availability (`maxOrderLimit`) of one or more items has changed since they were added to the cart.
- **Response:** The API returns the updated item details. The client application is expected to display this new information to the user for confirmation before retrying the order placement.

```json
{
  "success": false,
  "message": "One or more items have been updated.",
  "data": {
    "cartId": 39302,
    "addressId": 28392,
    "cartItems": [
      {
        "skuId": 390,
        "quantity": 3,
        "pricePerItem": 10, // Price might be updated
        "discount": 10,
        "discountedPrice": 27,
        "maxOrderLimit": 3 // Availability has changed
      },
      {
        "skuId": 400,
        "quantity": 5, // User requested quantity
        "pricePerItem": 20,
        "discount": 10,
        "discountedPrice": 36,
        "maxOrderLimit": 3, // Current limit
        "message": "A maximum of 3 units can be ordered."
      }
    ],
    "platformFee": 15,
    "deliveryAgentFee": 15,
    "totalPrice": 63,
    "orderValue": 93
  },
  "errors": []
}
```

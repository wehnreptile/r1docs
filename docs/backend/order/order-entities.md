# 📖 Order Lifecycle and Entity Designs

This document outlines the lifecycle of an order within the platform, including entity designs for addressing, cart management, and the final order/delivery flow.

---

## 🛒 Cart Management Flow

Every time a user intends to purchase products from our platform, they first add items to a **Cart** before placing the order.

### **Limit Constraint**

- A cart can hold multiple products, each with a specified quantity.
- The quantity for each item is constrained by a maximum limit.
- **MVP Scope:** For the initial release, this limit is determined by the product's available stock at the selected store. The server will enforce this stock-based restriction during cart validation.
- **Order Value Limit:** Initially, an order value limit of **(50,000)** is enforced. If the user's cart value exceeds this `limit_order_value`, the user will not be allowed to place the order.

### **Entity Designs**

### Address Book

| Property        | Example Value            | Description                                              |
| :-------------- | :----------------------- | :------------------------------------------------------- |
| `id`            | 101                      | Unique identifier.                                       |
| `userId`        | 3839                     | User ID associated with the address.                     |
| `addressLine1`  | #42, Sunshine Apartments | First line of the delivery address.                      |
| `addressLine2`  | Near City Mall           | Second line of the delivery address (optional landmark). |
| `latitude`      | 28.2                     | Geographical latitude of the address.                    |
| `longitude`     | 23.2                     | Geographical longitude of the address.                   |
| `isSelf`        | true                     | Boolean indicating if the address is created for user.   |
| `receiverName`  | Aravind S.               | Name of the person receiving the delivery.               |
| `receiverPhone` | +91 9876543210           | Contact phone number for delivery.                       |
| `isDefault`     | true                     | Flag indicating if this is the user's default address.   |
| `type`          | HOME                     | Categorization of the address (e.g., HOME, WORK).        |
| `label`         |                          | Optional custom label for the address.                   |
| `createdAt`     | 2025-11-20T10:30:00Z     | Timestamp of address creation.                           |
| `updatedAt`     | 2025-11-20T10:30:00Z     | Timestamp of the last update to the address.             |

### Cart

| Property    | Example Value                                      | Description                         |
| :---------- | :------------------------------------------------- | :---------------------------------- |
| `cartId`    | Unique identifier , one user can have many cardIds | Unique identifier for the cart.     |
| `userId`    | 3839                                               | User ID of the cart owner.          |
| `storeId`   | 3833                                               | Store ID associated with the cart.  |
| `createdAt` | Timestamp of first product added to cart           | Timestamp of the cart creation.     |
| `updatedAt` | Timestamp of recent edit to the cart               | Timestamp of the last modification. |

### CartItem

| Property     | Example Value     | Description                                           |
| :----------- | :---------------- | :---------------------------------------------------- |
| `cartId`     | FK to Cart        | Foreign Key linking to the `Cart` table.              |
| `cartItemId` | Unique identifier | Unique identifier for this line item within the cart. |
| `skuId`      | 3903              | Stock Keeping Unit ID of the product added.           |
| `quantity`   | 2                 | Number of units of the SKU in the cart.               |

---

## 🛍️ Order Lifecycle and Entity Designs

Once a cart is finalized and the order value limit is met, the cart contents are converted into an **Order**.

### **Order Status Lifecycle**

The standard order process moves through the following mandatory stages:

1.  **ORDER_PLACED:** (Initiated by the End Consumer)
2.  **ORDER_ACCEPTED:** (Actioned By the Pharmacy Owner)
3.  **ORDER_READY_FOR_PICKUP:** (Actioned By the Pharmacy Owner)
4.  **ORDER_PICKED_UP:** (Actioned By Delivery Agent)
5.  **ORDER_DELIVERED:** (Actioned By Delivery Agent)

**Rejection Path:**

- **ORDER_REJECTED:** (Actioned By the Pharmacy Owner)

### **Entity Design: Order**

| Property             | Example Value                                                                               | Description                                                                                           |
| :------------------- | :------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------- |
| `orderId`            | 193                                                                                         | Unique identifier for the order.                                                                      |
| `userId`             | 393                                                                                         | User ID who placed the order.                                                                         |
| `storeId`            | Store from which the order is being placed                                                  | Store ID fulfilling the order.                                                                        |
| `deliveryPartnerId`  | (FK)Integer mapped to an agentId can be null as well                                        | Foreign Key mapping to the assigned delivery agent.                                                   |
| `price`              | Total price paid by the user for this order                                                 | Final total price after all discounts and charges.                                                    |
| `discount`           | Overall order's discount percentage                                                         | Total discount applied to the entire order (Original price can be calculated using this and `price`). |
| `status`             | The status of the order                                                                     | Current state of the order (e.g., ORDER_PLACED, ORDER_DELIVERED).                                     |
| `platformCharge`     | 0                                                                                           | Fees charged by the platform.                                                                         |
| `gst`                | GST price                                                                                   | Goods and Services Tax amount applied to the order.                                                   |
| `deliveryPartnerFee` | 393                                                                                         | Fee charged by the delivery partner.                                                                  |
| `deliveryAddressId`  | Address id of the delivery                                                                  | Foreign Key mapping to the specific address used for delivery.                                        |
| `rejectionReason`    | A reason of why the store owner rejected the order , this can be displayed to the customer. | Reason provided if the store rejects the order.                                                       |

#### **Status History (Timestamps)**

| Property | Description                                                                                                       |
| :------- | :---------------------------------------------------------------------------------------------------------------- |
| `t0`     | The timestamp at which user placed the order. (Maps to **ORDER_PLACED**)                                          |
| `t1`     | The timestamp at which store owner accepted/rejected the order. (Maps to **ORDER_ACCEPTED** / **ORDER_REJECTED**) |
| `t2`     | The timestamp at which store owner marked the order as ready for pickup. (Maps to **ORDER_READY_FOR_PICKUP**)     |
| `t3`     | The timestamp at which delivery agent is assigned to this order. (Agent mapping timestamp)                        |
| `t4`     | The timestamp at which the delivery agent picked up the order. (Maps to **ORDER_PICKED_UP**)                      |
| `t5`     | The timestamp at which agent delivered the order. (Maps to **ORDER_DELIVERED**)                                   |

### **Entity Design: Order Item**

| Property      | Example Value                        | Description                                                              |
| :------------ | :----------------------------------- | :----------------------------------------------------------------------- |
| `orderItemId` | Unique identifier for this line item | Unique identifier for the individual product line item within the order. |
| `orderId`     | FK to Orders table                   | Foreign Key linking to the parent `Order` table.                         |
| `skuId`       | 283                                  | Stock Keeping Unit ID of the purchased product.                          |
| `productId`   | 232                                  | Product ID of the purchased product.                                     |
| `quantity`    | 3                                    | Number of units purchased.                                               |
| `price`       | 383                                  | Unit price of the item at the time of purchase.                          |
| `discount`    | Discount percentage                  | Discount percentage applied to this specific item.                       |

## Requirements

- A CONSUMER can place the order from the app.
- Placed order should be notified to corresponding store owner.
- Store owner can view/act on all ongoing orders.
- Orders which are in ready state can be assigned by the system to available agents.
- Individual parties can mutate the status of the order as required.
- CONSUMER can view an individual order's detail.
- CONSUMER can view order history for a selected date range with pagination.
- STORE_OWNER can view all orders filtered on the basis of ORDER_STATUS, TIME_RANGE and by ORDER_ID with pagination.
- Delivery agent can view all the orders delivered / on flight with a specified date range. ( on going orders needs to be displayed in a specific pattern ).

### Overiew of entities

```java
public class CartItem {
    int cartItemId;
    int skuId;
    int quantity; // > 0
    // What user sees.
    float price;
    float discount;
    float discountedPrice;
}

public class Cart {
    int cartId;
    List<CartItem> cartItems;
}

class Address {
    int addressId;
}
```

- Whenever user places an order , user sends cartId and price details that user was seeing on the app.
- Chocolate(3) - 10Rs. Cookie (5) : 12Rs => By the we place the order the price of the items might change : Chocoloate - 10Rs, Cookie: 11Rs
- By the time the user places the order: Chocolate (2) - 10Rs, Cookie (5) - 11Rs.
- Validate the requested addressId & cartId.
- When everything is fine then place order ?

```java
public class Order {
    int id;
    List<OrderItem> orderItems;
    int addressId;
    OrderStatus orderStatus;
    int userId;
    int storeId;
    float price; // sum of all individual prices
    float discount; // overall discount
    float discountedPrice; // Overall discounted price
    // timeline of all the statuses
}

public class OrderItem {
    int id;
    int skuId;
    int quantity;
    float price; // 35
    float discount; // 10%
    float discountedPrice; //  35 - 3.5 = 31.5
}

/*
Dolo 650 * 4 = 10Rs * 4 = 40Rs , disocunt - 5% => dicountedPrice = 38Rs
Citrizine * 2 = 3Rs * 2 = 6Rs , discount = 0%, => discountedPrice = 6Rs

total discount: (46 - 44 ) / 46 * 100 = 200 / 46
total price:  40 + 6 = 46Rs
total discounted price = 38 + 6 = 44Rs
*/
```

## API For placing the Order.

### Request

Endpoint: /order/create

```json
{
  "cartId": 39302, // Contains the userId & storeId
  "addressId": 28392,
  "cartItems": [
    // What user sees on the app.
    {
      "skuId": 390,
      "quantity": 3,
      "pricePerItem": 10,
      "discount": 10,
      "discountedPrice": 27,
      "maxOrderLimit": 10 // Upper limit to order a this item. => for instance it's the available stock in the pharmacy.
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
  "totalPrice": 63, // 27 + 36
  "orderValue": 93
}
```

### Response (Success)

`statuscode: 201`

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

### Error responses ()

- Since user can delete a cart or an address . First check is if both the cartId & delivery address Id are valid or not.

`statusCode: 404`

```json
{
  "success": false,
  "message": "Cart / AddressId are not present", // "Cart is invalid" / "Invalid address"
  "data": null,
  "errors": []
}
```

- When the prices are not matching with the sent items prices then throw an exception along with sending the updated details.

```json
{
  "success": false,
  "message": "One or more items price is updated", // "One or more items are unavailable"
  "data": {
    // Update price details of individual items => Similar data type that we receive to the server.
    "cartId": 39302, // Contains the userId & storeId
    "addressId": 28392,
    "cartItems": [
      {
        "skuId": 390,
        "quantity": 3,
        "pricePerItem": 10,
        "discount": 10,
        "discountedPrice": 27,
        "maxOrderLimit": 3
      },
      {
        "skuId": 390,
        "quantity": 5,
        "pricePerItem": 10,
        "discount": 10,
        "discountedPrice": 27,
        "maxOrderLimit": 3,
        "message": "Maximum ${3} can be ordered" // "Out of stock"
        // While placing the order client should handle this error. Loop through every cart item and check if it's quantity is less than the maxOrderLimit or not. IF all the items quantities are <= maxOrderLimit then only call the /order/create API.
      }
    ],
    "platformFee": 15,
    "deliveryAgentFee": 15,
    "totalPrice": 63, // 27 + 36
    "orderValue": 93,
    "maxOrderLimit": 10
  },
  "error": []
}
```

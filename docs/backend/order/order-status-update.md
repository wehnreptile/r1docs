# Comprehensive Guide to Order Status Updates

This document provides a detailed explanation of the order status update mechanism, including the standard workflow, specific requirements, and the technical implementation of the status mutation API.

## Standard Order Workflow

The lifecycle of an order progresses through a series of mandatory stages. Each stage represents a specific point in the fulfillment process and is triggered by a designated actor.

1.  **`ORDER_PLACED`:** This is the initial state of any order, initiated by the end consumer upon successful checkout.
2.  **`ORDER_ACCEPTED`:** The pharmacy owner reviews the placed order and, upon confirming they can fulfill it, accepts the order, transitioning it to this state.
3.  **`ORDER_READY_FOR_PICKUP`:** Once the pharmacy owner has prepared and packaged the order, they update the status to indicate it is ready for collection by a delivery agent.
4.  **`ORDER_PICKED_UP`:** A delivery agent actions this status change when they collect the prepared order from the pharmacy.
5.  **`ORDER_DELIVERED`:** The final successful state, actioned by the delivery agent upon handing the order over to the consumer.
6.  **`ORDER_REJECTED`:** If the pharmacy owner is unable to fulfill the order, they can reject it, moving it to this terminal state.

## System and API Requirements

- **Primary Requirement:** A robust API must be developed to handle all order status updates.
- **Consumer Permissions:** Consumers are explicitly prohibited from directly updating an order's status. Their role is to initiate the order, and the subsequent status changes are handled by other actors.
- **Address Update Constraint:** A critical validation must be implemented within the address update API. If a user attempts to update or delete a delivery address while an active order is associated with it, the system must prevent this change. An exception should be thrown with a clear message, such as: "You can only update the address after the current order is delivered."

## Status Transition Rules and Logic

The transition between order statuses is strictly controlled to ensure process integrity.

- **`ORDER_PLACED` -> `ORDER_ACCEPTED` / `ORDER_REJECTED`:** This is a valid status transition. Only a user with the 'store owner' role has the authority to perform this action.
- **`ORDER_REJECTED` -> Any other status:** This is an invalid transition. Once an order is rejected, it is considered a terminal state. Any attempt to change it should result in an error, and a specific HTTP status code should be decided for this case.
- **`ORDER_ACCEPTED` -> `ORDER_READY_FOR_PICKUP`:** This is a valid status change, and it can only be performed by the 'store owner'.
- **`ORDER_READY_FOR_PICKUP` -> `ORDER_PICKED_UP`:** This is a valid transition, which can only be executed by a 'delivery agent'.
- **`ORDER_PICKED_UP` -> `ORDER_DELIVERED`:** This is a valid final transition in the success path, and only the 'delivery agent' can perform it.

To enforce these rules, a central logic component, as described by the following interface, should be implemented:

```java
/**
 * Defines the contract for validating order status mutations.
 */
interface OrderStatusMutator {
    /**
     * This method checks if a requested status transition is valid based on the
     * current status, the new status, and the role of the user making the request.
     *
     * @param old The current OrderStatus of the order.
     * @param new The target OrderStatus for the update.
     * @param role The UserRole of the actor attempting the mutation.
     * @throws InvalidStatusMutation if the transition from 'old' to 'new' is not a permissible step in the workflow.
     * @throws AccessDeniedException if the 'role' does not have the necessary permissions for this specific status change.
     */
    void canMutateStatus(OrderStatus old, OrderStatus new, UserRole role)
        throws InvalidStatusMutation, AccessDeniedException;
}
```

## API Endpoint: Order Status Update

### Endpoint Definition

**`PUT`** `order/status/update`

The user's role, which is critical for validating permissions, will be extracted from their authentication token.

### Request Body Structure

The request body must include the order ID and the status transition details.

```json
{
  "orderId": 39033,
  "from": "ORDER_STATUS", // The current status of the order, as perceived by the user.
  "to": "ORDER_STATUS_NEW" // The target status to which the user is attempting to update.
}
```

### API Responses

#### Order Not Found (HTTP 404)

Returned if the provided `orderId` does not correspond to any existing order.

```json
{
  "success": false,
  "data": null,
  "message": "Order is not found.",
  "errors": []
}
```

#### Invalid Transitions or Insufficient Permissions

- For an `InvalidStatusMutation` error, the HTTP status code should be **400 (Bad Request)**.
- For an `AccessDeniedException` error, the HTTP status code should be **403 (Forbidden)**.

The response body will be:

```json
{
  "success": false,
  "data": null,
  "message": "Invalid status mutation.", // Or for access denial: "You don't have permissions to do this change."
  "errors": []
}
```

#### Successful Update (HTTP 200 OK)

Returned upon successful validation and persistence of the status change.

```json
{
  "success": true,
  "data": null,
  "message": "Order status updated.",
  "errors": []
}
```

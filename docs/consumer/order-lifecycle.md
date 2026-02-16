# Order Lifecycle

Orders transition through several states to ensure consistency between the consumer and delivery apps.

## States
- **PENDING**: Initial state upon creation.
- **ACCEPTED**: Restaurant has confirmed the order.
- **PREPARING**: Food is being made.
- **READY_FOR_PICKUP**: Courier can now collect.
- **PICKED_UP**: Courier has the items.
- **DELIVERED**: Final successful state.

> [!IMPORTANT]
> A transition to 'CANCELLED' is only possible before the 'PREPARING' state.
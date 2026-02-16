# Real-time Tracking (WebSocket)

We use Socket.io to stream GPS coordinates from the delivery partner's device to the backend.

## Implementation
- Update interval: Every 5 seconds when moving.
- Accuracy: High (GPS).
- Battery optimization: Throttled to 30 seconds when stationary.

```typescript
socket.emit('location_update', {
  lat: coords.latitude,
  lng: coords.longitude,
  orderId: currentOrderId
});
```
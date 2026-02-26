## Overview

- All APIs related to addressbook (create, update & delete) can be accessed **only by CONSUMER users**.
- All endpoints return responses in a **standardized response format**.
- After every create, update, or delete operation, the API response will return the **latest list of addresses currently stored on the server** for the authenticated user.
- The `data` field always reflects the **most up-to-date address state** immediately after the operation is completed.

Base Path: `/address`  
Authentication: Required (Consumer access only)  
Content-Type: `application/json`  
Response Format: JSON

---

# Common Response Structure

All API responses follow the structure below:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {},
  "errors": []
}
```

## Fields

| Field   | Type                  | Description                                  |
| ------- | --------------------- | -------------------------------------------- |
| success | boolean               | Indicates whether the request was successful |
| message | string                | Human-readable message                       |
| data    | object / array / null | Actual response payload                      |
| errors  | string[]              | List of validation or business errors        |

---

# Data Models

## AddressRequest

- This is the request payload used for createing or updating an address.

```json
{
  "id": 123, // This field will be set only for update request for create this can be null.
  "addressLine1": "123 Main St",
  "addressLine2": "Apt 4B",
  "latitude": 17.385,
  "longitude": 78.4867,
  "receiverName": "John Doe", // Optional, set only if it's for someone else.
  "receiverPhone": "+1-555-555-5555", // Optional , set only it's for someone else
  "isDefault": true, // Set this to true only when user wants to mark it as default address.
  "type": "HOME", // An enum representing address type : HOME, WORK, OTHER
  "label": "My Home" // A label to be displayed when selected OTHER as address type.
}
```

### Validation Rules

| Field         | Required    | Rules                                                                                                                  |
| ------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| id            | No          | Must be provided for update requests. Must be a valid existing address ID. Should be null/omitted for create requests. |
| addressLine1  | Yes         | Non-empty, max 255 characters.                                                                                         |
| addressLine2  | No          | Max 255 characters.                                                                                                    |
| latitude      | Yes         | Must be a valid decimal number between -90 and 90.                                                                     |
| longitude     | Yes         | Must be a valid decimal number between -180 and 180.                                                                   |
| receiverName  | No          | Max 100 characters. Required only if address is for someone else.                                                      |
| receiverPhone | No          | Must be a valid phone number format. Required only if address is for someone else.                                     |
| isDefault     | No          | Boolean. Only one address can be marked as default per user.                                                           |
| type          | Yes         | Must be one of: `HOME`, `WORK`, `OTHER`.                                                                               |
| label         | Conditional | Required if `type = OTHER`. Max 100 characters. Ignored for `HOME` or `WORK`.                                          |

---

## AddressResponse

```json
{
  "id": 123,
  "addressLine1": "123 Main St",
  "addressLine2": "Apt 4B",
  "latitude": 17.385,
  "longitude": 78.4867,
  "receiverName": "John Doe",
  "receiverPhone": "+91-9876543210",
  "isDefault": true,
  "type": "HOME",
  "label": "My Home"
}
```

### Field Definitions

| Field         | Type    | Description                                            |
| ------------- | ------- | ------------------------------------------------------ |
| id            | integer | Unique address identifier.                             |
| addressLine1  | string  | Primary address line.                                  |
| addressLine2  | string  | Secondary address details (optional).                  |
| latitude      | number  | Latitude coordinate of the address location.           |
| longitude     | number  | Longitude coordinate of the address location.          |
| receiverName  | string  | Name of the person receiving the delivery (optional).  |
| receiverPhone | string  | Phone number of the receiver (optional).               |
| isDefault     | boolean | Indicates if this is the default address.              |
| type          | string  | Address type. Allowed values: `HOME`, `WORK`, `OTHER`. |
| label         | string  | Custom label (required when type is `OTHER`).          |

---

# Endpoints

---

# 1. Add / Update Address

### POST `/address/update`

Creates a new address or updates an existing one.

## Request Body

```json
{
  "id": 2738, // This is mandatory for updating the address.
  "addressLine1": "Flat 502, Sri Sai Residency, Road No. 12",
  "addressLine2": "Banjara Hills",
  "latitude": 17.412627,
  "longitude": 78.448288,
  "receiverName": null,
  "receiverPhone": null,
  "isDefault": true,
  "type": "HOME",
  "label": null
}
```

### Rules

- If `id` is present → update existing address.
- If `id` is absent → create new address.
- All required fields must be provided.

---

## Success Response

### 200 OK

```json
{
  "success": true,
  "message": "Address updated successfully",
  "data": [
    // contains all the latest addresses mapped to the requested user.
    {
      "id": 123,
      "addressLine1": "123 Main St",
      "addressLine2": "Apt 4B",
      "latitude": 17.385,
      "longitude": 78.4867,
      "receiverName": "John Doe",
      "receiverPhone": "+91-9876543210",
      "isDefault": true,
      "type": "HOME",
      "label": "My Home"
    }
  ],
  "errors": []
}
```

---

## Error Responses

### 400 Bad Request (Validation Failure)

```json
{
  "success": false,
  "message": "Validation failed",
  "data": null,
  "errors": ["street must not be empty", "zip format is invalid"]
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "message": "Unauthorized",
  "data": null,
  "errors": []
}
```

### 403 Forbidden

```json
{
  "success": false,
  "message": "Access denied",
  "data": null,
  "errors": []
}
```

### 404 Not Found

```json
{
  "success": false,
  "message": "Address not found",
  "data": null,
  "errors": []
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Internal server error",
  "data": null,
  "errors": []
}
```

---

# 2. Delete Address

### POST `/address/delete`

Deletes an existing address.

## Query Parameters

| Name      | Type   | Required |
| --------- | ------ | -------- |
| addressId | number | Yes      |

Example:

```
POST /address/delete?addressId=123
```

---

## Success Response

### 200 OK

```json
{
  "success": true,
  "message": "Address deleted successfully",
  "data": [
    // All the latest addresses stored on backend after deletion.
    {
      "id": 123,
      "addressLine1": "123 Main St",
      "addressLine2": "Apt 4B",
      "latitude": 17.385,
      "longitude": 78.4867,
      "receiverName": "John Doe",
      "receiverPhone": "+91-9876543210",
      "isDefault": true,
      "type": "HOME",
      "label": "My Home"
    }
  ],
  "errors": []
}
```

---

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "message": "addressId is required",
  "data": null,
  "errors": []
}
```

### 404 Not Found

```json
{
  "success": false,
  "message": "Address not found",
  "data": null,
  "errors": []
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "message": "Unauthorized",
  "data": null,
  "errors": []
}
```

### 403 Forbidden

```json
{
  "success": false,
  "message": "Access denied",
  "data": null,
  "errors": []
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Internal server error",
  "data": null,
  "errors": []
}
```

---

# 3. Get All Addresses

### GET `/address/all`

Returns all addresses for the authenticated user.

---

## Success Response

### 200 OK

```json
{
  "success": true,
  "message": "Addresses fetched successfully",
  "data": [
    // All addresses stored on the backend.
    {
      "id": 123,
      "addressLine1": "123 Main St",
      "addressLine2": "Apt 4B",
      "latitude": 17.385,
      "longitude": 78.4867,
      "receiverName": "John Doe",
      "receiverPhone": "+91-9876543210",
      "isDefault": true,
      "type": "HOME",
      "label": "My Home"
    }
  ],
  "errors": []
}
```

---

## Error Responses

### 401 Unauthorized

```json
{
  "success": false,
  "message": "Unauthorized",
  "data": null,
  "errors": []
}
```

### 403 Forbidden

```json
{
  "success": false,
  "message": "Access denied",
  "data": null,
  "errors": []
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Internal server error",
  "data": null,
  "errors": []
}
```

---

# HTTP Status Code Summary

| Status Code | Meaning                            |
| ----------- | ---------------------------------- |
| 200         | Successful request                 |
| 400         | Validation or bad input            |
| 401         | Authentication required or invalid |
| 403         | Access denied                      |
| 404         | Resource not found                 |
| 500         | Unexpected server error            |

---

# Notes

- All requests must include valid authentication headers i.e Authorization token , these APIs work only for the CONSUMER users.
- All responses follow the standardized response format.
- `data` is `null` in case of failure.
- `errors` contains validation details when applicable.

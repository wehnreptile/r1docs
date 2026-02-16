# Feature: User Authentication via Phone Number

This document outlines the user registration and sign-in process using a phone number and a One-Time Password (OTP).

## User Interface (UI) and User Experience (UX)

### Phone Number Input Screen

- **Input Field:** A dedicated field for phone number entry, with a country code selector (defaulting to India).
- **Button:** A button with the text `Send One-Time Password`.

When the user clicks the `Send One-Time Password` button, the application should make a network call to the `auth/send-otp` endpoint and display a loading indicator.

### User Journeys

There are two possible user journeys depending on the response from the `auth/send-otp` endpoint:

#### New User Registration

- If the API returns a `404 Not Found` status, it indicates that the user is new.
- The application should navigate to a registration screen.
- The registration screen should display the user's phone number (`Registration for +91 928392948290`).
- The screen should include input fields for `userName`, `email`, and `password`, with validation based on the `AuthController.java` file in the `pharma-service` repository.
- A button with the text `Register & Send OTP` should trigger a call to the `auth/send-otp` endpoint with all the registration details.

#### Existing User Login

- If the API returns a `200 OK` status, it indicates that the user is an existing user and an OTP has been sent.
- The application should navigate to an OTP input screen.
- The OTP screen should feature a 6-digit OTP input component.
- It should also include a button to resend the OTP after one minute (`Didn't receive OTP yet? Resend OTP`).
- A `Verify OTP` button should trigger a call to the `auth/verify-otp` endpoint.

## API Endpoints

### Send OTP

- **Action:** `POST`
- **URL:** `/auth/send-otp`
- **Headers:**
  - `Content-Type: application/json`
- **Request Body:**

  ```json
  {
    "phoneNumber": "+1234567890",
    "email": "", // Optional: for new user registration
    "password": "", // Optional: for new user registration
    "userName": "" // Optional: for new user registration
  }
  ```

- **Success Response (200 OK):**

  ```json
  {
    "success": true,
    "message": "OTP has been sent successfully.",
    "data": null
  }
  ```

- **Error Response (404 Not Found):**

  ```json
  {
    "success": false,
    "message": "User not found with the given phone number.",
    "data": null
  }
  ```

- **Error Response (400 Bad Request):**

  ```json
  {
    "success": false,
    "message": "Invalid request payload.",
    "data": null
  }
  ```

### Verify OTP

- **Action:** `POST`
- **URL:** `/auth/verify-otp`
- **Headers:**
  - `Content-Type: application/json`
- **Request Body:**

  ```json
  {
    "phoneNumber": "+1234567890",
    "otp": "6-digit OTP"
  }
  ```

- **Success Response (200 OK):**
  - **Response Header:**
    ```json
    {
      "Set-Cookie": "accessToken:<jwt>"
    }
    ```
  - **Response Body:**
    ```json
    {
      "success": true,
      "message": "OTP verified successfully.",
      "data": null
    }
    ```

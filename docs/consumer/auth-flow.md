# Consumer App Authentication

We use Firebase Auth coupled with our custom backend JWT validation.

## Login Sequence
1. User enters phone number.
2. OTP is sent via SMS.
3. App validates OTP with Firebase.
4. App sends Firebase token to `/v1/auth/exchange`.
5. Backend returns long-lived refresh token and short-lived access token.

```javascript
async function login(phoneNumber) {
  const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
  // wait for user input...
}
```
# Existing Account Recovery Design

## Goal

Recover cleanly when Create account is submitted for an email that already exists, instead of leaving the user in a failed signup state.

## Behavior

When `/auth/signup` returns HTTP 409 with `Account already exists.`, Mark-AR switches the shared form to Sign in and immediately retries the submitted email/password against `/auth/login`.

- Active account with the correct password: sign in normally and unlock Image Targets.
- Pending account: remain signed out and show the Worker's approval-required message.
- Wrong password: remain in Sign in mode and show the Worker's invalid-credentials message.
- Any other signup error: remain in Create account mode and show the original error.

The email and password are reused only for this user-initiated recovery request. The password is cleared after a successful login.

## Architecture

- Replace generic auth response errors with a typed `AuthRequestError` that preserves the HTTP status.
- Export a type guard/helper so `main.ts` can detect status 409 without matching error text.
- Extract the existing sign-in sequence into one function used by both normal Sign in and 409 recovery.
- Keep pending-account and protected-route logic unchanged.

## Testing

- Test that a 409 signup error preserves status and message.
- Test the existing-account predicate separately from other errors.
- Test normal signup and login behavior for regressions.
- Run the full suite/build and browser-check the 409 recovery using a mocked Worker response path rather than creating another live account.

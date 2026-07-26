# Signup Password Minimum Design

## Goal

Use eight characters as the minimum password length for account creation in both the browser UI and the Worker API.

## Current mismatch

The account form accepts passwords with at least eight characters, while the Worker rejects signup passwords shorter than twelve characters. Passwords containing eight through eleven characters therefore pass browser validation but fail at the API.

## Design

- Keep the browser form minimum at eight characters.
- Change Worker signup validation to reject only passwords shorter than eight characters.
- Change the Worker validation error to state that passwords must contain at least eight characters.
- Leave sign-in behavior, password storage, hashing, sessions, and all other authentication rules unchanged.
- Do not introduce a shared browser/Worker constant; the focused validation change avoids unnecessary cross-runtime coupling.

## Verification

- A Worker signup request with a seven-character password returns HTTP 400 and the eight-character validation message.
- A Worker signup request with an eight-character password passes password-length validation.
- Existing UI tests continue to require `minLength` 8.
- The focused authentication tests, complete test suite, app build, and Worker dry-run all pass.

# Account Creation Design

## Goal

Add a clear account-creation option to the existing Account page without weakening the signed-in-only Image Targets boundary.

## UX

The signed-out Account panel has two modes: **Sign in** and **Create account**. A compact mode switch selects one mode at a time while reusing the email and password controls.

- Sign in shows Email and Password with one primary **Sign in** action.
- Create account additionally shows a required Name field, uses `autocomplete="new-password"`, requires at least eight password characters, and shows one primary **Create account** action.
- Switching modes never shows both primary actions together.

After a normal signup, the Worker returns a pending user without a token. The UI switches to Sign in, preserves the normalized email, clears the password, and explains that administrator approval is required before sign in. If the Worker returns an active user with a token, the app signs in immediately and unlocks Image Targets.

## Architecture

- Extend `webArAuth.ts` with a typed signup client that mirrors the existing Web-AR Worker `/auth/signup` contract.
- Add a focused form-mode UI helper that owns field visibility, autocomplete, selected tabs, headings, and submit-button copy.
- Keep `main.ts` responsible for the async signup call and for converting a token-bearing signup into the existing signed-in state.
- Keep the existing `AuthUiState` and protected-route logic unchanged.

## Error Handling

- Worker validation and duplicate-account errors stay in Create account mode and remain visible in the shared status area.
- Pending signup is success, not an error, but does not unlock Image Targets.
- Password validation is enforced in the browser and by the Worker.
- Email is normalized by the client before it is sent.

## Testing

- Test the `/auth/signup` request payload, normalization, pending response, and token-bearing response.
- DOM-test mutually exclusive login/signup fields, copy, autocomplete, and selected state.
- Regression-test Account shell structure and the signed-in-only target guard.
- Run focused tests, the full Vitest suite, the production build, and desktop/mobile browser checks.

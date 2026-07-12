# Authenticated Image Targets Design

## Goal

Make authentication states visually unambiguous and allow only a verified signed-in user to open the Image Targets workspace.

## Recommended UX

The application has three authentication states:

1. **Signed out:** The Account page shows the email/password form and one primary **Sign in** action. The Targets navigation and home card show a locked treatment and lead to Account. A direct `#/targets` visit is redirected to Account with an explanation.
2. **Checking session:** A stored token is not treated as authenticated until the Worker session endpoint verifies it. Account controls are disabled and the status says the session is being checked.
3. **Signed in:** The login form is hidden. The Account page shows the verified email, an **Image Targets unlocked** status, a primary **Open Image Targets** action, and a visually separate **Sign out** action. Navigation reflects the authenticated identity.

Only one state's controls are visible at a time. Sign in and Sign out never appear as equal adjacent actions.

## Architecture

- Add a small DOM-focused authentication UI module that applies the current state to navigation, account panels, and protected links.
- Add a pure protected-route resolver so direct hash navigation can be tested without booting the full AR application.
- Keep the Worker client as the source of truth for login and session verification.
- Keep token checks on cloud mutations even though the route is guarded.

## Data Flow

1. Initial render starts in `checking` when a stored token exists, otherwise `signed-out`.
2. Stored tokens are verified through the Worker session endpoint.
3. A successful login or session check stores the verified user in UI state and unlocks Targets.
4. A failed or expired session clears the token, returns to `signed-out`, and keeps Targets locked.
5. Sign out clears token and user state. If the user is in Targets, the app navigates to Account.

## Error Handling

- Invalid login errors stay on the signed-out panel and keep the form usable.
- Expired saved sessions are cleared and shown as a signed-out explanation.
- Route protection never relies only on CSS or hidden content.
- Cloud save/delete calls continue to reject missing tokens.

## Testing

- Unit-test route resolution for signed-in and signed-out users.
- DOM-test mutually exclusive Account panels and protected link state.
- Regression-test the rendered shell for distinct signed-out and signed-in containers.
- Run the focused auth tests, full Vitest suite, TypeScript/Vite build, and a browser check of signed-out navigation and Account layout.

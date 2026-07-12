# Authenticated Image Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Mark-AR distinct signed-out, session-checking, and signed-in interfaces while preventing unverified users from opening Image Targets.

**Architecture:** A focused `authUi` module owns DOM state and protected-route resolution. `main.ts` remains responsible for Worker calls and uses that module to keep navigation, session restoration, login, logout, and route activation synchronized.

**Tech Stack:** TypeScript 6, Vite 8, Vitest 4, happy-dom, CSS.

## Global Constraints

- A stored token is not authenticated until `/auth/session` verifies it.
- Sign in and Sign out are never shown as equal adjacent actions.
- Direct `#/targets` navigation must resolve to Account unless a verified user exists.
- Existing token checks on cloud mutations remain in place.
- Preserve the existing teal, white, and grid visual language and responsive behavior.

---

### Task 1: Authentication UI state and route policy

**Files:**
- Create: `src/ui/authUi.ts`
- Create: `tests/authUi.test.ts`

**Interfaces:**
- Consumes: `AppRoute` from `src/ui/pageRoutes.ts`.
- Produces: `AuthUiState`, `applyAuthUi(root, state)`, `isAuthenticated(state)`, and `resolveAccessibleRoute(route, state)`.

- [ ] **Step 1: Write the failing tests**

Test that `targets` resolves to `account` for `signed-out` and `checking`, remains `targets` for `signed-in`, and that applying each state makes exactly its matching `[data-auth-panel]` visible. Assert protected links switch between `#/account` plus `aria-disabled="true"` and their `data-unlocked-href` with the disabled attribute removed.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- tests/authUi.test.ts`

Expected: FAIL because `src/ui/authUi.ts` does not exist.

- [ ] **Step 3: Implement the minimal state module**

Define the discriminated union:

```ts
export type AuthUiState =
  | { status: 'checking'; message: string }
  | { status: 'signed-out'; message: string }
  | { status: 'signed-in'; message: string; email: string };
```

`resolveAccessibleRoute` returns `account` only when `route === 'targets'` and `status !== 'signed-in'`. `applyAuthUi` updates panel visibility, status copy, protected link href/lock state, account navigation label, email text, and access badge.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm.cmd test -- tests/authUi.test.ts`

Expected: PASS with no failures.

### Task 2: Mutually exclusive Account layout and protected links

**Files:**
- Modify: `src/ui/appShell.ts`
- Modify: `src/style.css`
- Modify: `tests/appShell.test.ts`

**Interfaces:**
- Consumes: the `data-auth-*` hooks defined by Task 1.
- Produces: three Account panels, protected Targets links, an access-status panel, and responsive styling.

- [ ] **Step 1: Add failing shell assertions**

Assert that the nav and Image Targets home card have `data-auth-protected` and `data-unlocked-href="#/targets"`; that signed-out, checking, and signed-in panels exist; that only signed-out is visible initially; and that `#worker-logout` lives only inside the signed-in panel.

- [ ] **Step 2: Run the shell test and verify RED**

Run: `npm.cmd test -- tests/appShell.test.ts`

Expected: FAIL on the missing auth panels and protected-link hooks.

- [ ] **Step 3: Implement the account markup and CSS**

Replace the single form card with a two-column `.auth-layout`: a teal access-status context panel and a white control panel. Keep the login form in `[data-auth-panel="signed-out"]`, add a checking panel, and place email, **Open Image Targets**, and **Sign out** inside `[data-auth-panel="signed-in"]`. Stack the columns below 760px, preserve focus visibility, and use existing CSS variables.

- [ ] **Step 4: Run shell and style tests and verify GREEN**

Run: `npm.cmd test -- tests/appShell.test.ts tests/targetPreviewMobileStyles.test.ts tests/targetPreviewDesktopStyles.test.ts`

Expected: PASS with no failures.

### Task 3: Session-driven routing and return-to-Targets flow

**Files:**
- Modify: `src/main.ts`
- Modify: `tests/pageRouter.test.ts`

**Interfaces:**
- Consumes: `applyAuthUi`, `resolveAccessibleRoute`, and `AuthUiState` from Task 1.
- Produces: verified state transitions, guarded hash routing, and automatic return to Targets after a successful login prompted by a blocked Targets visit.

- [ ] **Step 1: Extend the route regression tests**

Cover the route resolver in Task 1 and retain the existing `activateRoute` behavior test so the integration has a stable route activation seam.

- [ ] **Step 2: Run the focused auth/router tests**

Run: `npm.cmd test -- tests/authUi.test.ts tests/pageRouter.test.ts tests/webArAuth.test.ts`

Expected: current pure tests PASS; integration is still absent from `main.ts`.

- [ ] **Step 3: Integrate state transitions in `main.ts`**

Initialize to `checking` only when a token exists. Route all startup and hashchange activation through a guard that records a pending Targets route and replaces blocked hashes with `#/account`. On login success, set `signed-in` and restore the pending route. On login error, restore `signed-out`. On session expiry or logout, clear the token, set `signed-out`, and leave Targets for Account.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm.cmd test -- tests/authUi.test.ts tests/pageRouter.test.ts tests/webArAuth.test.ts tests/appShell.test.ts`

Expected: PASS with no failures.

### Task 4: Full and rendered verification

**Files:**
- Modify only if verification exposes a regression.

- [ ] **Step 1: Run the full automated suite**

Run: `npm.cmd test`

Expected: all Vitest files and tests pass.

- [ ] **Step 2: Run the production build**

Run: `npm.cmd run build`

Expected: TypeScript and Vite finish with exit code 0.

- [ ] **Step 3: Verify the browser states**

Start Vite on `127.0.0.1:5173`, open `#/targets` signed out, and confirm it lands on Account with the lock explanation. Confirm the form has one primary action, the sign-out action is absent, the mobile layout stacks cleanly, and keyboard focus remains visible.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; only the planned source, tests, and docs are changed in addition to pre-existing user files.

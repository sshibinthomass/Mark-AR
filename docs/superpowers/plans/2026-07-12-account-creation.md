# Account Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Create account mode to Mark-AR that uses the existing Web-AR Worker signup endpoint and preserves signed-in-only Image Targets access.

**Architecture:** `webArAuth.ts` gains the typed Worker signup call. A small `authFormMode` module owns the DOM differences between login and signup, while `main.ts` coordinates the async result with the existing authenticated application state.

**Tech Stack:** TypeScript 6, Vite 8, Vitest 4, happy-dom, CSS.

## Global Constraints

- Sign in mode shows only email and password.
- Create account mode shows a required name field and requires at least eight password characters.
- A pending signup must not unlock Image Targets.
- A token-bearing active signup signs in through the existing authenticated state.
- Sign in, Create account, and Sign out are never presented as equal simultaneous primary actions.

---

### Task 1: Worker signup client

**Files:**
- Modify: `src/app/webArAuth.ts`
- Modify: `tests/webArAuth.test.ts`

**Interfaces:**
- Produces: `signupToWebArWorker({ apiUrl, email, password, name, fetchImpl? }): Promise<AuthSession>`.

- [ ] **Step 1: Write the failing signup request test**

Assert that whitespace is trimmed from name and email, email is lowercased, and `POST /auth/signup` receives `{ email, password, name }`. Assert a pending response returns `token: null`.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd test -- tests/webArAuth.test.ts`

Expected: FAIL because `signupToWebArWorker` is not exported.

- [ ] **Step 3: Implement the signup client**

Use the existing `authBaseUrl` and `parseAuthSessionResponse` helpers, send JSON to `/signup`, and omit `name` only when its trimmed value is empty.

- [ ] **Step 4: Verify GREEN**

Run: `npm.cmd test -- tests/webArAuth.test.ts`

Expected: PASS.

### Task 2: Sign-in/create-account form modes

**Files:**
- Create: `src/ui/authFormMode.ts`
- Create: `tests/authFormMode.test.ts`
- Modify: `src/ui/appShell.ts`
- Modify: `src/style.css`
- Modify: `tests/appShell.test.ts`

**Interfaces:**
- Produces: `AuthFormMode = 'login' | 'signup'` and `applyAuthFormMode(root, mode)`.

- [ ] **Step 1: Write failing DOM and shell tests**

Assert login hides/disables Name and uses current-password/Sign in, while signup shows/requires Name and uses new-password/Create account. Assert the shell contains the two mode controls, one shared form, and an initially hidden name field.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd test -- tests/authFormMode.test.ts tests/appShell.test.ts`

Expected: FAIL on the missing module and markup.

- [ ] **Step 3: Implement the form-mode helper and markup**

Add stable `data-auth-form-mode`, `data-auth-mode`, `data-auth-name-field`, and `data-auth-submit-label` hooks. Make the mode switch compact and subordinate to the existing access-status panel.

- [ ] **Step 4: Verify GREEN**

Run: `npm.cmd test -- tests/authFormMode.test.ts tests/appShell.test.ts`

Expected: PASS.

### Task 3: Signup lifecycle integration and verification

**Files:**
- Modify: `src/main.ts`
- Modify: `tests/authFormMode.test.ts`

**Interfaces:**
- Consumes: `signupToWebArWorker`, `applyAuthFormMode`, and the existing `setAuthUiState` flow.

- [ ] **Step 1: Add failing lifecycle assertions**

Test that switching modes preserves shared values, pending signup returns the form to login mode, and the helper supports restoring login mode after success.

- [ ] **Step 2: Integrate mode buttons and form submission**

Track the current mode in `main.ts`. In login mode call login; in signup mode call signup. Pending signup switches back to login, preserves normalized email, clears the password, and shows the approval message. Token-bearing signup uses the same signed-in path as login.

- [ ] **Step 3: Run focused tests**

Run: `npm.cmd test -- tests/webArAuth.test.ts tests/authFormMode.test.ts tests/appShell.test.ts tests/authUi.test.ts tests/authNavigation.test.ts`

Expected: PASS.

- [ ] **Step 4: Run full verification**

Run: `npm.cmd test`, then `npm.cmd run build`, then `git diff --check`.

Expected: all tests pass, build exits 0, and no whitespace errors are reported.

- [ ] **Step 5: Verify rendered behavior**

Open the Account page on desktop and mobile. Confirm mode switching, name visibility, password autocomplete, single primary action, pending-account copy, and no horizontal overflow or console errors.

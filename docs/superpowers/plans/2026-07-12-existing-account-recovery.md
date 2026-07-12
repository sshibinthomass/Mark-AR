# Existing Account Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn signup HTTP 409 into a seamless sign-in attempt with the same user-submitted credentials.

**Architecture:** The auth client preserves HTTP status in a typed error. `main.ts` detects only status 409, switches to login mode, and reuses one sign-in function for both normal and recovery login.

**Tech Stack:** TypeScript 6, Vite 8, Vitest 4, happy-dom.

## Global Constraints

- Detect existing accounts by HTTP status 409, not error-message text.
- Reuse credentials only after the user explicitly submitted Create account.
- Pending accounts remain signed out.
- Non-409 signup errors remain in Create account mode.
- Password is cleared after successful sign in.

---

### Task 1: Typed auth request errors

**Files:**
- Modify: `src/app/webArAuth.ts`
- Modify: `tests/webArAuth.test.ts`

**Interfaces:**
- Produces: `AuthRequestError` with `status: number` and `isAuthRequestError(error, status?)`.

- [ ] Add a failing test that a 409 signup response rejects with message `Account already exists.` and status `409`.
- [ ] Run `npm.cmd test -- tests/webArAuth.test.ts` and verify RED.
- [ ] Replace the generic non-OK error in `parseAuthSessionResponse` with `AuthRequestError` and add the type guard.
- [ ] Rerun the focused test and verify GREEN.

### Task 2: Automatic login recovery

**Files:**
- Modify: `src/main.ts`
- Create: `src/app/authRecovery.ts`
- Create: `tests/authRecovery.test.ts`

**Interfaces:**
- Produces: `shouldRecoverExistingAccount(error): boolean`, delegating to the typed 409 guard.

- [ ] Write failing tests that only typed status 409 returns true; status 400, ordinary errors, and matching text without status return false.
- [ ] Run `npm.cmd test -- tests/authRecovery.test.ts` and verify RED.
- [ ] Implement the predicate.
- [ ] Extract the existing login sequence to `signInToWorker(message?)` in `main.ts`.
- [ ] In signup catch, when the predicate is true, switch to login mode and call `signInToWorker('Account already exists. Signing in…')`; otherwise preserve current signup error behavior.
- [ ] Run `npm.cmd test -- tests/authRecovery.test.ts tests/webArAuth.test.ts tests/authFormMode.test.ts tests/authUi.test.ts` and verify GREEN.

### Task 3: Full verification

- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run build`.
- [ ] Run `git diff --check`.
- [ ] Browser-check 409 recovery using a controlled mocked response; confirm it changes to Sign in and attempts login without creating a live account.

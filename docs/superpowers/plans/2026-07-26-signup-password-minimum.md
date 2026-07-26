# Signup Password Minimum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make eight characters the accepted minimum password length for account creation in both the browser UI and Worker API.

**Architecture:** Keep the existing browser constraint unchanged and align the Worker signup boundary and error message with it. Add Worker-level boundary tests so seven characters fail and exactly eight characters succeed.

**Tech Stack:** TypeScript, Cloudflare Workers, Vitest, Vite, Wrangler

## Global Constraints

- The minimum signup password length is exactly 8 characters.
- Sign-in behavior, password hashing, sessions, and other authentication rules remain unchanged.
- Do not add a shared browser/Worker constant or unrelated authentication refactoring.
- The existing browser `minLength` 8 tests must remain green.

---

### Task 1: Align Worker Signup Validation

**Files:**
- Modify: `tests/worker/targetWorker.test.ts`
- Modify: `worker/src/index.ts:165-175`

**Interfaces:**
- Consumes: `handleRequest(request: Request, env: WorkerEnv): Promise<Response>`
- Produces: Worker signup validation accepting passwords with length `>= 8` and rejecting passwords with length `< 8`.

- [ ] **Step 1: Write the failing boundary tests**

In `tests/worker/targetWorker.test.ts`, change the existing successful local signup password to exactly eight characters:

```ts
password: '12345678',
```

Add this rejection test beside the successful local signup test:

```ts
it('rejects local signup passwords shorter than eight characters', async () => {
  const bucket = new MemoryBucket();
  const env = createEnv(bucket);
  const response = await handleRequest(new Request('https://worker.example/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'short-password@example.com',
      password: '1234567',
      name: 'Short password',
    }),
  }), env);

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({
    error: 'Name, a valid email, and a password of at least 8 characters are required.',
  });
});
```

- [ ] **Step 2: Run the Worker test and confirm the red state**

Run:

```powershell
npx.cmd vitest run tests/worker/targetWorker.test.ts --maxWorkers=2
```

Expected: the exact-eight-character signup returns HTTP 400, and the rejection test receives the old twelve-character message.

- [ ] **Step 3: Implement the minimal Worker change**

In `worker/src/index.ts`, replace the signup validation with:

```ts
if (!email || password.length < 8 || !name) {
  return json({ error: 'Name, a valid email, and a password of at least 8 characters are required.' }, 400);
}
```

- [ ] **Step 4: Run focused authentication tests**

Run:

```powershell
npx.cmd vitest run tests/worker/targetWorker.test.ts tests/authFormMode.test.ts tests/appShell.test.ts --maxWorkers=2
```

Expected: PASS, including the Worker boundary tests and existing browser `minLength` 8 tests.

- [ ] **Step 5: Verify the Worker build**

Run:

```powershell
npm.cmd run worker:check
```

Expected: TypeScript and Wrangler dry-run pass.

- [ ] **Step 6: Run complete verification**

Run:

```powershell
npx.cmd vitest run --exclude=.worktrees/** --maxWorkers=4
npm.cmd run build
```

Expected: all tests and the production build pass.

- [ ] **Step 7: Commit the fix**

```powershell
git add -- worker/src/index.ts tests/worker/targetWorker.test.ts
git commit -m "fix: align signup password minimum"
```

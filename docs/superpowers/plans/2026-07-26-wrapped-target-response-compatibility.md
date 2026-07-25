# Wrapped Target Response Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Studio saves and scanner loads accept the deployed Worker's `{ target: ... }` response envelope while retaining compatibility with legacy flat target responses.

**Architecture:** Normalize successful single-target JSON responses inside `parseImageTargetResponse`, the shared API boundary used by create, update, and scan. Keep list, delete, Worker persistence, scanner rendering, and UI state logic unchanged.

**Tech Stack:** TypeScript, Fetch API, Vitest, Vite, in-app browser automation

## Global Constraints

- Preserve support for legacy flat single-target responses.
- Preserve existing HTTP error messages and invalid-target validation.
- Do not change the Worker response envelope.
- Do not modify unrelated Studio or scanner behavior.
- Add regression coverage before production code.

---

### Task 1: Normalize Single-Target Responses

**Files:**
- Modify: `tests/cloudImageTargets.test.ts`
- Modify: `src/app/cloudImageTargets.ts:155-190`
- Modify: `src/app/cloudImageTargets.ts:568-579`

**Interfaces:**
- Consumes: `WorkerImageTargetEntry`, `WorkerErrorResponse`, and `mapImageTargetEntry(entry)`.
- Produces: `parseImageTargetResponse(response, fallback): Promise<CloudImageTarget>` accepting either `WorkerImageTargetEntry` or `{ target: WorkerImageTargetEntry }`.

- [ ] **Step 1: Write failing create, update, and scan tests**

Add wrapped response fixtures for the three public operations. Each fixture must contain a valid target under `target`, call the real exported client function, and assert the returned `CloudImageTarget` ID and object content.

```ts
const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
  target: {
    id: 'target-wrapped',
    label: 'Wrapped target',
    image_url: 'https://worker.example/image-targets/images/target-wrapped.png',
    image_object_key: 'image-targets/images/target-wrapped.png',
    objects: [{
      kind: 'youtube',
      id: 'video-1',
      youtube: {
        video_id: 'M7lc1UVf-VE',
        url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
        thumbnail_url: 'https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg',
      },
      placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.1 },
    }],
  },
}), { status: 200 }));
```

- [ ] **Step 2: Write failing invalid-envelope coverage**

Add a successful HTTP response containing `{ target: null }` and assert that the existing message is retained:

```ts
await expect(getImageTargetForScan({
  apiUrl: 'https://worker.example/generate-3d',
  scanId: 'invalid',
  fetchImpl,
})).rejects.toThrow('Worker response did not include an image target.');
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
npm test -- --run tests/cloudImageTargets.test.ts
```

Expected: the wrapped create, update, and scan cases fail with `Worker response did not include an image target.` while the legacy flat tests remain green.

- [ ] **Step 4: Implement the minimal response normalizer**

Extend the response type and normalize before mapping:

```ts
type WorkerSingleImageTargetResponse =
  & WorkerErrorResponse
  & Partial<WorkerImageTargetEntry>
  & { target?: WorkerImageTargetEntry | null };

async function parseImageTargetResponse(
  response: Response,
  fallback: string,
): Promise<CloudImageTarget> {
  const body = (await response.json()) as WorkerSingleImageTargetResponse;
  if (!response.ok) {
    throw new ImageTargetRequestError(
      body.error ?? `${fallback} with HTTP ${response.status}.`,
      response.status,
    );
  }
  const entry = body.target && typeof body.target === 'object' ? body.target : body;
  const target = mapImageTargetEntry(entry);
  if (!target) {
    throw new Error('Worker response did not include an image target.');
  }
  return target;
}
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
npm test -- --run tests/cloudImageTargets.test.ts
```

Expected: all client contract tests pass, including existing flat-response coverage.

- [ ] **Step 6: Commit the parser fix**

```bash
git add src/app/cloudImageTargets.ts tests/cloudImageTargets.test.ts
git commit -m "fix: accept wrapped target responses"
```

---

### Task 2: Verify and Publish

**Files:**
- Verify: all repository tests and production build
- Verify: deployed Studio and scanner through the in-app browser

**Interfaces:**
- Consumes: the fixed frontend bundle and existing deployed Worker.
- Produces: a published `main` build where save and scan no longer show the response-parser error.

- [ ] **Step 1: Run the complete verification matrix**

Run:

```bash
npm test
npm run build
npm audit
git diff --check
```

Expected: all tests pass, the Vite build completes, audit reports zero vulnerabilities, and `git diff --check` is silent.

- [ ] **Step 2: Review the branch diff**

Inspect:

```bash
git diff --stat main...HEAD
git diff main...HEAD -- src/app/cloudImageTargets.ts tests/cloudImageTargets.test.ts
```

Expected: only the approved compatibility normalization and regression coverage affect runtime behavior.

- [ ] **Step 3: Integrate and publish**

Fast-forward `main`, push it, and wait for `.github/workflows/deploy-pages.yml` to complete successfully.

- [ ] **Step 4: Verify Studio save in the in-app browser**

Open the published Studio, use an active signed-in account, create a temporary media target, save it once, and assert that the status reports success rather than `Worker response did not include an image target.`.

- [ ] **Step 5: Verify scanner load in the in-app browser**

Open the temporary target's scan link, assert that the experience loads without the parser error, and verify the Start camera control becomes available when camera permission is not yet granted.

- [ ] **Step 6: Clean up**

Delete the temporary target through the UI, finalize browser tabs, and remove the clean implementation worktree after confirming `main` and `origin/main` contain the fix.

# Media-only Target Save Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Image-only and YouTube-only targets save successfully without losing their object IDs.

**Architecture:** Route the production frontend to the repository-local Mark-AR Worker, which already validates all four supported object kinds and stores image objects in R2. Bind that Worker to the existing asset bucket to preserve stored records, and add a client-boundary regression test that fails if production falls back to the legacy Worker.

**Tech Stack:** TypeScript, Vitest, Vite, Cloudflare Workers, R2, Wrangler, GitHub Actions, GitHub Pages.

## Global Constraints

- Empty targets remain invalid.
- Image-only and YouTube-only targets are valid.
- Save and update responses preserve every submitted object ID.
- Existing R2 records use `web-ar-model-assets`.
- Do not modify or deploy the sibling `Web-AR` repository.

---

### Task 1: Lock the frontend to the media-capable Worker

**Files:**
- Modify: `tests/cloudflareModels.test.ts`
- Modify: `src/app/cloudflareModels.ts`
- Modify: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: `DEFAULT_GENERATE_MODEL_API_URL`
- Produces: production requests to `https://mark-ar-targets.sshibinthomass.workers.dev/generate-3d`

- [ ] **Step 1: Write the failing test**

Add a test that calls `loadCloudflareModelOptions` with an auth token and no
explicit `apiUrl`, then asserts the real client requests:

```ts
https://mark-ar-targets.sshibinthomass.workers.dev/generate-3d/models
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```powershell
npm test -- tests/cloudflareModels.test.ts
```

Expected: FAIL because the request still targets
`web-ar-generate-model.sshibinthomass.workers.dev`.

- [ ] **Step 3: Implement the minimal endpoint change**

Change the fallback API URL in `src/app/cloudflareModels.ts` and set
`VITE_TARGET_API_URL` to the same `/generate-3d` endpoint in the Pages build
environment.

- [ ] **Step 4: Run the test to verify GREEN**

Run:

```powershell
npm test -- tests/cloudflareModels.test.ts tests/cloudImageTargets.test.ts tests/targetPersistence.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add tests/cloudflareModels.test.ts src/app/cloudflareModels.ts .github/workflows/deploy-pages.yml
git commit -m "fix: route target saves to media worker"
```

### Task 2: Configure and validate the production Worker

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `tests/worker/targetWorker.test.ts`

**Interfaces:**
- Consumes: existing `web-ar-model-assets` R2 keys
- Produces: deployed `mark-ar-targets` Worker with `ASSET_BUCKET`

- [ ] **Step 1: Add explicit media-only preservation assertions**

Extend Worker tests so an image-only create and a YouTube-only update assert
HTTP success and the exact submitted IDs in `target.objects`.

- [ ] **Step 2: Run focused Worker tests**

Run:

```powershell
npm test -- tests/worker/targetWorker.test.ts
```

Expected: all tests pass because the local Worker already implements the desired
contract; these assertions protect the deployment target from regression.

- [ ] **Step 3: Configure production resources**

Set:

```json
{
  "PUBLIC_ORIGIN": "https://mark-ar-targets.sshibinthomass.workers.dev",
  "ALLOWED_ORIGINS": "https://sshibinthomass.github.io,http://localhost:5173,http://127.0.0.1:5173"
}
```

Bind `ASSET_BUCKET` to `web-ar-model-assets`.

- [ ] **Step 4: Verify Worker bundle**

Run:

```powershell
npm run worker:check
```

Expected: TypeScript succeeds and Wrangler reports the `web-ar-model-assets`
binding.

- [ ] **Step 5: Commit**

```powershell
git add wrangler.jsonc tests/worker/targetWorker.test.ts
git commit -m "fix: preserve media-only targets"
```

### Task 3: Deploy, publish, and verify

**Files:**
- No source files beyond Tasks 1 and 2.

**Interfaces:**
- Consumes: Cloudflare OAuth session and GitHub authentication
- Produces: live Worker and GitHub Pages release

- [ ] **Step 1: Run complete local verification**

```powershell
npm ci
npm test
$env:GITHUB_PAGES = "true"
npm run build
Remove-Item Env:GITHUB_PAGES
npm run worker:check
```

Expected: all commands exit zero.

- [ ] **Step 2: Create the Worker secret and deploy**

Generate a cryptographically random secret without printing it, pass it to:

```powershell
npx wrangler secret put AUTH_SECRET --name mark-ar-targets
npx wrangler deploy
```

- [ ] **Step 3: Verify the live target lifecycle**

Create a temporary account, create an Image-only target, update it to a
YouTube-only target, verify the same object IDs are returned, then delete the
temporary target.

- [ ] **Step 4: Merge and push**

Merge the verified branch into `main` and push `main` to `origin`.

- [ ] **Step 5: Verify GitHub Pages**

Wait for `deploy-pages.yml`, then verify the Pages URL and its hashed JavaScript
asset return HTTP 200 and that the asset contains the `mark-ar-targets` origin.

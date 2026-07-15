# Target-Specific Scan Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every saved cloud image target one stable URL that starts an isolated camera session and is authorized by one of four owner-selected access modes.

**Architecture:** The Web-AR Worker persists opaque scan IDs, access modes, and normalized email allowlists, then authorizes a dedicated single-target scan endpoint. Mark-AR parses `#/scan/<scan_id>`, retains that full route through authentication, fetches one authorized target, and starts MindAR with exactly that target. Focused access and routing helpers keep validation out of the existing large `main.ts` coordinator.

**Tech Stack:** TypeScript 6, Cloudflare Worker/R2, Vite 8, Vitest 4, Three.js, MindAR, hash routing, browser Clipboard and MediaDevices APIs.

## Global Constraints

- Access modes are exactly `anyone_with_link`, `any_signed_in`, `owner_only`, and `specific_accounts`.
- New and legacy-private targets default to `owner_only`.
- Target-specific URLs use `#/scan/<scan_id>` and compile exactly one cloud target with target index `0`.
- Sharing grants scan access only; existing owner/admin management rules remain unchanged.
- Email matching is case-insensitive after trimming, lowercasing, validation, and deduplication.
- Permission changes do not rotate the stable opaque scan ID.
- Existing `#/scan` behavior remains unchanged.
- Preserve the current unrelated loopback-CORS edits in `D:/Github-Projects/Web-AR/worker/src/index.ts` and `D:/Github-Projects/Web-AR/tests/worker/generateModelWorker.test.ts`.
- Preserve the current unrelated target-model-loader edits in `D:/Github-Projects/Mark-AR/src/main.ts`, `src/style.css`, `src/ui/modelRail.ts`, and their tests.
- Do not add runtime dependencies.

---

## File Structure

### Web-AR

- Modify `D:/Github-Projects/Web-AR/worker/src/index.ts`: persist access metadata, backfill scan IDs, validate updates, and authorize the focused scan endpoint.
- Modify `D:/Github-Projects/Web-AR/tests/worker/generateModelWorker.test.ts`: prove persistence, migration, and all authorization outcomes.

### Mark-AR

- Create `src/app/imageTargetAccess.ts`: access-mode types, default state, email normalization, and validation.
- Create `tests/imageTargetAccess.test.ts`: focused access helper coverage.
- Modify `src/app/cloudImageTargets.ts`: wire access fields and implement `getImageTargetForScan`.
- Modify `tests/cloudImageTargets.test.ts`: request and mapping coverage.
- Modify `src/ui/pageRoutes.ts`: parse and generate target-specific scan locations.
- Modify `tests/pageRoutes.test.ts`: target-specific hash coverage.
- Modify `src/ui/authNavigation.ts`: remember and restore an exact hash after authentication.
- Modify `tests/authNavigation.test.ts`: exact scan-hash restoration coverage.
- Modify `src/ui/appShell.ts`: render access controls and scan-state copy.
- Modify `src/ui/savedTargetList.ts`: render per-target URL, Copy link, and Open scanner.
- Modify `tests/savedTargetList.test.ts`: link rendering and callback coverage.
- Modify `src/app/targetPersistence.ts`: include access metadata in save acknowledgement checks.
- Modify `tests/targetPersistence.test.ts`: reject lossy access responses.
- Modify `src/ar/markerTargets.ts`: expose an explicit one-target runtime helper.
- Modify `tests/markerTargets.test.ts`: prove isolation and index zero.
- Modify `src/main.ts`: coordinate editor state, save/load, route/auth handling, focused fetch, and automatic camera start.
- Modify `src/style.css`: style access controls and saved-link actions without disturbing loader styles.
- Create `tests/targetSpecificScan.test.ts`: integration coverage for auto-start, authorization errors, and no fallback.

---

### Task 1: Persist Target Access Metadata in the Worker

**Files:**
- Modify: `D:/Github-Projects/Web-AR/tests/worker/generateModelWorker.test.ts:2055-2188`
- Modify: `D:/Github-Projects/Web-AR/worker/src/index.ts:281-309,1385-1460,1561-1604,3124-3179`

**Interfaces:**
- Produces: `type ImageTargetAccessMode = 'anyone_with_link' | 'any_signed_in' | 'owner_only' | 'specific_accounts'`.
- Produces: `scan_id?: string`, `access_mode?: ImageTargetAccessMode`, and `allowed_emails?: string[]` on stored legacy-compatible entries.
- Produces: `normalizeImageTargetAccess(input, ownerEmail, fallback)` returning `{ accessMode, allowedEmails } | { error }`.
- Produces: new targets with a stable `crypto.randomUUID()` scan ID.

- [ ] **Step 1: Write failing create, update, and legacy-normalization tests**

Add these assertions to the private-target creation test and a new specific-account update test:

```ts
expect(body).toMatchObject({
  scan_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
  access_mode: 'owner_only',
  allowed_emails: [],
});

expect(sharedBody).toMatchObject({
  access_mode: 'specific_accounts',
  allowed_emails: ['friend@example.com', 'second@example.com'],
});
expect(updatedBody.scan_id).toBe(originalBody.scan_id);
```

Also assert that `specific_accounts` with no valid non-owner email returns `400`, invalid modes return `400`, and a legacy private entry normalizes to `owner_only`.

- [ ] **Step 2: Run the focused Worker test and confirm RED**

Run from `D:/Github-Projects/Web-AR`:

```powershell
npm.cmd test -- tests/worker/generateModelWorker.test.ts
```

Expected: FAIL because the response lacks `scan_id`, `access_mode`, and `allowed_emails`.

- [ ] **Step 3: Implement minimal access persistence and validation**

Add the concrete record fields and helpers:

```ts
type ImageTargetAccessMode = 'anyone_with_link' | 'any_signed_in' | 'owner_only' | 'specific_accounts';

type ImageTargetEntry = {
  id: string;
  label: string;
  image_url: string;
  image_object_key: string;
  objects: ImageTargetObject[];
  groups: ImageTargetGroup[];
  owner_email?: string;
  visibility?: ImageTargetVisibility;
  scan_id?: string;
  access_mode?: ImageTargetAccessMode;
  allowed_emails?: string[];
  created_at: string;
  updated_at: string;
};

function normalizeSharedEmails(value: unknown, ownerEmail: string): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const values = [...new Set(value.map((email) => typeof email === 'string' ? email.trim().toLowerCase() : ''))]
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email !== ownerEmail.toLowerCase());
  return values;
}
```

Create defaults with `scan_id: crypto.randomUUID()`, `access_mode: 'owner_only'`, and `allowed_emails: []`. Normalize legacy `visibility: public` to `anyone_with_link` and every other legacy value to `owner_only`. On update, retain `existingTarget.scan_id`, validate requested access fields, clear `allowed_emails` outside `specific_accounts`, and reject an empty specific-account allowlist.

- [ ] **Step 4: Run the focused Worker test and confirm GREEN**

Run the command from Step 2.

Expected: PASS, including the pre-existing loopback-CORS tests.

- [ ] **Step 5: Record the task boundary**

Do not commit pre-existing Worker edits. Capture `git diff -- worker/src/index.ts tests/worker/generateModelWorker.test.ts` and verify both the existing CORS hunks and the new access hunks remain present.

---

### Task 2: Add the Worker Single-Target Scan Endpoint

**Files:**
- Modify: `D:/Github-Projects/Web-AR/tests/worker/generateModelWorker.test.ts:2517-2950`
- Modify: `D:/Github-Projects/Web-AR/worker/src/index.ts:448-471,1535-1559,2982-3014,3124-3145`

**Interfaces:**
- Consumes: persisted access metadata from Task 1.
- Produces: `GET /generate-3d/image-targets/scan/<scan_id>` with optional Bearer authentication.
- Produces: `canScanImageTarget(target, user)` returning `true` only for the four specified access rules plus admin override.
- Produces: owner/admin list-time scan-ID backfill for legacy records.

- [ ] **Step 1: Write the failing endpoint matrix test**

Create targets for all modes and assert:

```ts
expect((await scan('link-id')).status).toBe(200);
expect((await scan('signed-id')).status).toBe(401);
expect((await scan('signed-id', activeUserToken)).status).toBe(200);
expect((await scan('owner-id', otherUserToken)).status).toBe(403);
expect((await scan('owner-id', ownerToken)).status).toBe(200);
expect((await scan('shared-id', listedUserToken)).status).toBe(200);
expect((await scan('shared-id', otherUserToken)).status).toBe(403);
expect((await scan('missing-id')).status).toBe(404);
```

Assert that every successful response contains one target object rather than `{ targets: [...] }`, and that listing a legacy owner target persists one generated scan ID to both its index entry and record object.

- [ ] **Step 2: Run the focused Worker test and confirm RED**

Run:

```powershell
npm.cmd test -- tests/worker/generateModelWorker.test.ts
```

Expected: FAIL because `/scan/<scan_id>` is handled by the management catch-all.

- [ ] **Step 3: Implement route precedence, authorization, and backfill**

Register the route before the item catch-all:

```ts
const scanPrefix = '/generate-3d/image-targets/scan/';
if (request.method === 'GET' && url.pathname.startsWith(scanPrefix)) {
  const scanId = decodeURIComponent(url.pathname.slice(scanPrefix.length));
  return handleImageTargetScanRequest(request, env, deps, scanId);
}
```

Implement `handleImageTargetScanRequest` to read the normalized index, return `404` for no match, return the target directly for `anyone_with_link`, read optional approved auth for other modes, then return `401`, `403`, or the single target. Add a list-time `ensureImageTargetScanIds` pass for targets manageable by the authenticated owner/admin, persist changed index and record objects, and leave public anonymous list behavior otherwise unchanged for legacy compatibility.

- [ ] **Step 4: Run the Worker tests and build**

Run:

```powershell
npm.cmd test -- tests/worker/generateModelWorker.test.ts
npm.cmd run build
```

Expected: focused test PASS and TypeScript/Vite build PASS.

- [ ] **Step 5: Record the task boundary**

Run `git -C D:/Github-Projects/Web-AR diff --check` and retain all Worker changes unstaged because the same files contain pre-existing CORS work.

---

### Task 3: Add Mark-AR Access Types and Worker Client Support

**Files:**
- Create: `src/app/imageTargetAccess.ts`
- Create: `tests/imageTargetAccess.test.ts`
- Modify: `src/app/cloudImageTargets.ts:20-190,193-275,293-316,429-447`
- Modify: `tests/cloudImageTargets.test.ts`

**Interfaces:**
- Produces: `ImageTargetAccessMode`, `ImageTargetAccess`, and `DEFAULT_IMAGE_TARGET_ACCESS`.
- Produces: `parseAllowedEmails(value: string): string[]` and `validateImageTargetAccess(access): string | null`.
- Produces: optional `scanId` plus normalized `accessMode` and `allowedEmails` on `CloudImageTarget`.
- Produces: `getImageTargetForScan({ apiUrl, scanId, authToken?, fetchImpl? }): Promise<CloudImageTarget>`.

- [ ] **Step 1: Write failing helper and client tests**

Use these exact behavioral assertions:

```ts
expect(parseAllowedEmails(' Friend@Example.com,friend@example.com\nsecond@example.com '))
  .toEqual(['friend@example.com', 'second@example.com']);
expect(validateImageTargetAccess({ accessMode: 'specific_accounts', allowedEmails: [] }, 'owner@example.com'))
  .toBe('Add at least one account email.');
expect(validateImageTargetAccess({ accessMode: 'specific_accounts', allowedEmails: ['OWNER@example.com'] }, 'owner@example.com'))
  .toBe('Add at least one account email other than your own.');
expect(DEFAULT_IMAGE_TARGET_ACCESS).toEqual({ accessMode: 'owner_only', allowedEmails: [] });
```

In `cloudImageTargets.test.ts`, prove snake-case mapping, create/update request serialization, no Authorization header for a link scan, Bearer authorization when supplied, and error propagation for `401`, `403`, and `404`.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
npm.cmd test -- tests/imageTargetAccess.test.ts tests/cloudImageTargets.test.ts
```

Expected: FAIL because the helper and focused scan request do not exist.

- [ ] **Step 3: Implement the helper and client mapping**

Create:

```ts
export const IMAGE_TARGET_ACCESS_MODES = [
  'anyone_with_link', 'any_signed_in', 'owner_only', 'specific_accounts',
] as const;
export type ImageTargetAccessMode = typeof IMAGE_TARGET_ACCESS_MODES[number];
export type ImageTargetAccess = { accessMode: ImageTargetAccessMode; allowedEmails: string[] };
export const DEFAULT_IMAGE_TARGET_ACCESS: ImageTargetAccess = { accessMode: 'owner_only', allowedEmails: [] };

export function validateImageTargetAccess(access: ImageTargetAccess, ownerEmail?: string): string | null {
  if (access.accessMode !== 'specific_accounts') return null;
  if (access.allowedEmails.length === 0) return 'Add at least one account email.';
  if (ownerEmail && access.allowedEmails.every((email) => email === ownerEmail.trim().toLowerCase())) {
    return 'Add at least one account email other than your own.';
  }
  return null;
}
```

Extend request and response wire types with `scan_id`, `access_mode`, and `allowed_emails`. Serialize access fields on create/update. Implement `getImageTargetForScan` against `${imageTargetsUrl(apiUrl)}/scan/${encodeURIComponent(scanId)}` with headers only when `authToken` exists, then reuse `parseImageTargetResponse`.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run the command from Step 2.

Expected: both files PASS.

- [ ] **Step 5: Record the task boundary**

Run `git diff --check -- src/app/imageTargetAccess.ts src/app/cloudImageTargets.ts tests/imageTargetAccess.test.ts tests/cloudImageTargets.test.ts`.

---

### Task 4: Parse Exact Scan Routes and Build Isolated Runtime Targets

**Files:**
- Modify: `src/ui/pageRoutes.ts`
- Modify: `tests/pageRoutes.test.ts`
- Modify: `src/ui/authNavigation.ts`
- Modify: `tests/authNavigation.test.ts`
- Modify: `src/ar/markerTargets.ts`
- Modify: `tests/markerTargets.test.ts`

**Interfaces:**
- Produces: `type AppLocation = { route: AppRoute; scanId?: string }`.
- Produces: `locationFromHash(hash): AppLocation`, `hrefForTargetScan(scanId): string`, and `absoluteTargetScanUrl(scanId, currentUrl): string`.
- Produces: `AuthNavigation.rememberHref(href)` and `takePendingHref(authState)` without breaking existing protected Targets navigation.
- Produces: `createSingleTargetRuntimeMarker(target)` returning exactly one runtime target at index `0`.

- [ ] **Step 1: Write failing route, auth-return, and isolation tests**

Assert:

```ts
expect(locationFromHash('#/scan/scan-abc')).toEqual({ route: 'scan', scanId: 'scan-abc' });
expect(hrefForTargetScan('scan abc')).toBe('#/scan/scan%20abc');
expect(locationFromHash('#/scan/')).toEqual({ route: 'scan' });
expect(createSingleTargetRuntimeMarker(target)).toHaveLength(1);
expect(createSingleTargetRuntimeMarker(target)[0].marker.targetIndex).toBe(0);
```

Remember `#/scan/scan-abc`, confirm it is unavailable while signed out, and confirm `takePendingHref(signedIn)` returns that exact hash once.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
npm.cmd test -- tests/pageRoutes.test.ts tests/authNavigation.test.ts tests/markerTargets.test.ts
```

Expected: FAIL because the new route and isolation APIs do not exist.

- [ ] **Step 3: Implement route, return-href, and runtime helpers**

Parse only the first two hash segments and decode scan IDs defensively. Generate absolute links from the document URL before its hash:

```ts
export function absoluteTargetScanUrl(scanId: string, currentUrl: string): string {
  const url = new URL(currentUrl);
  url.hash = hrefForTargetScan(scanId).slice(1);
  return url.href;
}
```

Implement isolation as:

```ts
export function createSingleTargetRuntimeMarker(target: CloudImageTarget): RuntimeMarkerTarget[] {
  return createRuntimeMarkerTargets({ builtInMarkers: [], cloudTargets: [target] });
}
```

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run the command from Step 2.

Expected: all three files PASS.

- [ ] **Step 5: Record the task boundary**

Run `git diff --check` on the six touched files.

---

### Task 5: Add Access Controls, Save Acknowledgement, and Per-Target Links

**Files:**
- Modify: `src/ui/appShell.ts:146-188`
- Modify: `src/ui/savedTargetList.ts`
- Modify: `tests/savedTargetList.test.ts`
- Modify: `src/app/targetPersistence.ts`
- Modify: `tests/targetPersistence.test.ts`
- Modify: `src/main.ts:139-205,384-395,1500-1584,1631-1685`
- Modify: `src/style.css`

**Interfaces:**
- Consumes: access types and route helpers from Tasks 3-4.
- Produces: editor controls `#target-access-mode`, `#target-access-emails-field`, and `#target-access-emails`.
- Produces: saved rows with `[data-copy-target-link]` and `a[data-open-target-scan]`.
- Produces: save acknowledgement that rejects changed access mode, allowlist, or scan ID.

- [ ] **Step 1: Write failing editor/list/persistence tests**

Extend saved-target fixtures with `scanId: 'scan-target-model'`. Assert the row contains exactly one link with `href="#/scan/scan-target-model"`, the Copy link callback receives the absolute URL, and targets without a scan ID do not show link controls.

Extend persistence tests so this response is rejected:

```ts
savedTargetAuthoringMismatch(objects, groups, {
  ...savedTarget,
  accessMode: 'anyone_with_link',
}, {
  accessMode: 'owner_only',
  allowedEmails: [],
  scanId: 'scan-id',
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
npm.cmd test -- tests/savedTargetList.test.ts tests/targetPersistence.test.ts
```

Expected: FAIL because access controls and target link actions do not exist.

- [ ] **Step 3: Implement access editor state and saved-link actions**

Render a four-option `<select>` and a textarea accepting comma/newline-separated emails. In `main.ts`, keep:

```ts
let targetAccess: ImageTargetAccess = { ...DEFAULT_IMAGE_TARGET_ACCESS, allowedEmails: [] };
```

Reset new drafts to owner-only, load saved access into controls, show the email field only for `specific_accounts`, validate against the signed-in owner's email before save, and include access in create/update calls. Extend save acknowledgement with an optional expected access object and compare normalized mode, allowlist, and stable scan ID.

Build Copy link values with `absoluteTargetScanUrl(target.scanId, window.location.href)` and call `navigator.clipboard.writeText`. Report success or failure through `#image-target-status` without changing editor selection.

- [ ] **Step 4: Run focused UI and persistence tests**

Run:

```powershell
npm.cmd test -- tests/savedTargetList.test.ts tests/targetPersistence.test.ts tests/cloudImageTargets.test.ts
```

Expected: PASS.

- [ ] **Step 5: Record the task boundary**

Use `git diff --check` and confirm the pre-existing loader hunks in `src/main.ts` and `src/style.css` remain unchanged.

---

### Task 6: Integrate Target-Specific Authentication and Camera Startup

**Files:**
- Create: `tests/targetSpecificScan.test.ts`
- Modify: `src/main.ts:186-290,302-339,600-638`
- Modify: `src/ui/appShell.ts:93-109,430-460`
- Modify: `src/style.css`

**Interfaces:**
- Consumes: `getImageTargetForScan`, `locationFromHash`, `hrefForTargetScan`, `AuthNavigation.rememberHref`, and `createSingleTargetRuntimeMarker`.
- Produces: one reusable `startCurrentArSession()` path for both the button and automatic focused startup.
- Produces: exact `401` sign-in return, `403` denial, `404` missing-target, and retryable camera states.

- [ ] **Step 1: Write failing focused scan integration tests**

Mock `getImageTargetForScan` and `startMarkerAR`. For `#/scan/scan-abc`, resolve one target and assert:

```ts
expect(startMarkerAR).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
  targets: [expect.objectContaining({ marker: expect.objectContaining({ targetIndex: 0 }) })],
}));
```

Assert no built-in markers or second cloud target are passed. Add cases where the focused request rejects with HTTP `401`, `403`, and `404`; assert `startMarkerAR` is never called and the page respectively preserves the exact return hash, shows `You don't have access to this target.`, or shows `Target not found.`

- [ ] **Step 2: Run the integration test and confirm RED**

Run:

```powershell
npm.cmd test -- tests/targetSpecificScan.test.ts
```

Expected: FAIL because hash activation does not fetch or auto-start a focused target.

- [ ] **Step 3: Refactor and implement the scanner coordinator**

Move the current Start AR listener body into `startCurrentArSession()`. Maintain `focusedScanTarget?: CloudImageTarget` and a monotonically increasing route-load token. When `locationFromHash` contains a scan ID:

1. activate the Scan page;
2. stop the old session and clear focused state;
3. fetch only that scan ID with the optional saved token;
4. ignore stale responses after a hash change;
5. set `focusedScanTarget` and immediately call `startCurrentArSession()`;
6. use `createSingleTargetRuntimeMarker` whenever focused state exists.

On `401`, remember the exact scan hash and open Account. After sign-in, restore that hash. On `403` or `404`, keep the Scan page, use the approved copy, and leave the Start camera button disabled until a valid target loads. On camera/compile failure after a valid target loads, re-enable `Start camera` for manual retry. Stop the camera when leaving any Scan page.

- [ ] **Step 4: Run focused and related integration tests**

Run:

```powershell
npm.cmd test -- tests/targetSpecificScan.test.ts tests/pageRoutes.test.ts tests/authNavigation.test.ts tests/markerTargets.test.ts tests/mindarRuntime.test.ts tests/appShell.test.ts
```

Expected: PASS.

- [ ] **Step 5: Record the task boundary**

Run `git diff --check -- src/main.ts src/ui/appShell.ts src/style.css tests/targetSpecificScan.test.ts` and confirm the existing loader changes still appear in the working tree.

---

### Task 7: Full Verification and Live Browser Smoke

**Files:**
- Verify only; no planned source file changes.

**Interfaces:**
- Consumes: all earlier tasks.
- Produces: test, build, and browser evidence for the complete feature.

- [ ] **Step 1: Run the full Web-AR gates**

From `D:/Github-Projects/Web-AR`:

```powershell
npm.cmd test
npm.cmd run build
```

Expected: all Vitest files PASS and the production build exits `0`.

- [ ] **Step 2: Run the full Mark-AR gates**

From `D:/Github-Projects/Mark-AR`:

```powershell
npm.cmd test
npm.cmd run build
$env:GITHUB_PAGES='true'; npm.cmd run build; Remove-Item Env:GITHUB_PAGES
```

Expected: all Vitest files PASS, normal build exits `0`, and Pages build emits assets under `/Mark-AR/`.

- [ ] **Step 3: Start both local services without stealing occupied ports**

Inspect listeners first. Start the Worker with `npm.cmd run worker:dev` from Web-AR and Mark-AR with:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

If `5173` belongs to another app, use the next free strict port and verify that exact origin is accepted by the existing loopback-CORS behavior.

- [ ] **Step 4: Verify the live target editor and scan routes**

In a signed-in browser session:

1. save or update one target as `Only me` and confirm its URL appears;
2. open the URL and confirm only its label is compiled and the camera prompt/start path appears;
3. sign out and confirm the same URL requests sign-in then returns to itself;
4. set the target to `Anyone with the link`, sign out, reopen the URL, and confirm no sign-in is requested;
5. present a different marker and confirm it does not activate content.

Expected: single-target isolation and both owner-only and no-sign-in flows are visible in the real app.

- [ ] **Step 5: Review final diffs without committing unrelated work**

Run:

```powershell
git -C D:/Github-Projects/Web-AR status --short
git -C D:/Github-Projects/Web-AR diff --check
git -C D:/Github-Projects/Mark-AR status --short
git -C D:/Github-Projects/Mark-AR diff --check
```

Expected: no whitespace errors; pre-existing Web-AR CORS and Mark-AR loader changes remain present and uncommitted alongside the target-specific scan implementation.

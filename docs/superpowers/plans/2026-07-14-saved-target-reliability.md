# Saved Target Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for every production change. These tasks are tightly coupled through `main.ts`, so execute them sequentially in the existing approved implementation session.

**Goal:** Prevent per-object animation and text from being lost or applied to unintended objects when saved targets are edited and reopened.

**Architecture:** Keep selection behavior explicit in both `main.ts` and `ImageTargetPreview`, add a pure canonical persistence verifier beside the target editor session helpers, and gate every save rehydration and refreshed-list commit on that verifier. Preserve the last good list on refresh errors or invalid refreshed records and release the already-tested Worker contract from a clean committed checkout.

**Tech Stack:** TypeScript 6, Vite 8, Vitest 4, happy-dom, Three.js, Cloudflare Workers, R2.

## Global Constraints

- A click without Ctrl or Command selects exactly one object.
- Only explicitly selected objects or the explicitly selected group receive animation edits.
- Do not rehydrate a save response that loses or changes submitted authoring state.
- Preserve the complete local editor draft when the server response is lossy.
- Preserve the last good saved-target list when refresh fails.
- Distinguish a successful save plus failed refresh from a failed save.
- Do not include the unrelated Web-AR loopback CORS working-tree changes in tests, commits, or deployment artifacts.
- Do not attempt to synthesize data already discarded by the old Worker.

---

### Task 1: Single-object animation selection

**Files:**
- Modify: `src/main.ts`
- Modify: `src/scene/ImageTargetPreview.ts`
- Test: `tests/targetAnimationEditorIntegration.test.ts`
- Test: `tests/imageTargetPreview.test.ts`

**Interfaces:**
- Consumes: `renderTargetObjectList` callback `(objectId, additive)`.
- Produces: non-additive selection `{ objectIds: [objectId] }` and additive selection through `toggleTargetObjectSelection`.

- [ ] **Step 1: Write the failing selection regression**

Add regressions that place two objects, Ctrl-select both, and normally click the first through both the object list and the 3D preview. Assert only the first object remains selected and only that object changes after selecting another preset.

```ts
expect(selectedObjectIds()).toEqual(['first-object-id']);
expect(latestObjects()[0].animation?.preset).toBe('turntable');
expect(latestObjects()[1].animation?.preset).toBe('none');
```

- [ ] **Step 2: Verify RED**

Run: `npm.cmd test -- tests/targetAnimationEditorIntegration.test.ts`

Expected: FAIL because the ordinary click leaves both rows selected.

- [ ] **Step 3: Implement replacement selection**

Use additive selection only in the additive branch. Every non-additive list or preview object click assigns exactly one object ID before normalizing the selection.

```ts
targetSelection = options?.additive
  ? toggleTargetObjectSelection(targetSelection, object.id)
  : { objectIds: [object.id] };
```

- [ ] **Step 4: Verify GREEN**

Run: `npm.cmd test -- tests/targetAnimationEditorIntegration.test.ts tests/targetGroupEditorIntegration.test.ts`

Expected: PASS.

---

### Task 2: Lossless save acknowledgement

**Files:**
- Create: `src/app/targetPersistence.ts`
- Modify: `src/main.ts`
- Create: `tests/targetPersistence.test.ts`
- Modify: `tests/savedTargetEditingIntegration.test.ts`

**Interfaces:**
- Produces: `savedTargetAuthoringMismatch(objects, groups, savedTarget): string | undefined`.
- Consumes: `TargetEditorObject[]`, `TargetEditorGroup[]`, and `CloudImageTarget`.

- [ ] **Step 1: Write failing canonical-state tests**

Prove that a complete normalized response returns `undefined`, while a response missing a text object, changing one object's tracks, changing text style, changing local placement, or removing a used group returns a descriptive mismatch.

```ts
expect(savedTargetAuthoringMismatch(objects, groups, completeTarget)).toBeUndefined();
expect(savedTargetAuthoringMismatch(objects, groups, targetWithoutText)).toContain('text-1');
```

- [ ] **Step 2: Verify RED**

Run: `npm.cmd test -- tests/targetPersistence.test.ts`

Expected: FAIL because `targetPersistence.ts` does not exist.

- [ ] **Step 3: Implement canonical comparison**

Normalize placements, local placements, animations, text, group state, and model metadata. Sort canonical objects and groups by ID before comparing serialized canonical values. Return the first object/group-specific mismatch string.

- [ ] **Step 4: Verify helper GREEN**

Run: `npm.cmd test -- tests/targetPersistence.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing save-response integration test**

Mock `updateImageTarget` to return the same model object but omit the submitted text or animation. Assert the editor still shows both original objects, retains their original authoring state in preview, and displays a server-preservation error.

- [ ] **Step 6: Verify integration RED**

Run: `npm.cmd test -- tests/savedTargetEditingIntegration.test.ts`

Expected: FAIL because the lossy response is currently loaded into the editor.

- [ ] **Step 7: Gate rehydration in `saveCurrentImageTarget`**

Call `savedTargetAuthoringMismatch` immediately after create/update and again for the refreshed record. Throw before `loadSavedImageTarget` when a mismatch exists, so the local state remains untouched.

- [ ] **Step 8: Verify integration GREEN**

Run: `npm.cmd test -- tests/targetPersistence.test.ts tests/savedTargetEditingIntegration.test.ts`

Expected: PASS.

---

### Task 3: Refresh reliability and save-status accuracy

**Files:**
- Modify: `src/main.ts`
- Modify: `tests/savedTargetEditingIntegration.test.ts`

**Interfaces:**
- Preserves: `cloudImageTargets`, `editingTarget`, `targetObjects`, and `targetGroups` on refresh failure.
- Reports: successful save plus failed refresh separately from a failed create/update.

- [ ] **Step 1: Write failing refresh regressions**

Cover a manual refresh rejection, an update success followed by list-refresh rejection, a successful refresh that omits the saved target, and one that returns lossy state. Assert the last good saved card and editor objects remain, and the rejection status contains both `saved` and `refresh`.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd test -- tests/savedTargetEditingIntegration.test.ts`

Expected: FAIL because `refreshImageTargets` clears the list and the outer save catch reports the save as failed.

- [ ] **Step 3: Preserve last good state and separate failure phases**

Do not assign `cloudImageTargets = []` in the refresh catch. In the save path, validate the direct save response, stage the refreshed list without rendering it, require the saved ID and validate that refreshed record, and only then replace the cache. Catch only a post-save refresh rejection, load the validated response, and report a saved-but-refresh-failed message.

- [ ] **Step 4: Verify GREEN**

Run: `npm.cmd test -- tests/savedTargetEditingIntegration.test.ts tests/cloudImageTargets.test.ts`

Expected: PASS.

---

### Task 4: Full verification and release readiness

**Files:**
- Verify only: Mark-AR and Web-AR committed source plus intentional Mark-AR changes.

- [ ] **Step 1: Run Mark-AR verification**

Run:

```powershell
npm.cmd test
npm.cmd run build
$env:GITHUB_PAGES='true'; npm.cmd run build
```

Expected: all tests pass and both builds exit 0.

- [ ] **Step 2: Verify committed Worker source in a clean temporary worktree**

Create a detached worktree at the intended Worker commit, run `npm.cmd ci`, the focused Worker test, the complete suite, and the build. This prevents the unrelated local CORS changes from entering the verification artifact.

- [ ] **Step 3: Verify the current production gap**

Run `npx.cmd wrangler deployments list --config wrangler.jsonc` and record that the active production deployment predates the complete persistence commit.

- [ ] **Step 4: Browser-check the local editor**

Exercise two-object selection, one-object animation, mixed model/text save-response handling, and refresh-error retention in a real browser. Capture console and network failures.

- [ ] **Step 5: Obtain production deployment authority if it is not already explicit**

The Worker must be deployed from the clean verified committed checkout, followed by a signed-in create/update/reload/reopen smoke. GitHub Pages must be republished only after the intentional Mark-AR fixes are committed and the user authorizes publication.

# Saved Target Editing and Complete Object Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users click a saved cloud image target, edit its complete scene, and update the same durable record with every model, text object, group, transform, and animation reusable after reload and in AR.

**Architecture:** Mark-AR will use a typed model/text object union, a pure editor-session hydration helper, and a focused saved-target list renderer. The Web-AR Worker will validate and persist that union plus groups while retaining legacy top-level model aliases. `main.ts` will orchestrate create versus update without re-uploading an unchanged target image.

**Tech Stack:** TypeScript 6, Vite 8, Vitest 4, happy-dom, Three.js, Cloudflare Worker, R2-compatible bucket storage.

## Global Constraints

- Clicking a saved card edits that target; **Update target** patches the existing target ID and must not create a duplicate.
- Persist target label, image, all model objects, all custom 3D text fields, placements, local placements, animations, groups, and group animations.
- Text-only targets are valid when at least one valid text object remains.
- Existing model-only targets without `kind`, `objects`, groups, rotations, or custom animation tracks must remain readable.
- Top-level `model` and `placement` stay as first-model compatibility aliases when a model exists; text-only targets may omit them.
- Nested groups and cross-target templates remain out of scope.
- Manual list refresh must not discard unsaved editor state.
- Preserve `.codex-remote-attachments/` and every unrelated Web-AR change, especially the existing local-development CORS edits in `worker/src/index.ts` and `tests/worker/generateModelWorker.test.ts`.

---

## File Structure

### Mark-AR

- Modify `src/app/targetEditorObjects.ts`: own the shared model/text editor object union and normalizers.
- Modify `src/app/cloudImageTargets.ts`: parse and serialize typed cloud objects and optional legacy aliases.
- Create `src/app/targetEditorSession.ts`: deep-clone a cloud target into isolated editor state and resolve preview image source.
- Create `src/ui/savedTargetList.ts`: render accessible open/delete controls and active-row state.
- Modify `src/main.ts`: load targets, reset to a new target, choose POST versus PATCH, and keep UI/preview state synchronized.
- Modify `src/ui/appShell.ts`: add the **New target** action.
- Modify `src/style.css`: style open controls and the active saved row without changing the overall visual language.
- Modify `src/ar/markerTargets.ts` only if type narrowing is needed for optional legacy aliases.
- Test with `tests/cloudImageTargets.test.ts`, `tests/targetEditorObjects.test.ts`, `tests/targetEditorSession.test.ts`, `tests/savedTargetList.test.ts`, `tests/savedTargetEditingIntegration.test.ts`, `tests/appShell.test.ts`, and `tests/markerTargets.test.ts`.

### Web-AR

- Modify `D:\Github-Projects\Web-AR\worker\src\index.ts`: validate/store typed objects, full placement/animation data, and groups.
- Modify `D:\Github-Projects\Web-AR\tests\worker\generateModelWorker.test.ts`: prove mixed/text-only round trips, updates, invalid payload rejection, and legacy compatibility.

---

### Task 1: Mark-AR Typed Cloud Object Contract

**Files:**
- Modify: `src/app/targetEditorObjects.ts`
- Modify: `src/app/cloudImageTargets.ts`
- Test: `tests/cloudImageTargets.test.ts`
- Test: `tests/targetEditorObjects.test.ts`

**Interfaces:**
- Produces: `ModelTargetObject`, `LocalTextTargetObject`, and `TargetEditorObject` from `targetEditorObjects.ts`.
- Produces: `CloudImageTarget.objects: TargetEditorObject[]`, optional `CloudImageTarget.model`, optional `CloudImageTarget.placement`.
- Produces: `createImageTarget(...)` and `updateImageTarget(...)` request bodies with `kind: "model" | "text"`.

- [ ] **Step 1: Write failing mixed-object parsing and serialization tests**

Add tests that list a mixed record and assert every text field survives:

```ts
it('round-trips mixed model and text objects with complete authoring state', async () => {
  const target = await listImageTargets({
    apiUrl: 'https://worker.example/generate-3d',
    authToken: 'token',
    fetchImpl: vi.fn(async () => new Response(JSON.stringify({ targets: [{
      id: 'target-1', label: 'Mixed', image_url: 'https://worker.example/target.png',
      image_object_key: 'image-targets/images/target.png',
      objects: [
        { kind: 'model', id: 'model-1', model: { id: 'chair', label: 'Chair', url: 'https://worker.example/chair.glb' }, placement: wirePlacement },
        { kind: 'text', id: 'text-1', text: { value: 'Hallo AR', language: 'german', font: 'studio-sans-bold', fill_mode: 'gradient', color: '#112233', gradient_start: '#223344', gradient_end: '#334455', gradient_direction: 'diagonal', side_color: '#445566', depth: 0.08, bevel: 0.01, gloss: 0.9, style_preset: 'gold-bevel' }, placement: wirePlacement },
      ], groups: [],
    }] }), { status: 200 })) as typeof fetch,
  });
  expect(target[0].objects[1]).toMatchObject({ kind: 'text', text: { value: 'Hallo AR', language: 'german', fillMode: 'gradient', gradientStart: '#223344' } });
});
```

Add a create/update test that captures JSON and asserts a text-only body contains `objects[0].kind === 'text'`, contains no top-level `model`, and PATCHes `/image-targets/target-1`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm.cmd test -- tests/cloudImageTargets.test.ts tests/targetEditorObjects.test.ts`

Expected: FAIL because text objects are filtered or cannot satisfy `CloudImageTargetObject`, and text-only parsing returns no target.

- [ ] **Step 3: Move the model object type beside the text type**

In `targetEditorObjects.ts`, remove the type import from `cloudImageTargets.ts` and define:

```ts
export type ModelTargetObject = {
  kind?: 'model';
  id: string;
  model: CloudflareModelOption;
  placement: ImageTargetPlacement;
  animation?: ImageTargetAnimation;
  groupId?: string;
  localPlacement?: ImageTargetPlacement;
};

export type TargetEditorObject = ModelTargetObject | LocalTextTargetObject;
```

Keep `isTextTargetObject`; add `isModelTargetObject` so all serializers narrow explicitly.

- [ ] **Step 4: Implement typed wire mapping**

In `cloudImageTargets.ts`:

```ts
export type CloudImageTargetObject = ModelTargetObject;
export type CloudImageTarget = {
  id: string;
  label: string;
  imageUrl: string;
  imageObjectKey: string;
  model?: CloudflareModelOption;
  placement?: ImageTargetPlacement;
  objects: TargetEditorObject[];
  groups: CloudImageTargetGroup[];
  // existing owner/visibility/timestamps
};
```

Extend `WorkerImageTargetObject` with `kind?: string` and a wire-format `text` object. Parse `kind === 'text'` through `normalizeTargetText`; treat missing `kind` plus valid `model` as legacy model. Serialize every object with `kind`, placement, group fields, and animation. Derive top-level aliases with:

```ts
const firstModel = requestObjects.find((object) => object.kind === 'model');
const legacyAliases = firstModel ? { model: firstModel.model, placement: firstModel.placement } : {};
```

Change `resolveGroupedObjectsForSave` to accept and return `TargetEditorObject[]` without dropping text.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm.cmd test -- tests/cloudImageTargets.test.ts tests/targetEditorObjects.test.ts`

Expected: PASS with all mixed, text-only, legacy, group, and existing model tests green.

- [ ] **Step 6: Commit the Mark-AR object contract**

```powershell
git add src/app/targetEditorObjects.ts src/app/cloudImageTargets.ts tests/cloudImageTargets.test.ts tests/targetEditorObjects.test.ts
git diff --cached --check
git commit -m "feat: persist complete target objects"
```

---

### Task 2: Web-AR Worker Full Target Persistence

**Files:**
- Modify: `D:\Github-Projects\Web-AR\worker\src\index.ts`
- Test: `D:\Github-Projects\Web-AR\tests\worker\generateModelWorker.test.ts`

**Interfaces:**
- Consumes: Mark-AR wire objects with `kind`, `model` or `text`, placement, animation, group ID, and local placement.
- Produces: R2 index and record entries whose `objects` and `groups` are normalized and reusable.

- [ ] **Step 1: Write failing Worker round-trip tests**

Add one POST test with a model, a text object, and a group; assert the response plus both stored JSON records contain:

```ts
expect(body).toMatchObject({
  model: { id: 'chair' },
  objects: [
    expect.objectContaining({ kind: 'model', id: 'model-1', group_id: 'group-1' }),
    expect.objectContaining({ kind: 'text', id: 'text-1', text: expect.objectContaining({ value: 'Hallo AR', fill_mode: 'gradient' }) }),
  ],
  groups: [expect.objectContaining({ id: 'group-1', label: 'Group 1' })],
});
```

Add a text-only PATCH test asserting status `200`, the same target ID, no required top-level model, and preserved image URL. Add rejection tests for empty text, text longer than 512 code points, invalid colors, unknown kinds, and a request with no valid objects. Keep an explicit legacy POST using only top-level `model` and `placement`.

- [ ] **Step 2: Run focused Worker tests and verify RED**

Run from `D:\Github-Projects\Web-AR`:

`npm.cmd test -- tests/worker/generateModelWorker.test.ts`

Expected: FAIL because Worker normalization currently accepts model objects only and discards groups, rotations, custom tracks, and text.

- [ ] **Step 3: Add typed Worker records**

Replace the single `ImageTargetObject` shape with model/text variants and add groups:

```ts
type ImageTargetModelObject = ImageTargetObjectBase & { kind: 'model'; model: ImageTargetModel };
type ImageTargetTextObject = ImageTargetObjectBase & { kind: 'text'; text: ImageTargetText };
type ImageTargetObject = ImageTargetModelObject | ImageTargetTextObject;
type ImageTargetGroup = { id: string; label: string; placement: ImageTargetPlacement; animation: ImageTargetAnimation };
```

Expand placement with `rotation_x`, `rotation_y`, and `rotation_z`. Expand animation with `preset` and `tracks`. Add `groups?: unknown` to `ImageTargetRequestBody`, `groups: ImageTargetGroup[]` to stored entries, and make top-level `model`/`placement` optional.

- [ ] **Step 4: Implement strict normalizers and compatibility aliases**

Use exact supported enum sets:

```ts
const textLanguages = new Set(['english', 'german', 'tamil']);
const textFonts = new Set(['studio-sans', 'studio-sans-bold', 'studio-serif', 'studio-serif-bold', 'droid-serif', 'droid-serif-bold', 'optimer', 'optimer-bold', 'helvetiker', 'helvetiker-bold', 'studio-mono', 'tamil-ui']);
const textFillModes = new Set(['solid', 'gradient']);
const textGradientDirections = new Set(['horizontal', 'vertical', 'diagonal', 'depth']);
const textStylePresets = new Set(['blue-shine', 'gold-bevel', 'neon-cyan', 'red-gloss', 'tamil-classic']);
```

Implement `normalizeImageTargetText`, `normalizeImageTargetGroups`, `normalizeImageTargetObject`, and `normalizeImageTargetAnimationTracks`. Normalize groups first, then object group references, remove empty groups, and derive aliases from the first model object:

```ts
const firstModel = objects.find((object): object is ImageTargetModelObject => object.kind === 'model');
const aliases = firstModel ? { model: firstModel.model, placement: firstModel.placement } : {};
```

Create/update must accept at least one normalized model or text object. Legacy objects without `kind` remain model objects when `model` is valid.

- [ ] **Step 5: Run focused Worker tests and verify GREEN**

Run: `npm.cmd test -- tests/worker/generateModelWorker.test.ts`

Expected: PASS, including pre-existing CORS tests and all existing image-target authorization/image tests.

- [ ] **Step 6: Stage only feature hunks and protect unrelated edits**

Run:

```powershell
git diff -- worker/src/index.ts tests/worker/generateModelWorker.test.ts
git add -p -- worker/src/index.ts tests/worker/generateModelWorker.test.ts
git diff --cached --check
git diff --cached -- worker/src/index.ts tests/worker/generateModelWorker.test.ts
```

Accept only image-target contract/test hunks. Reject the existing `localDevelopmentHostnames`, `isLocalDevelopmentOrigin`, and loopback-origin test hunks. Commit only after cached diff inspection:

`git commit -m "feat: persist complete image target state"`

---

### Task 3: Isolated Target Editor Session Hydration

**Files:**
- Create: `src/app/targetEditorSession.ts`
- Test: `tests/targetEditorSession.test.ts`

**Interfaces:**
- Produces: `EditingTargetState`, `EditableTargetSession`, `createEditingTargetSession`, and `targetPreviewImageUrl`.
- Consumes later in `main.ts` without touching the DOM.

- [ ] **Step 1: Write failing session tests**

```ts
it('deep-clones every nested target field for editing', () => {
  const session = createEditingTargetSession(mixedTarget);
  session.objects[1].placement.offsetX = 0.9;
  session.groups[0].animation.tracks[0].amount = 99;
  expect(mixedTarget.objects[1].placement.offsetX).not.toBe(0.9);
  expect(mixedTarget.groups[0].animation.tracks[0].amount).not.toBe(99);
  expect(session.selection).toEqual({ objectIds: ['model-1'] });
});

it('prefers a replacement data URL and otherwise uses the saved image URL', () => {
  expect(targetPreviewImageUrl(editing, replacement)).toContain('data:image/png;base64,');
  expect(targetPreviewImageUrl(editing)).toBe(editing.imageUrl);
});
```

- [ ] **Step 2: Run session test and verify RED**

Run: `npm.cmd test -- tests/targetEditorSession.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure session helper**

```ts
export type EditingTargetState = { targetId: string; imageUrl: string };
export type EditableTargetSession = EditingTargetState & {
  label: string;
  objects: TargetEditorObject[];
  groups: TargetEditorGroup[];
  selection: TargetEditorSelection;
};

export function createEditingTargetSession(target: CloudImageTarget): EditableTargetSession {
  const objects = structuredClone(target.objects);
  const groups = structuredClone(target.groups);
  return {
    targetId: target.id,
    imageUrl: target.imageUrl,
    label: target.label,
    objects,
    groups,
    selection: { objectIds: objects[0] ? [objects[0].id] : [] },
  };
}
```

Implement `targetPreviewImageUrl(editing, replacement)` using `imageTargetDataUrl` for the replacement and `editing?.imageUrl` otherwise.

- [ ] **Step 4: Run test and verify GREEN**

Run: `npm.cmd test -- tests/targetEditorSession.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/targetEditorSession.ts tests/targetEditorSession.test.ts
git commit -m "feat: hydrate saved target editor sessions"
```

---

### Task 4: Accessible Saved Target Card Actions

**Files:**
- Create: `src/ui/savedTargetList.ts`
- Modify: `src/style.css`
- Test: `tests/savedTargetList.test.ts`
- Preserve/adjust: `tests/savedTargetDeleteIcon.test.ts`

**Interfaces:**
- Produces: `renderSavedTargetList(container, options): void`.
- Options: `{ targets, activeTargetId, onEdit(target), onDelete(target) }`.

- [ ] **Step 1: Write failing renderer tests**

Assert the renderer creates `[data-edit-target="target-1"]` and `[data-delete-target="target-1"]`, calls only `onEdit` when the open control is clicked, calls only `onDelete` when delete is clicked, sets `aria-current="true"` for the active target, and counts model plus text objects.

- [ ] **Step 2: Run renderer tests and verify RED**

Run: `npm.cmd test -- tests/savedTargetList.test.ts tests/savedTargetDeleteIcon.test.ts`

Expected: FAIL because the focused renderer and edit control do not exist.

- [ ] **Step 3: Implement semantic row rendering**

```ts
export function renderSavedTargetList(container: HTMLElement, options: SavedTargetListOptions): void {
  container.replaceChildren();
  for (const target of options.targets) {
    const row = document.createElement('article');
    row.className = 'saved-target-row';
    row.classList.toggle('is-active', target.id === options.activeTargetId);

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'saved-target-open';
    open.dataset.editTarget = target.id;
    open.setAttribute('aria-current', target.id === options.activeTargetId ? 'true' : 'false');
    open.addEventListener('click', () => options.onEdit(target));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'saved-target-delete';
    remove.dataset.deleteTarget = target.id;
    decorateDeleteIconButton(remove, `Delete target ${target.label}`);
    remove.addEventListener('click', () => void options.onDelete(target));
    row.append(open, remove);
    container.append(row);
  }
}
```

Build the thumbnail/meta children inside `open`; use the text value for a single text object's summary and `N objects` for multiple objects. Update CSS so `.saved-target-open` occupies the image/meta columns and `.saved-target-row.is-active` has the existing teal focus language.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm.cmd test -- tests/savedTargetList.test.ts tests/savedTargetDeleteIcon.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/ui/savedTargetList.ts src/style.css tests/savedTargetList.test.ts tests/savedTargetDeleteIcon.test.ts
git commit -m "feat: open saved targets from cards"
```

---

### Task 5: Wire Update-in-Place Into the Target Editor

**Files:**
- Modify: `src/main.ts`
- Modify: `src/ui/appShell.ts`
- Modify: `tests/appShell.test.ts`
- Create: `tests/savedTargetEditingIntegration.test.ts`

**Interfaces:**
- Consumes: `createEditingTargetSession`, `targetPreviewImageUrl`, `renderSavedTargetList`, `updateImageTarget`.
- Produces: user-visible load, update, new-target reset, active row, and status behavior.

- [ ] **Step 1: Add failing shell and integration tests**

The shell test must find `#new-image-target`. The integration test mocks `listImageTargets`, imports `main.ts`, clicks `[data-edit-target="target-1"]`, and asserts:

```ts
expect(labelInput.value).toBe('Kitchen marker');
expect(saveButton.textContent).toBe('Update target');
expect(newButton.hidden).toBe(false);
expect(document.querySelectorAll('.target-object-row')).toHaveLength(2);
```

Click update and assert `updateImageTarget` receives `targetId: 'target-1'`, complete model/text objects and groups, and no image fields when the image was unchanged. Assert `createImageTarget` is not called. Click **New target** and assert the label/object list/editing state clear and the save label returns to **Save target**.

- [ ] **Step 2: Run integration tests and verify RED**

Run: `npm.cmd test -- tests/appShell.test.ts tests/savedTargetEditingIntegration.test.ts`

Expected: FAIL because edit loading, update mode, and the new-target action do not exist.

- [ ] **Step 3: Add editor-mode controls and state**

Add `<button id="new-image-target" type="button" hidden>New target</button>` beside the save action. In `main.ts`, import `updateImageTarget`, the session helper, and the saved-list renderer. Add:

```ts
let editingTarget: EditingTargetState | undefined;

function syncTargetSaveMode(): void {
  if (saveImageTargetButton) saveImageTargetButton.textContent = editingTarget ? 'Update target' : 'Save target';
  if (newImageTargetButton) newImageTargetButton.hidden = !editingTarget;
}
```

- [ ] **Step 4: Implement target loading and reset**

`loadSavedImageTarget(target)` must create the isolated session, assign label/objects/groups/selection, clear `targetImagePayload` and the file input, select the first model in the hidden model select when present, sync every inspector/list control, render active saved cards, and await `updateTargetPreview()`.

`resetImageTargetEditor()` must clear editing ID/image URL, local image payload, label, file input, objects, groups, and selection; then sync controls, list, preview, and save-mode labels without modifying cloud data.

- [ ] **Step 5: Implement POST versus PATCH**

Replace model-only filtering with the complete normalized `targetObjects`. Require a local image only in create mode. Use:

```ts
const request = {
  apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
  authToken,
  label,
  objects,
  groups,
  ...(targetImagePayload ?? {}),
};
const saved = editingTarget
  ? await updateImageTarget({ ...request, targetId: editingTarget.targetId })
  : await createImageTarget({ ...request, ...targetImagePayload! });
await refreshImageTargets({ rethrowOnError: true });
await loadSavedImageTarget(cloudImageTargets.find((target) => target.id === saved.id) ?? saved);
```

Change preview image selection to `targetPreviewImageUrl(editingTarget, targetImagePayload)`. Manual refresh only rerenders the list. Deleting the active target calls reset after a successful delete.

- [ ] **Step 6: Run integration tests and verify GREEN**

Run: `npm.cmd test -- tests/appShell.test.ts tests/savedTargetEditingIntegration.test.ts tests/savedTargetDeleteIcon.test.ts`

Expected: PASS; PATCH uses the existing ID and no duplicate POST occurs.

- [ ] **Step 7: Commit**

```powershell
git add src/main.ts src/ui/appShell.ts tests/appShell.test.ts tests/savedTargetEditingIntegration.test.ts
git commit -m "feat: update saved targets in place"
```

---

### Task 6: Restored Text Objects in AR and Compatibility Regression

**Files:**
- Modify: `tests/markerTargets.test.ts`
- Modify if required: `src/ar/markerTargets.ts`
- Modify if required: `src/ar/cloudflareMarkerObject.ts`
- Test: `tests/cloudflareMarkerObject.test.ts`

**Interfaces:**
- Consumes: `CloudImageTarget.objects: TargetEditorObject[]`.
- Produces: saved cloud text objects passed to `CloudflarePlacedAsset` and rendered without GLB loading.

- [ ] **Step 1: Add a failing saved-cloud text runtime test**

Create a cloud target with one `kind: 'text'` object and no top-level model. Assert `createRuntimeMarkerTargets` keeps the text object, groups, image path, and sequential target index. In `cloudflareMarkerObject.test.ts`, pass that asset and assert the text factory is called while the GLB loader is not.

- [ ] **Step 2: Run runtime tests and verify RED or confirm existing runtime support**

Run: `npm.cmd test -- tests/markerTargets.test.ts tests/cloudflareMarkerObject.test.ts`

Expected before type fixes: compile/test failure from required legacy model aliases or model-only cloud object types. If tests already pass after Task 1, record that runtime behavior was already implemented and keep the regression test.

- [ ] **Step 3: Make the minimal runtime type adjustment**

Keep the existing asset construction but omit undefined aliases:

```ts
cloudflareAsset: {
  ...(target.model ? { model: target.model } : {}),
  ...(target.placement ? { placement: target.placement } : {}),
  objects: target.objects,
  groups: target.groups,
}
```

Do not duplicate text rendering; reuse the existing `isTextTargetObject` path in `cloudflareMarkerObject.ts`.

- [ ] **Step 4: Run runtime tests and verify GREEN**

Run: `npm.cmd test -- tests/markerTargets.test.ts tests/cloudflareMarkerObject.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/ar/markerTargets.ts src/ar/cloudflareMarkerObject.ts tests/markerTargets.test.ts tests/cloudflareMarkerObject.test.ts
git diff --cached --check
git commit -m "test: verify saved text objects in AR"
```

---

### Task 7: Full Verification and Browser Smoke

**Files:**
- Verify all files changed above.
- Do not add generated `dist/`, `.playwright-cli/`, `tmp/`, or `.codex-remote-attachments/` files.

**Interfaces:**
- Consumes the complete Mark-AR/Worker feature.
- Produces fresh evidence for completion.

- [ ] **Step 1: Run full Web-AR verification**

From `D:\Github-Projects\Web-AR`:

```powershell
npm.cmd test
npm.cmd run build
```

Expected: zero failing tests and build exit code `0`. Confirm the pre-existing CORS changes remain present and unstaged unless they belonged to the user before this task.

- [ ] **Step 2: Run full Mark-AR verification**

From `D:\Github-Projects\Mark-AR`:

```powershell
npm.cmd test
npm.cmd run build
$env:GITHUB_PAGES='true'; npm.cmd run build
```

Expected: zero failing tests; normal and Pages builds exit `0`.

- [ ] **Step 3: Start local services for browser verification**

Start the Worker with its existing environment on an available local port and Mark-AR with:

`npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort`

If `5173` is occupied, inspect its owner first and use the next free allowed loopback port. Confirm Mark-AR returns HTTP `200` and title `Mark AR`.

- [ ] **Step 4: Smoke the real editing flow**

In the browser, sign in, click an existing target, verify its image/objects load, edit a model and text object, update, refresh, reopen, and confirm no duplicate target. Switch to another target to prove isolation. Create/reload a text-only target and start AR to confirm restored text rendering. Check the browser console for uncaught errors.

- [ ] **Step 5: Inspect final repository state**

Run in both repositories:

```powershell
git status --short --branch
git diff --check
git log -8 --oneline
```

Expected: only intentional commits/changes from this feature plus the pre-existing untracked or Web-AR CORS work. Do not push or deploy unless the user separately requests it.

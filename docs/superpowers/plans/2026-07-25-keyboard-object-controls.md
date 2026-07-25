# Keyboard Object Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add selection-aware keyboard movement and deletion throughout the Targets page while preserving normal typing behavior.

**Architecture:** A focused `targetEditorKeyboard` module will translate keyboard events into movement or deletion commands and expose a pure placement-nudge function. `main.ts` will own the page-level listener and route commands through the existing canonical editor-state, selection, normalization, inspector, and preview update paths.

**Tech Stack:** TypeScript 6, Vite 8, Vitest 4, Happy DOM, Three.js

## Global Constraints

- Keyboard commands work whenever the Targets page has an object, multi-selection, or group selected.
- Do not handle shortcuts from `input`, `textarea`, `select`, or content-editable elements.
- X/Z movement uses `0.05`; height movement uses `0.02`.
- `ArrowUp` moves forward by decreasing `offsetY`; `ArrowDown` moves backward by increasing `offsetY`.
- `Delete` removes every object represented by the current selection.
- Existing preview-canvas shortcuts remain functional.
- Prevent browser defaults only for commands the editor handles.
- Do not add dependencies.

---

### Task 1: Keyboard command rules

**Files:**
- Create: `src/app/targetEditorKeyboard.ts`
- Create: `tests/targetEditorKeyboard.test.ts`

**Interfaces:**
- Consumes: `ImageTargetPlacement` from `src/app/imageTargetPayload.ts`
- Produces: `TargetEditorKeyboardCommand`, `targetEditorKeyboardCommand(event)`, `nudgeTargetPlacement(placement, command)`, and `isEditableKeyboardTarget(target)`

- [ ] **Step 1: Write failing command-mapping and placement tests**

Create table-driven tests with literal expectations:

```ts
it.each([
  ['ArrowLeft',  { type: 'move', offsetX: -0.05, offsetY: 0, height: 0 }],
  ['ArrowRight', { type: 'move', offsetX: 0.05, offsetY: 0, height: 0 }],
  ['ArrowUp',    { type: 'move', offsetX: 0, offsetY: -0.05, height: 0 }],
  ['ArrowDown',  { type: 'move', offsetX: 0, offsetY: 0.05, height: 0 }],
  ['PageUp',     { type: 'move', offsetX: 0, offsetY: 0, height: 0.02 }],
  ['PageDown',   { type: 'move', offsetX: 0, offsetY: 0, height: -0.02 }],
  ['Delete',     { type: 'delete' }],
])('maps %s to an editor command', (key, expected) => {
  expect(targetEditorKeyboardCommand({ key, altKey: false, ctrlKey: false, metaKey: false }))
    .toEqual(expected);
});

it('applies a movement command without changing scale or rotation', () => {
  expect(nudgeTargetPlacement(
    { scale: 1.2, offsetX: 0.1, offsetY: -0.2, height: 0.3, rotationX: 4, rotationY: 5, rotationZ: 6 },
    { type: 'move', offsetX: 0.05, offsetY: -0.05, height: 0.02 },
  )).toEqual({
    scale: 1.2,
    offsetX: 0.15,
    offsetY: -0.25,
    height: 0.32,
    rotationX: 4,
    rotationY: 5,
    rotationZ: 6,
  });
});
```

Name the mutations caught: reversed directions, wrong increments, Delete misclassification, and accidental rotation/scale changes.

- [ ] **Step 2: Write failing exclusion tests**

```ts
it('ignores modified and unsupported shortcuts', () => {
  expect(targetEditorKeyboardCommand({ key: 'ArrowLeft', altKey: false, ctrlKey: true, metaKey: false }))
    .toBeUndefined();
  expect(targetEditorKeyboardCommand({ key: 'Home', altKey: false, ctrlKey: false, metaKey: false }))
    .toBeUndefined();
});

it.each(['input', 'textarea', 'select'])('recognizes editable %s targets', (tag) => {
  expect(isEditableKeyboardTarget(document.createElement(tag))).toBe(true);
});

it('recognizes descendants of content-editable regions', () => {
  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  const child = document.createElement('span');
  editor.append(child);
  document.body.append(editor);
  expect(isEditableKeyboardTarget(child)).toBe(true);
});
```

Name the mutations caught: intercepting browser modifier shortcuts and deleting while text is being edited.

- [ ] **Step 3: Run the focused test and verify RED**

Run: `npm test -- tests/targetEditorKeyboard.test.ts`

Expected: FAIL because `src/app/targetEditorKeyboard.ts` does not exist.

- [ ] **Step 4: Implement the minimal keyboard module**

Create the command union, exact key map, pure nudge function, and editable-target guard:

```ts
export type TargetEditorKeyboardCommand =
  | { type: 'move'; offsetX: number; offsetY: number; height: number }
  | { type: 'delete' };

type KeyboardCommandEvent = Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey'>;

export function targetEditorKeyboardCommand(
  event: KeyboardCommandEvent,
): TargetEditorKeyboardCommand | undefined {
  if (event.altKey || event.ctrlKey || event.metaKey) return undefined;
  return KEY_COMMANDS[event.key];
}

export function nudgeTargetPlacement(
  placement: ImageTargetPlacement,
  command: Extract<TargetEditorKeyboardCommand, { type: 'move' }>,
): ImageTargetPlacement {
  return {
    ...placement,
    offsetX: placement.offsetX + command.offsetX,
    offsetY: placement.offsetY + command.offsetY,
    height: placement.height + command.height,
  };
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
}
```

Define `KEY_COMMANDS` with the exact literal mappings from Step 1.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npm test -- tests/targetEditorKeyboard.test.ts`

Expected: all keyboard-rule tests PASS with no warnings.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/app/targetEditorKeyboard.ts tests/targetEditorKeyboard.test.ts
git commit -m "feat: add target editor keyboard commands"
```

---

### Task 2: Targets-page keyboard integration

**Files:**
- Modify: `src/main.ts`
- Create: `tests/targetEditorKeyboardIntegration.test.ts`

**Interfaces:**
- Consumes: all exports created by Task 1; existing `targetSelection`, `targetPlacement`, `updateSelectedTargetObjectPlacement`, `syncTargetPlacementInputs`, `updateTargetPreview`, `normalizeTargetEditorSelection`, and `ungroupTargetEditorGroup`
- Produces: page-level `handleTargetEditorKeyDown`, batch `removeTargetObjectsByIds`, and selection deletion behavior

- [ ] **Step 1: Write a failing selected-object movement test**

Build the integration fixture using the existing Cloudflare, auth, capture, MindAR, and `ImageTargetPreview` mock pattern:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TargetEditorGroup, TargetEditorSelection } from '../src/app/targetEditorGroups';
import type { TargetEditorObject } from '../src/app/targetEditorObjects';

const models = [
  { id: 'chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
  { id: 'lamp', label: 'Lamp', url: 'https://worker.example/lamp.glb' },
  { id: 'plant', label: 'Plant', url: 'https://worker.example/plant.glb' },
];
type PreviewUpdate = {
  objects: TargetEditorObject[];
  groups: TargetEditorGroup[];
  selection: TargetEditorSelection;
};
const previewUpdates: PreviewUpdate[] = [];

vi.mock('../src/app/cloudflareModels', () => ({
  DEFAULT_GENERATE_MODEL_API_URL: 'https://worker.example/generate-3d',
  loadCloudflareModelOptions: vi.fn(async () => models),
}));
vi.mock('../src/app/cloudImageTargets', () => ({
  createImageTarget: vi.fn(),
  deleteImageTarget: vi.fn(),
  listImageTargets: vi.fn(async () => []),
}));
vi.mock('../src/app/webArAuth', () => ({
  clearWorkerAuthToken: vi.fn(),
  getCurrentWebArUser: vi.fn(async () => ({ email: 'maker@example.com' })),
  loadWorkerAuthToken: vi.fn(() => 'token-123'),
  loginToWebArWorker: vi.fn(),
  saveWorkerAuthToken: vi.fn(),
  signupToWebArWorker: vi.fn(),
}));
vi.mock('../src/capture/cameraCapture', () => ({ imageFileToCapturedImage: vi.fn() }));
vi.mock('../src/ar/mindarRuntime', () => ({ startMarkerAR: vi.fn() }));
vi.mock('../src/scene/ImageTargetPreview', () => ({
  ImageTargetPreview: class {
    update = vi.fn(async (state: PreviewUpdate) => previewUpdates.push(structuredClone(state)));
    dispose = vi.fn();
  },
}));

beforeEach(() => {
  vi.resetModules();
  previewUpdates.length = 0;
  document.body.innerHTML = '<div id="app"></div>';
  window.localStorage.clear();
  window.history.replaceState(null, '', 'https://example.com/Mark-AR/#/targets');
});
```

```ts
it('moves the selected object anywhere on Targets and synchronizes its input', async () => {
  await import('../src/main');
  await waitFor(() => document.querySelectorAll('.target-model-card').length === 3);
  document.querySelector<HTMLButtonElement>('.target-model-card')!.click();
  await waitFor(() => latest().objects.length === 1);

  const event = dispatchEditorKey(document.body, 'ArrowRight');
  await waitFor(() => latest().objects[0]?.placement.offsetX === 0.05);

  expect(event.defaultPrevented).toBe(true);
  expect(document.querySelector<HTMLInputElement>('#target-offset-x')?.value).toBe('0.05');
});
```

Name the mutation caught: keeping keyboard behavior scoped to the canvas or updating only the preview instead of canonical state.

- [ ] **Step 2: Write failing route, typing, and no-selection tests**

```ts
it('leaves keyboard input alone while typing and when Targets is inactive', async () => {
  await import('../src/main');
  await waitFor(() => document.querySelectorAll('.target-model-card').length === 3);
  document.querySelector<HTMLButtonElement>('.target-model-card')!.click();
  await waitFor(() => latest().objects.length === 1);

  const label = document.querySelector<HTMLInputElement>('#target-label')!;
  const typingMove = dispatchEditorKey(label, 'ArrowRight');
  const typingDelete = dispatchEditorKey(label, 'Delete');

  expect(typingMove.defaultPrevented).toBe(false);
  expect(typingDelete.defaultPrevented).toBe(false);
  expect(latest().objects).toHaveLength(1);
  expect(latest().objects[0].placement.offsetX).toBe(0);

  document.querySelector<HTMLAnchorElement>('[data-route-link="home"]')!.click();
  await waitFor(() => document.querySelector('[data-app-shell]')?.getAttribute('data-active-page') === 'home');
  const inactiveMove = dispatchEditorKey(document.body, 'ArrowRight');

  expect(inactiveMove.defaultPrevented).toBe(false);
  expect(latest().objects[0].placement.offsetX).toBe(0);
});

it('does not consume supported keys without a selection', async () => {
  await import('../src/main');
  await waitFor(() => document.querySelector('[data-app-shell]')?.getAttribute('data-active-page') === 'targets');
  const event = dispatchEditorKey(document.body, 'PageUp');
  expect(event.defaultPrevented).toBe(false);
});
```

Use real DOM events and assert real editor state captured by preview updates; do not assert mock call counts.

- [ ] **Step 3: Write failing multi-selection and group tests**

```ts
it('moves and deletes multi-object and group selections as one selection', async () => {
  await import('../src/main');
  await waitFor(() => document.querySelectorAll('.target-model-card').length === 3);
  const cards = document.querySelectorAll<HTMLButtonElement>('.target-model-card');
  cards[0].click();
  cards[1].click();
  cards[2].click();
  await waitFor(() => latest().objects.length === 3);

  clickObject('chair');
  clickObject('lamp', { ctrlKey: true });
  const forwardStart = Object.fromEntries(
    latest().objects
      .filter((object) => modelIdOf(object) !== 'plant')
      .map((object) => [modelIdOf(object), object.placement.offsetY]),
  );

  dispatchEditorKey(document.body, 'ArrowUp');
  await waitFor(() => (
    latest().objects.find((object) => modelIdOf(object) === 'chair')!.placement.offsetY
      === forwardStart.chair - 0.05
    && latest().objects.find((object) => modelIdOf(object) === 'lamp')!.placement.offsetY
      === forwardStart.lamp - 0.05
  ));

  document.querySelector<HTMLButtonElement>('#group-selected-objects')!.click();
  await waitFor(() => latest().groups.length === 1);
  dispatchEditorKey(document.body, 'PageUp');
  await waitFor(() => latest().groups[0].placement.height === 0.14);

  dispatchEditorKey(document.body, 'Delete');
  await waitFor(() => latest().objects.length === 1);
  expect(latest().groups).toHaveLength(0);
  expect(modelIdOf(latest().objects[0])).toBe('plant');
});
```

Name the mutations caught: moving only the active member, failing to update the group pivot, and deleting only one group member.

Add these exact helpers below the tests:

```ts
function dispatchEditorKey(target: EventTarget, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function clickObject(modelId: string, modifiers: MouseEventInit = {}): void {
  const object = latest().objects.find((candidate) => modelIdOf(candidate) === modelId);
  document.querySelector<HTMLButtonElement>(`[data-select-target-object="${object?.id}"]`)!
    .dispatchEvent(new MouseEvent('click', { bubbles: true, ...modifiers }));
}

function modelIdOf(object: TargetEditorObject): string {
  return 'model' in object ? object.model.id : '';
}

function latest(): PreviewUpdate {
  return previewUpdates.at(-1) ?? { objects: [], groups: [], selection: { objectIds: [] } };
}

async function waitFor(assertion: () => boolean): Promise<void> {
  const timeoutAt = Date.now() + 1800;
  while (Date.now() < timeoutAt) {
    if (assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for target keyboard editor state');
}
```

- [ ] **Step 4: Run the integration test and verify RED**

Run: `npm test -- tests/targetEditorKeyboardIntegration.test.ts`

Expected: FAIL because no page-level keyboard handler exists.

- [ ] **Step 5: Add the page-level keyboard handler**

Import Task 1's helpers, register `window.addEventListener('keydown', handleTargetEditorKeyDown)`, and implement:

```ts
function handleTargetEditorKeyDown(event: KeyboardEvent): void {
  if (
    event.defaultPrevented
    || shell.dataset.activePage !== 'targets'
    || isEditableKeyboardTarget(event.target)
  ) return;

  const command = targetEditorKeyboardCommand(event);
  const hasSelection = targetSelection.objectIds.length > 0 || Boolean(targetSelection.groupId);
  if (!command || !hasSelection) return;

  if (command.type === 'delete') {
    removeSelectedTargetObjects();
  } else {
    updateSelectedTargetObjectPlacement(nudgeTargetPlacement(targetPlacement, command));
    const activeObject = getSelectedTargetObjects().at(-1);
    syncTargetPlacementInputs(targetPlacement, {
      local: Boolean(activeObject?.groupId && targetSelection.objectIds.length === 1),
    });
    void updateTargetPreview();
  }
  event.preventDefault();
}
```

Keep preview-canvas shortcuts safe by exiting when `event.defaultPrevented` is already true.

- [ ] **Step 6: Refactor deletion into one batch operation**

Change `removeTargetObjectById(id)` to delegate to `removeTargetObjectsByIds([id])`. Implement `removeSelectedTargetObjects()` by resolving either `targetSelection.objectIds` or all member IDs of `targetSelection.groupId`.

`removeTargetObjectsByIds` must:

```ts
const removedIds = new Set(objectIds);
const firstRemovedIndex = targetObjects.findIndex((object) => removedIds.has(object.id));
const removedObjects = targetObjects.filter((object) => removedIds.has(object.id));
targetObjects = targetObjects.filter((object) => !removedIds.has(object.id));

for (const groupId of new Set(removedObjects.flatMap((object) => object.groupId ? [object.groupId] : []))) {
  if (targetObjects.filter((object) => object.groupId === groupId).length < 2) {
    const ungrouped = ungroupTargetEditorGroup({ groupId, objects: targetObjects, groups: targetGroups });
    targetObjects = ungrouped.objects;
    targetGroups = ungrouped.groups;
  }
}
```

Then normalize selection, select the nearest remaining object when needed, synchronize the inspector and list, announce the result, and call `updateTargetPreview()` exactly once.

- [ ] **Step 7: Run focused integration and existing selection tests**

Run:

```bash
npm test -- tests/targetEditorKeyboardIntegration.test.ts tests/targetObjectControlsSelection.test.ts tests/targetGroupEditorIntegration.test.ts
```

Expected: all focused integration tests PASS with no warnings.

- [ ] **Step 8: Commit Task 2**

```bash
git add src/main.ts tests/targetEditorKeyboardIntegration.test.ts
git commit -m "feat: control selected target objects by keyboard"
```

---

### Task 3: Regression and browser verification

**Files:**
- Modify only if verification exposes a defect in Task 1 or Task 2 files

**Interfaces:**
- Consumes: completed keyboard command and Targets-page integration
- Produces: verified feature branch

- [ ] **Step 1: Run formatting and type/build verification**

Run:

```bash
git diff --check
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 2: Run the complete automated suite**

Run: `npm test`

Expected: every Vitest test passes with zero failures.

- [ ] **Step 3: Verify the local Targets route in a browser**

Open `http://127.0.0.1:5175/#/targets`, sign in only if an existing browser session already permits it, select an object, and verify:

- Arrow keys move on X/Z from outside the canvas.
- Page Up and Page Down change height.
- Placement sliders stay synchronized.
- Typing in an input does not move or delete.
- Delete removes the selection.

If authentication blocks the route, report that browser verification was limited to the visible sign-in gate and rely on the automated integration coverage for the authenticated editor.

- [ ] **Step 4: Review the final diff against the design**

Confirm every design requirement has a test or direct browser check, no unrelated user files are staged, and `git status --short` contains only expected feature changes plus the user's pre-existing untracked files.

- [ ] **Step 5: Commit verification fixes if needed**

If Task 3 required code changes:

```bash
git add <only-the-feature-files-that-changed>
git commit -m "fix: finalize keyboard object controls"
```

If no files changed, do not create an empty commit.

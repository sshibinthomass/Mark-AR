# Floor AR Transform Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a normal floor-AR video tap start playback without moving the experience, while requiring long-press selection before floor objects can be moved or scaled.

**Architecture:** The floor gesture controller will become a small tap/long-press/drag state machine. `TargetSceneObject` will expose stable per-object interaction wrappers, and `FloorPlacementRuntime` will own session-only selection scope, hit testing, outlines, and transforms. Floor UI state will explicitly carry selection state; marker/image-target AR remains unchanged.

**Tech Stack:** TypeScript 6, Three.js 0.150, WebXR, Vite 8, Vitest 4, happy-dom.

## Global Constraints

- Apply the feature only to floor AR. Do not change marker/image-target gestures or persistence.
- Use test-driven development for every behavior change: add a focused failing test, run it and confirm the expected failure, implement the smallest change, then rerun the focused test.
- Keep authored placement and animation on the existing object root. Apply viewer movement and scale only to a new identity interaction wrapper.
- Never reposition an already placed floor experience after a missed video tap.
- Keep the rotation range available without a selection and rotate the complete floor experience.
- Treat all selection transforms as session-only. Do not serialize them into target data.
- Preserve cleanup behavior for stopped, ended, relaunched, and disposed sessions.
- Run commands from `D:\Github-Projects\Mark-AR\.worktrees\floor-transform-selection`.

---

## Task 1: Make floor gestures distinguish taps, long presses, and selected drags

**Files:**

- Modify: `src/interaction/floorGestureController.ts`
- Modify: `tests/floorGestureController.test.ts`

- [ ] Add failing tests using Vitest fake timers for the complete state machine:
  - sub-threshold movement followed by release emits one tap and no drag;
  - movement at or above 12 px before 450 ms emits no tap and no drag while no transform is selected;
  - an unmoved 450 ms hold emits one long press;
  - movement after the long press emits drag deltas;
  - a later gesture emits drag after reaching the threshold when `isTransformActive()` returns true;
  - pinch continues to emit its multiplier;
  - touch cancel and `disconnect()` clear the long-press timer;
  - events originating inside `.youtube-css3d-player` are ignored by floor gestures.

- [ ] Run the focused test and verify RED:

```powershell
npx vitest run tests/floorGestureController.test.ts
```

- [ ] Replace the gesture callback shape with exact point-pair drag data:

```ts
export type Point2 = { x: number; y: number };

export type FloorDragGesture = {
  previous: Point2;
  current: Point2;
};

export type FloorGestureHandlers = {
  isTransformActive(): boolean;
  onTap(point: Point2): void;
  onLongPress(point: Point2): void;
  onDrag(gesture: FloorDragGesture): void;
  onPinch(multiplier: number): void;
};
```

- [ ] Implement these controller constants and states:

```ts
const MOVEMENT_THRESHOLD_PX = 12;
const LONG_PRESS_DELAY_MS = 450;

private longPressTimer: ReturnType<typeof setTimeout> | undefined;
private gestureStart: Point2 | undefined;
private previousPoint: Point2 | undefined;
private pendingPress = false;
private longPressFired = false;
private dragging = false;
```

- [ ] On one-finger start, record the start and previous points and schedule the 450 ms timer. The timer must emit `onLongPress(startPoint)` once only if the press is still pending and below the movement threshold.

- [ ] On one-finger move:
  - do nothing below the threshold while a press is pending;
  - crossing the threshold before long press cancels the pending tap;
  - if no transform is active, emit no drag for that gesture;
  - if a long press has selected a target, or a selection was already active at touch start, emit `{ previous, current }`;
  - update `previousPoint` after each emitted drag.

- [ ] On release, emit a tap only when the press is still pending, no long press fired, and total movement is below 12 px. Clear all transient state afterward.

- [ ] Cancel the timer and transient state on a second touch, pinch transition, `touchcancel`, and `disconnect()`.

- [ ] Add `.youtube-css3d-player` to the interactive-target exclusion selector so iframe player controls retain their own touch events.

- [ ] Run the focused test and verify GREEN:

```powershell
npx vitest run tests/floorGestureController.test.ts
```

- [ ] Commit:

```powershell
git add src/interaction/floorGestureController.ts tests/floorGestureController.test.ts
git commit -m "fix: separate floor taps from transform gestures"
```

---

## Task 2: Add stable authored-object interaction roots

**Files:**

- Modify: `src/ar/targetSceneObject.ts`
- Create: `src/ar/floorObjectTransform.ts`
- Modify: `src/ar/floorSceneTransform.ts`
- Modify: `tests/targetSceneObject.test.ts`
- Create: `tests/floorObjectTransform.test.ts`
- Modify: `tests/floorSceneTransform.test.ts`

- [ ] Add failing target-scene tests proving:
  - image, YouTube, text, and model objects each expose exactly one selectable entry;
  - the interaction root is the authored object root's direct parent;
  - the interaction root begins with identity position, rotation, and scale;
  - changing the interaction root survives `scene.update()` when the child has an authored animation;
  - a legacy fallback model is exposed as a selectable model;
  - existing YouTube surface metadata still points at the playable child plane.

- [ ] Add failing transform tests proving:
  - an individual interaction root moves by a world-space delta even under a transformed parent;
  - individual scale clamps to the same `0.1..5` range as whole-experience scale;
  - whole-experience movement by world delta preserves its floor height and existing rotation/scale.

- [ ] Run the focused tests and verify RED:

```powershell
npx vitest run tests/targetSceneObject.test.ts tests/floorObjectTransform.test.ts tests/floorSceneTransform.test.ts
```

- [ ] Define and expose exact selectable metadata:

```ts
export type TargetSceneSelectableKind = 'image' | 'youtube' | 'text' | 'model';

export type TargetSceneSelectableObject = {
  objectId: string;
  kind: TargetSceneSelectableKind;
  interactionRoot: THREE.Group;
  contentRoot: THREE.Group;
};

export type TargetSceneObject = {
  group: THREE.Group;
  ready: Promise<void>;
  youtubeSurfaces: readonly TargetSceneYouTubeSurface[];
  selectableObjects: readonly TargetSceneSelectableObject[];
  update(elapsedSeconds: number): void;
  dispose(): void;
};
```

- [ ] For every authored object, create an identity wrapper named `cloudflare-interaction-root-${objectId}`. Add the wrapper to the existing authored parent and add the existing `cloudflare-model-root-${objectId}` beneath it. Keep all authored placement and animation updates on the existing object root.

- [ ] Populate `selectableObjects` once per authored object using the normalized object kind. For loaded models, use the object content root so recursive raycasting sees descendant meshes. Include the legacy fallback model entry.

- [ ] Implement `FloorObjectTransform`:

```ts
export class FloorObjectTransform {
  constructor(private readonly root: THREE.Object3D) {}

  moveByWorldDelta(delta: THREE.Vector3): void;
  scaleBy(multiplier: number): void;
}
```

`moveByWorldDelta` must read the current world position, add `delta`, convert through `root.parent.worldToLocal`, and set the local position. `scaleBy` must apply a uniform scalar clamped to `0.1..5`.

- [ ] Add `FloorSceneTransform.moveByWorldDelta(delta: THREE.Vector3)` that offsets the whole placement root by the horizontal delta without changing its established `floorY`.

- [ ] Run the focused tests and verify GREEN:

```powershell
npx vitest run tests/targetSceneObject.test.ts tests/floorObjectTransform.test.ts tests/floorSceneTransform.test.ts
```

- [ ] Run marker-renderer regressions because the scene hierarchy is shared:

```powershell
npx vitest run tests/cloudflareMarkerObject.test.ts tests/targetSceneObject.test.ts
```

- [ ] Commit:

```powershell
git add src/ar/targetSceneObject.ts src/ar/floorObjectTransform.ts src/ar/floorSceneTransform.ts tests/targetSceneObject.test.ts tests/floorObjectTransform.test.ts tests/floorSceneTransform.test.ts
git commit -m "feat: expose floor selectable object roots"
```

---

## Task 3: Implement floor-session selection, outlines, and gated transforms

**Files:**

- Modify: `src/ar/floorPlacementRuntime.ts`
- Modify: `tests/floorPlacementRuntime.test.ts`

- [ ] Extend the runtime harness first, then add failing tests for:
  - every new session emits `{ selectAll: true, active: false }`;
  - `setSelectAll(false)` clears an existing selection and emits the new scope;
  - long press on an authored object with Select All on selects the placement root;
  - long press with Select All off selects only the closest authored object;
  - long press on empty floor is a no-op;
  - drag and pinch without selection do nothing;
  - individual drag/scale leaves sibling interaction roots unchanged;
  - whole-experience drag/scale changes the placement root;
  - the rotation controller works with no active selection and still rotates the whole experience;
  - a normal video tap activates playback and does not move the placement root;
  - a post-placement video miss never invokes `place()`;
  - while selected, tapping the selected target does not play video;
  - while selected, tapping outside clears selection;
  - `clearSelection()`, reset, session end, stop, relaunch, and dispose remove and dispose the outline;
  - gestures retained from an old session token cannot affect a newer session.

- [ ] Run the focused runtime test and verify RED:

```powershell
npx vitest run tests/floorPlacementRuntime.test.ts
```

- [ ] Add the public controller and hook contracts:

```ts
export type FloorTransformSelectionState = {
  selectAll: boolean;
  active: boolean;
  objectId?: string;
  label?: string;
};

export type FloorSelectionOutline = {
  object: THREE.Object3D;
  update(): void;
  dispose(): void;
};

export type FloorPlacementController = {
  launch(): Promise<void>;
  place(): void;
  setRotation(degrees: number): void;
  setSelectAll(enabled: boolean): void;
  clearSelection(): void;
  reset(): void;
  stop(): Promise<void>;
  dispose(): Promise<void>;
};
```

Add `onSelectionChange(state)` to `FloorPlacementRuntimeHooks`, and inject `createSelectionOutline(target)` through runtime dependencies. The production factory must construct a visible `THREE.BoxHelper`, expose it as `object`, update it every frame, and dispose its geometry/material.

- [ ] Represent active selection with a discriminated union:

```ts
type ActiveSelection =
  | { kind: 'all'; root: THREE.Group }
  | {
      kind: 'object';
      objectId: string;
      root: THREE.Group;
      contentRoot: THREE.Group;
      transform: FloorObjectTransform;
    };
```

- [ ] Reset scope to Select All and clear selection on every successful new session. Changing scope clears selection before emitting the new scope. `reset()` clears selection but keeps the current scope until a new session starts.

- [ ] Use the synchronized current XR camera for all selection and transform raycasts. Raycast recursively against each `selectable.contentRoot` and choose the closest hit. With Select All enabled, any authored-object hit activates the placement root; otherwise activate that entry's interaction root.

- [ ] On an active selection, add its outline object to the Three scene, update it every render frame, and remove/dispose it on every deselection and cleanup path.

- [ ] Process drag point pairs by intersecting both normalized screen points against a horizontal plane through the selected root's world position. Subtract the two intersections and:
  - call `FloorSceneTransform.moveByWorldDelta` for Select All;
  - call `FloorObjectTransform.moveByWorldDelta` for one object.

- [ ] Gate pinch scaling on active selection. Route it to whole-scene or object transform based on the active selection.

- [ ] Implement tap ordering exactly:
  1. if the scene is not placed, place it;
  2. if a selection is active, clear only when the tap misses the selected recursive target, and never start playback;
  3. otherwise attempt YouTube activation;
  4. consume both activation success and player-initialization failure;
  5. do nothing on a YouTube miss or when there is no YouTube manager.

- [ ] Keep `setRotation()` independent of selection and routed to `FloorSceneTransform.rotateTo`.

- [ ] Run the focused test and verify GREEN:

```powershell
npx vitest run tests/floorPlacementRuntime.test.ts
```

- [ ] Run the complete AR unit subset:

```powershell
npx vitest run tests/floorGestureController.test.ts tests/floorPlacementRuntime.test.ts tests/floorSceneTransform.test.ts tests/floorObjectTransform.test.ts tests/targetSceneObject.test.ts tests/youtubeArPlaybackManager.test.ts tests/markerScannerRuntime.test.ts
```

- [ ] Commit:

```powershell
git add src/ar/floorPlacementRuntime.ts tests/floorPlacementRuntime.test.ts
git commit -m "feat: add floor transform selection runtime"
```

---

## Task 4: Add floor-only Select All and Done controls

**Files:**

- Modify: `src/ui/appShell.ts`
- Modify: `src/ui/floorPlacementUi.ts`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Modify: `src/styles/arvenilo-redesign.css`
- Modify: `tests/appShell.test.ts`
- Modify: `tests/floorPlacementUi.test.ts`
- Modify: `tests/floorPlacementStyles.test.ts`
- Modify: `tests/targetSpecificScanIntegration.test.ts`

- [ ] Add failing shell tests proving the floor overlay, and only the floor overlay, includes:

```html
<button id="floor-ar-select-all" type="button" aria-pressed="true">Select all</button>
<button id="floor-ar-selection-done" type="button" hidden>Done</button>
<p id="floor-ar-selection-hint">Long press an object to move or scale it.</p>
```

- [ ] Add failing UI-state tests proving:
  - controls are hidden before placement;
  - Select All is pressed by default when placed;
  - Done appears only with an active selection;
  - object scope updates `aria-pressed` to false;
  - selection state remains correct while a playback-error status is rendered.

- [ ] Add failing integration tests proving:
  - clicking Select All calls `controller.setSelectAll(false)`, and a second click calls `true`;
  - clicking Done calls `controller.clearSelection()`;
  - runtime selection callbacks rerender controls without losing the current floor status;
  - reset clears the active selection presentation;
  - marker/image-target UI contains none of these controls.

- [ ] Run the focused UI tests and verify RED:

```powershell
npx vitest run tests/appShell.test.ts tests/floorPlacementUi.test.ts tests/floorPlacementStyles.test.ts tests/targetSpecificScanIntegration.test.ts
```

- [ ] Add explicit selection presentation state:

```ts
export type FloorTransformSelectionUiState = {
  selectAll: boolean;
  active: boolean;
  label?: string;
};

export const DEFAULT_FLOOR_TRANSFORM_SELECTION_UI: FloorTransformSelectionUiState = {
  selectAll: true,
  active: false,
};
```

Extend `applyFloorPlacementUi(root, state, selection)` so it updates visibility, `aria-pressed`, Done, and hint while preserving all existing preparing/ready/placed/playback-error rules.

- [ ] Add the three controls to the floor overlay in `appShell.ts`, adjacent to the existing Place/rotation/Reset controls.

- [ ] In `main.ts`, query the controls, keep a separate `floorTransformSelectionUi` value, and always pass it alongside `floorUiState` to `applyFloorPlacementUi`.

- [ ] Wire controller callbacks and controls:
  - `onSelectionChange` updates the UI state;
  - Select All click passes `!current.selectAll`;
  - Done click calls `clearSelection()`;
  - session startup and runtime cleanup callbacks restore the emitted state rather than guessing locally.

- [ ] Style the toggle as a compact floor control, distinguish `aria-pressed="true"`, keep Done visible beside it only in transform mode, and add responsive rules matching the existing floor-control breakpoints.

- [ ] Run the focused UI tests and verify GREEN:

```powershell
npx vitest run tests/appShell.test.ts tests/floorPlacementUi.test.ts tests/floorPlacementStyles.test.ts tests/targetSpecificScanIntegration.test.ts
```

- [ ] Commit:

```powershell
git add src/ui/appShell.ts src/ui/floorPlacementUi.ts src/main.ts src/style.css src/styles/arvenilo-redesign.css tests/appShell.test.ts tests/floorPlacementUi.test.ts tests/floorPlacementStyles.test.ts tests/targetSpecificScanIntegration.test.ts
git commit -m "feat: add floor transform selection controls"
```

---

## Task 5: Deep verification and browser regression

**Files:**

- Modify only files required by failures uncovered in this task.

- [ ] Run the complete test suite:

```powershell
npm test
```

- [ ] Run production and worker validation:

```powershell
npm run build
npm run worker:check
npm audit --audit-level=high
```

- [ ] Start the development server on an available local port and use the in-app browser to verify the non-XR UI:
  - Select All is visible only after the floor experience reaches placed state;
  - it defaults to active;
  - toggling it updates the pressed state;
  - Done appears only when the runtime reports a selection;
  - existing floor status and playback-error rendering remain readable at desktop and mobile widths;
  - marker/image-target scanner controls are unchanged.

- [ ] Where the browser environment cannot provide Android WebXR hit testing or camera permissions, record that device-only boundary explicitly. Do not claim physical touch/AR playback was browser-automated unless it was.

- [ ] Review the final diff for:
  - accidental image-target AR changes;
  - persisted viewer transforms;
  - leaked timers, outlines, materials, or event listeners;
  - post-placement calls to `place()` from tap misses;
  - unfinished implementation markers or temporary debug output.

- [ ] Re-run focused interaction tests after any review fixes:

```powershell
npx vitest run tests/floorGestureController.test.ts tests/floorPlacementRuntime.test.ts tests/targetSpecificScanIntegration.test.ts
```

- [ ] If verification required code changes, stage the exact changed implementation
  and test paths shown by `git status --short`, then commit them with
  `git commit -m "test: harden floor transform selection"`.

- [ ] Invoke `superpowers:verification-before-completion`, inspect `git status --short`, and report the exact test/build results plus the device-only verification boundary.

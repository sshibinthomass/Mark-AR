# Exact Preview-to-AR Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each MindAR target reproduce the 3D target preview's positions, depth order, scale, combined rotations, text orientation, groups, and animation exactly relative to the saved image target.

**Architecture:** Put every scanned target object beneath one `cloudflare-preview-space` group rotated `+90°` around X, then apply the exact Y-up local transforms used by the editor preview. Extract authored placement/animation application and GLB normalization into shared scene helpers so preview and scan cannot drift independently.

**Tech Stack:** TypeScript 6, Three.js 0.150, MindAR image tracking, Vitest 4 with happy-dom, Vite 8, GitHub Pages.

## Global Constraints

- The phone camera may change apparent perspective, but every scene transform must remain exact relative to the image target.
- Existing Worker/R2 target records must work without migration or resaving.
- Preserve current sharing permissions, authentication, target URLs, preview camera controls, and saved preview camera values.
- Do not add camera-facing or billboard behavior to text.
- Preserve model-load fallbacks and current normalization of invalid placement and animation input.
- Work only in `D:\Github-Projects\Mark-AR\.worktrees\exact-preview-ar-parity`; do not modify the unrelated model-loader changes in the main checkout.

---

### Task 1: Share authored placement and animation transforms

**Files:**
- Create: `src/scene/targetObjectTransform.ts`
- Create: `tests/targetObjectTransform.test.ts`
- Modify: `src/scene/ImageTargetPreview.ts:1-35, 275-285, 802-870, 895-910, 1010-1030`

**Interfaces:**
- Consumes: `ImageTargetPlacement`, `ImageTargetAnimation`, and `evaluateAnimationFrame(...)`.
- Produces: `applyTargetPlacement(root: Object3D, placement: ImageTargetPlacement): void` and `applyTargetAnimation(root: Object3D, placement: ImageTargetPlacement, animation: ImageTargetAnimation, elapsedSeconds: number): void`.

- [ ] **Step 1: Write the failing shared-transform test**

Create `tests/targetObjectTransform.test.ts`:

```ts
import { Group } from 'three';
import { describe, expect, it } from 'vitest';
import { applyTargetAnimation, applyTargetPlacement } from '../src/scene/targetObjectTransform';

describe('target object transforms', () => {
  it('applies saved placement in the preview Y-up coordinate frame', () => {
    const root = new Group();

    applyTargetPlacement(root, {
      scale: 1.5,
      offsetX: 0.2,
      offsetY: -0.3,
      height: 0.4,
      rotationX: 10,
      rotationY: 20,
      rotationZ: 30,
    });

    expect(root.position.toArray()).toEqual([0.2, 0.4, -0.3]);
    expect(root.scale.toArray()).toEqual([1.5, 1.5, 1.5]);
    expect(root.rotation.x).toBeCloseTo(Math.PI / 18);
    expect(root.rotation.y).toBeCloseTo(Math.PI / 9);
    expect(root.rotation.z).toBeCloseTo(Math.PI / 6);
  });

  it('applies animation in the same local axes as the preview', () => {
    const root = new Group();
    const placement = {
      scale: 2,
      offsetX: 0.2,
      offsetY: 0.1,
      height: 0.3,
      rotationX: 10,
      rotationY: 20,
      rotationZ: 30,
    };

    applyTargetAnimation(root, placement, {
      preset: 'custom',
      tracks: [
        { property: 'positionY', motion: 'smooth', amount: 0.4, speed: 0.5, phase: 0 },
        { property: 'rotationY', motion: 'spin', amount: 360, speed: 0.5, phase: 0 },
        { property: 'scale', motion: 'smooth', amount: 0.25, speed: 0.5, phase: 0 },
      ],
    }, 0.5);

    expect(root.position.toArray()).toEqual([0.2, 0.7, 0.1]);
    expect(root.rotation.x).toBeCloseTo(Math.PI / 18);
    expect(root.rotation.y).toBeCloseTo(Math.PI / 9 + Math.PI / 2);
    expect(root.rotation.z).toBeCloseTo(Math.PI / 6);
    expect(root.scale.x).toBeCloseTo(2.5);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm test -- tests/targetObjectTransform.test.ts
```

Expected: FAIL because `src/scene/targetObjectTransform.ts` does not exist.

- [ ] **Step 3: Implement the shared transform helper**

Create `src/scene/targetObjectTransform.ts`:

```ts
import type { Object3D } from 'three';
import { evaluateAnimationFrame, type ImageTargetAnimation } from '../app/imageTargetAnimation';
import type { ImageTargetPlacement } from '../app/imageTargetPayload';

export function applyTargetPlacement(root: Object3D, placement: ImageTargetPlacement): void {
  root.position.set(placement.offsetX, placement.height, placement.offsetY);
  root.scale.setScalar(placement.scale);
  root.rotation.set(
    degreesToRadians(placement.rotationX),
    degreesToRadians(placement.rotationY),
    degreesToRadians(placement.rotationZ),
  );
}

export function applyTargetAnimation(
  root: Object3D,
  placement: ImageTargetPlacement,
  animation: ImageTargetAnimation,
  elapsedSeconds: number,
): void {
  const frame = evaluateAnimationFrame(animation, elapsedSeconds);
  root.position.set(
    placement.offsetX + frame.position.x,
    placement.height + frame.position.y,
    placement.offsetY + frame.position.z,
  );
  root.scale.setScalar(placement.scale * frame.scaleMultiplier);
  root.rotation.set(
    degreesToRadians(placement.rotationX) + frame.rotationRadians.x,
    degreesToRadians(placement.rotationY) + frame.rotationRadians.y,
    degreesToRadians(placement.rotationZ) + frame.rotationRadians.z,
  );
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
```

- [ ] **Step 4: Route `ImageTargetPreview` through the helper**

In `src/scene/ImageTargetPreview.ts`:

```ts
import { normalizeAnimation, type ImageTargetAnimation } from '../app/imageTargetAnimation';
import { applyTargetAnimation, applyTargetPlacement } from './targetObjectTransform';
```

Replace every `this.applyPlacementToRoot(root, placement)` with `applyTargetPlacement(root, placement)`. Replace animation application with:

```ts
applyTargetAnimation(root, placement, animation, this.elapsedSeconds);
```

Delete the private `applyPlacementToRoot(...)` and `applyAnimatedPlacement(...)` methods and the now-unused local `degreesToRadians(...)` function. Keep the selection, drag, group, and callback behavior unchanged.

- [ ] **Step 5: Verify GREEN and preview regressions**

Run:

```powershell
npm test -- tests/targetObjectTransform.test.ts tests/imageTargetPreview.test.ts
```

Expected: both files pass; the existing preview placement, text, group, drag, and animation tests remain green.

- [ ] **Step 6: Commit Task 1**

```powershell
git add src/scene/targetObjectTransform.ts src/scene/ImageTargetPreview.ts tests/targetObjectTransform.test.ts
git commit -m "refactor: share target object transforms"
```

---

### Task 2: Share model normalization and authored model size

**Files:**
- Create: `src/scene/targetModelNormalization.ts`
- Create: `tests/targetModelNormalization.test.ts`
- Modify: `src/scene/ImageTargetPreview.ts:1-25, 1294-1320`
- Modify: `src/ar/cloudflareMarkerObject.ts:1-12, 190-218`

**Interfaces:**
- Consumes: a loaded Three.js `Group` and a caller-selected wrapper name.
- Produces: `NORMALIZED_TARGET_MODEL_SIZE = 0.36` and `createNormalizedTargetModelGroup(scene: Group, wrapperName: string): Group`.

- [ ] **Step 1: Write the failing normalization test**

Create `tests/targetModelNormalization.test.ts`:

```ts
import { Box3, BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  createNormalizedTargetModelGroup,
  NORMALIZED_TARGET_MODEL_SIZE,
} from '../src/scene/targetModelNormalization';

describe('target model normalization', () => {
  it('normalizes every runtime to the same size, center, and floor', () => {
    const scene = new Group();
    scene.add(new Mesh(new BoxGeometry(2, 4, 1)));

    const wrapper = createNormalizedTargetModelGroup(scene, 'normalized-target-model');
    const bounds = new Box3().setFromObject(wrapper);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());

    expect(wrapper.name).toBe('normalized-target-model');
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(NORMALIZED_TARGET_MODEL_SIZE);
    expect(center.x).toBeCloseTo(0);
    expect(center.z).toBeCloseTo(0);
    expect(bounds.min.y).toBeCloseTo(0);
    expect(wrapper.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm test -- tests/targetModelNormalization.test.ts
```

Expected: FAIL because `src/scene/targetModelNormalization.ts` does not exist.

- [ ] **Step 3: Implement the shared normalization helper**

Create `src/scene/targetModelNormalization.ts`:

```ts
import { Box3, Group, Vector3 } from 'three';

export const NORMALIZED_TARGET_MODEL_SIZE = 0.36;

export function createNormalizedTargetModelGroup(scene: Group, wrapperName: string): Group {
  const wrapper = new Group();
  wrapper.name = wrapperName;

  const bounds = new Box3().setFromObject(scene);
  const size = bounds.getSize(new Vector3());
  const largestDimension = Math.max(size.x, size.y, size.z);
  if (Number.isFinite(largestDimension) && largestDimension > 0) {
    scene.scale.setScalar(NORMALIZED_TARGET_MODEL_SIZE / largestDimension);
  }

  const scaledBounds = new Box3().setFromObject(scene);
  const center = scaledBounds.getCenter(new Vector3());
  scene.position.set(-center.x, -scaledBounds.min.y, -center.z);
  wrapper.add(scene);
  return wrapper;
}
```

- [ ] **Step 4: Use the helper in preview and scan loaders**

In `src/scene/ImageTargetPreview.ts`, import the helper, remove `Box3` and `Vector3` imports if unused, and make the default loader:

```ts
async function defaultLoadModel(url: string): Promise<Group> {
  const gltf = await new GLTFLoader().loadAsync(url);
  return createNormalizedTargetModelGroup(gltf.scene, 'image-target-preview-model');
}
```

Delete the local `createNormalizedModelGroup(...)` function.

In `src/ar/cloudflareMarkerObject.ts`, import the helper, remove `Box3` and `Vector3`, and make the GLB loader:

```ts
async function loadGltfModelGroup(modelUrl: string): Promise<Group> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(modelUrl);
  return createNormalizedTargetModelGroup(gltf.scene, 'cloudflare-loaded-model');
}
```

Delete `normalizeGltfScene(...)` and the GLB wrapper's scan-only `rotation.x = Math.PI / 2`.

- [ ] **Step 5: Verify GREEN and loader regressions**

Run:

```powershell
npm test -- tests/targetModelNormalization.test.ts tests/imageTargetPreview.test.ts tests/cloudflareMarkerObject.test.ts
```

Expected: all focused tests pass. The scan's injected-loader tests do not depend on the removed default-loader basis rotation; Task 3 changes the scene coordinate layout separately.

- [ ] **Step 6: Commit Task 2**

```powershell
git add src/scene/targetModelNormalization.ts src/scene/ImageTargetPreview.ts src/ar/cloudflareMarkerObject.ts tests/targetModelNormalization.test.ts
git commit -m "refactor: share target model normalization"
```

---

### Task 3: Render the entire scan beneath one preview-space basis

**Files:**
- Modify: `src/ar/cloudflareMarkerObject.ts:45-175`
- Modify: `tests/cloudflareMarkerObject.test.ts:1-270`

**Interfaces:**
- Consumes: `applyTargetPlacement(...)`, `applyTargetAnimation(...)`, normalized groups/objects, and the existing saved target record.
- Produces: a named `cloudflare-preview-space` group with `rotation.x = Math.PI / 2`; every target group, model root, text root, fallback, and animation remains in authored preview-local coordinates below it.

- [ ] **Step 1: Write the failing exact-parity regression**

Add Three.js `Euler`, `Matrix4`, `Quaternion`, and `Vector3` imports to `tests/cloudflareMarkerObject.test.ts`, then add:

```ts
it('preserves the complete preview transform beneath one MindAR basis', async () => {
  const textModel = new Group();
  const markerObject = createCloudflareMarkerObject({
    groups: [{
      id: 'room',
      label: 'Room',
      placement: {
        scale: 1.2,
        offsetX: 0.3,
        offsetY: -0.25,
        height: 0.4,
        rotationX: 10,
        rotationY: 20,
        rotationZ: 30,
      },
    }],
    objects: [
      {
        id: 'chair',
        model: { id: 'chair', label: 'Chair', url: 'chair.glb' },
        groupId: 'room',
        localPlacement: {
          scale: 0.8,
          offsetX: -0.2,
          offsetY: 0.15,
          height: 0.1,
          rotationX: -15,
          rotationY: 25,
          rotationZ: 40,
        },
        placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0, rotationX: 0, rotationY: 0, rotationZ: 0 },
      },
      {
        kind: 'text',
        id: 'title',
        text: { value: 'Exact AR', language: 'english', font: 'studio-sans' },
        placement: {
          scale: 1.1,
          offsetX: 0.25,
          offsetY: -0.1,
          height: 0.22,
          rotationX: 5,
          rotationY: 15,
          rotationZ: -10,
        },
      },
    ],
    loadModelGroup: async () => new Group(),
    createTextObject: () => textModel,
  });
  await Promise.resolve();

  const previewSpace = markerObject.group.getObjectByName('cloudflare-preview-space') as Group;
  const groupRoot = markerObject.group.getObjectByName('cloudflare-group-root-room') as Group;
  const chairRoot = markerObject.group.getObjectByName('cloudflare-model-root-chair') as Group;
  const textRoot = markerObject.group.getObjectByName('cloudflare-model-root-title') as Group;

  expect(previewSpace.parent).toBe(markerObject.group);
  expect(previewSpace.rotation.x).toBeCloseTo(Math.PI / 2);
  expect(groupRoot.parent).toBe(previewSpace);
  expect(chairRoot.parent).toBe(groupRoot);
  expect(textRoot.parent).toBe(previewSpace);
  expect(groupRoot.position.toArray()).toEqual([0.3, 0.4, -0.25]);
  expect(chairRoot.position.toArray()).toEqual([-0.2, 0.1, 0.15]);
  expect(textRoot.position.toArray()).toEqual([0.25, 0.22, -0.1]);

  markerObject.group.updateMatrixWorld(true);
  const authoredTextMatrix = new Matrix4().compose(
    new Vector3(0.25, 0.22, -0.1),
    new Quaternion().setFromEuler(new Euler(5 * Math.PI / 180, 15 * Math.PI / 180, -10 * Math.PI / 180)),
    new Vector3(1.1, 1.1, 1.1),
  );
  const expectedTextWorld = new Matrix4()
    .makeRotationX(Math.PI / 2)
    .multiply(authoredTextMatrix);

  const authoredGroupMatrix = new Matrix4().compose(
    new Vector3(0.3, 0.4, -0.25),
    new Quaternion().setFromEuler(new Euler(10 * Math.PI / 180, 20 * Math.PI / 180, 30 * Math.PI / 180)),
    new Vector3(1.2, 1.2, 1.2),
  );
  const authoredChairMatrix = new Matrix4().compose(
    new Vector3(-0.2, 0.1, 0.15),
    new Quaternion().setFromEuler(new Euler(-15 * Math.PI / 180, 25 * Math.PI / 180, 40 * Math.PI / 180)),
    new Vector3(0.8, 0.8, 0.8),
  );
  const expectedChairWorld = new Matrix4()
    .makeRotationX(Math.PI / 2)
    .multiply(authoredGroupMatrix)
    .multiply(authoredChairMatrix);

  textRoot.matrixWorld.elements.forEach((value, index) => {
    expect(value).toBeCloseTo(expectedTextWorld.elements[index]);
  });
  chairRoot.matrixWorld.elements.forEach((value, index) => {
    expect(value).toBeCloseTo(expectedChairWorld.elements[index]);
  });
});
```

The element-by-element assertions avoid adding a custom matcher while still proving the complete grouped-model and text world matrices.

- [ ] **Step 2: Run the regression and verify RED**

Run:

```powershell
npm test -- tests/cloudflareMarkerObject.test.ts
```

Expected: FAIL because `cloudflare-preview-space` does not exist and static roots still use scan-specific coordinates.

- [ ] **Step 3: Add the single preview-space basis and shared transforms**

In `src/ar/cloudflareMarkerObject.ts`, import the shared helpers and remove scan-local placement/animation helpers:

```ts
import { applyTargetAnimation, applyTargetPlacement } from '../scene/targetObjectTransform';
```

Immediately after creating `group`, create the only coordinate conversion:

```ts
const previewSpace = new Group();
previewSpace.name = 'cloudflare-preview-space';
previewSpace.rotation.x = Math.PI / 2;
group.add(previewSpace);
```

Apply and parent group roots with:

```ts
applyTargetPlacement(root, placement);
previewSpace.add(root);
```

Apply and parent object/text roots with:

```ts
applyTargetPlacement(modelRoot, placement);
(parentGroup ?? previewSpace).add(modelRoot);
```

Update animation with:

```ts
applyTargetAnimation(
  animatedRoot.root,
  animatedRoot.placement,
  animatedRoot.animation,
  animatedRoot.elapsedSeconds,
);
```

Delete `applyPlacement(...)`, `applyAnimation(...)`, and the local `degreesToRadians(...)`. Do not rotate GLBs, text, individual groups, or individual objects to compensate for MindAR.

- [ ] **Step 4: Update old scan-specific assertions to authored local coordinates**

In `tests/cloudflareMarkerObject.test.ts`, retain all hierarchy/load/fallback assertions, but make local transform expectations match preview semantics:

```ts
expect(groupRoot.position.toArray()).toEqual([0.2, 0.3, -0.1]);
expect(orphanRoot.parent?.name).toBe('cloudflare-preview-space');

markerObject.update(0.5);
expect(groupRoot.position.toArray()).toEqual([0.2, 0.4, -0.1]);
expect(chairRoot.rotation.y).toBeCloseTo(0);
expect(chairRoot.rotation.z).toBeCloseTo(Math.PI / 6);
```

For ungrouped objects, assert `position = [offsetX, height, offsetY]` and the exact saved local Euler components. For animated objects, assert the same local values as `tests/imageTargetPreview.test.ts` at `0.5s` and `1.0s`. For text, assert its authored position and Euler rotation plus ancestry beneath `cloudflare-preview-space`.

- [ ] **Step 5: Verify GREEN for static, grouped, text, and animated parity**

Run:

```powershell
npm test -- tests/targetObjectTransform.test.ts tests/targetModelNormalization.test.ts tests/imageTargetPreview.test.ts tests/cloudflareMarkerObject.test.ts
```

Expected: all focused files pass. The Turntable test must prove local preview `rotationY` remains positive Y while its world axis is positive MindAR Z through the basis parent.

- [ ] **Step 6: Commit Task 3**

```powershell
git add src/ar/cloudflareMarkerObject.ts tests/cloudflareMarkerObject.test.ts
git commit -m "fix: preserve preview transforms in AR"
```

---

### Task 4: Verify, review, merge, and publish the parity fix

**Files:**
- Verify: all source and test changes from Tasks 1-3
- Preserve: unrelated dirty files in `D:\Github-Projects\Mark-AR`

**Interfaces:**
- Consumes: the completed exact-parity branch.
- Produces: a reviewed commit series merged to `main`, pushed to GitHub, deployed to Pages, and smoke-tested at the saved target URL.

- [ ] **Step 1: Run the complete verification gate**

```powershell
npm test
npm run build
git diff --check main...HEAD
git status --short --branch
```

Expected: 0 failing tests, successful TypeScript/Vite build, no whitespace errors, and only intentional branch changes.

- [ ] **Step 2: Inspect requirement coverage**

Confirm from tests and source:

```text
Static position/order -> preview local coordinates below one basis root
Combined rotation     -> authored Euler/quaternion preserved below basis
Text orientation      -> same basis and authored rotation as models
Groups/local children -> same hierarchy and local placement as preview
Animation             -> shared transform evaluator and authored axes
Scale/normalization   -> shared 0.36 normalization helper
Saved data            -> no schema/API changes
```

- [ ] **Step 3: Request independent code review**

Use the `superpowers:requesting-code-review` skill with base `6082ce0b39b2f9820227d335d6573852a47e4429` and the branch HEAD. Resolve every Critical or Important finding, then rerun Step 1.

- [ ] **Step 4: Merge without touching unrelated loader work**

From `D:\Github-Projects\Mark-AR`, confirm `main` and `origin/main` have not diverged, then fast-forward:

```powershell
git fetch origin main
git rev-list --left-right --count main...origin/main
git merge --ff-only codex/exact-preview-ar-parity
```

Expected: `0 0` before merge and a fast-forward containing only the design, shared-transform, normalization, parity-test, and runtime commits. Preserve the existing modified loader files and untracked loader docs.

- [ ] **Step 5: Verify the merged checkout and push**

```powershell
npm test
npm run build
git push origin main
```

Expected: tests/build pass and `origin/main` advances to the parity branch HEAD.

- [ ] **Step 6: Watch Pages and verify the live scan**

```powershell
$run = gh run list --workflow deploy-pages.yml --branch main --limit 1 --json databaseId,headSha,status,conclusion,url | ConvertFrom-Json
$run | ConvertTo-Json -Compress
gh run watch $run[0].databaseId --exit-status
$headSha = git rev-parse HEAD
curl.exe -fsSL -D - "https://sshibinthomass.github.io/Mark-AR/?v=$headSha"
```

Expected: Pages workflow succeeds, live HTML is HTTP `200`, and it references the newly built asset.

Open:

```text
https://sshibinthomass.github.io/Mark-AR/#/scan/2985707b-ebae-4d4e-b674-33552c5d7388
```

Expected browser status: `Camera active. Scan download (1).` Record that physical target presentation remains the user's final visual confirmation of camera-pose-dependent rendering.

- [ ] **Step 7: Clean up the owned worktree after successful merge/deploy**

From `D:\Github-Projects\Mark-AR`:

```powershell
git worktree remove .worktrees\exact-preview-ar-parity
git worktree prune
git branch -d codex/exact-preview-ar-parity
```

Expected: only the owned parity worktree/branch is removed; the unrelated `cloud-image-targets` worktree and dirty loader files remain untouched.

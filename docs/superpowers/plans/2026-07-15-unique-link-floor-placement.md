# Unique-Link Floor Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep automatic image-target scanning on every authorized `#/scan/<scan_id>` link and add a native Mark-AR floor mode that places the complete saved scene together.

**Architecture:** Extract the saved model/text/group graph into a runtime-neutral Y-up scene object, retain the current MindAR basis wrapper, and add a focused Three.js/WebXR floor runtime with hit testing and whole-root controls. A small UI state helper and a versioned coordinator in `src/main.ts` switch between the existing marker session and the prepared floor session without redirecting to Web-AR or changing Worker data.

**Tech Stack:** TypeScript 6, Three.js 0.150, direct WebXR `requestSession`, WebXR hit-test, Vite 8, Vitest 4, happy-dom.

## Global Constraints

- Everything runs inside Mark-AR; Web-AR is only a behavioral reference and must not become a frontend redirect, embed, import, or runtime dependency.
- `#/scan/<scan_id>` must retain its current focused fetch, permissions, authentication return flow, and automatic MindAR startup.
- `Place on floor` is available only for an authorized target-specific link; generic `#/scan` remains unchanged.
- The complete saved scene is placed as one root, preserving models, text, groups, local/global transforms, authored heights, and animation tracks.
- Animation support means the saved `ImageTargetAnimation` tracks already used by Mark-AR; do not add unrelated GLTF clip playback in this feature.
- Floor controls move, uniformly scale, rotate, reset, and re-place the whole scene; they never separate or edit individual saved objects.
- Floor placement requires a real horizontal WebXR hit-test pose; do not estimate a floor below the camera.
- No Web-AR Worker schema, route, or saved-target metadata changes are allowed.
- Preserve all pre-existing uncommitted target-model-loader changes in `src/main.ts`, `src/style.css`, `src/ui/modelRail.ts`, and their tests.
- Use the stable copy `Place on floor`, `Place`, `Scan image`, `Reset`, and `Restart floor AR`.
- Desktop/unsupported devices must keep marker scanning usable and show `Floor placement needs Android Chrome with WebXR. Image scanning is still available.`

---

## File Structure

- Create `src/ar/targetSceneObject.ts`: assemble one Y-up saved scene, expose readiness, animation updates, and disposal.
- Modify `src/scene/textObject3d.ts`: expose text readiness/disposal while retaining the synchronous compatibility wrapper.
- Modify `src/ar/cloudflareMarkerObject.ts`: retain only the MindAR basis adapter around `targetSceneObject`.
- Modify `src/ar/arObjects.ts` and `src/ar/mindarRuntime.ts`: allow marker objects to dispose loaded scene resources on session stop.
- Create `src/ar/floorHitTest.ts`: acquire and validate horizontal hit poses and drive the reticle.
- Create `src/ar/floorSceneTransform.ts`: place and manipulate one complete scene root.
- Create `src/interaction/floorGestureController.ts`: map tap, drag, and pinch input without consuming button/input gestures.
- Create `src/ar/floorSessionLauncher.ts`: preflight WebXR support and synchronously request the immersive session from the user's click.
- Create `src/ar/floorPlacementRuntime.ts`: renderer/scene lifecycle, hit testing, whole-root controls, scene loading, and public controller.
- Create `src/ui/floorPlacementUi.ts`: apply the finite UI states without putting DOM branching in `main.ts`.
- Modify `src/ui/appShell.ts`: add the floor stage, overlay, gesture surface, and controls to the existing scanner panel.
- Modify `src/main.ts`: prepare floor mode for focused links, preserve user activation, coordinate starts/stops, and reject stale async starts.
- Modify `src/style.css`: style the floor stage/overlay/reticle controls within the current Mark-AR visual system and mobile safe areas.
- Add focused tests under `tests/` and extend `tests/targetSpecificScanIntegration.test.ts`, `tests/appShell.test.ts`, and `tests/mindarRuntime.test.ts`.

---

### Task 1: Runtime-Neutral Saved Target Scene

**Files:**
- Create: `src/ar/targetSceneObject.ts`
- Modify: `src/ar/cloudflareMarkerObject.ts`
- Modify: `src/ar/arObjects.ts`
- Modify: `src/ar/mindarRuntime.ts`
- Modify: `src/scene/textObject3d.ts`
- Create: `tests/targetSceneObject.test.ts`
- Modify: `tests/cloudflareMarkerObject.test.ts`
- Modify: `tests/mindarRuntime.test.ts`
- Modify: `tests/textObject3d.test.ts`

**Interfaces:**
- Consumes: existing `CloudflarePlacedAsset`, `CloudflarePlacedObject`, `ModelGroupLoader`, placement/group/text/animation helpers.
- Produces:

```ts
export type TargetSceneLoadMode = 'fallback' | 'strict';

export type TargetSceneObject = {
  group: Group;
  ready: Promise<void>;
  update(deltaSeconds: number): void;
  dispose(): void;
};

export function createTargetSceneObject(
  asset: CloudflarePlacedAsset,
  options?: { loadMode?: TargetSceneLoadMode },
): TargetSceneObject;

export type PreparedTextObject3D = {
  group: Group;
  ready: Promise<void>;
  dispose(): void;
};

export function prepareTextObject3D(
  text: LocalTextTargetObject['text'],
): PreparedTextObject3D;
```

- `createCloudflareMarkerObject(asset)` keeps returning `MarkerObject`; the neutral scene root is renamed `cloudflare-preview-space` and receives exactly `rotation.x = Math.PI / 2`, preserving the existing hierarchy and world matrices without an extra wrapper.
- `MarkerObject` gains optional `dispose(): void`; `startMarkerAR().stop()` calls it once. `StartMarkerARHooks` gains `signal?: AbortSignal` so aborted compilation or camera startup cannot publish a stale session.

- [ ] **Step 1: Write the failing Y-up scene and disposal tests**

Create `tests/targetSceneObject.test.ts` with a grouped model plus text fixture. Assert that the scene root has no MindAR rotation, group/object parents and Y-up positions match saved data, `update(0.5)` applies the existing animation frame, `ready` waits for model loads, strict mode rejects a failed model, fallback mode inserts `model-load-fallback-plane`, and `dispose()` disposes mesh geometry/material resources exactly once.

```ts
import { describe, expect, it, vi } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { createTargetSceneObject } from '../src/ar/targetSceneObject';

describe('createTargetSceneObject', () => {
  it('builds the complete saved scene directly in Y-up space', async () => {
    const scene = createTargetSceneObject({
      groups: [{
        id: 'room', label: 'Room',
        placement: { scale: 1.2, offsetX: 0.3, offsetY: -0.25, height: 0.4, rotationX: 10, rotationY: 20, rotationZ: 30 },
      }],
      objects: [
        {
          id: 'chair', model: { id: 'chair', label: 'Chair', url: 'chair.glb' }, groupId: 'room',
          localPlacement: { scale: 0.8, offsetX: -0.2, offsetY: 0.15, height: 0.1, rotationX: -15, rotationY: 25, rotationZ: 40 },
          placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0, rotationX: 0, rotationY: 0, rotationZ: 0 },
        },
        {
          kind: 'text', id: 'title', text: { value: 'Floor scene', language: 'english', font: 'studio-sans' },
          placement: { scale: 1.1, offsetX: 0.25, offsetY: -0.1, height: 0.22, rotationX: 5, rotationY: 15, rotationZ: -10 },
        },
      ],
      loadModelGroup: async () => new Group(),
      createTextObject: () => new Group(),
    }, { loadMode: 'strict' });

    await scene.ready;

    expect(scene.group.rotation.x).toBe(0);
    expect(scene.group.getObjectByName('cloudflare-group-root-room')?.position.toArray()).toEqual([0.3, 0.4, -0.25]);
    expect(scene.group.getObjectByName('cloudflare-model-root-chair')?.parent?.name).toBe('cloudflare-group-root-room');
    expect(scene.group.getObjectByName('cloudflare-model-root-title')?.position.toArray()).toEqual([0.25, 0.22, -0.1]);
  });

  it('rejects strict model failures and disposes loaded mesh resources', async () => {
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial();
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const loaded = new Group().add(new Mesh(geometry, material));
    const good = createTargetSceneObject({
      model: { id: 'chair', label: 'Chair', url: 'chair.glb' },
      loadModelGroup: async () => loaded,
    }, { loadMode: 'strict' });
    await good.ready;
    good.dispose();
    good.dispose();
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);

    const failed = createTargetSceneObject({
      model: { id: 'missing', label: 'Missing', url: 'missing.glb' },
      loadModelGroup: async () => { throw new Error('model unavailable'); },
    }, { loadMode: 'strict' });
    await expect(failed.ready).rejects.toThrow('model unavailable');
  });
});
```

- [ ] **Step 2: Run the new tests and confirm RED**

Run: `npm.cmd test -- tests/targetSceneObject.test.ts`

Expected: FAIL because `src/ar/targetSceneObject.ts` does not exist.

- [ ] **Step 3: Extract the existing graph builder and add deterministic readiness/disposal**

Move the graph construction currently inside `createCloudflareMarkerObject` into `createTargetSceneObject`. The target scene root is named `cloudflare-target-scene`; group roots and model roots retain their current names. Collect every model load into `modelLoads`, use strict/fallback behavior at the individual catch boundary, and return `ready: Promise.all(modelLoads).then(() => undefined)`.

Use this exact ownership pattern:

```ts
const sceneRoot = new Group();
sceneRoot.name = 'cloudflare-target-scene';
const modelLoads: Promise<void>[] = [];
let disposed = false;

for (const [index, object] of placedObjects.entries()) {
  const objectRoot = new Group();
  objectRoot.name = modelRootName(object, index, placedObjects.length);
  const parentGroup = object.groupId ? groupRoots.get(object.groupId) : undefined;
  const placement = parentGroup && object.localPlacement
    ? normalizeLocalPlacement(object.localPlacement)
    : object.placement
      ? normalizePlacement(object.placement)
      : normalizePlacement({ height: 0.04 });
  applyTargetPlacement(objectRoot, placement);
  (parentGroup ?? sceneRoot).add(objectRoot);

  if (isTextTargetObject(object)) {
    objectRoot.add(createTextObject(object.text));
  } else {
    const load = loadModelGroup(object.model.url)
      .then((loadedModel) => {
        if (disposed) {
          disposeObjectTree(loadedModel);
          return;
        }
        loadedModel.name = loadedModel.name || 'cloudflare-loaded-model';
        objectRoot.add(loadedModel);
      })
      .catch((error: unknown) => {
        if (loadMode === 'strict') {
          throw error;
        }
        objectRoot.add(createModelLoadFallback());
      });
    modelLoads.push(load);
  }

  animatedRoots.push({
    root: objectRoot,
    placement,
    animation: normalizeAnimation(object.animation),
    elapsedSeconds: 0,
  });
}

return {
  group: sceneRoot,
  ready: Promise.all(modelLoads).then(() => undefined),
  update(deltaSeconds) {
    for (const animatedRoot of animatedRoots) {
      animatedRoot.elapsedSeconds += deltaSeconds;
      applyTargetAnimation(animatedRoot.root, animatedRoot.placement, animatedRoot.animation, animatedRoot.elapsedSeconds);
    }
  },
  dispose() {
    if (disposed) return;
    disposed = true;
    disposeObjectTree(sceneRoot);
    sceneRoot.clear();
  },
};
```

`disposeObjectTree` traverses meshes, disposes geometry, every unique material, and texture-valued material properties. A `Set` prevents duplicate disposal. Refactor `createTextObject3D` through a new `prepareTextObject3D` handle with `{ group, ready, dispose }`; the compatibility function returns the handle's group, while `TargetSceneObject.ready` includes each prepared text promise and disposal prevents late font geometry from attaching.

- [ ] **Step 4: Keep the MindAR adapter exact and wire cleanup**

Replace `createCloudflareMarkerObject`'s internal graph assembly with:

```ts
export function createCloudflareMarkerObject(asset: CloudflarePlacedAsset): MarkerObject {
  const group = new Group();
  group.name = 'cloudflare-model-object';
  const targetScene = createTargetSceneObject(asset, { loadMode: 'fallback' });
  targetScene.group.name = 'cloudflare-preview-space';
  targetScene.group.rotation.x = Math.PI / 2;
  group.add(targetScene.group);
  return {
    group,
    update: (deltaSeconds) => targetScene.update(deltaSeconds),
    dispose: () => targetScene.dispose(),
  };
}
```

Add `dispose?: () => void` to `MarkerObject`. In `startMarkerAR().stop()`, call `markerObjects.forEach((object) => object.dispose?.())` before disposing compiled targets and make stop idempotent. Add `signal?: AbortSignal` to `StartMarkerARHooks`; check it after module loading, compilation, scene setup, and `mindarThree.start()`. An aborted late start calls the same cleanup and throws `new DOMException('Marker AR start aborted', 'AbortError')` instead of returning an active session.

- [ ] **Step 5: Run focused scene/MindAR tests and confirm GREEN**

Run: `npm.cmd test -- tests/targetSceneObject.test.ts tests/cloudflareMarkerObject.test.ts tests/mindarRuntime.test.ts tests/textObject3d.test.ts`

Expected: all focused tests PASS; existing MindAR basis assertions remain unchanged.

- [ ] **Step 6: Commit the scene extraction**

```powershell
git add src/ar/targetSceneObject.ts src/ar/cloudflareMarkerObject.ts src/ar/arObjects.ts src/ar/mindarRuntime.ts src/scene/textObject3d.ts tests/targetSceneObject.test.ts tests/cloudflareMarkerObject.test.ts tests/mindarRuntime.test.ts tests/textObject3d.test.ts
git commit -m "refactor: share saved target scene runtime"
```

---

### Task 2: Floor Hit Testing, Whole-Scene Transform, and Gestures

**Files:**
- Create: `src/ar/floorHitTest.ts`
- Create: `src/ar/floorSceneTransform.ts`
- Create: `src/interaction/floorGestureController.ts`
- Create: `tests/floorHitTest.test.ts`
- Create: `tests/floorSceneTransform.test.ts`
- Create: `tests/floorGestureController.test.ts`

**Interfaces:**

```ts
export class FloorHitTest {
  latestPoseMatrix: Matrix4 | null;
  constructor(reticle: Object3D);
  update(frame: XRFrame, session: XRSession, referenceSpace: XRReferenceSpace): boolean;
  reset(): void;
  dispose(): void;
}

export class FloorSceneTransform {
  constructor(root: Group);
  placeAt(matrix: Matrix4): void;
  moveTo(point: Vector3): void;
  rotateTo(degrees: number): void;
  scaleBy(multiplier: number): void;
  resetAt(matrix: Matrix4): void;
}

export class FloorGestureController {
  constructor(target: HTMLElement, handlers: {
    onTap(point: Point2): void;
    onDrag(point: Point2): void;
    onPinch(multiplier: number): void;
  });
  connect(): void;
  disconnect(): void;
}
```

- [ ] **Step 1: Write failing primitive tests**

Pin the following behaviors with real `Group`, `Matrix4`, and `Vector3` instances and minimal fake XR objects:

```ts
it('shows the reticle only for a horizontal hit pose', async () => {
  const reticle = new Group();
  const hitTest = new FloorHitTest(reticle);
  const session = fakeSessionWithHitSource();
  hitTest.update(fakeFrame(horizontalPoseMatrix()), session, {} as XRReferenceSpace);
  await Promise.resolve();
  expect(hitTest.update(fakeFrame(horizontalPoseMatrix()), session, {} as XRReferenceSpace)).toBe(true);
  expect(reticle.visible).toBe(true);
  expect(hitTest.latestPoseMatrix?.elements).toEqual(horizontalPoseMatrix().elements);
});

it('places and manipulates one complete root without touching its children', () => {
  const root = new Group();
  const child = new Group();
  child.position.set(0.4, 0.2, -0.3);
  root.add(child);
  const transform = new FloorSceneTransform(root);
  transform.placeAt(new Matrix4().makeTranslation(1, 0, -2));
  transform.rotateTo(45);
  transform.scaleBy(1.5);
  transform.moveTo(new Vector3(2, 0.5, -3));
  expect(child.position.toArray()).toEqual([0.4, 0.2, -0.3]);
  expect(root.position.toArray()).toEqual([2, 0, -3]);
  expect(root.rotation.y).toBeCloseTo(Math.PI / 4);
  expect(root.scale.x).toBeCloseTo(1.5);
});
```

Gesture tests must show a movement under 12 px emits tap, one-finger movement emits drag, two-finger distance emits a scale multiplier, interactive controls are ignored, and `disconnect()` removes listeners.

- [ ] **Step 2: Run primitive tests and confirm RED**

Run: `npm.cmd test -- tests/floorHitTest.test.ts tests/floorSceneTransform.test.ts tests/floorGestureController.test.ts`

Expected: FAIL because the three modules do not exist.

- [ ] **Step 3: Implement horizontal hit validation**

Adapt Web-AR's viewer-space hit source flow, but accept only matrices whose transformed local Y axis has `dot(worldUp) >= 0.85`. Copy the pose into the reticle and `latestPoseMatrix`; hide the reticle and clear readiness on missing, invalid, or vertical hits. Cancel the `XRHitTestSource` in `dispose()` when the API exists.

```ts
const matrix = new Matrix4().fromArray(pose.transform.matrix);
const up = new Vector3(0, 1, 0).applyQuaternion(new Quaternion().setFromRotationMatrix(matrix));
if (Math.abs(up.dot(new Vector3(0, 1, 0))) < 0.85) {
  this.reticle.visible = false;
  return false;
}
this.reticle.visible = true;
this.reticle.matrix.copy(matrix);
this.latestPoseMatrix = matrix;
return true;
```

- [ ] **Step 4: Implement whole-root transforms**

`placeAt` decomposes the hit matrix into the scene root, sets `matrixAutoUpdate = true`, reveals the root, records the floor Y and base quaternion, and resets authored root scale to `1`. `moveTo` changes X/Z only. `rotateTo` restores the stored base quaternion and applies a Y-axis angle. `scaleBy` clamps uniform scale to `0.1..5`. `resetAt` calls `placeAt` using the latest valid pose.

```ts
placeAt(matrix: Matrix4): void {
  matrix.decompose(this.root.position, this.root.quaternion, this.root.scale);
  this.baseQuaternion.copy(this.root.quaternion);
  this.floorY = this.root.position.y;
  this.root.scale.setScalar(1);
  this.root.matrixAutoUpdate = true;
  this.root.visible = true;
}

moveTo(point: Vector3): void {
  if (this.floorY === null) return;
  this.root.position.set(point.x, this.floorY, point.z);
}

rotateTo(degrees: number): void {
  this.root.quaternion.copy(this.baseQuaternion);
  this.root.rotateY(MathUtils.degToRad(degrees));
}

scaleBy(multiplier: number): void {
  const scale = Math.min(5, Math.max(0.1, this.root.scale.x * multiplier));
  this.root.scale.setScalar(scale);
}

resetAt(matrix: Matrix4): void {
  this.placeAt(matrix);
}
```

- [ ] **Step 5: Implement touch gestures**

Use the same 12 px tap threshold and pinch-distance ratio as Web-AR. Ignore events whose target is within `button, a, input, select, textarea, [role="button"]`. Register listeners with `{ passive: false }`, prevent default only for active scene gestures, and remove the same bound handlers in `disconnect()`.

```ts
connect(): void {
  this.target.addEventListener('touchstart', this.onTouchStart, { passive: false });
  this.target.addEventListener('touchmove', this.onTouchMove, { passive: false });
  this.target.addEventListener('touchend', this.onTouchEnd, { passive: false });
  this.target.addEventListener('touchcancel', this.onTouchCancel, { passive: false });
}

disconnect(): void {
  this.target.removeEventListener('touchstart', this.onTouchStart);
  this.target.removeEventListener('touchmove', this.onTouchMove);
  this.target.removeEventListener('touchend', this.onTouchEnd);
  this.target.removeEventListener('touchcancel', this.onTouchCancel);
}
```

- [ ] **Step 6: Run primitive tests and confirm GREEN**

Run: `npm.cmd test -- tests/floorHitTest.test.ts tests/floorSceneTransform.test.ts tests/floorGestureController.test.ts`

Expected: all focused tests PASS.

- [ ] **Step 7: Commit the floor primitives**

```powershell
git add src/ar/floorHitTest.ts src/ar/floorSceneTransform.ts src/interaction/floorGestureController.ts tests/floorHitTest.test.ts tests/floorSceneTransform.test.ts tests/floorGestureController.test.ts
git commit -m "feat: add floor placement primitives"
```

---

### Task 3: Native Mark-AR WebXR Floor Runtime

**Files:**
- Create: `src/ar/floorPlacementRuntime.ts`
- Create: `src/ar/floorSessionLauncher.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Create: `tests/floorPlacementRuntime.test.ts`
- Create: `tests/floorSessionLauncher.test.ts`

**Interfaces:**

```ts
export type FloorSessionLauncherPreparation =
  | { supported: false; message: string }
  | { supported: true; launcher: { start(): Promise<XRSession> } };

export function prepareFloorSessionLauncher(
  overlayRoot: HTMLElement,
  xr?: XRSystem,
): Promise<FloorSessionLauncherPreparation>;

export type FloorPlacementController = {
  launch(): Promise<void>;
  place(): boolean;
  setRotation(degrees: number): void;
  reset(): boolean;
  stop(): Promise<void>;
  dispose(): void;
};

export type FloorPlacementPreparation =
  | { supported: false; message: string }
  | { supported: true; controller: FloorPlacementController };

export type FloorPlacementHooks = {
  onSessionStart(): void;
  onSessionEnd(): void;
  onStatus(message: string): void;
  onPlacementReady(ready: boolean): void;
  onPlaced(): void;
};

export type FloorPlacementScene = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  reticle: Mesh;
  placementRoot: Group;
  dispose(): void;
};

export type FloorPlacementDependencies = {
  prepareSessionLauncher: typeof prepareFloorSessionLauncher;
  createScene(stage: HTMLElement): FloorPlacementScene;
  createTargetSceneObject: typeof createTargetSceneObject;
  createHitTest(reticle: Object3D): FloorHitTest;
  createGestureController(
    target: HTMLElement,
    handlers: ConstructorParameters<typeof FloorGestureController>[1],
  ): FloorGestureController;
  createClock(): Pick<Clock, 'getDelta'>;
};

export async function prepareFloorPlacement(options: {
  stage: HTMLElement;
  overlayRoot: HTMLElement;
  gestureSurface: HTMLElement;
  asset: CloudflarePlacedAsset;
  hooks: FloorPlacementHooks;
}, dependencies?: Partial<FloorPlacementDependencies>): Promise<FloorPlacementPreparation>;
```

- [ ] **Step 1: Write failing runtime tests with injected browser dependencies**

Use a real Three.js `Scene`, `Group`, `PerspectiveCamera`, and a fake renderer/XR manager. Inject session-launcher preparation, scene creation, clock, target-scene creation, and hit-test creation. Tests must prove:

```ts
it('returns an unsupported result without creating a renderer', async () => {
  const createScene = vi.fn();
  const result = await prepareFloorPlacement(baseOptions(), {
    prepareSessionLauncher: async () => ({
      supported: false,
      message: 'Floor placement needs Android Chrome with WebXR. Image scanning is still available.',
    }),
    createScene,
  });
  expect(result).toEqual({
    supported: false,
    message: 'Floor placement needs Android Chrome with WebXR. Image scanning is still available.',
  });
  expect(createScene).not.toHaveBeenCalled();
});

it('keeps launch synchronous and places one loaded target scene at the latest hit', async () => {
  const startSession = vi.fn(() => Promise.resolve(fakeXRSession()));
  const targetScene = fakeReadyTargetScene();
  const result = await prepareFloorPlacement(baseOptions(), {
    prepareSessionLauncher: async () => ({ supported: true, launcher: { start: startSession } }),
    createTargetSceneObject: () => targetScene,
    createScene: () => fakeFloorScene(),
  });
  if (!result.supported) throw new Error('expected support');
  const launchPromise = result.controller.launch();
  expect(startSession).toHaveBeenCalledTimes(1);
  await launchPromise;
  emitSessionStart();
  await targetScene.ready;
  setLatestHorizontalHit(new Matrix4().makeTranslation(1, 0, -2));
  expect(result.controller.place()).toBe(true);
  expect(targetScene.group.parent?.visible).toBe(true);
});
```

Also test session end, no-hit placement rejection, rotation/reset delegation, animation updates, asset-load error status, gesture connection/disconnection, stale session resolution, and idempotent stop/dispose. In `floorSessionLauncher.test.ts`, assert that `start()` invokes `xr.requestSession(...)` before returning its promise and sends required `hit-test`, optional `dom-overlay`/`plane-detection`/`light-estimation`, and the exact overlay root.

- [ ] **Step 2: Run the runtime tests and confirm RED**

Run: `npm.cmd test -- tests/floorPlacementRuntime.test.ts tests/floorSessionLauncher.test.ts`

Expected: FAIL because `floorPlacementRuntime.ts` does not exist.

- [ ] **Step 3: Make WebXR globals an explicit development dependency**

Run: `npm.cmd install --save-dev @types/webxr@^0.5.24`

Expected: `package.json` and `package-lock.json` record the type dependency without changing Three.js. Add `"webxr"` to `tsconfig.json`'s existing `types` array.

- [ ] **Step 4: Implement the scene, launcher, and render lifecycle**

The default runtime creates:

```ts
const scene = new Scene();
const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);
const renderer = new WebGLRenderer({ antialias: true, alpha: true });
renderer.xr.enabled = true;
renderer.outputEncoding = sRGBEncoding;
const reticle = new Mesh(
  new RingGeometry(0.09, 0.105, 40).rotateX(-Math.PI / 2),
  new MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.95 }),
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
const placementRoot = new Group();
placementRoot.name = 'floor-placement-root';
placementRoot.visible = false;
scene.add(new HemisphereLight(0xffffff, 0xbfd6ff, 2.4), reticle, placementRoot);
stage.append(renderer.domElement);
```

Create `prepareFloorSessionLauncher(overlayRoot, xr = navigator.xr)`. Its support preflight catches rejected `isSessionSupported('immersive-ar')` calls. The returned `start` method is not declared `async`; its first and only operation returns `xr.requestSession('immersive-ar', sessionInit)`, keeping the request in the visible user's click stack. The init requires `hit-test`, optionally requests `dom-overlay`, `plane-detection`, and `light-estimation`, and passes `domOverlay.root = overlayRoot`.

`controller.launch()` immediately calls the prepared launcher's `start()` before awaiting the returned `XRSession`. Once it resolves, call `renderer.xr.setReferenceSpaceType('local')`, `renderer.xr.setSession(session)`, emit `onSessionStart`, start strict target-scene loading, attach its Y-up root below `placementRoot`, connect gestures, and emit scanning/loading status. The render loop updates hit testing, placement readiness, target animation, and the renderer. Place is allowed only when `targetScene.ready` has resolved and `latestPoseMatrix` is present. If disposal or a newer launch wins while `requestSession` is pending, end the stale resolved session immediately and never attach it.

Drag raycasts from the screen point to a horizontal plane at the placed root's Y. Pinch calls `scaleBy`. `setRotation` uses absolute degrees. `reset` uses the latest valid pose. `stop` ends the current XR session without destroying the prepared launcher. `dispose` ends the session, disconnects gestures, stops the render loop, disposes hit testing and target resources, removes the canvas, unregisters resize/session listeners, and disposes the renderer.

- [ ] **Step 5: Run runtime tests and confirm GREEN**

Run: `npm.cmd test -- tests/floorPlacementRuntime.test.ts tests/floorSessionLauncher.test.ts tests/floorHitTest.test.ts tests/floorSceneTransform.test.ts tests/floorGestureController.test.ts`

Expected: all runtime and primitive tests PASS.

- [ ] **Step 6: Run a build typecheck before integration**

Run: `npm.cmd run build`

Expected: `tsc` and Vite exit `0`; no Three.js upgrade is introduced.

- [ ] **Step 7: Commit the native floor runtime**

```powershell
git add package.json package-lock.json tsconfig.json src/ar/floorSessionLauncher.ts src/ar/floorPlacementRuntime.ts tests/floorSessionLauncher.test.ts tests/floorPlacementRuntime.test.ts
git commit -m "feat: add native WebXR floor runtime"
```

---

### Task 4: Floor Mode UI and Responsive Styling

**Files:**
- Create: `src/ui/floorPlacementUi.ts`
- Modify: `src/ui/appShell.ts`
- Modify: `src/style.css`
- Create: `tests/floorPlacementUi.test.ts`
- Create: `tests/floorPlacementStyles.test.ts`
- Modify: `tests/appShell.test.ts`

**Interfaces:**

```ts
export type FloorPlacementUiState =
  | { state: 'hidden' }
  | { state: 'preparing'; message: string }
  | { state: 'unsupported'; message: string }
  | { state: 'marker-ready'; message: string }
  | { state: 'floor-scanning'; message: string }
  | { state: 'floor-ready'; message: string }
  | { state: 'floor-placed'; message: string }
  | { state: 'floor-ended'; message: string }
  | { state: 'floor-error'; message: string };

export function applyFloorPlacementUi(root: HTMLElement, state: FloorPlacementUiState): void;
```

- [ ] **Step 1: Write failing shell/UI/style tests**

Extend `appShell.test.ts` to require these unique IDs and initial states:

```ts
expect(container.querySelector('#floor-ar-stage')?.hasAttribute('hidden')).toBe(true);
expect(container.querySelector('#floor-ar-overlay')?.hasAttribute('hidden')).toBe(true);
expect(container.querySelector('#floor-ar-toggle')?.textContent?.trim()).toBe('Place on floor');
expect(container.querySelector('#floor-ar-toggle')?.hasAttribute('hidden')).toBe(true);
expect((container.querySelector('#floor-ar-place') as HTMLButtonElement).disabled).toBe(true);
expect(container.querySelector('#floor-ar-reset')?.textContent?.trim()).toBe('Reset');
expect(container.querySelector('#floor-ar-restart')?.textContent?.trim()).toBe('Restart floor AR');
expect((container.querySelector('#floor-ar-rotation') as HTMLInputElement).type).toBe('range');
```

`floorPlacementUi.test.ts` must exercise every union state and assert stage visibility, marker start-button visibility, toggle label/disabled state, Place/Reset/rotation visibility and enabled state, and live status copy. `floorPlacementStyles.test.ts` must pin a full-stage transparent canvas, pointer-safe overlay, bottom safe-area control tray, 44 px touch targets, visible `:focus-visible`, and a reduced-motion rule.

- [ ] **Step 2: Run UI tests and confirm RED**

Run: `npm.cmd test -- tests/appShell.test.ts tests/floorPlacementUi.test.ts tests/floorPlacementStyles.test.ts`

Expected: FAIL because the floor controls/helper/styles do not exist.

- [ ] **Step 3: Add the scanner-owned floor DOM**

Inside the existing scanner panel, keep `#ar-stage` and add:

```html
<div id="floor-ar-stage" class="ar-stage floor-ar-stage" hidden aria-label="Floor AR camera stage"></div>
<div id="floor-ar-overlay" class="floor-ar-overlay" hidden>
  <div id="floor-ar-gesture-surface" class="floor-ar-gesture-surface" aria-label="Move and scale the placed scene"></div>
  <div class="floor-ar-controls">
    <p id="floor-ar-status" role="status">Preparing floor placement...</p>
    <button id="floor-ar-place" type="button" disabled>Place</button>
    <label class="floor-ar-rotation-control">
      <span>Rotate</span>
      <input id="floor-ar-rotation" type="range" min="-180" max="180" step="1" value="0">
    </label>
    <button id="floor-ar-reset" type="button">Reset</button>
    <button id="floor-ar-restart" type="button" hidden>Restart floor AR</button>
  </div>
</div>
```

Wrap `#start-ar` and the new hidden `#floor-ar-toggle` in `.scanner-actions`. Add `#floor-ar-message` inside the existing polite live region so unsupported/preparation copy does not overwrite marker visibility status.

- [ ] **Step 4: Implement the UI state helper**

Query by the stable IDs once inside `applyFloorPlacementUi`. Each state deterministically sets `hidden`, `disabled`, `textContent`, `aria-busy`, and `data-ar-mode`. `unsupported` leaves marker stage/start visible and shows a disabled floor toggle. Active floor states hide marker stage/start, reveal floor stage/overlay, and label the toggle `Scan image`. Only `floor-ready` and `floor-placed` enable Place; only `floor-placed` reveals Reset/rotation. `floor-ended` and `floor-error` keep `Scan image` visible, disable Place, and reveal `Restart floor AR`.

```ts
const floorVisible = state.state.startsWith('floor-');
markerStage.hidden = floorVisible;
startMarkerButton.hidden = floorVisible;
floorStage.hidden = !floorVisible;
floorOverlay.hidden = !floorVisible;
toggle.hidden = state.state === 'hidden';
toggle.disabled = state.state === 'preparing' || state.state === 'unsupported';
toggle.textContent = floorVisible ? 'Scan image' : 'Place on floor';
place.disabled = state.state !== 'floor-ready' && state.state !== 'floor-placed';
restart.hidden = state.state !== 'floor-ended' && state.state !== 'floor-error';
root.dataset.arMode = floorVisible ? 'floor' : 'marker';
message.textContent = 'message' in state ? state.message : '';
```

- [ ] **Step 5: Add scoped responsive styles**

Use `.floor-ar-*` selectors adjacent to the existing scanner rules. The overlay fills the scanner stage, its gesture layer accepts touch input, and the compact control tray sits above `env(safe-area-inset-bottom)`. Keep the current teal/ink/panel tokens. The signature floor control is the turquoise reticle and a restrained translucent tray; do not copy Web-AR's full HUD or model rail.

```css
.scanner-panel { position: relative; }
.floor-ar-stage { position: relative; }
.floor-ar-overlay { position: absolute; inset: 0 0 72px; }
.floor-ar-stage canvas { width: 100%; height: 100%; }
.floor-ar-overlay { z-index: 4; pointer-events: none; }
.floor-ar-gesture-surface { position: absolute; inset: 0; pointer-events: auto; touch-action: none; }
.floor-ar-controls {
  position: absolute;
  right: 14px;
  bottom: max(14px, env(safe-area-inset-bottom));
  left: 14px;
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px;
  border: 1px solid rgba(94, 234, 212, 0.28);
  border-radius: 8px;
  background: rgba(2, 7, 11, 0.78);
  pointer-events: auto;
}
.floor-ar-controls button:focus-visible,
#floor-ar-toggle:focus-visible { outline: 3px solid var(--amber); outline-offset: 2px; }
```

- [ ] **Step 6: Run UI tests and confirm GREEN**

Run: `npm.cmd test -- tests/appShell.test.ts tests/floorPlacementUi.test.ts tests/floorPlacementStyles.test.ts`

Expected: all UI and style tests PASS.

- [ ] **Step 7: Commit the Mark-AR floor UI**

```powershell
git add src/ui/floorPlacementUi.ts src/ui/appShell.ts src/style.css tests/floorPlacementUi.test.ts tests/floorPlacementStyles.test.ts tests/appShell.test.ts
git commit -m "feat: add shared-link floor controls"
```

---

### Task 5: Target-Specific Mode Coordination and Race Safety

**Files:**
- Modify: `src/main.ts`
- Modify: `tests/targetSpecificScanIntegration.test.ts`

**Interfaces:**
- Consumes: `prepareFloorPlacement`, `FloorPlacementPreparation`, `FloorPlacementController`, and `applyFloorPlacementUi`.
- Produces: target-specific marker-to-floor switching; no new public module API.

- [ ] **Step 1: Extend the integration mock before production wiring**

Add a hoisted floor runtime mock that captures preparation options and returns either unsupported or this controller:

```ts
const floorRuntimeMocks = vi.hoisted(() => ({
  prepareFloorPlacement: vi.fn(),
  launch: vi.fn(() => Promise.resolve()),
  place: vi.fn(() => true),
  setRotation: vi.fn(),
  reset: vi.fn(() => true),
  stop: vi.fn(() => Promise.resolve()),
  dispose: vi.fn(),
  hooks: undefined as undefined | {
    onSessionStart(): void;
    onSessionEnd(): void;
    onStatus(message: string): void;
    onPlacementReady(ready: boolean): void;
    onPlaced(): void;
  },
}));

vi.mock('../src/ar/floorPlacementRuntime', () => ({
  prepareFloorPlacement: floorRuntimeMocks.prepareFloorPlacement,
}));
```

Add one test per behavior:

- focused link still auto-starts MindAR and prepares floor mode with exactly `scanTarget.objects`/`groups`;
- floor toggle is absent/hidden on generic `#/scan`;
- `Place on floor` synchronously calls marker `stop()` before controller `launch()`;
- Place, rotation, Reset, and hook status delegate to the same controller;
- `Scan image` stops floor mode and starts MindAR a second time with the same target;
- native floor session end leaves explicit `Scan image` without automatic marker restart;
- `Restart floor AR` calls the already-prepared controller's synchronous launch path again without touching the target URL;
- unsupported prep leaves marker scanning active and disables the floor action;
- navigating away disposes the floor controller and stops whichever session is active;
- a marker start resolving after a floor switch is stopped and never becomes active;
- a floor preparation resolving after route departure is disposed and never shown.

- [ ] **Step 2: Run integration tests and confirm RED**

Run: `npm.cmd test -- tests/targetSpecificScanIntegration.test.ts`

Expected: new tests FAIL because `main.ts` does not prepare or coordinate floor mode.

- [ ] **Step 3: Add explicit marker-start versioning**

Add `let markerStartVersion = 0;` and `let markerStartAbort: AbortController | undefined;`. Abort the previous controller before each start, pass the new signal into `startMarkerAR`, and keep a resolved session only if the captured version is current and the active mode is still marker:

```ts
const startVersion = ++markerStartVersion;
markerStartAbort?.abort();
markerStartAbort = new AbortController();
const startedSession = await startMarkerAR(stage, { ...options, signal: markerStartAbort.signal });
if (startVersion !== markerStartVersion || activeSharedLinkMode !== 'marker') {
  startedSession.stop();
  return;
}
session = startedSession;
```

Every marker stop, floor switch, route departure, and target replacement increments `markerStartVersion`, aborts `markerStartAbort`, and then stops the current session. Treat `AbortError` as expected cancellation rather than a user-facing camera failure.

- [ ] **Step 4: Prepare floor mode only for the focused target**

After the authorized target record is assigned, call `prepareFocusedFloorPlacement(target, requestVersion)` without delaying the current `await startCurrentArSession()`. Pass the dedicated floor stage/overlay/gesture elements plus this asset:

```ts
const asset = {
  model: target.model,
  placement: target.placement,
  objects: target.objects,
  groups: target.groups,
};
```

While preparation is pending, apply `preparing`. If it returns unsupported, apply `unsupported` and leave MindAR untouched. If the scan request/version changed before resolution, immediately dispose a supported controller. Otherwise store it, apply `marker-ready`, and enable the toggle.

- [ ] **Step 5: Wire the mode and floor controls**

The floor toggle handler must perform no awaited work before `controller.launch()`:

```ts
floorToggle.addEventListener('click', () => {
  if (activeSharedLinkMode === 'floor') {
    void returnToFocusedMarkerScan();
    return;
  }
  if (!floorController || !focusedScanTarget) return;
  activeSharedLinkMode = 'floor';
  markerStartVersion += 1;
  session?.stop();
  session = undefined;
  applyFloorPlacementUi(shell, {
    state: 'floor-scanning',
    message: 'Move your phone until the floor ring appears.',
  });
  void floorController.launch();
});
```

Place calls `controller.place()`. Rotation converts the range value to a finite number and calls `setRotation(degrees)`. Reset calls `controller.reset()` and sets the slider to `0`. `Restart floor AR` calls `controller.launch()` directly from its click handler. Floor hooks apply scanning/ready/placed/ended/error states with exact spec copy. Returning to marker awaits `controller.stop()`, resets the UI to marker-ready, and starts `startCurrentArSession()` with the same focused target.

`clearTargetSpecificScan()` and route cleanup call one `disposeFocusedFloorPlacement()` helper, invalidate both scan and marker-start versions, restore hidden floor UI, remove canvases/overlays through controller disposal, and retain existing generic scanner cleanup.

- [ ] **Step 6: Run integration and regression tests and confirm GREEN**

Run: `npm.cmd test -- tests/targetSpecificScanIntegration.test.ts tests/appShell.test.ts tests/floorPlacementUi.test.ts tests/floorPlacementRuntime.test.ts tests/mindarRuntime.test.ts`

Expected: all focused tests PASS; existing automatic scan and auth-return tests remain green.

- [ ] **Step 7: Commit the unique-link integration**

```powershell
git add src/main.ts tests/targetSpecificScanIntegration.test.ts
git commit -m "feat: switch shared links between marker and floor AR"
```

---

### Task 6: Full Verification and Device Handoff

**Files:**
- Modify only if verification finds a scoped defect: files already listed in Tasks 1-5.

**Interfaces:**
- Consumes: complete native Mark-AR floor mode.
- Produces: verified unit/integration/build/browser evidence and an explicit physical-device result or limitation.

- [ ] **Step 1: Run formatting and diff hygiene checks**

Run:

```powershell
git diff --check
git status --short --branch
```

Expected: no whitespace errors; unrelated target-loader files remain preserved and identifiable.

- [ ] **Step 2: Run all tests**

Run: `npm.cmd test`

Expected: every Vitest file and test passes with zero failures.

- [ ] **Step 3: Run normal and GitHub Pages builds**

Run:

```powershell
npm.cmd run build
$env:GITHUB_PAGES='true'; npm.cmd run build; Remove-Item Env:GITHUB_PAGES
```

Expected: both builds exit `0`; Pages output uses `/Mark-AR/` assets.

- [ ] **Step 4: Verify the live local route on desktop**

Open `http://127.0.0.1:5173/#/scan/800ad3c6-1180-45d4-a21f-f77de22b6686` in the browser. Verify title `Mark AR`, exact-link authentication retention when required, automatic marker start/retry behavior, visible but disabled `Place on floor` on unsupported desktop WebXR, the exact unsupported message, no floor option on `#/scan`, and clean route-departure UI.

- [ ] **Step 5: Attempt an Android Chrome WebXR smoke test**

If `adb devices` reports an authorized ARCore-capable device, run:

```powershell
adb reverse tcp:5173 tcp:5173
```

Open the target-specific localhost URL in Android Chrome and verify the reticle, horizontal-floor gating, one-tap whole-scene placement, upright Y-up orientation, saved relative layout, text/groups/animations, drag/pinch/rotation/reset, `Scan image` return, second floor launch, and cleanup after navigation. If no authorized device exists, record that physical floor detection remains unverified rather than claiming it passed.

- [ ] **Step 6: Re-run the final verification gate after any smoke-test fix**

Run:

```powershell
npm.cmd test
npm.cmd run build
git diff --check
```

Expected: tests/build/diff checks all exit `0` after the last source edit.

- [ ] **Step 7: Record the verified completion state**

Report exact test counts, build commands, desktop route state, Android device result, files changed, and any remaining physical-device limitation. Do not publish or push unless the user separately requests it.

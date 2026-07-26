# YouTube AR Tap Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make YouTube thumbnails respond to taps and play inline in both image-marker AR and markerless floor AR.

**Architecture:** Keep `YouTubePlayerManager` as the shared hit-test and player-lifecycle unit. Route marker taps from the interactive AR stage rather than its disabled canvas, and give the floor runtime a session-scoped manager that receives placed-scene surfaces before existing placement fallback behavior runs.

**Tech Stack:** TypeScript, Three.js r150, MindAR, WebXR DOM overlay, YouTube IFrame API, Vitest/happy-dom.

## Global Constraints

- The thumbnail remains a draggable 3D object in Studio and plays only after a viewer taps it in AR.
- Both image-marker AR and Android Chrome markerless floor AR must use the same inline player lifecycle.
- A tap outside a YouTube plane must preserve the current marker/floor behavior.
- Player initialization failure must restore the thumbnail and show scanner status.
- Images, text, models, transforms, grouping, and animation behavior must remain unchanged.
- No new runtime dependency may be added.

---

### Task 1: Make marker YouTube taps reachable and observable

**Files:**
- Modify: `src/ar/youtubePlayerManager.ts:36-161`
- Modify: `src/ar/mindarRuntime.ts:56-211`
- Modify: `src/main.ts:596-610`
- Test: `tests/youtubePlayerManager.test.ts`
- Test: `tests/mindarRuntime.test.ts`

**Interfaces:**
- Produces: `YouTubeActivationResult = 'activated' | 'missed' | 'failed'`.
- Produces: `YouTubePlayerManager` constructor option `onPlaybackError?: (message: string) => void`.
- Produces: `StartMarkerARHooks.onYouTubeError?: (message: string) => void`.
- Consumes: existing `InteractiveYouTubeSurface`, camera, and normalized pointer coordinates.

- [ ] **Step 1: Write failing manager-result and error-callback tests**

Add focused tests that name the breaks:

```ts
it('distinguishes a miss from failed player creation and reports the failure', async () => {
  const errorMessages: string[] = [];
  const manager = createManager({
    hitTest: (_pointer, _camera, surfaces) => surfaces[0],
    createPlayer: async () => { throw new Error('Embedding disabled'); },
    onPlaybackError: (message) => errorMessages.push(message),
  });
  manager.register('marker-1', createSurface());
  manager.setMarkerVisible('marker-1', true);

  expect(await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera()))
    .toBe('failed');
  expect(errorMessages).toEqual(['Embedding disabled']);
});

it('returns missed when no visible YouTube plane is hit', async () => {
  const manager = createManager({
    hitTest: () => undefined,
  });
  manager.register('marker-1', createSurface());
  manager.setMarkerVisible('marker-1', true);

  expect(await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera()))
    .toBe('missed');
});

function createManager(
  overrides: ConstructorParameters<typeof YouTubePlayerManager>[1] = {},
) {
  return new YouTubePlayerManager(document.createElement('div'), {
    createCssRenderer: () => ({
      domElement: document.createElement('div'),
      setSize: vi.fn(),
      render: vi.fn(),
    }),
    createCssObject: (element) => {
      const object = new Group() as Group & { element: HTMLElement };
      object.element = element;
      return object;
    },
    createPlayer: async () => ({
      playVideo() {},
      pauseVideo() {},
      destroy() {},
    }),
    ...overrides,
  });
}
```

The test helper must use the real `YouTubePlayerManager`; only CSS rendering
and the external YouTube player are injected.

- [ ] **Step 2: Run the manager tests and verify RED**

Run:

```powershell
npm.cmd test -- --run tests/youtubePlayerManager.test.ts
```

Expected: FAIL because the current method returns booleans and has no
`onPlaybackError` callback.

- [ ] **Step 3: Implement the explicit activation result**

Add:

```ts
export type YouTubeActivationResult = 'activated' | 'missed' | 'failed';

type YouTubePlayerManagerDeps = {
  onPlaybackError?: (message: string) => void;
  // retain the existing injected dependencies
};
```

Change `activateFromPointer` to return:

```ts
Promise<YouTubeActivationResult>
```

Return `'missed'` for disposed/ineligible/no-hit paths, `'activated'` after
`playVideo()`, and `'failed'` after restoring the thumbnail. Invoke
`onPlaybackError` with the same message stored in `container.dataset.youtubeError`.

- [ ] **Step 4: Run the manager tests and verify GREEN**

Run:

```powershell
npm.cmd test -- --run tests/youtubePlayerManager.test.ts
```

Expected: all manager tests PASS with no console errors.

- [ ] **Step 5: Write failing marker-stage routing tests**

Extend the `YouTubePlayerManager` mock to retain the constructor's error
callback. Add:

```ts
it('routes marker taps from the stage while the canvas is non-interactive', async () => {
  const container = document.createElement('div');
  runtimeMocks.youtubeSurfaces.push({ objectId: 'video-1' });
  runtimeMocks.compileMarkerTargets.mockResolvedValue(createCompiledTargets());

  const session = await startMarkerAR(container, {
    targets: [createCloudflareRuntimeTarget(true)],
  });
  runtimeMocks.anchors[0].onTargetFound?.();
  container.dispatchEvent(new PointerEvent('pointerup', {
    bubbles: true,
    clientX: 160,
    clientY: 90,
  }));

  expect(runtimeMocks.managerActivate).toHaveBeenCalledWith(
    { x: 0, y: 0 },
    expect.anything(),
  );
  session.stop();
  runtimeMocks.managerActivate.mockClear();
  container.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  expect(runtimeMocks.managerActivate).not.toHaveBeenCalled();
});

it('does not reprocess taps from an active player control', async () => {
  // Start a YouTube target, append a .youtube-css3d-player button,
  // dispatch pointerup from the button, and expect no manager activation.
});

it('forwards marker playback failures through the runtime hook', async () => {
  const container = document.createElement('div');
  const onYouTubeError = vi.fn();
  await startMarkerAR(container, {
    targets: [createCloudflareRuntimeTarget(true)],
    onYouTubeError,
  });
  runtimeMocks.managerOnPlaybackError?.('Embedding disabled');
  expect(onYouTubeError).toHaveBeenCalledWith('Embedding disabled');
});
```

Make the fake MindAR renderer canvas return a literal `320 x 180` client rect
so the expected normalized coordinates are independently derived.

- [ ] **Step 6: Run marker tests and verify RED**

Run:

```powershell
npm.cmd test -- --run tests/mindarRuntime.test.ts
```

Expected: stage dispatch does not call `managerActivate`, listener cleanup is
wrong for the stage, and `onYouTubeError` is not forwarded.

- [ ] **Step 7: Move marker routing to the stage and add the error hook**

Add to `StartMarkerARHooks`:

```ts
onYouTubeError?: (message: string) => void;
```

Construct the manager with:

```ts
new YouTubePlayerManager(container, {
  onPlaybackError: hooks.onYouTubeError,
})
```

Attach/remove `pointerup` on `container`. Before raycasting, ignore:

```ts
event.target instanceof Element
  && event.target.closest(
    '.youtube-css3d-player, button, a, input, select, textarea, [role="button"]',
  )
```

Continue calculating pointer coordinates from
`instance.renderer.domElement.getBoundingClientRect()`.

In `src/main.ts`, pass:

```ts
onYouTubeError: (message) => setScannerStatus(message, 'error'),
```

- [ ] **Step 8: Run focused Task 1 verification**

Run:

```powershell
npm.cmd test -- --run tests/youtubePlayerManager.test.ts tests/mindarRuntime.test.ts
npm.cmd run build
git diff --check
```

Expected: focused tests and build PASS; no whitespace errors.

- [ ] **Step 9: Commit Task 1**

```powershell
git add -- src/ar/youtubePlayerManager.ts src/ar/mindarRuntime.ts src/main.ts tests/youtubePlayerManager.test.ts tests/mindarRuntime.test.ts
git commit -m "fix: route marker YouTube taps"
```

---

### Task 2: Add the shared player lifecycle to markerless floor AR

**Files:**
- Modify: `src/ar/floorPlacementRuntime.ts:40-610`
- Test: `tests/floorPlacementRuntime.test.ts`

**Interfaces:**
- Consumes: `YouTubePlayerManager`, `YouTubeActivationResult`, and
  `TargetSceneObject.youtubeSurfaces`.
- Produces: `FloorPlacementDependencies.createYouTubePlayerManager` for a
  session-scoped real manager or focused test double.
- Preserves: `FloorPlacementController` public interface and all existing
  placement hooks.

- [ ] **Step 1: Write failing floor registration/lifecycle test**

Add a manager double with `register`, `setMarkerVisible`,
`activateFromPointer`, `update`, `resize`, and `dispose`. Inject it through:

```ts
createYouTubePlayerManager(
  container: HTMLElement,
  onPlaybackError: (message: string) => void,
): Pick<
  YouTubePlayerManager,
  'register' | 'setMarkerVisible' | 'activateFromPointer' | 'update' | 'resize' | 'dispose'
>;
```

Add:

```ts
it('registers floor YouTube surfaces, activates them after placement, and disposes the manager', async () => {
  const surface = createSurface();
  const harness = createHarness({
    targetScenes: [fakeTargetScene(Promise.resolve(), [surface])],
  });
  const result = await prepareWithHarness(harness);
  const controller = supportedController(result);
  await controller.launch();

  expect(harness.youtube.register).toHaveBeenCalledWith('floor-target', surface);
  expect(harness.youtube.setMarkerVisible).not.toHaveBeenCalledWith('floor-target', true);

  harness.hitTest.setCurrentHit(new Matrix4());
  harness.renderer.emitFrame();
  expect(controller.place()).toBe(true);
  expect(harness.youtube.setMarkerVisible).toHaveBeenCalledWith('floor-target', true);

  controller.dispose();
  expect(harness.youtube.dispose).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Write failing tap-consumption and miss-fallback tests**

Add:

```ts
it('plays a tapped floor video without replacing the placed transform', async () => {
  harness.youtube.activateFromPointer.mockResolvedValue('activated');
  // Launch, produce a valid hit, and place once.
  harness.gesture.handlers.onTap({ x: 120, y: 80 });
  await flushPromises();

  expect(harness.youtube.activateFromPointer).toHaveBeenCalledWith(
    expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    harness.floorScene.camera,
  );
  expect(harness.hooks.onPlaced).toHaveBeenCalledTimes(1);
});

it('preserves floor placement when a tap misses every video', async () => {
  harness.youtube.activateFromPointer.mockResolvedValue('missed');
  // Launch, set a new hit, tap, and wait for the activation result.
  expect(harness.hooks.onPlaced).toHaveBeenCalledTimes(1);
  harness.gesture.handlers.onTap({ x: 120, y: 80 });
  await flushPromises();
  expect(harness.hooks.onPlaced).toHaveBeenCalledTimes(2);
});

it('reports a failed floor player without moving the scene', async () => {
  harness.youtube.activateFromPointer.mockResolvedValue('failed');
  harness.youtube.emitError('Embedding disabled');
  await flushPromises();
  expect(harness.hooks.onStatus).toHaveBeenCalledWith('Embedding disabled');
  expect(harness.hooks.onPlaced).toHaveBeenCalledTimes(1);
});
```

The production mutation these tests catch is deleting floor activation or
treating every activation result as a placement miss.

- [ ] **Step 3: Run floor tests and verify RED**

Run:

```powershell
npm.cmd test -- --run tests/floorPlacementRuntime.test.ts
```

Expected: FAIL because `FloorPlacementDependencies` has no player factory and
floor taps only call `place()`.

- [ ] **Step 4: Implement the floor session manager**

Add a default factory:

```ts
createYouTubePlayerManager: (container, onPlaybackError) =>
  new YouTubePlayerManager(container, { onPlaybackError }),
```

When a session creates a target scene with YouTube surfaces:

```ts
this.youtubeManager = this.dependencies.createYouTubePlayerManager(
  this.options.overlayRoot,
  (message) => this.options.hooks.onStatus(message),
);
for (const surface of targetScene.youtubeSurfaces) {
  this.youtubeManager.register('floor-target', surface);
}
```

Change the tap handler to:

```ts
onTap: (point) => {
  void this.activateYouTubeOrPlace(point);
},
```

`activateYouTubeOrPlace` must:

1. Call `place()` immediately while the placement root is not visible.
2. Normalize coordinates against `gestureSurface.getBoundingClientRect()`.
3. Await `activateFromPointer`.
4. Call `place()` only for `'missed'`.
5. Consume `'activated'` and `'failed'`.

After a successful `place()` call, set floor surfaces visible. During each
animation frame, call `youtubeManager.update(camera)`. Resize from the stage
bounds before rendering and dispose/null the manager in
`cleanupSessionResources`.

- [ ] **Step 5: Run floor tests and verify GREEN**

Run:

```powershell
npm.cmd test -- --run tests/floorPlacementRuntime.test.ts
```

Expected: all floor runtime tests PASS without changing existing placement,
session, stale-launch, or disposal assertions.

- [ ] **Step 6: Run cross-runtime and full verification**

Run:

```powershell
npm.cmd test -- --run tests/youtubePlayerManager.test.ts tests/mindarRuntime.test.ts tests/floorPlacementRuntime.test.ts
npm.cmd test
npm.cmd run build
npm.cmd audit
git diff --check
git status --short
```

Expected: 0 failing tests, production build exit 0, 0 audit vulnerabilities,
and only planned source/test/doc changes.

- [ ] **Step 7: Commit Task 2**

```powershell
git add -- src/ar/floorPlacementRuntime.ts tests/floorPlacementRuntime.test.ts
git commit -m "fix: play YouTube objects in floor AR"
```

---

### Task 3: Browser verification and release

**Files:**
- No production file changes expected.
- Verify: GitHub Pages deployment and the live scanner.

**Interfaces:**
- Consumes: the saved YouTube target scan link and both AR runtime entry points.
- Produces: release evidence for marker tap routing and markerless WebXR behavior.

- [ ] **Step 1: Run an in-app-browser marker fixture**

Use a local saved-target fixture with a YouTube-only object. Verify:

- the thumbnail is visible before tapping;
- a stage tap calls the player path despite the canvas being non-interactive;
- the `.youtube-css3d-player` element appears;
- the thumbnail mesh is hidden;
- a failed embed reports visible scanner status.

- [ ] **Step 2: Run markerless verification where WebXR is available**

On Android Chrome/WebXR, verify:

- the floor target can be placed normally;
- tapping the placed thumbnail creates the inline player;
- tapping outside the video retains floor placement behavior;
- ending floor AR removes the player.

If the in-app browser lacks immersive WebXR/camera hardware, record that exact
boundary and rely on the floor runtime regression tests for the unavailable
device layer.

- [ ] **Step 3: Review, merge, push, and publish**

Request task-scoped and whole-branch reviews. After clean reviews, merge to
`main`, push `main`, wait for the Pages workflow, and confirm the live asset is
the reviewed commit.

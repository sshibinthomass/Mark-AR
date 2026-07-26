import {
  Group,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { CloudflarePlacedAsset } from '../src/ar/cloudflareMarkerObject';
import type { FloorGestureHandlers } from '../src/interaction/floorGestureController';
import {
  prepareFloorPlacement,
  type FloorPlacementDependencies,
  type FloorPlacementHooks,
  type FloorPlacementScene,
} from '../src/ar/floorPlacementRuntime';
import type {
  InteractiveYouTubeSurface,
  TargetSceneObject,
} from '../src/ar/targetSceneObject';
import {
  YouTubePlayerManager,
  type YouTubePlayerPort,
} from '../src/ar/youtubePlayerManager';

const UNSUPPORTED_MESSAGE =
  'Floor placement needs Android Chrome with WebXR. Image scanning is still available.';

describe('prepareFloorPlacement', () => {
  it('returns an unsupported result without creating a renderer', async () => {
    const createScene = vi.fn();

    const result = await prepareFloorPlacement(baseOptions(), {
      prepareSessionLauncher: async () => ({
        supported: false,
        message: UNSUPPORTED_MESSAGE,
      }),
      createScene,
    });

    expect(result).toEqual({ supported: false, message: UNSUPPORTED_MESSAGE });
    expect(createScene).not.toHaveBeenCalled();
  });

  it('starts synchronously, loads one strict Y-up target, and places it at the current hit', async () => {
    const pendingSession = deferred<XRSession>();
    const harness = createHarness();
    harness.startSession.mockReturnValueOnce(pendingSession.promise);
    const result = await prepareWithHarness(harness);

    const launchPromise = supportedController(result).launch();

    expect(harness.startSession).toHaveBeenCalledOnce();
    expect(harness.createTargetSceneObject).not.toHaveBeenCalled();

    pendingSession.resolve(harness.session.session);
    await launchPromise;

    expect(harness.renderer.xr.setReferenceSpaceType).toHaveBeenCalledWith('local');
    expect(harness.renderer.xr.setSession).toHaveBeenCalledWith(harness.session.session);
    expect(harness.hooks.onSessionStart).toHaveBeenCalledOnce();
    expect(harness.createTargetSceneObject).toHaveBeenCalledWith(
      harness.options.asset,
      { loadMode: 'strict' },
    );
    expect(harness.targetScene.group.parent).toBe(harness.floorScene.placementRoot);
    expect(harness.targetScene.group.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    expect(harness.gesture.connect).toHaveBeenCalledOnce();
    expect(harness.hooks.onStatus).toHaveBeenCalledWith(
      'Move your phone until the floor ring appears.',
    );
    expect(firstInvocation(harness.hooks.onSessionStart)).toBeLessThan(
      firstInvocation(harness.hooks.onStatus),
    );

    const hit = new Matrix4().makeTranslation(1, 0, -2);
    harness.hitTest.setCurrentHit(hit);
    harness.renderer.emitFrame();

    expect(supportedController(result).place()).toBe(true);
    expect(harness.floorScene.placementRoot.position.toArray()).toEqual([1, 0, -2]);
    expect(harness.floorScene.placementRoot.visible).toBe(true);
    expect(harness.hooks.onPlaced).toHaveBeenCalledOnce();
  });

  it('rejects placement until the target is ready and whenever the current hit is invalid', async () => {
    const ready = deferred<void>();
    const harness = createHarness({ targetReady: ready.promise });
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);
    const launchPromise = controller.launch();
    await flushPromises();

    harness.hitTest.setCurrentHit(new Matrix4().makeTranslation(2, 0, -3));
    harness.renderer.emitFrame();
    expect(controller.place()).toBe(false);

    ready.resolve();
    await launchPromise;
    harness.renderer.emitFrame();
    expect(controller.place()).toBe(true);

    harness.hitTest.setCurrentValidity(false);
    harness.renderer.emitFrame();
    expect(controller.place()).toBe(false);
  });

  it('updates hit readiness, target animation, status, and rendering on each XR frame', async () => {
    const harness = createHarness();
    const result = await prepareWithHarness(harness);
    await supportedController(result).launch();
    const frame = {} as XRFrame;

    harness.hitTest.setCurrentHit(new Matrix4());
    harness.renderer.emitFrame(frame);

    expect(harness.hitTest.update).toHaveBeenCalledWith(
      frame,
      harness.session.session,
      harness.renderer.referenceSpace,
    );
    expect(harness.hooks.onPlacementReady).toHaveBeenLastCalledWith(true);
    expect(harness.hooks.onStatus).toHaveBeenLastCalledWith('Floor found. Tap Place.');
    expect(harness.targetScene.update).toHaveBeenCalledWith(0.25);
    expect(harness.renderer.render).toHaveBeenCalledWith(
      harness.floorScene.scene,
      harness.floorScene.camera,
    );

    harness.hitTest.setCurrentValidity(false);
    harness.renderer.emitFrame();

    expect(harness.hooks.onPlacementReady).toHaveBeenLastCalledWith(false);
    expect(harness.hooks.onStatus).toHaveBeenLastCalledWith(
      'Move your phone until the floor ring appears.',
    );
  });

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
    expect(harness.youtube.resize).toHaveBeenCalledWith(300, 150);
    expect(harness.renderer.xr.getCamera).toHaveBeenCalledWith(harness.floorScene.camera);
    expect(harness.youtube.update).toHaveBeenCalledWith(harness.renderer.xrCamera);
    expect(firstInvocation(harness.renderer.render)).toBeLessThan(
      firstInvocation(harness.renderer.xr.getCamera),
    );
    expect(controller.place()).toBe(true);
    expect(harness.youtube.setMarkerVisible).toHaveBeenCalledWith('floor-target', true);

    controller.dispose();
    expect(harness.youtube.dispose).toHaveBeenCalledOnce();
  });

  it('plays a tapped floor video without replacing the placed transform', async () => {
    const harness = createHarness({
      targetScenes: [fakeTargetScene(Promise.resolve(), [createSurface()])],
    });
    harness.youtube.activateFromPointer.mockResolvedValue('activated');
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);
    await controller.launch();

    harness.hitTest.setCurrentHit(new Matrix4());
    harness.renderer.emitFrame();
    expect(controller.place()).toBe(true);

    harness.gesture.handlers.onTap({ x: 120, y: 80 });
    await flushPromises();

    expect(harness.youtube.activateFromPointer).toHaveBeenCalledWith(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      harness.renderer.xrCamera,
    );
    expect(harness.hooks.onPlaced).toHaveBeenCalledTimes(1);
  });

  it('repairs a stale XR projection inverse before an off-center YouTube raycast', async () => {
    const surface = createRaycastSurface();
    const harness = createHarness({
      targetScenes: [fakeTargetScene(Promise.resolve(), [surface])],
    });
    harness.renderer.xrCamera.fov = 90;
    harness.renderer.xrCamera.aspect = 1;
    harness.renderer.xrCamera.near = 0.1;
    harness.renderer.xrCamera.far = 10;
    harness.renderer.xrCamera.updateProjectionMatrix();
    harness.renderer.xrCamera.projectionMatrixInverse.identity();
    harness.renderer.xrCamera.updateMatrixWorld(true);
    const player: YouTubePlayerPort = {
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      destroy: vi.fn(),
    };
    harness.dependencies.createYouTubePlayerManager = vi.fn((container, onPlaybackError) => (
      new YouTubePlayerManager(container, {
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
        createPlayer: async () => player,
        onPlaybackError,
      })
    ));
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);
    await controller.launch();

    harness.hitTest.setCurrentHit(new Matrix4());
    harness.renderer.emitFrame();
    expect(controller.place()).toBe(true);
    harness.floorScene.scene.updateMatrixWorld(true);

    harness.gesture.handlers.onTap({ x: 150, y: 50 });
    await flushPromises();

    expect(player.playVideo).toHaveBeenCalledOnce();
    expect(surface.mesh.visible).toBe(false);
    expect(harness.hooks.onPlaced).toHaveBeenCalledTimes(1);
  });

  it('preserves floor placement when a tap misses every video', async () => {
    const harness = createHarness({
      targetScenes: [fakeTargetScene(Promise.resolve(), [createSurface()])],
    });
    harness.youtube.activateFromPointer.mockResolvedValue('missed');
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);
    await controller.launch();

    harness.hitTest.setCurrentHit(new Matrix4());
    harness.renderer.emitFrame();
    expect(controller.place()).toBe(true);
    harness.hitTest.setCurrentHit(new Matrix4().makeTranslation(2, 0, -3));
    harness.renderer.emitFrame();

    harness.gesture.handlers.onTap({ x: 120, y: 80 });
    await flushPromises();

    expect(harness.hooks.onPlaced).toHaveBeenCalledTimes(2);
  });

  it('reports a nonfatal floor player failure, restores its thumbnail, and allows a later retry', async () => {
    const surface = createSurface();
    const harness = createHarness({
      targetScenes: [fakeTargetScene(Promise.resolve(), [surface])],
    });
    const player: YouTubePlayerPort = {
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      destroy: vi.fn(),
    };
    const hitTest = vi.fn((_pointer, _camera, surfaces) => surfaces[0]);
    let playerAttempts = 0;
    harness.dependencies.createYouTubePlayerManager = vi.fn((container, onPlaybackError) => (
      new YouTubePlayerManager(container, {
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
        createPlayer: async () => {
          playerAttempts += 1;
          if (playerAttempts === 1) {
            throw new Error('Embedding disabled');
          }
          return player;
        },
        hitTest,
        onPlaybackError,
      })
    ));
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);
    await controller.launch();

    harness.hitTest.setCurrentHit(new Matrix4());
    harness.renderer.emitFrame();
    expect(controller.place()).toBe(true);
    const placedPosition = harness.floorScene.placementRoot.position.toArray();

    harness.gesture.handlers.onTap({ x: 120, y: 80 });
    await flushPromises();

    expect(surface.mesh.visible).toBe(true);
    expect(harness.hooks.onYouTubeError).toHaveBeenCalledWith('Embedding disabled');
    expect(harness.hooks.onStatus).not.toHaveBeenCalledWith('Embedding disabled');
    expect(harness.floorScene.placementRoot.position.toArray()).toEqual(placedPosition);
    expect(harness.hooks.onPlaced).toHaveBeenCalledTimes(1);

    harness.gesture.handlers.onTap({ x: 120, y: 80 });
    await flushPromises();

    expect(hitTest).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      harness.renderer.xrCamera,
      expect.any(Array),
    );
    expect(player.playVideo).toHaveBeenCalledOnce();
    expect(surface.mesh.visible).toBe(false);
    expect(harness.hooks.onYouTubeActivated).toHaveBeenCalledOnce();
    expect(harness.floorScene.placementRoot.position.toArray()).toEqual(placedPosition);
    expect(harness.hooks.onPlaced).toHaveBeenCalledTimes(1);
  });

  it('ignores an old activation miss after stop and relaunch', async () => {
    const activation = deferred<'missed'>();
    const firstSession = fakeXRSession();
    const secondSession = fakeXRSession();
    const youtube = fakeYouTubeManager();
    youtube.activateFromPointer.mockReturnValueOnce(activation.promise);
    const harness = createHarness({
      sessionPromises: [Promise.resolve(firstSession.session), Promise.resolve(secondSession.session)],
      targetScenes: [
        fakeTargetScene(Promise.resolve(), [createSurface()]),
        fakeTargetScene(Promise.resolve(), [createSurface()]),
      ],
    });
    harness.dependencies.createYouTubePlayerManager = vi.fn(
      (_container, onPlaybackError) => youtube.install(onPlaybackError),
    );
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);

    await controller.launch();
    harness.hitTest.setCurrentHit(new Matrix4());
    harness.renderer.emitFrame();
    expect(controller.place()).toBe(true);
    harness.gesture.handlers.onTap({ x: 120, y: 80 });
    expect(youtube.activateFromPointer).toHaveBeenCalledOnce();

    await controller.stop();
    await controller.launch();
    harness.hitTest.setCurrentHit(new Matrix4().makeTranslation(3, 0, -4));
    harness.renderer.emitFrame();
    expect(harness.floorScene.placementRoot.visible).toBe(false);

    activation.resolve('missed');
    await flushPromises();

    expect(harness.floorScene.placementRoot.visible).toBe(false);
    expect(harness.hooks.onPlaced).toHaveBeenCalledTimes(1);
    expect(youtube.activateFromPointer).toHaveBeenCalledOnce();
  });

  it('uses absolute rotation, latest-pose reset, pinch, tap, select, and floor-plane drag', async () => {
    const harness = createHarness();
    harness.floorScene.camera.position.set(0, 1, 1);
    harness.floorScene.camera.lookAt(0, 0, 0);
    harness.floorScene.camera.updateProjectionMatrix();
    harness.floorScene.camera.updateMatrixWorld(true);
    harness.options.gestureSurface.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      toJSON: () => ({}),
    });
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);
    await controller.launch();

    const latestHit = new Matrix4().makeTranslation(1, 0, -2);
    harness.hitTest.setCurrentHit(latestHit);
    harness.renderer.emitFrame();
    expect(controller.place()).toBe(true);

    controller.setRotation(45);
    controller.setRotation(10);
    expect(harness.floorScene.placementRoot.rotation.y).toBeCloseTo(Math.PI / 18);

    harness.gesture.handlers.onPinch(2);
    expect(harness.floorScene.placementRoot.scale.toArray()).toEqual([2, 2, 2]);

    harness.session.emit('select');
    expect(harness.floorScene.placementRoot.rotation.y).toBeCloseTo(Math.PI / 18);
    expect(harness.floorScene.placementRoot.scale.toArray()).toEqual([2, 2, 2]);
    expect(harness.hooks.onPlaced).toHaveBeenCalledOnce();

    harness.gesture.handlers.onDrag({ x: 50, y: 50 });
    expect(harness.floorScene.placementRoot.position.distanceTo(new Vector3(0, 0, 0))).toBeCloseTo(0);

    harness.hitTest.setCurrentValidity(false);
    harness.renderer.emitFrame();
    expect(controller.reset()).toBe(true);
    expect(harness.floorScene.placementRoot.position.toArray()).toEqual([1, 0, -2]);
    expect(harness.floorScene.placementRoot.scale.toArray()).toEqual([1, 1, 1]);

    harness.hitTest.setCurrentValidity(true);
    harness.renderer.emitFrame();
    harness.gesture.handlers.onTap({ x: 50, y: 50 });
    harness.session.emit('select');
    expect(harness.hooks.onPlaced).toHaveBeenCalledTimes(2);
  });

  it('keeps rotation and scale when DOM-overlay input ends after placement', async () => {
    const harness = createHarness();
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);
    await controller.launch();

    harness.hitTest.setCurrentHit(new Matrix4().makeTranslation(1, 0, -2));
    harness.renderer.emitFrame();
    harness.session.emit('select');
    expect(harness.hooks.onPlaced).toHaveBeenCalledOnce();

    controller.setRotation(45);
    harness.gesture.handlers.onPinch(2);

    const beforeXRSelect = new Event('beforexrselect', {
      bubbles: true,
      cancelable: true,
    });
    harness.options.gestureSurface.dispatchEvent(beforeXRSelect);
    if (!beforeXRSelect.defaultPrevented) {
      harness.session.emit('select');
    }

    expect(beforeXRSelect.defaultPrevented).toBe(true);
    expect(harness.floorScene.placementRoot.rotation.y).toBeCloseTo(Math.PI / 4);
    expect(harness.floorScene.placementRoot.scale.toArray()).toEqual([2, 2, 2]);
    expect(harness.hooks.onPlaced).toHaveBeenCalledOnce();
  });

  it('cleans an externally ended session and remains reusable', async () => {
    const firstSession = fakeXRSession();
    const secondSession = fakeXRSession();
    const firstTarget = fakeTargetScene();
    const secondTarget = fakeTargetScene();
    const harness = createHarness({
      targetScenes: [firstTarget, secondTarget],
      sessionPromises: [Promise.resolve(firstSession.session), Promise.resolve(secondSession.session)],
    });
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);

    await controller.launch();
    firstSession.emit('end');

    expect(firstTarget.dispose).toHaveBeenCalledOnce();
    expect(harness.gesture.disconnect).toHaveBeenCalledOnce();
    expect(harness.renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
    expect(harness.floorScene.placementRoot.children).toHaveLength(0);
    expect(harness.hooks.onSessionEnd).toHaveBeenCalledOnce();
    expect(harness.hooks.onStatus).toHaveBeenLastCalledWith(
      'Floor AR ended. Scan the image or place it again.',
    );
    expect(harness.floorScene.dispose).not.toHaveBeenCalled();
    const endedOverlaySelect = new Event('beforexrselect', { bubbles: true, cancelable: true });
    harness.options.gestureSurface.dispatchEvent(endedOverlaySelect);
    expect(endedOverlaySelect.defaultPrevented).toBe(false);

    await controller.launch();

    expect(harness.startSession).toHaveBeenCalledTimes(2);
    expect(secondTarget.group.parent).toBe(harness.floorScene.placementRoot);
    expect(harness.gesture.connect).toHaveBeenCalledTimes(2);
    const relaunchedOverlaySelect = new Event('beforexrselect', { bubbles: true, cancelable: true });
    harness.options.gestureSurface.dispatchEvent(relaunchedOverlaySelect);
    expect(relaunchedOverlaySelect.defaultPrevented).toBe(true);
  });

  it('publishes and rejects an asset failure after cleaning session resources', async () => {
    const ready = deferred<void>();
    const harness = createHarness({ targetReady: ready.promise });
    const result = await prepareWithHarness(harness);
    const launchPromise = supportedController(result).launch();
    await flushPromises();

    ready.reject(new Error('model unavailable'));

    await expect(launchPromise).rejects.toThrow('model unavailable');
    expect(harness.hooks.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining('model unavailable'),
    );
    expect(harness.session.end).toHaveBeenCalledOnce();
    expect(harness.targetScene.dispose).toHaveBeenCalledOnce();
    expect(harness.gesture.disconnect).toHaveBeenCalledOnce();
    expect(harness.renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
    expect(harness.floorScene.placementRoot.children).toHaveLength(0);
  });

  it('publishes and rejects a session request failure without creating target resources', async () => {
    const harness = createHarness({
      sessionPromises: [Promise.reject(new Error('permission denied'))],
    });
    const result = await prepareWithHarness(harness);

    await expect(supportedController(result).launch()).rejects.toThrow('permission denied');

    expect(harness.hooks.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining('permission denied'),
    );
    expect(harness.createTargetSceneObject).not.toHaveBeenCalled();
    expect(harness.hooks.onSessionStart).not.toHaveBeenCalled();
  });

  it('waits for an unresolved session request and stale session end before stop resolves', async () => {
    const sessionRequest = deferred<XRSession>();
    const sessionEnd = deferred<void>();
    const staleSession = fakeXRSession();
    staleSession.end.mockReturnValueOnce(sessionEnd.promise);
    const harness = createHarness({ sessionPromises: [sessionRequest.promise] });
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);

    const launchPromise = controller.launch();
    let stopSettled = false;
    const stopPromise = controller.stop().then(() => {
      stopSettled = true;
    });
    await flushPromises();

    expect(stopSettled).toBe(false);
    expect(staleSession.end).not.toHaveBeenCalled();

    sessionRequest.resolve(staleSession.session);
    await flushPromises();

    expect(staleSession.end).toHaveBeenCalledOnce();
    expect(stopSettled).toBe(false);
    expect(staleSession.session.addEventListener).not.toHaveBeenCalled();
    expect(harness.renderer.xr.setSession).not.toHaveBeenCalled();
    expect(harness.createTargetSceneObject).not.toHaveBeenCalled();
    expect(harness.gesture.connect).not.toHaveBeenCalled();
    expect(harness.renderer.setAnimationLoop).not.toHaveBeenCalled();
    expect(harness.renderer.render).not.toHaveBeenCalled();
    expect(harness.hooks.onSessionStart).not.toHaveBeenCalled();
    expect(harness.hooks.onStatus).not.toHaveBeenCalled();

    sessionEnd.resolve();
    await Promise.all([stopPromise, launchPromise]);

    expect(stopSettled).toBe(true);
    expect(staleSession.end).toHaveBeenCalledOnce();
  });

  it('waits for an unresolved rejected session request without leaking resources', async () => {
    const sessionRequest = deferred<XRSession>();
    const harness = createHarness({ sessionPromises: [sessionRequest.promise] });
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);

    const launchPromise = controller.launch();
    let stopSettled = false;
    const stopPromise = controller.stop().then(() => {
      stopSettled = true;
    });
    await flushPromises();

    expect(stopSettled).toBe(false);

    sessionRequest.reject(new Error('permission denied after stop'));
    await Promise.all([stopPromise, launchPromise]);

    expect(stopSettled).toBe(true);
    expect(harness.renderer.xr.setSession).not.toHaveBeenCalled();
    expect(harness.createTargetSceneObject).not.toHaveBeenCalled();
    expect(harness.gesture.connect).not.toHaveBeenCalled();
    expect(harness.hooks.onSessionStart).not.toHaveBeenCalled();
    expect(harness.hooks.onStatus).not.toHaveBeenCalled();
  });

  it('releases stop after XR end without waiting for stale target readiness', async () => {
    const targetReady = deferred<void>();
    const sessionEnd = deferred<void>();
    const harness = createHarness({ targetReady: targetReady.promise });
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);

    const launchPromise = controller.launch();
    await flushPromises();
    expect(harness.hooks.onSessionStart).toHaveBeenCalledOnce();
    expect(harness.createTargetSceneObject).toHaveBeenCalledOnce();
    expect(harness.gesture.connect).toHaveBeenCalledOnce();

    harness.session.end.mockReturnValueOnce(sessionEnd.promise);
    let stopSettled = false;
    const stopPromise = controller.stop().then(() => {
      stopSettled = true;
    });

    expect(harness.session.end).toHaveBeenCalledOnce();
    expect(harness.targetScene.dispose).toHaveBeenCalledOnce();
    expect(harness.gesture.disconnect).toHaveBeenCalledOnce();
    expect(harness.renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
    expect(harness.floorScene.placementRoot.children).toHaveLength(0);

    sessionEnd.resolve();
    await vi.waitFor(() => expect(stopSettled).toBe(true));

    const lifecycleCounts = {
      end: harness.session.end.mock.calls.length,
      setSession: harness.renderer.xr.setSession.mock.calls.length,
      sessionStart: harness.hooks.onSessionStart.mock.calls.length,
      sessionEnd: harness.hooks.onSessionEnd.mock.calls.length,
      status: harness.hooks.onStatus.mock.calls.length,
      targetCreation: harness.createTargetSceneObject.mock.calls.length,
      targetDisposal: harness.targetScene.dispose.mock.calls.length,
      gestureConnect: harness.gesture.connect.mock.calls.length,
      gestureDisconnect: harness.gesture.disconnect.mock.calls.length,
      animationLoop: harness.renderer.setAnimationLoop.mock.calls.length,
    };

    targetReady.reject(new Error('late stale target failure'));
    await Promise.all([stopPromise, launchPromise]);

    expect(harness.session.end).toHaveBeenCalledTimes(lifecycleCounts.end);
    expect(harness.renderer.xr.setSession).toHaveBeenCalledTimes(lifecycleCounts.setSession);
    expect(harness.hooks.onSessionStart).toHaveBeenCalledTimes(lifecycleCounts.sessionStart);
    expect(harness.hooks.onSessionEnd).toHaveBeenCalledTimes(lifecycleCounts.sessionEnd);
    expect(harness.hooks.onStatus).toHaveBeenCalledTimes(lifecycleCounts.status);
    expect(harness.createTargetSceneObject).toHaveBeenCalledTimes(lifecycleCounts.targetCreation);
    expect(harness.targetScene.dispose).toHaveBeenCalledTimes(lifecycleCounts.targetDisposal);
    expect(harness.gesture.connect).toHaveBeenCalledTimes(lifecycleCounts.gestureConnect);
    expect(harness.gesture.disconnect).toHaveBeenCalledTimes(lifecycleCounts.gestureDisconnect);
    expect(harness.renderer.setAnimationLoop).toHaveBeenCalledTimes(lifecycleCounts.animationLoop);
    expect(harness.renderer.render).not.toHaveBeenCalled();
    expect(harness.floorScene.placementRoot.children).toHaveLength(0);
  });

  it('ends a stale session resolution when a newer launch wins', async () => {
    const firstResolution = deferred<XRSession>();
    const secondResolution = deferred<XRSession>();
    const firstSession = fakeXRSession();
    const secondSession = fakeXRSession();
    const harness = createHarness({
      sessionPromises: [firstResolution.promise, secondResolution.promise],
    });
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);

    const firstLaunch = controller.launch();
    const secondLaunch = controller.launch();
    expect(harness.startSession).toHaveBeenCalledTimes(2);

    secondResolution.resolve(secondSession.session);
    await secondLaunch;
    firstResolution.resolve(firstSession.session);
    await firstLaunch;

    expect(firstSession.end).toHaveBeenCalledOnce();
    expect(harness.renderer.xr.setSession).toHaveBeenCalledTimes(1);
    expect(harness.renderer.xr.setSession).toHaveBeenCalledWith(secondSession.session);
    expect(harness.createTargetSceneObject).toHaveBeenCalledOnce();
  });

  it('immediately supersedes an active loading session before a newer request rejects', async () => {
    const firstReady = deferred<void>();
    const secondResolution = deferred<XRSession>();
    const firstSession = fakeXRSession();
    const firstTarget = fakeTargetScene(firstReady.promise);
    const harness = createHarness({
      sessionPromises: [Promise.resolve(firstSession.session), secondResolution.promise],
      targetScenes: [firstTarget],
    });
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);
    const firstLaunch = controller.launch();
    await flushPromises();

    const secondLaunch = controller.launch();

    expect(harness.startSession).toHaveBeenCalledTimes(2);
    expect(firstSession.end).toHaveBeenCalledOnce();
    expect(harness.startSession.mock.invocationCallOrder[1]).toBeLessThan(
      firstSession.end.mock.invocationCallOrder[0],
    );
    expect(firstTarget.dispose).toHaveBeenCalledOnce();
    expect(harness.gesture.disconnect).toHaveBeenCalledOnce();
    expect(harness.renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
    expect(harness.floorScene.placementRoot.children).toHaveLength(0);

    firstReady.reject(new Error('stale first asset failure'));
    await expect(firstLaunch).resolves.toBeUndefined();
    secondResolution.reject(new Error('second request denied'));
    await expect(secondLaunch).rejects.toThrow('second request denied');

    expect(firstSession.end).toHaveBeenCalledOnce();
    expect(firstTarget.dispose).toHaveBeenCalledOnce();
    expect(harness.hooks.onStatus).toHaveBeenLastCalledWith(
      expect.stringContaining('second request denied'),
    );
  });

  it('ends a resolved waiting session immediately when stop invalidates it', async () => {
    const firstEnd = deferred<void>();
    const secondResolution = deferred<XRSession>();
    const firstSession = fakeXRSession();
    const secondSession = fakeXRSession();
    const harness = createHarness({
      sessionPromises: [Promise.resolve(firstSession.session), secondResolution.promise],
      targetScenes: [fakeTargetScene()],
    });
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);

    await controller.launch();
    firstSession.end.mockReturnValueOnce(firstEnd.promise);

    const secondLaunch = controller.launch();
    expect(firstSession.end).toHaveBeenCalledOnce();

    secondResolution.resolve(secondSession.session);
    await flushPromises();

    const stopPromise = controller.stop();

    expect(secondSession.end).toHaveBeenCalledOnce();
    expect(harness.renderer.xr.setSession).toHaveBeenCalledTimes(1);
    expect(harness.renderer.xr.setSession).toHaveBeenCalledWith(firstSession.session);
    expect(harness.hooks.onSessionStart).toHaveBeenCalledOnce();
    expect(harness.createTargetSceneObject).toHaveBeenCalledOnce();

    firstEnd.resolve();
    await stopPromise;
    await secondLaunch;

    expect(secondSession.end).toHaveBeenCalledOnce();
    expect(harness.renderer.xr.setSession).toHaveBeenCalledTimes(1);
    expect(harness.hooks.onSessionStart).toHaveBeenCalledOnce();
    expect(harness.createTargetSceneObject).toHaveBeenCalledOnce();
  });

  it('ends a session once when stop wins during renderer session setup', async () => {
    const rendererSessionReady = deferred<void>();
    const harness = createHarness();
    harness.renderer.xr.setSession.mockReturnValueOnce(rendererSessionReady.promise);
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);
    const launchPromise = controller.launch();
    await flushPromises();

    let stopSettled = false;
    const stopPromise = controller.stop().then(() => {
      stopSettled = true;
    });
    await flushPromises();

    expect(stopSettled).toBe(false);

    rendererSessionReady.resolve();
    await Promise.all([stopPromise, launchPromise]);

    expect(stopSettled).toBe(true);
    expect(harness.session.end).toHaveBeenCalledOnce();
    expect(harness.createTargetSceneObject).not.toHaveBeenCalled();
    expect(harness.hooks.onSessionStart).not.toHaveBeenCalled();
    expect(harness.hooks.onStatus).not.toHaveBeenCalled();
  });

  it('ends a session once when dispose wins during renderer session setup', async () => {
    const rendererSessionReady = deferred<void>();
    const harness = createHarness();
    harness.renderer.xr.setSession.mockReturnValueOnce(rendererSessionReady.promise);
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);
    const launchPromise = controller.launch();
    await flushPromises();

    controller.dispose();
    rendererSessionReady.resolve();
    await launchPromise;

    expect(harness.session.end).toHaveBeenCalledOnce();
    expect(harness.createTargetSceneObject).not.toHaveBeenCalled();
    expect(harness.hooks.onSessionStart).not.toHaveBeenCalled();
    expect(harness.hooks.onStatus).not.toHaveBeenCalled();
    expect(harness.floorScene.dispose).toHaveBeenCalledOnce();
  });

  it('ends a pending stale resolution and fully disposes exactly once', async () => {
    const pendingSession = deferred<XRSession>();
    const staleSession = fakeXRSession();
    const harness = createHarness({ sessionPromises: [pendingSession.promise] });
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);
    const launchPromise = controller.launch();

    controller.dispose();
    controller.dispose();
    pendingSession.resolve(staleSession.session);
    await launchPromise;

    expect(staleSession.end).toHaveBeenCalledOnce();
    expect(harness.renderer.xr.setSession).not.toHaveBeenCalled();
    expect(harness.renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
    expect(harness.hitTest.dispose).toHaveBeenCalledOnce();
    expect(harness.gesture.disconnect).toHaveBeenCalledOnce();
    expect(harness.floorScene.dispose).toHaveBeenCalledOnce();
    expect(harness.renderer.domElement.isConnected).toBe(false);
  });

  it('makes stop and dispose idempotent while preserving the prepared launcher after stop', async () => {
    const firstSession = fakeXRSession();
    const secondSession = fakeXRSession();
    const harness = createHarness({
      sessionPromises: [Promise.resolve(firstSession.session), Promise.resolve(secondSession.session)],
      targetScenes: [fakeTargetScene(), fakeTargetScene()],
    });
    const result = await prepareWithHarness(harness);
    const controller = supportedController(result);

    await controller.launch();
    await Promise.all([controller.stop(), controller.stop()]);
    expect(firstSession.end).toHaveBeenCalledOnce();
    expect(harness.floorScene.dispose).not.toHaveBeenCalled();

    await controller.launch();
    controller.dispose();
    controller.dispose();

    expect(harness.startSession).toHaveBeenCalledTimes(2);
    expect(secondSession.end).toHaveBeenCalledOnce();
    expect(harness.hitTest.dispose).toHaveBeenCalledOnce();
    expect(harness.floorScene.dispose).toHaveBeenCalledOnce();
  });
});

function baseOptions() {
  const stage = document.createElement('div');
  const overlayRoot = document.createElement('div');
  const gestureSurface = document.createElement('div');
  overlayRoot.append(gestureSurface);
  stage.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 300,
    bottom: 150,
    width: 300,
    height: 150,
    toJSON: () => ({}),
  });
  gestureSurface.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 200,
    bottom: 100,
    width: 200,
    height: 100,
    toJSON: () => ({}),
  });
  const asset: CloudflarePlacedAsset = {
    model: { id: 'chair', label: 'Chair', url: 'chair.glb' },
  };
  const hooks: FloorPlacementHooks = {
    onSessionStart: vi.fn(),
    onSessionEnd: vi.fn(),
    onStatus: vi.fn(),
    onYouTubeError: vi.fn(),
    onYouTubeActivated: vi.fn(),
    onPlacementReady: vi.fn(),
    onPlaced: vi.fn(),
  };
  return { stage, overlayRoot, gestureSurface, asset, hooks };
}

type HarnessOptions = {
  targetReady?: Promise<void>;
  targetScenes?: TargetSceneObject[];
  sessionPromises?: Promise<XRSession>[];
};

function createHarness(options: HarnessOptions = {}) {
  const runtimeOptions = baseOptions();
  document.body.append(runtimeOptions.stage);
  const renderer = fakeRenderer();
  runtimeOptions.stage.append(renderer.domElement);
  const floorScene: FloorPlacementScene = {
    renderer: renderer.renderer,
    scene: new Scene(),
    camera: new PerspectiveCamera(70, 1, 0.01, 40),
    reticle: new Mesh(),
    placementRoot: new Group(),
    dispose: vi.fn(),
  };
  floorScene.placementRoot.visible = false;
  floorScene.scene.add(floorScene.reticle, floorScene.placementRoot);
  const session = fakeXRSession();
  const sessionPromises = [...(options.sessionPromises ?? [Promise.resolve(session.session)])];
  const startSession = vi.fn(() => sessionPromises.shift() ?? Promise.resolve(session.session));
  const targetScenes = [...(options.targetScenes ?? [fakeTargetScene(options.targetReady)])];
  const fallbackTarget = targetScenes[0];
  const createTargetSceneObject = vi.fn(() => targetScenes.shift() ?? fallbackTarget);
  const hitTest = fakeHitTest();
  const gesture = fakeGesture();
  const youtube = fakeYouTubeManager();
  const clock = { getDelta: vi.fn(() => 0.25) };
  const dependencies: Partial<FloorPlacementDependencies> = {
    prepareSessionLauncher: async () => ({
      supported: true,
      launcher: { start: startSession },
    }),
    createScene: vi.fn(() => floorScene),
    createTargetSceneObject,
    createHitTest: vi.fn(() => hitTest.value),
    createGestureController: vi.fn((_target, handlers) => gesture.install(handlers)),
    createClock: vi.fn(() => clock),
    createYouTubePlayerManager: vi.fn((_container, onPlaybackError) => youtube.install(onPlaybackError)),
  };

  return {
    options: runtimeOptions,
    hooks: runtimeOptions.hooks,
    dependencies,
    floorScene,
    renderer,
    session,
    startSession,
    targetScene: fallbackTarget,
    createTargetSceneObject,
    hitTest,
    gesture,
    youtube,
    clock,
  };
}

async function prepareWithHarness(harness: ReturnType<typeof createHarness>) {
  return prepareFloorPlacement(harness.options, harness.dependencies);
}

function supportedController(result: Awaited<ReturnType<typeof prepareFloorPlacement>>) {
  if (!result.supported) throw new Error('expected floor placement support');
  return result.controller;
}

function fakeTargetScene(
  ready: Promise<void> = Promise.resolve(),
  youtubeSurfaces: InteractiveYouTubeSurface[] = [],
): TargetSceneObject {
  const group = new Group();
  for (const surface of youtubeSurfaces) {
    group.add(surface.root);
  }
  return {
    group,
    ready,
    youtubeSurfaces,
    update: vi.fn(),
    dispose: vi.fn(),
  };
}

function createRaycastSurface(): InteractiveYouTubeSurface {
  const root = new Group();
  const mesh = new Mesh(new PlaneGeometry(0.5, 0.5));
  mesh.position.set(1, 0, -2);
  root.add(mesh);
  return {
    objectId: 'off-center-floor-video',
    root,
    mesh,
    youtube: {
      videoId: 'dQw4w9WgXcQ',
      title: 'Off-center floor video',
    },
  };
}

function createSurface(): InteractiveYouTubeSurface {
  const root = new Group();
  const mesh = new Mesh();
  root.add(mesh);
  return {
    objectId: 'floor-video',
    root,
    mesh,
    youtube: {
      videoId: 'dQw4w9WgXcQ',
      title: 'Floor video',
    },
  };
}

function fakeYouTubeManager() {
  const value = {
    register: vi.fn(),
    setMarkerVisible: vi.fn(),
    activateFromPointer: vi.fn(),
    update: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  };

  return {
    ...value,
    install(_onPlaybackError: (message: string) => void) {
      return value as Pick<
        YouTubePlayerManager,
        'register' | 'setMarkerVisible' | 'activateFromPointer' | 'update' | 'resize' | 'dispose'
      >;
    },
  };
}

function fakeRenderer() {
  let animationLoop: XRFrameRequestCallback | null = null;
  const referenceSpace = {} as XRReferenceSpace;
  const xrCamera = new PerspectiveCamera(70, 1, 0.01, 40);
  const xr = {
    enabled: true,
    setReferenceSpaceType: vi.fn(),
    setSession: vi.fn(async () => undefined),
    getReferenceSpace: vi.fn(() => referenceSpace),
    getCamera: vi.fn(() => xrCamera),
  };
  const domElement = document.createElement('canvas');
  const setAnimationLoop = vi.fn((callback: XRFrameRequestCallback | null) => {
    animationLoop = callback;
  });
  const render = vi.fn();
  const renderer = {
    xr,
    domElement,
    setAnimationLoop,
    render,
  } as unknown as WebGLRenderer;

  return {
    renderer,
    xr,
    xrCamera,
    domElement,
    referenceSpace,
    setAnimationLoop,
    render,
    emitFrame(frame: XRFrame = {} as XRFrame) {
      animationLoop?.(0, frame);
    },
  };
}

function fakeHitTest() {
  let currentValid = false;
  const value = {
    latestPoseMatrix: null as Matrix4 | null,
    update: vi.fn(() => currentValid),
    reset: vi.fn(() => {
      currentValid = false;
      value.latestPoseMatrix = null;
    }),
    dispose: vi.fn(),
  };

  return {
    value: value as unknown as ReturnType<FloorPlacementDependencies['createHitTest']>,
    update: value.update,
    reset: value.reset,
    dispose: value.dispose,
    setCurrentHit(matrix: Matrix4) {
      value.latestPoseMatrix = matrix;
      currentValid = true;
    },
    setCurrentValidity(valid: boolean) {
      currentValid = valid;
    },
  };
}

function fakeGesture() {
  const connect = vi.fn();
  const disconnect = vi.fn();
  let handlers: FloorGestureHandlers | undefined;

  return {
    connect,
    disconnect,
    get handlers() {
      if (!handlers) throw new Error('gesture handlers were not installed');
      return handlers;
    },
    install(nextHandlers: FloorGestureHandlers) {
      handlers = nextHandlers;
      return { connect, disconnect } as ReturnType<FloorPlacementDependencies['createGestureController']>;
    },
  };
}

function fakeXRSession() {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const session = {
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      const registered = listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
      registered.add(listener);
      listeners.set(type, registered);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.get(type)?.delete(listener);
    }),
    end: vi.fn(async () => {
      emit('end');
    }),
  } as unknown as XRSession;

  function emit(type: 'end' | 'select'): void {
    const event = new Event(type);
    for (const listener of [...(listeners.get(type) ?? [])]) {
      if (typeof listener === 'function') {
        listener.call(session, event);
      } else {
        listener.handleEvent(event);
      }
    }
  }

  return { session, end: session.end as ReturnType<typeof vi.fn>, emit };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function firstInvocation(callback: (...args: never[]) => unknown): number {
  return (callback as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudImageTarget } from '../src/app/cloudImageTargets';

const scanModel = {
  id: 'chair',
  label: 'Chair',
  url: 'https://worker.example/models/chair.glb',
};

const scanPlacement = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  height: 0.12,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
};

const scanTarget: CloudImageTarget = {
  id: 'target-one',
  scanId: 'scan-one',
  accessMode: 'anyone_with_link',
  allowedEmails: [],
  label: 'Only this marker',
  imageUrl: 'https://worker.example/image-targets/only-this-marker.jpg',
  imageObjectKey: 'image-targets/only-this-marker.jpg',
  model: scanModel,
  placement: scanPlacement,
  objects: [{
    kind: 'model',
    id: 'object-one',
    model: scanModel,
    placement: scanPlacement,
    groupId: 'group-one',
    localPlacement: { ...scanPlacement, offsetX: 0.2 },
  }],
  groups: [{
    id: 'group-one',
    label: 'Furniture',
    placement: { ...scanPlacement, height: 0 },
    animation: { preset: 'none', tracks: [] },
  }],
};

const cloudImageTargetMocks = vi.hoisted(() => {
  class ImageTargetRequestError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }

  return {
    ImageTargetRequestError,
    createImageTarget: vi.fn(),
    deleteImageTarget: vi.fn(),
    getImageTargetForScan: vi.fn(),
    listImageTargets: vi.fn(async () => []),
    updateImageTarget: vi.fn(),
  };
});

const markerArMocks = vi.hoisted(() => ({
  sessionStop: vi.fn(),
  startMarkerAR: vi.fn(),
}));

const floorRuntimeMocks = vi.hoisted(() => {
  const launch = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const place = vi.fn<() => boolean>(() => true);
  const setRotation = vi.fn<(degrees: number) => void>();
  const reset = vi.fn<() => boolean>(() => true);
  const stop = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const dispose = vi.fn<() => void>();

  return {
    prepareFloorPlacement: vi.fn(),
    launch,
    place,
    setRotation,
    reset,
    stop,
    dispose,
    controller: { launch, place, setRotation, reset, stop, dispose },
    hooks: undefined as undefined | {
      onSessionStart(): void;
      onSessionEnd(): void;
      onStatus(message: string): void;
      onPlacementReady(ready: boolean): void;
      onPlaced(): void;
    },
  };
});

const authMocks = vi.hoisted(() => ({
  getCurrentWebArUser: vi.fn(),
  loadWorkerAuthToken: vi.fn<() => string | null>(),
  loginToWebArWorker: vi.fn(),
}));

vi.mock('../src/app/cloudflareModels', () => ({
  DEFAULT_GENERATE_MODEL_API_URL: 'https://worker.example/generate-3d',
  loadCloudflareModelOptions: vi.fn(async () => []),
}));

vi.mock('../src/app/cloudImageTargets', () => cloudImageTargetMocks);

vi.mock('../src/app/webArAuth', () => ({
  clearWorkerAuthToken: vi.fn(),
  getCurrentWebArUser: authMocks.getCurrentWebArUser,
  loadWorkerAuthToken: authMocks.loadWorkerAuthToken,
  loginToWebArWorker: authMocks.loginToWebArWorker,
  saveWorkerAuthToken: vi.fn(),
  signupToWebArWorker: vi.fn(),
}));

vi.mock('../src/capture/cameraCapture', () => ({
  imageFileToCapturedImage: vi.fn(),
}));

vi.mock('../src/ar/mindarRuntime', () => ({
  startMarkerAR: markerArMocks.startMarkerAR,
}));

vi.mock('../src/ar/floorPlacementRuntime', () => ({
  prepareFloorPlacement: floorRuntimeMocks.prepareFloorPlacement,
}));

vi.mock('../src/scene/ImageTargetPreview', () => ({
  ImageTargetPreview: class {
    update = vi.fn(async () => undefined);
    dispose = vi.fn();
  },
}));

describe('target-specific scan route integration', () => {
  let hashChangeListeners: EventListener[] = [];

  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="app"></div>';
    window.localStorage.clear();
    window.history.replaceState(null, '', '#/scan/scan-one');
    authMocks.loadWorkerAuthToken.mockReset();
    authMocks.loadWorkerAuthToken.mockReturnValue(null);
    authMocks.getCurrentWebArUser.mockReset();
    authMocks.getCurrentWebArUser.mockResolvedValue(null);
    authMocks.loginToWebArWorker.mockReset();
    cloudImageTargetMocks.getImageTargetForScan.mockReset();
    cloudImageTargetMocks.listImageTargets.mockClear();
    markerArMocks.sessionStop.mockClear();
    markerArMocks.startMarkerAR.mockReset();
    markerArMocks.startMarkerAR.mockResolvedValue({ stop: markerArMocks.sessionStop });
    floorRuntimeMocks.prepareFloorPlacement.mockReset();
    floorRuntimeMocks.launch.mockReset();
    floorRuntimeMocks.launch.mockResolvedValue(undefined);
    floorRuntimeMocks.place.mockReset();
    floorRuntimeMocks.place.mockReturnValue(true);
    floorRuntimeMocks.setRotation.mockReset();
    floorRuntimeMocks.reset.mockReset();
    floorRuntimeMocks.reset.mockReturnValue(true);
    floorRuntimeMocks.stop.mockReset();
    floorRuntimeMocks.stop.mockResolvedValue(undefined);
    floorRuntimeMocks.dispose.mockReset();
    floorRuntimeMocks.hooks = undefined;
    floorRuntimeMocks.prepareFloorPlacement.mockImplementation(async (options: {
      hooks: NonNullable<typeof floorRuntimeMocks.hooks>;
    }) => {
      floorRuntimeMocks.hooks = options.hooks;
      return { supported: true, controller: floorRuntimeMocks.controller };
    });
    hashChangeListeners = [];
    const addEventListener = window.addEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation(((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (type === 'hashchange' && typeof listener === 'function') {
        hashChangeListeners.push(listener);
      }
      addEventListener(type, listener, options);
    }) as typeof window.addEventListener);
  });

  afterEach(async () => {
    for (const listener of hashChangeListeners) {
      window.removeEventListener('hashchange', listener);
    }
    window.history.replaceState(null, '', '#/scan/scan-one');
    vi.restoreAllMocks();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('explains camera permission before a direct generic Scan starts', async () => {
    window.history.replaceState(null, '', '#/scan');

    await import('../src/main');

    expect(required('[data-app-shell]').getAttribute('data-active-page')).toBe('scan');
    expect(required('#ar-status').textContent).toBe(
      'Camera access starts only after you choose Start camera.',
    );
    expect(required<HTMLButtonElement>('#start-ar')).toMatchObject({
      disabled: false,
      textContent: 'Start camera',
    });
    expect(markerArMocks.startMarkerAR).not.toHaveBeenCalled();
  });

  it('stops a generic scanner session when navigating away from Scan', async () => {
    window.history.replaceState(null, '', '#/scan');

    await import('../src/main');
    document.querySelector<HTMLButtonElement>('#start-ar')?.click();
    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 1);

    window.location.hash = '#/';
    await waitFor(() => markerArMocks.sessionStop.mock.calls.length === 1);

    expect(document.querySelector('[data-app-shell]')?.getAttribute('data-active-page')).toBe('home');
    const stage = required('#ar-stage');
    expect(stage.querySelector('[data-scanner-guide]')).toBeNull();
    expect(stage.querySelector('.stage-idle')?.textContent).toBe('Scan an experience');
    expect(document.querySelectorAll('[data-scanner-guide]')).toHaveLength(0);
  });

  it('owns one scanner guide inside the camera stage and toggles it from aggregate marker visibility', async () => {
    window.history.replaceState(null, '', '#/scan');

    await import('../src/main');
    required<HTMLButtonElement>('#start-ar').click();
    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 1);

    const stage = required('#ar-stage');
    const guide = required<HTMLElement>('#ar-stage [data-scanner-guide]');
    const options = markerArMocks.startMarkerAR.mock.calls[0][1] as {
      targets: Array<{ marker: { id: string; label: string; targetIndex: number } }>;
      onMarkerVisibility(event: {
        marker: { id: string; label: string; targetIndex: number };
        visible: boolean;
      }): void;
    };

    expect(stage.querySelectorAll('[data-scanner-guide]')).toHaveLength(1);
    expect(guide.parentElement).toBe(stage);
    expect([...document.body.children]).not.toContain(guide);
    expect(guide.hidden).toBe(false);

    options.onMarkerVisibility({ marker: options.targets[0].marker, visible: true });
    options.onMarkerVisibility({ marker: options.targets[1].marker, visible: false });
    expect(guide.hidden).toBe(true);

    options.onMarkerVisibility({ marker: options.targets[0].marker, visible: false });
    expect(guide.hidden).toBe(false);
  });

  it('does not duplicate the scanner guide when the camera restarts', async () => {
    window.history.replaceState(null, '', '#/scan');

    await import('../src/main');
    const start = required<HTMLButtonElement>('#start-ar');
    start.click();
    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 1);

    start.click();
    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 2);

    expect(required('#ar-stage').querySelectorAll('[data-scanner-guide]')).toHaveLength(1);
    expect(markerArMocks.sessionStop).toHaveBeenCalledTimes(1);
  });

  it('removes the guide while startup is pending and stops the late session', async () => {
    const markerStart = deferred<{ stop(): void }>();
    const lateStop = vi.fn();
    markerArMocks.startMarkerAR.mockReturnValueOnce(markerStart.promise);
    window.history.replaceState(null, '', '#/scan');

    await import('../src/main');
    required<HTMLButtonElement>('#start-ar').click();
    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 1);

    window.location.hash = '#/';
    await waitFor(() => required('[data-app-shell]').getAttribute('data-active-page') === 'home');

    expect(required('#ar-stage').querySelector('[data-scanner-guide]')).toBeNull();
    expect(required('#ar-stage').querySelector('.stage-idle')).toBeTruthy();

    markerStart.resolve({ stop: lateStop });
    await waitFor(() => lateStop.mock.calls.length === 1);
    expect(required('#ar-stage').querySelector('[data-scanner-guide]')).toBeNull();
  });

  it('exits a pending marker start and stops its late session safely', async () => {
    const markerStart = deferred<{ stop(): void }>();
    const lateStop = vi.fn();
    markerArMocks.startMarkerAR.mockReturnValueOnce(markerStart.promise);
    window.history.replaceState(null, '', '#/scan');

    await import('../src/main');
    required<HTMLButtonElement>('#start-ar').click();
    await waitFor(() => required('[data-app-shell]').getAttribute('data-scan-session') === 'starting');

    const exit = required<HTMLButtonElement>('#marker-session-exit');
    expect(exit.hidden).toBe(false);
    exit.click();

    expect(required('[data-app-shell]').getAttribute('data-scan-session')).toBe('idle');
    expect(exit.hidden).toBe(true);
    expect(required('#ar-status').textContent).toBe(
      'Camera access starts only after you choose Start camera.',
    );
    expect(required<HTMLButtonElement>('#start-ar')).toMatchObject({
      disabled: false,
      textContent: 'Start camera',
    });
    expect(document.activeElement).toBe(required<HTMLButtonElement>('#start-ar'));
    expect(required('#ar-stage').querySelector('.stage-idle')).toBeTruthy();

    markerStart.resolve({ stop: lateStop });
    await waitFor(() => lateStop.mock.calls.length === 1);
    expect(required('[data-app-shell]').getAttribute('data-scan-session')).toBe('idle');
  });

  it('exits an active marker session and restores route navigation state', async () => {
    window.history.replaceState(null, '', '#/scan');

    await import('../src/main');
    required<HTMLButtonElement>('#start-ar').click();
    await waitFor(() => required('[data-app-shell]').getAttribute('data-scan-session') === 'active');

    const exit = required<HTMLButtonElement>('#marker-session-exit');
    expect(exit.hidden).toBe(false);
    exit.click();

    expect(markerArMocks.sessionStop).toHaveBeenCalledTimes(1);
    expect(required('[data-app-shell]').getAttribute('data-scan-session')).toBe('idle');
    expect(exit.hidden).toBe(true);
    expect(required('#ar-stage').querySelector('.stage-idle')?.textContent).toBe('Scan an experience');
    expect(required('#ar-status').textContent).toBe(
      'Camera access starts only after you choose Start camera.',
    );
    expect(required<HTMLButtonElement>('#start-ar')).toMatchObject({
      disabled: false,
      textContent: 'Start camera',
    });
    expect(document.activeElement).toBe(required<HTMLButtonElement>('#start-ar'));
  });

  it('tracks marker startup for immersive mobile navigation and clears it on departure', async () => {
    const markerStart = deferred<{ stop(): void }>();
    markerArMocks.startMarkerAR.mockReturnValueOnce(markerStart.promise);
    cloudImageTargetMocks.getImageTargetForScan.mockResolvedValue(scanTarget);

    await import('../src/main');
    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 1);
    expect(required('[data-app-shell]').getAttribute('data-scan-session')).toBe('starting');

    markerStart.resolve({ stop: markerArMocks.sessionStop });
    await waitFor(() => required('[data-app-shell]').getAttribute('data-scan-session') === 'active');

    window.location.hash = '#/';
    await waitFor(() => required('[data-app-shell]').getAttribute('data-scan-session') === 'idle');
  });

  it('never prepares or exposes floor placement on the generic Scan route', async () => {
    window.history.replaceState(null, '', '#/scan');

    await import('../src/main');

    expect(floorRuntimeMocks.prepareFloorPlacement).not.toHaveBeenCalled();
    expect(required<HTMLButtonElement>('#floor-ar-toggle').hidden).toBe(true);
  });

  it('auto-starts marker AR while floor preparation is still pending and prepares the exact focused scene once', async () => {
    const preparation = deferred<{
      supported: true;
      controller: typeof floorRuntimeMocks.controller;
    }>();
    floorRuntimeMocks.prepareFloorPlacement.mockImplementation((options: {
      hooks: NonNullable<typeof floorRuntimeMocks.hooks>;
    }) => {
      floorRuntimeMocks.hooks = options.hooks;
      return preparation.promise;
    });
    cloudImageTargetMocks.getImageTargetForScan.mockResolvedValue(scanTarget);

    await import('../src/main');
    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 1);

    expect(floorRuntimeMocks.prepareFloorPlacement).toHaveBeenCalledTimes(1);
    const preparationOptions = floorRuntimeMocks.prepareFloorPlacement.mock.calls[0][0] as {
      stage: HTMLElement;
      overlayRoot: HTMLElement;
      gestureSurface: HTMLElement;
      asset: unknown;
    };
    expect(preparationOptions).toMatchObject({
      stage: required('#floor-ar-stage'),
      overlayRoot: required('#floor-ar-overlay'),
      gestureSurface: required('#floor-ar-gesture-surface'),
    });
    expect(preparationOptions.asset).toEqual({
      model: scanTarget.model,
      placement: scanTarget.placement,
      objects: scanTarget.objects,
      groups: scanTarget.groups,
    });
    expect(required('#floor-ar-message').textContent).toBe('Preparing floor placement...');
    expect(required<HTMLButtonElement>('#floor-ar-toggle').disabled).toBe(true);
    expect(markerArMocks.sessionStop).not.toHaveBeenCalled();

    preparation.resolve({ supported: true, controller: floorRuntimeMocks.controller });
    await waitFor(() => required<HTMLButtonElement>('#floor-ar-toggle').disabled === false);
  });

  it('opens the camera with exactly the target assigned to the URL', async () => {
    cloudImageTargetMocks.getImageTargetForScan.mockResolvedValue(scanTarget);

    await import('../src/main');
    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 1);

    expect(cloudImageTargetMocks.getImageTargetForScan).toHaveBeenCalledWith({
      apiUrl: 'https://worker.example/generate-3d',
      scanId: 'scan-one',
      authToken: null,
    });
    const options = markerArMocks.startMarkerAR.mock.calls[0][1] as {
      targets: Array<{
        marker: { id: string; imagePath?: string; targetIndex: number };
        cloudflareAsset?: { objects?: Array<{ id: string }> };
      }>;
    };
    expect(options.targets).toHaveLength(1);
    expect(options.targets[0]).toMatchObject({
      marker: {
        id: 'cloud-target-one',
        imagePath: scanTarget.imageUrl,
        targetIndex: 0,
      },
      cloudflareAsset: {
        objects: [expect.objectContaining({ id: 'object-one' })],
      },
    });
    expect(options).toHaveProperty('signal');
  });

  it('keeps floor preparation tied to the route when the response omits its redundant scan id', async () => {
    cloudImageTargetMocks.getImageTargetForScan.mockResolvedValue({
      ...scanTarget,
      scanId: undefined,
    });

    await import('../src/main');
    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 1);

    expect(floorRuntimeMocks.prepareFloorPlacement).toHaveBeenCalledTimes(1);
    await waitFor(() => required<HTMLButtonElement>('#floor-ar-toggle').disabled === false);
    expect(floorRuntimeMocks.dispose).not.toHaveBeenCalled();
  });

  it('stops marker AR before launching floor AR in the Place on floor click stack', async () => {
    await openFocusedScan();

    required<HTMLButtonElement>('#floor-ar-toggle').click();

    expect(markerArMocks.sessionStop).toHaveBeenCalledTimes(1);
    expect(floorRuntimeMocks.launch).toHaveBeenCalledTimes(1);
    expect(markerArMocks.sessionStop.mock.invocationCallOrder[0]).toBeLessThan(
      floorRuntimeMocks.launch.mock.invocationCallOrder[0],
    );
    expect(required('#floor-ar-status').textContent).toBe(
      'Move your phone until the floor ring appears.',
    );
    expect(required<HTMLButtonElement>('#floor-ar-toggle').hidden).toBe(true);
    expect(required<HTMLButtonElement>('#floor-ar-back')).toMatchObject({
      hidden: false,
      textContent: 'Back to image scan',
    });
    expect(required<HTMLElement>('.scanner-controls').hidden).toBe(true);
    expect(required<HTMLButtonElement>('#marker-session-exit').hidden).toBe(true);
    expect(required('#ar-stage').querySelector('[data-scanner-guide]')).toBeNull();
    expect(required('#ar-stage').querySelector('.stage-idle')).toBeTruthy();
  });

  it('delegates Place, rotation, and Reset to the prepared controller and applies exact lifecycle statuses', async () => {
    await openFocusedScan();
    required<HTMLButtonElement>('#floor-ar-toggle').click();

    floorRuntimeMocks.hooks?.onSessionStart();
    expect(required('#floor-ar-status').textContent).toBe(
      'Move your phone until the floor ring appears.',
    );

    floorRuntimeMocks.hooks?.onPlacementReady(true);
    expect(required('#floor-ar-status').textContent).toBe('Floor found. Tap Place.');
    required<HTMLButtonElement>('#floor-ar-place').click();
    expect(floorRuntimeMocks.place).toHaveBeenCalledTimes(1);

    floorRuntimeMocks.hooks?.onPlaced();
    expect(required('#floor-ar-status').textContent).toBe(
      'Only this marker placed on the floor.',
    );

    const rotation = required<HTMLInputElement>('#floor-ar-rotation');
    rotation.value = '37';
    rotation.dispatchEvent(new Event('input', { bubbles: true }));
    expect(floorRuntimeMocks.setRotation).toHaveBeenLastCalledWith(37);

    required<HTMLButtonElement>('#floor-ar-reset').click();
    expect(floorRuntimeMocks.reset).toHaveBeenCalledTimes(1);
    expect(rotation.value).toBe('0');

    floorRuntimeMocks.hooks?.onStatus('Floor found. Tap Place.');
    expect(required('#floor-ar-status').textContent).toBe(
      'Only this marker placed on the floor.',
    );
  });

  it('keeps the placed state when floor readiness later becomes false', async () => {
    await openFocusedScan();
    required<HTMLButtonElement>('#floor-ar-toggle').click();
    floorRuntimeMocks.hooks?.onPlacementReady(true);
    floorRuntimeMocks.hooks?.onPlaced();

    floorRuntimeMocks.hooks?.onPlacementReady(false);

    expect(required('#floor-ar-status').textContent).toBe(
      'Only this marker placed on the floor.',
    );
    expect(required<HTMLButtonElement>('#floor-ar-reset').hidden).toBe(false);
    expect(required<HTMLInputElement>('#floor-ar-rotation').disabled).toBe(false);
  });

  it('keeps the placed state when floor readiness later remains true', async () => {
    await openFocusedScan();
    required<HTMLButtonElement>('#floor-ar-toggle').click();
    floorRuntimeMocks.hooks?.onPlacementReady(true);
    floorRuntimeMocks.hooks?.onPlaced();

    floorRuntimeMocks.hooks?.onPlacementReady(true);

    expect(required('#floor-ar-status').textContent).toBe(
      'Only this marker placed on the floor.',
    );
    expect(required<HTMLButtonElement>('#floor-ar-reset').hidden).toBe(false);
    expect(required<HTMLInputElement>('#floor-ar-rotation').disabled).toBe(false);
  });

  it('stops floor AR and restarts MindAR with the same focused target when Back to image scan is clicked', async () => {
    await openFocusedScan();
    required<HTMLButtonElement>('#floor-ar-toggle').click();

    required<HTMLButtonElement>('#floor-ar-back').click();
    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 2);

    expect(floorRuntimeMocks.stop).toHaveBeenCalledTimes(1);
    const firstTargets = markerArMocks.startMarkerAR.mock.calls[0][1].targets;
    const restartedTargets = markerArMocks.startMarkerAR.mock.calls[1][1].targets;
    expect(restartedTargets).toEqual(firstTargets);
    expect(restartedTargets[0].marker.imagePath).toBe(scanTarget.imageUrl);
    expect(required<HTMLButtonElement>('#floor-ar-toggle').textContent).toBe('Place on floor');
    expect(required('#floor-ar-message').textContent).toBe('Floor placement is ready.');
    expect(required('#ar-stage').querySelectorAll('[data-scanner-guide]')).toHaveLength(1);
  });

  it('ignores a re-entrant Back to image scan click while floor stop is pending', async () => {
    const floorStop = deferred<void>();
    floorRuntimeMocks.stop.mockReturnValueOnce(floorStop.promise);
    await openFocusedScan();
    required<HTMLButtonElement>('#floor-ar-toggle').click();

    required<HTMLButtonElement>('#floor-ar-back').click();
    required<HTMLButtonElement>('#floor-ar-back').click();

    expect(floorRuntimeMocks.stop).toHaveBeenCalledTimes(1);
    expect(floorRuntimeMocks.launch).toHaveBeenCalledTimes(1);
    expect(markerArMocks.startMarkerAR).toHaveBeenCalledTimes(1);

    floorStop.resolve();
    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 2);
    expect(floorRuntimeMocks.stop).toHaveBeenCalledTimes(1);
    expect(floorRuntimeMocks.launch).toHaveBeenCalledTimes(1);
  });

  it('leaves explicit floor recovery controls after a native session end without auto-starting marker AR', async () => {
    await openFocusedScan();
    required<HTMLButtonElement>('#floor-ar-toggle').click();

    floorRuntimeMocks.hooks?.onSessionEnd();

    expect(markerArMocks.startMarkerAR).toHaveBeenCalledTimes(1);
    expect(required('#floor-ar-status').textContent).toBe(
      'Floor AR ended. Scan the image or place it again.',
    );
    expect(required<HTMLButtonElement>('#floor-ar-back')).toMatchObject({
      hidden: false,
      disabled: false,
      textContent: 'Back to image scan',
    });
    expect(required<HTMLButtonElement>('#floor-ar-restart').hidden).toBe(false);
  });

  it('restarts the already-prepared floor controller directly without refetching the target', async () => {
    await openFocusedScan();
    required<HTMLButtonElement>('#floor-ar-toggle').click();
    floorRuntimeMocks.hooks?.onSessionEnd();

    required<HTMLButtonElement>('#floor-ar-restart').click();

    expect(floorRuntimeMocks.launch).toHaveBeenCalledTimes(2);
    expect(cloudImageTargetMocks.getImageTargetForScan).toHaveBeenCalledTimes(1);
    expect(markerArMocks.startMarkerAR).toHaveBeenCalledTimes(1);
    expect(required('#floor-ar-status').textContent).toBe(
      'Move your phone until the floor ring appears.',
    );
  });

  it('keeps marker scanning active and disables floor placement when WebXR is unsupported', async () => {
    floorRuntimeMocks.prepareFloorPlacement.mockImplementation(async (options: {
      hooks: NonNullable<typeof floorRuntimeMocks.hooks>;
    }) => {
      floorRuntimeMocks.hooks = options.hooks;
      return {
        supported: false,
        message: 'Floor placement needs Android Chrome with WebXR. Image scanning is still available.',
      };
    });
    cloudImageTargetMocks.getImageTargetForScan.mockResolvedValue(scanTarget);

    await import('../src/main');
    await waitFor(() => required<HTMLButtonElement>('#floor-ar-toggle').disabled);

    expect(markerArMocks.startMarkerAR).toHaveBeenCalledTimes(1);
    expect(markerArMocks.sessionStop).not.toHaveBeenCalled();
    expect(required('#floor-ar-message').textContent).toBe(
      'Floor placement needs Android Chrome with WebXR. Image scanning is still available.',
    );
    expect(required<HTMLButtonElement>('#floor-ar-toggle')).toMatchObject({
      hidden: false,
      disabled: true,
    });
    expect(required<HTMLElement>('#ar-stage').hidden).toBe(false);
  });

  it.each([
    [403, "You don't have access to this target."],
    [404, 'Target not found.'],
  ])('does not start the camera when the scan endpoint returns %s', async (statusCode, message) => {
    cloudImageTargetMocks.getImageTargetForScan.mockRejectedValue(
      new cloudImageTargetMocks.ImageTargetRequestError('Denied', statusCode),
    );

    await import('../src/main');
    await waitFor(() => document.querySelector('#ar-status')?.textContent === message);

    expect(required('#ar-status').dataset.tone).toBe('error');
    expect(markerArMocks.startMarkerAR).not.toHaveBeenCalled();
    expect(floorRuntimeMocks.prepareFloorPlacement).not.toHaveBeenCalled();
    expect(required<HTMLButtonElement>('#floor-ar-toggle').hidden).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('#start-ar')?.disabled).toBe(true);
  });

  it('disposes the prepared floor controller and stops marker AR when leaving a focused scan', async () => {
    await openFocusedScan();

    window.location.hash = '#/';
    await waitFor(() => floorRuntimeMocks.dispose.mock.calls.length === 1);

    expect(markerArMocks.sessionStop).toHaveBeenCalledTimes(1);
    expect(floorRuntimeMocks.stop).toHaveBeenCalledTimes(1);
    expect(required<HTMLButtonElement>('#floor-ar-toggle').hidden).toBe(true);
    expect(required('[data-app-shell]').getAttribute('data-active-page')).toBe('home');
  });

  it('stops and disposes an active floor session when leaving a focused scan', async () => {
    await openFocusedScan();
    required<HTMLButtonElement>('#floor-ar-toggle').click();
    markerArMocks.sessionStop.mockClear();

    window.location.hash = '#/';
    await waitFor(() => floorRuntimeMocks.dispose.mock.calls.length === 1);

    expect(markerArMocks.sessionStop).not.toHaveBeenCalled();
    expect(floorRuntimeMocks.stop).toHaveBeenCalledTimes(1);
    expect(floorRuntimeMocks.dispose).toHaveBeenCalledTimes(1);
    expect(required<HTMLButtonElement>('#floor-ar-toggle').hidden).toBe(true);
  });

  it('invalidates the focused floor runtime when authentication changes', async () => {
    authMocks.loadWorkerAuthToken.mockReturnValue('token-123');
    authMocks.getCurrentWebArUser.mockResolvedValue({
      email: 'viewer@example.com',
      role: 'user',
      status: 'active',
    });
    await openFocusedScan();
    required<HTMLButtonElement>('#floor-ar-toggle').click();
    markerArMocks.sessionStop.mockClear();

    required<HTMLButtonElement>('#worker-logout').click();
    await waitFor(() => floorRuntimeMocks.dispose.mock.calls.length === 1);

    expect(markerArMocks.sessionStop).not.toHaveBeenCalled();
    expect(floorRuntimeMocks.stop).toHaveBeenCalledTimes(1);
    expect(floorRuntimeMocks.dispose).toHaveBeenCalledTimes(1);
    expect(required<HTMLButtonElement>('#floor-ar-toggle').hidden).toBe(true);
  });

  it('aborts a pending marker start on floor switch and stops its late resolved session', async () => {
    const markerStart = deferred<{ stop(): void }>();
    const lateSessionStop = vi.fn();
    markerArMocks.startMarkerAR.mockReturnValueOnce(markerStart.promise);
    cloudImageTargetMocks.getImageTargetForScan.mockResolvedValue(scanTarget);

    await import('../src/main');
    await waitFor(() => (
      floorRuntimeMocks.hooks !== undefined
      && markerArMocks.startMarkerAR.mock.calls.length === 1
    ));
    const markerOptions = markerArMocks.startMarkerAR.mock.calls[0][1] as { signal: AbortSignal };

    required<HTMLButtonElement>('#floor-ar-toggle').click();

    expect(markerOptions.signal.aborted).toBe(true);
    expect(floorRuntimeMocks.launch).toHaveBeenCalledTimes(1);
    markerStart.resolve({ stop: lateSessionStop });
    await waitFor(() => lateSessionStop.mock.calls.length === 1);
    expect(required('#floor-ar-status').textContent).toBe(
      'Move your phone until the floor ring appears.',
    );
  });

  it('treats an aborted marker start as cancellation instead of a camera failure', async () => {
    markerArMocks.startMarkerAR.mockImplementationOnce((_stage: HTMLElement, options: {
      signal: AbortSignal;
    }) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        reject(new DOMException('Marker AR start aborted', 'AbortError'));
      }, { once: true });
    }));
    cloudImageTargetMocks.getImageTargetForScan.mockResolvedValue(scanTarget);

    await import('../src/main');
    await waitFor(() => (
      floorRuntimeMocks.hooks !== undefined
      && markerArMocks.startMarkerAR.mock.calls.length === 1
    ));
    required<HTMLButtonElement>('#floor-ar-toggle').click();
    await waitFor(() => floorRuntimeMocks.launch.mock.calls.length === 1);

    expect(required('#floor-ar-status').textContent).toBe(
      'Move your phone until the floor ring appears.',
    );
    expect(required('#ar-status').textContent).not.toContain('aborted');
  });

  it('treats any AbortError shape as cancellation without publishing it', async () => {
    const abortError = new Error('Synthetic marker cancellation');
    abortError.name = 'AbortError';
    markerArMocks.startMarkerAR.mockRejectedValueOnce(abortError);
    cloudImageTargetMocks.getImageTargetForScan.mockResolvedValue(scanTarget);

    await import('../src/main');
    await waitFor(() => required<HTMLButtonElement>('#start-ar').disabled === false);

    expect(required('#ar-status').textContent).not.toBe('Synthetic marker cancellation');
    expect(required<HTMLButtonElement>('#start-ar').textContent).toBe('Restart camera');
  });

  it('disposes a floor preparation that resolves after route departure and never reveals it', async () => {
    const preparation = deferred<{
      supported: true;
      controller: typeof floorRuntimeMocks.controller;
    }>();
    floorRuntimeMocks.prepareFloorPlacement.mockImplementation((options: {
      hooks: NonNullable<typeof floorRuntimeMocks.hooks>;
    }) => {
      floorRuntimeMocks.hooks = options.hooks;
      return preparation.promise;
    });
    cloudImageTargetMocks.getImageTargetForScan.mockResolvedValue(scanTarget);

    await import('../src/main');
    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 1);
    window.location.hash = '#/';
    await waitFor(() => required('[data-app-shell]').getAttribute('data-active-page') === 'home');

    preparation.resolve({ supported: true, controller: floorRuntimeMocks.controller });
    await waitFor(() => floorRuntimeMocks.dispose.mock.calls.length === 1);

    expect(required<HTMLButtonElement>('#floor-ar-toggle').hidden).toBe(true);
    expect(required('#floor-ar-message').textContent).toBe('');
  });

  it('catches a floor launch rejection and keeps Back to image scan plus Restart floor AR available', async () => {
    floorRuntimeMocks.launch.mockRejectedValueOnce(new Error('XR permission denied'));
    await openFocusedScan();

    required<HTMLButtonElement>('#floor-ar-toggle').click();
    await waitFor(() => required<HTMLButtonElement>('#floor-ar-restart').hidden === false);

    expect(required('#floor-ar-status').textContent).toContain('XR permission denied');
    expect(required<HTMLButtonElement>('#floor-ar-back')).toMatchObject({
      hidden: false,
      disabled: false,
      textContent: 'Back to image scan',
    });
    expect(required<HTMLButtonElement>('#floor-ar-restart')).toMatchObject({
      hidden: false,
      disabled: false,
    });
  });

  it('keeps the runtime asset error when launch rejects after the status hook reports it', async () => {
    floorRuntimeMocks.launch.mockImplementationOnce(() => {
      floorRuntimeMocks.hooks?.onStatus('Floor scene failed to load: model unavailable');
      return Promise.reject(new Error('model unavailable'));
    });
    await openFocusedScan();

    required<HTMLButtonElement>('#floor-ar-toggle').click();
    await waitFor(() => required<HTMLButtonElement>('#floor-ar-restart').hidden === false);

    expect(required('#floor-ar-status').textContent).toBe(
      'Floor scene failed to load: model unavailable',
    );
    expect(required<HTMLButtonElement>('#floor-ar-back')).toMatchObject({
      hidden: false,
      disabled: false,
      textContent: 'Back to image scan',
    });
  });

  it('catches a Restart floor AR rejection without leaving recovery mode', async () => {
    await openFocusedScan();
    required<HTMLButtonElement>('#floor-ar-toggle').click();
    floorRuntimeMocks.hooks?.onSessionEnd();
    floorRuntimeMocks.launch.mockRejectedValueOnce(new Error('second launch failed'));

    required<HTMLButtonElement>('#floor-ar-restart').click();
    await waitFor(() => required('#floor-ar-status').textContent?.includes('second launch failed') === true);

    expect(floorRuntimeMocks.launch).toHaveBeenCalledTimes(2);
    expect(required<HTMLButtonElement>('#floor-ar-back')).toMatchObject({
      hidden: false,
      disabled: false,
      textContent: 'Back to image scan',
    });
    expect(required<HTMLButtonElement>('#floor-ar-restart').hidden).toBe(false);
  });

  it('ignores late floor hooks after returning to marker mode', async () => {
    await openFocusedScan();
    required<HTMLButtonElement>('#floor-ar-toggle').click();
    const staleHooks = floorRuntimeMocks.hooks;
    required<HTMLButtonElement>('#floor-ar-back').click();
    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 2);

    staleHooks?.onSessionEnd();
    staleHooks?.onStatus('Floor scene failed to load: stale error');

    expect(required<HTMLButtonElement>('#floor-ar-toggle').textContent).toBe('Place on floor');
    expect(required('#floor-ar-message').textContent).toBe('Floor placement is ready.');
    expect(required<HTMLButtonElement>('#floor-ar-restart').hidden).toBe(true);
  });

  it('ignores late floor hooks after the focused route token changes', async () => {
    await openFocusedScan();
    required<HTMLButtonElement>('#floor-ar-toggle').click();
    const staleHooks = floorRuntimeMocks.hooks;

    window.location.hash = '#/';
    await waitFor(() => required('[data-app-shell]').getAttribute('data-active-page') === 'home');
    staleHooks?.onSessionEnd();
    staleHooks?.onStatus('Floor scene failed to load: stale error');

    expect(required<HTMLButtonElement>('#floor-ar-toggle').hidden).toBe(true);
    expect(required('#floor-ar-message').textContent).toBe('');
    expect(required('#floor-ar-status').textContent).toBe('');
  });

  it('leaves a manual Start camera retry when automatic startup is blocked', async () => {
    cloudImageTargetMocks.getImageTargetForScan.mockResolvedValue(scanTarget);
    markerArMocks.startMarkerAR.mockRejectedValueOnce(new Error('Camera permission was blocked'));

    await import('../src/main');
    await waitFor(() => document.querySelector('#ar-status')?.textContent === 'Camera permission was blocked');

    expect(required('#ar-status').dataset.tone).toBe('error');
    expect(document.querySelector<HTMLButtonElement>('#start-ar')).toMatchObject({
      disabled: false,
      textContent: 'Start camera',
    });
    expect(required('#ar-stage').querySelector('[data-scanner-guide]')).toBeNull();
    expect(required('#ar-stage').querySelector('.stage-idle')?.textContent).toBe('Scan an experience');

    required<HTMLButtonElement>('#start-ar').click();
    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 2);
    expect(required('#ar-status').hasAttribute('data-tone')).toBe(false);
  });

  it('remembers the exact scan URL across sign-in after a 401 response', async () => {
    cloudImageTargetMocks.getImageTargetForScan
      .mockRejectedValueOnce(new cloudImageTargetMocks.ImageTargetRequestError('Login required', 401))
      .mockResolvedValue(scanTarget);
    authMocks.loginToWebArWorker.mockResolvedValue({
      token: 'token-123',
      user: {
        email: 'viewer@example.com',
        role: 'user',
        status: 'active',
      },
    });

    await import('../src/main');
    await waitFor(() => window.location.hash === '#/account');
    expect(document.querySelector('#worker-status')?.textContent).toBe('Sign in to open this target.');

    const email = document.querySelector<HTMLInputElement>('#worker-email');
    const password = document.querySelector<HTMLInputElement>('#worker-password');
    if (email && password) {
      email.value = 'viewer@example.com';
      password.value = 'password';
    }
    document.querySelector<HTMLFormElement>('#worker-login-form')?.dispatchEvent(
      new SubmitEvent('submit', { bubbles: true, cancelable: true }),
    );

    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length > 0);
    expect(window.location.hash).toBe('#/scan/scan-one');
    expect(cloudImageTargetMocks.getImageTargetForScan).toHaveBeenLastCalledWith({
      apiUrl: 'https://worker.example/generate-3d',
      scanId: 'scan-one',
      authToken: 'token-123',
    });
  });
});

async function openFocusedScan(): Promise<void> {
  cloudImageTargetMocks.getImageTargetForScan.mockResolvedValue(scanTarget);
  await import('../src/main');
  await waitFor(() => (
    markerArMocks.startMarkerAR.mock.calls.length === 1
    && floorRuntimeMocks.hooks !== undefined
    && required<HTMLButtonElement>('#floor-ar-toggle').disabled === false
  ));
}

function required<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing test element: ${selector}`);
  }
  return element;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitFor(assertion: () => boolean): Promise<void> {
  const timeoutAt = Date.now() + 2000;
  while (Date.now() < timeoutAt) {
    if (assertion()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for target-specific scan state');
}

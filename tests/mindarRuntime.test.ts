import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { AR_MARKERS } from '../src/ar/markerCatalog';

const runtimeMocks = vi.hoisted(() => ({
  cloudflareFactory: vi.fn(),
  compileMarkerTargets: vi.fn(),
  instances: [] as unknown[],
  markerDispose: vi.fn(),
  markerUpdate: vi.fn(),
  mindarStart: vi.fn(),
  mindarStop: vi.fn(),
  render: vi.fn(),
}));

vi.mock('../src/ar/cloudflareMarkerObject', async () => {
  const { Group: ThreeGroup } = await import('three');
  return {
    createCloudflareMarkerObject: (asset: unknown) => {
      runtimeMocks.cloudflareFactory(asset);
      const group = new ThreeGroup();
      group.name = 'cloudflare-model-object';
      return {
        group,
        update: runtimeMocks.markerUpdate,
        dispose: runtimeMocks.markerDispose,
      };
    },
  };
});

vi.mock('../src/ar/targetCompiler', () => ({
  compileMarkerTargets: runtimeMocks.compileMarkerTargets,
}));

vi.mock('../src/vendor/mind-ar/mindar-image.prod.js', () => ({
  Compiler: class FakeCompiler {},
}));

vi.mock('../src/vendor/mind-ar/mindar-image-three.prod.js', async () => {
  const { Group: ThreeGroup, Scene } = await import('three');
  class FakeMindARThree {
    camera = {};
    renderer = { render: runtimeMocks.render };
    scene = new Scene();
    start = runtimeMocks.mindarStart;
    stop = runtimeMocks.mindarStop;

    constructor(_options: unknown) {
      runtimeMocks.instances.push(this);
    }

    addAnchor(targetIndex: number) {
      return { group: new ThreeGroup(), targetIndex };
    }
  }

  return { MindARThree: FakeMindARThree };
});

import { setupMarkerAnchors, startMarkerAR } from '../src/ar/mindarRuntime';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createCloudflareRuntimeTarget() {
  return {
    marker: { ...AR_MARKERS[0], targetIndex: 0 },
    cloudflareAsset: {
      model: {
        id: 'generated-chair',
        label: 'Chair',
        url: 'https://worker.example/models/chair.glb',
      },
      loadModelGroup: async () => new Group(),
    },
  };
}

function createCompiledTargets(dispose = vi.fn()) {
  return {
    imageTargetSrc: 'blob:compiled-targets',
    targetCount: 1,
    dispose,
  };
}

beforeEach(() => {
  runtimeMocks.cloudflareFactory.mockReset();
  runtimeMocks.compileMarkerTargets.mockReset();
  runtimeMocks.markerDispose.mockReset();
  runtimeMocks.markerUpdate.mockReset();
  runtimeMocks.mindarStart.mockReset().mockResolvedValue(undefined);
  runtimeMocks.mindarStop.mockReset();
  runtimeMocks.render.mockReset();
  runtimeMocks.instances.length = 0;
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 41));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('setupMarkerAnchors', () => {
  it('attaches one AR object to each MindAR target anchor', () => {
    const anchors: Array<{
      group: Group;
      onTargetFound?: () => void;
      onTargetLost?: () => void;
      targetIndex: number;
    }> = [];
    const scene = { add: vi.fn() };
    const states: string[] = [];
    const mindarThree = {
      addAnchor: (targetIndex: number) => {
        const anchor = { group: new Group(), targetIndex };
        anchors.push(anchor);
        return anchor;
      },
      scene,
    };

    const objects = setupMarkerAnchors(mindarThree, AR_MARKERS, (event) => {
      states.push(`${event.marker.label}:${event.visible}`);
    });

    expect(objects).toHaveLength(2);
    expect(anchors.map((anchor) => anchor.targetIndex)).toEqual([0, 1]);
    expect(anchors.map((anchor) => anchor.group.children[0].name)).toEqual([
      'crystal-tower-object',
      'orbit-beacon-object',
    ]);
    expect(scene.add).toHaveBeenCalledTimes(2);

    anchors[0].onTargetFound?.();
    anchors[1].onTargetLost?.();

    expect(states).toEqual(['Aurora Gate:true', 'Orbit Key:false']);
  });

  it('uses per-target Cloudflare assets when runtime targets include saved models', () => {
    const anchors: Array<{
      group: Group;
      onTargetFound?: () => void;
      onTargetLost?: () => void;
      targetIndex: number;
    }> = [];
    const scene = { add: vi.fn() };
    const mindarThree = {
      addAnchor: (targetIndex: number) => {
        const anchor = { group: new Group(), targetIndex };
        anchors.push(anchor);
        return anchor;
      },
      scene,
    };

    const objects = setupMarkerAnchors(mindarThree, [
      { marker: AR_MARKERS[0] },
      {
        marker: { ...AR_MARKERS[1], label: 'Cloud target' },
        cloudflareAsset: {
          model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
          placement: { scale: 1.5, offsetX: 0.1, offsetY: 0.2, height: 0.2 },
          loadModelGroup: async () => new Group(),
        },
      },
    ]);

    expect(objects).toHaveLength(2);
    expect(anchors.map((anchor) => anchor.group.children[0].name)).toEqual([
      'crystal-tower-object',
      'cloudflare-model-object',
    ]);
  });
});

describe('startMarkerAR', () => {
  it('stops once and disposes marker objects before compiled targets', async () => {
    const cleanupOrder: string[] = [];
    runtimeMocks.markerDispose.mockImplementation(() => cleanupOrder.push('marker'));
    const compiledDispose = vi.fn(() => cleanupOrder.push('compiled'));
    runtimeMocks.compileMarkerTargets.mockResolvedValue(createCompiledTargets(compiledDispose));

    const session = await startMarkerAR(document.createElement('div'), {
      targets: [createCloudflareRuntimeTarget()],
    });

    session.stop();
    session.stop();

    expect(runtimeMocks.markerDispose).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.mindarStop).toHaveBeenCalledTimes(1);
    expect(compiledDispose).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(cleanupOrder).toEqual(['marker', 'compiled']);
  });

  it('rejects an already-aborted start before compiling targets', async () => {
    const controller = new AbortController();
    controller.abort();
    runtimeMocks.compileMarkerTargets.mockResolvedValue(createCompiledTargets());

    await expect(startMarkerAR(document.createElement('div'), {
      targets: [createCloudflareRuntimeTarget()],
      signal: controller.signal,
    })).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Marker AR start aborted',
    });

    expect(runtimeMocks.compileMarkerTargets).not.toHaveBeenCalled();
    expect(runtimeMocks.instances).toHaveLength(0);
  });

  it('disposes compiled targets when compilation resolves after abort', async () => {
    const controller = new AbortController();
    const compiledDispose = vi.fn();
    const compilation = createDeferred<ReturnType<typeof createCompiledTargets>>();
    runtimeMocks.compileMarkerTargets.mockReturnValue(compilation.promise);

    const startPromise = startMarkerAR(document.createElement('div'), {
      targets: [createCloudflareRuntimeTarget()],
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(runtimeMocks.compileMarkerTargets).toHaveBeenCalledTimes(1));
    controller.abort();
    compilation.resolve(createCompiledTargets(compiledDispose));

    await expect(startPromise).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Marker AR start aborted',
    });
    expect(compiledDispose).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.instances).toHaveLength(0);
    expect(runtimeMocks.cloudflareFactory).not.toHaveBeenCalled();
  });

  it('cleans up when aborted during scene setup without starting the camera', async () => {
    const controller = new AbortController();
    const compiledDispose = vi.fn();
    runtimeMocks.compileMarkerTargets.mockResolvedValue(createCompiledTargets(compiledDispose));
    runtimeMocks.cloudflareFactory.mockImplementationOnce(() => controller.abort());

    await expect(startMarkerAR(document.createElement('div'), {
      targets: [createCloudflareRuntimeTarget()],
      signal: controller.signal,
    })).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Marker AR start aborted',
    });

    expect(runtimeMocks.markerDispose).toHaveBeenCalledTimes(1);
    expect(compiledDispose).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.mindarStart).not.toHaveBeenCalled();
  });

  it('cleans up immediately while camera startup is pending and rejects without publishing', async () => {
    const controller = new AbortController();
    const compiledDispose = vi.fn();
    const cameraStart = createDeferred<void>();
    const onReady = vi.fn();
    runtimeMocks.compileMarkerTargets.mockResolvedValue(createCompiledTargets(compiledDispose));
    runtimeMocks.mindarStart.mockReturnValue(cameraStart.promise);

    const startPromise = startMarkerAR(document.createElement('div'), {
      targets: [createCloudflareRuntimeTarget()],
      signal: controller.signal,
      onReady,
    });
    await vi.waitFor(() => expect(runtimeMocks.mindarStart).toHaveBeenCalledTimes(1));
    controller.abort();

    expect(runtimeMocks.markerDispose).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.mindarStop).toHaveBeenCalledTimes(1);
    expect(compiledDispose).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();

    cameraStart.resolve();

    await expect(startPromise).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Marker AR start aborted',
    });
    expect(runtimeMocks.markerDispose).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.mindarStop).toHaveBeenCalledTimes(1);
    expect(compiledDispose).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
});

import { AmbientLight, Clock, DirectionalLight, Group, Scene } from 'three';
import { createMarkerObject, type MarkerObject } from './arObjects';
import { normalizeMindARCameraLayers } from './cameraLayers';
import { createCloudflareMarkerObject } from './cloudflareMarkerObject';
import { type MarkerSpec } from './markerCatalog';
import {
  createRuntimeMarkerTargets,
  type RuntimeMarkerTarget,
} from './markerTargets';
import {
  compileMarkerTargets,
  type CompiledMarkerTargets,
  type MindARCompilerConstructor,
} from './targetCompiler';

export type MindARAnchor = {
  group: Group;
  onTargetFound?: () => void;
  onTargetLost?: () => void;
  targetIndex: number;
};

export type MindARThreeInstance = {
  addAnchor: (targetIndex: number) => MindARAnchor;
  camera: unknown;
  renderer: {
    render: (scene: unknown, camera: unknown) => void;
  };
  scene: Pick<Scene, 'add'>;
  start: () => Promise<void>;
  stop?: () => void;
};

export type MindARThreeConstructor = new (options: {
  container: HTMLElement;
  imageTargetSrc: string;
  filterMinCF?: number;
  filterBeta?: number;
}) => MindARThreeInstance;

export type MarkerVisibilityEvent = {
  marker: MarkerSpec;
  visible: boolean;
};

export type MarkerARSession = {
  stop: () => void;
};

export type StartMarkerARHooks = {
  targets?: RuntimeMarkerTarget[];
  onCompileProgress?: (percent: number) => void;
  onMarkerVisibility?: (event: MarkerVisibilityEvent) => void;
  onReady?: () => void;
  signal?: AbortSignal;
};

type MindARModules = {
  Compiler: MindARCompilerConstructor;
  MindARThree: MindARThreeConstructor;
};

export function setupMarkerAnchors(
  mindarThree: Pick<MindARThreeInstance, 'addAnchor' | 'scene'>,
  targets: RuntimeMarkerTarget[] | MarkerSpec[] = createRuntimeMarkerTargets(),
  onMarkerVisibility?: (event: MarkerVisibilityEvent) => void,
): MarkerObject[] {
  return normalizeAnchorTargets(targets).map((target) => {
    const anchor = mindarThree.addAnchor(target.marker.targetIndex);
    const markerObject = target.cloudflareAsset
      ? createCloudflareMarkerObject(target.cloudflareAsset)
      : createMarkerObject(target.marker.object);

    anchor.group.add(markerObject.group);
    mindarThree.scene.add(anchor.group);

    anchor.onTargetFound = () => onMarkerVisibility?.({ marker: target.marker, visible: true });
    anchor.onTargetLost = () => onMarkerVisibility?.({ marker: target.marker, visible: false });

    return markerObject;
  });
}

function normalizeAnchorTargets(targets: RuntimeMarkerTarget[] | MarkerSpec[]): RuntimeMarkerTarget[] {
  if (targets.length === 0) {
    return [];
  }

  return 'marker' in targets[0]
    ? (targets as RuntimeMarkerTarget[])
    : (targets as MarkerSpec[]).map((marker) => ({ marker }));
}

export async function startMarkerAR(
  container: HTMLElement,
  hooks: StartMarkerARHooks = {},
): Promise<MarkerARSession> {
  let compiledTargets: CompiledMarkerTargets | undefined;
  let mindarThree: MindARThreeInstance | undefined;
  let markerObjects: MarkerObject[] = [];
  let active = true;
  let frameId: number | undefined;
  let mindarStartAttempted = false;
  let stopped = false;

  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    active = false;
    if (frameId !== undefined) {
      cancelAnimationFrame(frameId);
    }
    if (mindarStartAttempted) {
      try {
        mindarThree?.stop?.();
      } catch {
        // A rejected MindAR start can leave its camera/controller only partially initialized.
      }
    }
    for (const markerObject of markerObjects) {
      markerObject.dispose?.();
    }
    compiledTargets?.dispose();
  };

  const throwIfAborted = () => {
    if (!hooks.signal?.aborted) {
      return;
    }
    stop();
    throw new DOMException('Marker AR start aborted', 'AbortError');
  };

  const { Compiler, MindARThree } = await loadMindARModules();
  throwIfAborted();
  const targets = hooks.targets ?? createRuntimeMarkerTargets();
  const compiled = await compileMarkerTargets(
    targets.map((target) => target.marker),
    {
      Compiler,
      onProgress: hooks.onCompileProgress,
    },
  );
  compiledTargets = compiled;
  throwIfAborted();

  const instance = new MindARThree({
    container,
    imageTargetSrc: compiled.imageTargetSrc,
    filterMinCF: 0.001,
    filterBeta: 0.01,
  });
  mindarThree = instance;
  markerObjects = setupScene(
    instance,
    targets,
    hooks.onMarkerVisibility,
  );
  throwIfAborted();

  const clock = new Clock();
  const render = () => {
    if (!active) {
      return;
    }

    const delta = clock.getDelta();
    for (const markerObject of markerObjects) {
      markerObject.update(delta);
    }

    instance.renderer.render(instance.scene, instance.camera);
    frameId = requestAnimationFrame(render);
  };

  mindarStartAttempted = true;
  const abortPendingStart = () => {
    stop();
  };
  hooks.signal?.addEventListener('abort', abortPendingStart, { once: true });
  try {
    throwIfAborted();
    await instance.start();
  } catch (error) {
    stop();
    if (hooks.signal?.aborted) {
      throw new DOMException('Marker AR start aborted', 'AbortError');
    }
    throw error;
  } finally {
    hooks.signal?.removeEventListener('abort', abortPendingStart);
  }
  throwIfAborted();
  normalizeMindARCameraLayers(container);
  hooks.onReady?.();
  throwIfAborted();
  frameId = requestAnimationFrame(render);

  return { stop };
}

function setupScene(
  mindarThree: MindARThreeInstance,
  targets: RuntimeMarkerTarget[],
  onMarkerVisibility?: (event: MarkerVisibilityEvent) => void,
): MarkerObject[] {
  const ambient = new AmbientLight(0xffffff, 1.7);
  const directional = new DirectionalLight(0xffffff, 1.2);
  directional.position.set(0.6, 1, 1.4);
  mindarThree.scene.add(ambient);
  mindarThree.scene.add(directional);

  return setupMarkerAnchors(mindarThree, targets, onMarkerVisibility);
}

async function loadMindARModules(): Promise<MindARModules> {
  const [imageModule, threeModule] = await Promise.all([
    import('../vendor/mind-ar/mindar-image.prod.js'),
    import('../vendor/mind-ar/mindar-image-three.prod.js'),
  ]);

  return {
    Compiler: imageModule.Compiler,
    MindARThree: threeModule.MindARThree,
  };
}

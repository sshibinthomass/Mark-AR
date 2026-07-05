import { AmbientLight, Clock, DirectionalLight, Group, Scene } from 'three';
import { createMarkerObject, type MarkerObject } from './arObjects';
import { normalizeMindARCameraLayers } from './cameraLayers';
import {
  createCloudflareMarkerObject,
  type CloudflarePlacedAsset,
} from './cloudflareMarkerObject';
import { type MarkerSpec } from './markerCatalog';
import {
  createRuntimeMarkerTargets,
  type RuntimeMarkerTarget,
} from './markerTargets';
import {
  compileMarkerTargets,
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
  cloudflareAsset?: CloudflarePlacedAsset;
  onCompileProgress?: (percent: number) => void;
  onMarkerVisibility?: (event: MarkerVisibilityEvent) => void;
  onReady?: () => void;
};

type MindARModules = {
  Compiler: MindARCompilerConstructor;
  MindARThree: MindARThreeConstructor;
};

export function setupMarkerAnchors(
  mindarThree: Pick<MindARThreeInstance, 'addAnchor' | 'scene'>,
  targets: RuntimeMarkerTarget[] | MarkerSpec[] = createRuntimeMarkerTargets(),
  onMarkerVisibility?: (event: MarkerVisibilityEvent) => void,
  fallbackCloudflareAsset?: CloudflarePlacedAsset,
): MarkerObject[] {
  return normalizeAnchorTargets(targets).map((target) => {
    const anchor = mindarThree.addAnchor(target.marker.targetIndex);
    const cloudflareAsset = target.cloudflareAsset ?? fallbackCloudflareAsset;
    const markerObject = cloudflareAsset
      ? createCloudflareMarkerObject(cloudflareAsset)
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
  const { Compiler, MindARThree } = await loadMindARModules();
  const targets = hooks.targets ?? createRuntimeMarkerTargets({
    selectedModel: hooks.cloudflareAsset?.model,
    processedBaseImage: hooks.cloudflareAsset?.baseImage,
  });
  const compiledTargets = await compileMarkerTargets(
    targets.map((target) => target.marker),
    {
    Compiler,
    onProgress: hooks.onCompileProgress,
    },
  );

  const mindarThree = new MindARThree({
    container,
    imageTargetSrc: compiledTargets.imageTargetSrc,
    filterMinCF: 0.001,
    filterBeta: 0.01,
  });
  const markerObjects = setupScene(
    mindarThree,
    targets,
    hooks.onMarkerVisibility,
    hooks.cloudflareAsset,
  );

  let active = true;
  let frameId = 0;
  const clock = new Clock();
  const render = () => {
    if (!active) {
      return;
    }

    const delta = clock.getDelta();
    for (const markerObject of markerObjects) {
      markerObject.update(delta);
    }

    mindarThree.renderer.render(mindarThree.scene, mindarThree.camera);
    frameId = requestAnimationFrame(render);
  };

  await mindarThree.start();
  normalizeMindARCameraLayers(container);
  hooks.onReady?.();
  frameId = requestAnimationFrame(render);

  return {
    stop: () => {
      active = false;
      cancelAnimationFrame(frameId);
      mindarThree.stop?.();
      compiledTargets.dispose();
    },
  };
}

function setupScene(
  mindarThree: MindARThreeInstance,
  targets: RuntimeMarkerTarget[],
  onMarkerVisibility?: (event: MarkerVisibilityEvent) => void,
  cloudflareAsset?: CloudflarePlacedAsset,
): MarkerObject[] {
  const ambient = new AmbientLight(0xffffff, 1.7);
  const directional = new DirectionalLight(0xffffff, 1.2);
  directional.position.set(0.6, 1, 1.4);
  mindarThree.scene.add(ambient);
  mindarThree.scene.add(directional);

  return setupMarkerAnchors(mindarThree, targets, onMarkerVisibility, cloudflareAsset);
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

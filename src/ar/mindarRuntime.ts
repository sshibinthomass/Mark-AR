import { AmbientLight, Clock, DirectionalLight, Group, Scene } from 'three';
import { createMarkerObject, type MarkerObject } from './arObjects';
import { normalizeMindARCameraLayers } from './cameraLayers';
import { AR_MARKERS, type MarkerSpec } from './markerCatalog';
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
  markers: MarkerSpec[] = AR_MARKERS,
  onMarkerVisibility?: (event: MarkerVisibilityEvent) => void,
): MarkerObject[] {
  return markers.map((marker) => {
    const anchor = mindarThree.addAnchor(marker.targetIndex);
    const markerObject = createMarkerObject(marker.object);

    anchor.group.add(markerObject.group);
    mindarThree.scene.add(anchor.group);

    anchor.onTargetFound = () => onMarkerVisibility?.({ marker, visible: true });
    anchor.onTargetLost = () => onMarkerVisibility?.({ marker, visible: false });

    return markerObject;
  });
}

export async function startMarkerAR(
  container: HTMLElement,
  hooks: StartMarkerARHooks = {},
): Promise<MarkerARSession> {
  const { Compiler, MindARThree } = await loadMindARModules();
  const compiledTargets = await compileMarkerTargets(AR_MARKERS, {
    Compiler,
    onProgress: hooks.onCompileProgress,
  });

  const mindarThree = new MindARThree({
    container,
    imageTargetSrc: compiledTargets.imageTargetSrc,
    filterMinCF: 0.001,
    filterBeta: 0.01,
  });
  const markerObjects = setupScene(mindarThree, hooks.onMarkerVisibility);

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
  onMarkerVisibility?: (event: MarkerVisibilityEvent) => void,
): MarkerObject[] {
  const ambient = new AmbientLight(0xffffff, 1.7);
  const directional = new DirectionalLight(0xffffff, 1.2);
  directional.position.set(0.6, 1, 1.4);
  mindarThree.scene.add(ambient);
  mindarThree.scene.add(directional);

  return setupMarkerAnchors(mindarThree, AR_MARKERS, onMarkerVisibility);
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

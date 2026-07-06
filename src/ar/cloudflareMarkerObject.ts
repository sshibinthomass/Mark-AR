import {
  Box3,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  TextureLoader,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {
  CloudflareModelOption,
  ProcessedBaseImage,
} from '../app/cloudflareModels';
import { processedImageDataUrl } from '../app/cloudflareModels';
import type { ImageTargetAnimation } from '../app/imageTargetAnimation';
import { normalizeAnimation } from '../app/imageTargetAnimation';
import { normalizePlacement, type ImageTargetPlacement } from '../app/imageTargetPayload';
import type { MarkerObject } from './arObjects';

export type ModelGroupLoader = (modelUrl: string) => Promise<Group>;

export type CloudflarePlacedObject = {
  id?: string;
  model: CloudflareModelOption;
  placement?: ImageTargetPlacement;
  animation?: ImageTargetAnimation;
};

export type CloudflarePlacedAsset = {
  model?: CloudflareModelOption;
  baseImage?: ProcessedBaseImage;
  placement?: ImageTargetPlacement;
  objects?: CloudflarePlacedObject[];
  loadModelGroup?: ModelGroupLoader;
};

export function createCloudflareMarkerObject(asset: CloudflarePlacedAsset): MarkerObject {
  const group = new Group();
  group.name = 'cloudflare-model-object';

  if (asset.baseImage) {
    group.add(createProcessedBasePlane(asset.baseImage));
  }

  const loadModelGroup = asset.loadModelGroup ?? loadGltfModelGroup;
  const placedObjects = createPlacedObjects(asset);
  const animatedRoots = placedObjects.map((object, index) => {
    const modelRoot = new Group();
    modelRoot.name = modelRootName(object, index, placedObjects.length);
    modelRoot.position.z = asset.baseImage ? 0.12 : 0.04;
    if (object.placement) {
      const placement = normalizePlacement(object.placement);
      modelRoot.position.set(placement.offsetX, placement.offsetY, placement.height);
      modelRoot.scale.setScalar(placement.scale);
      modelRoot.rotation.set(
        degreesToRadians(placement.rotationX),
        degreesToRadians(placement.rotationY),
        degreesToRadians(placement.rotationZ),
      );
    }
    group.add(modelRoot);

    void loadModelGroup(object.model.url)
      .then((loadedModel) => {
        loadedModel.name = loadedModel.name || 'cloudflare-loaded-model';
        modelRoot.add(loadedModel);
      })
      .catch(() => {
        modelRoot.add(createModelLoadFallback());
      });

    return {
      root: modelRoot,
      baseZ: modelRoot.position.z,
      animation: normalizeAnimation(object.animation),
      elapsedSeconds: 0,
    };
  });

  return {
    group,
    update: (deltaSeconds: number) => {
      for (const animatedRoot of animatedRoots) {
        animatedRoot.elapsedSeconds += deltaSeconds;
        applyAnimation(
          animatedRoot.root,
          animatedRoot.animation,
          animatedRoot.baseZ,
          deltaSeconds,
          animatedRoot.elapsedSeconds,
        );
      }
    },
  };
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function applyAnimation(
  modelRoot: Group,
  animation: ImageTargetAnimation,
  baseZ: number,
  deltaSeconds: number,
  elapsedSeconds: number,
): void {
  if (animation.spinAxis !== 'none' && animation.spinSpeed !== 0) {
    modelRoot.rotation[animation.spinAxis] += animation.spinSpeed * deltaSeconds;
  }
  modelRoot.position.z = baseZ + Math.sin(elapsedSeconds * animation.bobSpeed) * animation.bobHeight;
}

function modelRootName(object: CloudflarePlacedObject, index: number, objectCount: number): string {
  if (object.id) {
    return `cloudflare-model-root-${object.id}`;
  }
  return objectCount === 1 ? 'cloudflare-model-root' : `cloudflare-model-root-${index + 1}`;
}

function createPlacedObjects(asset: CloudflarePlacedAsset): CloudflarePlacedObject[] {
  if (asset.objects?.length) {
    return asset.objects;
  }
  if (!asset.model) {
    return [];
  }
  return [{
    model: asset.model,
    ...(asset.placement ? { placement: asset.placement } : {}),
  }];
}

async function loadGltfModelGroup(modelUrl: string): Promise<Group> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(modelUrl);
  const wrapper = new Group();
  wrapper.name = 'cloudflare-loaded-model';
  wrapper.rotation.x = Math.PI / 2;
  wrapper.add(normalizeGltfScene(gltf.scene));
  return wrapper;
}

function createProcessedBasePlane(baseImage: ProcessedBaseImage): Mesh {
  const texture = new TextureLoader().load(processedImageDataUrl(baseImage));
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
  });
  const plane = new Mesh(new PlaneGeometry(0.94, 0.62), material);
  plane.name = 'processed-base-plane';
  plane.position.z = 0.01;
  return plane;
}

function normalizeGltfScene(scene: Group): Group {
  const box = new Box3().setFromObject(scene);
  const size = box.getSize(new Vector3());
  const largestDimension = Math.max(size.x, size.y, size.z);

  if (largestDimension > 0) {
    scene.scale.setScalar(0.72 / largestDimension);
  }

  const scaledBox = new Box3().setFromObject(scene);
  const center = scaledBox.getCenter(new Vector3());
  scene.position.set(-center.x, -scaledBox.min.y, -center.z);
  return scene;
}

function createModelLoadFallback(): Group {
  const fallback = new Group();
  fallback.name = 'cloudflare-model-load-fallback';

  const base = new Mesh(
    new PlaneGeometry(0.5, 0.5),
    new MeshBasicMaterial({
      color: 0xff4f8b,
      opacity: 0.62,
      transparent: true,
      side: DoubleSide,
    }),
  );
  base.name = 'model-load-fallback-plane';
  base.position.z = 0.08;
  fallback.add(base);
  return fallback;
}

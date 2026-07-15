import {
  Box3,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CloudflareModelOption } from '../app/cloudflareModels';
import type { ImageTargetAnimation } from '../app/imageTargetAnimation';
import { evaluateAnimationFrame, normalizeAnimation } from '../app/imageTargetAnimation';
import { normalizePlacement, type ImageTargetPlacement } from '../app/imageTargetPayload';
import { normalizeLocalPlacement, type TargetEditorGroup } from '../app/targetEditorGroups';
import {
  isTextTargetObject,
  type LocalTextTargetObject,
} from '../app/targetEditorObjects';
import { createTextObject3D } from '../scene/textObject3d';
import type { MarkerObject } from './arObjects';

export type ModelGroupLoader = (modelUrl: string) => Promise<Group>;

export type CloudflareModelPlacedObject = {
  id?: string;
  model: CloudflareModelOption;
  placement?: ImageTargetPlacement;
  animation?: ImageTargetAnimation;
  groupId?: string;
  localPlacement?: ImageTargetPlacement;
};

export type CloudflarePlacedObject = CloudflareModelPlacedObject | LocalTextTargetObject;

export type CloudflarePlacedAsset = {
  model?: CloudflareModelOption;
  placement?: ImageTargetPlacement;
  objects?: CloudflarePlacedObject[];
  groups?: TargetEditorGroup[];
  loadModelGroup?: ModelGroupLoader;
  createTextObject?: (text: LocalTextTargetObject['text']) => Group;
};

export function createCloudflareMarkerObject(asset: CloudflarePlacedAsset): MarkerObject {
  const group = new Group();
  group.name = 'cloudflare-model-object';

  const loadModelGroup = asset.loadModelGroup ?? loadGltfModelGroup;
  const createTextObject = asset.createTextObject ?? createTextObject3D;
  const placedObjects = createPlacedObjects(asset);
  const groupRoots = new Map<string, Group>();
  const animatedRoots: Array<{
    root: Group;
    placement: ImageTargetPlacement;
    animation: ImageTargetAnimation;
    elapsedSeconds: number;
  }> = [];
  for (const targetGroup of normalizeAssetGroups(asset.groups)) {
    const root = new Group();
    root.name = `cloudflare-group-root-${targetGroup.id}`;
    const placement = normalizePlacement(targetGroup.placement);
    applyPlacement(root, placement);
    group.add(root);
    groupRoots.set(targetGroup.id, root);
    animatedRoots.push({
      root,
      placement,
      animation: normalizeAnimation(targetGroup.animation),
      elapsedSeconds: 0,
    });
  }

  for (const [index, object] of placedObjects.entries()) {
    const modelRoot = new Group();
    modelRoot.name = modelRootName(object, index, placedObjects.length);
    const parentGroup = object.groupId ? groupRoots.get(object.groupId) : undefined;
    const placement = parentGroup && object.localPlacement
      ? normalizeLocalPlacement(object.localPlacement)
      : object.placement
        ? normalizePlacement(object.placement)
        : normalizePlacement({ height: 0.04 });
    applyPlacement(modelRoot, placement);
    (parentGroup ?? group).add(modelRoot);

    if (isTextTargetObject(object)) {
      modelRoot.add(createTextObject(object.text));
      animatedRoots.push({
        root: modelRoot,
        placement,
        animation: normalizeAnimation(object.animation),
        elapsedSeconds: 0,
      });
      continue;
    }

    void loadModelGroup(object.model.url)
      .then((loadedModel) => {
        loadedModel.name = loadedModel.name || 'cloudflare-loaded-model';
        modelRoot.add(loadedModel);
      })
      .catch(() => {
        modelRoot.add(createModelLoadFallback());
      });

    animatedRoots.push({
      root: modelRoot,
      placement,
      animation: normalizeAnimation(object.animation),
      elapsedSeconds: 0,
    });
  }

  return {
    group,
    update: (deltaSeconds: number) => {
      for (const animatedRoot of animatedRoots) {
        animatedRoot.elapsedSeconds += deltaSeconds;
        applyAnimation(animatedRoot.root, animatedRoot.animation, animatedRoot.placement, animatedRoot.elapsedSeconds);
      }
    },
  };
}

function normalizeAssetGroups(groups: TargetEditorGroup[] | undefined): TargetEditorGroup[] {
  const seen = new Set<string>();
  return (groups ?? []).filter((group) => {
    if (!group.id || seen.has(group.id)) {
      return false;
    }
    seen.add(group.id);
    return true;
  });
}

function applyPlacement(root: Group, placement: ImageTargetPlacement): void {
  root.position.set(placement.offsetX, placement.offsetY, placement.height);
  root.scale.setScalar(placement.scale);
  root.rotation.set(
    degreesToRadians(placement.rotationX),
    degreesToRadians(placement.rotationY),
    degreesToRadians(placement.rotationZ),
  );
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function applyAnimation(
  modelRoot: Group,
  animation: ImageTargetAnimation,
  placement: ImageTargetPlacement,
  elapsedSeconds: number,
): void {
  const frame = evaluateAnimationFrame(animation, elapsedSeconds);
  // The editor preview is Y-up while MindAR target anchors are Z-up.
  // Rotate animation offsets and axes +90 degrees around X: (x, y, z) -> (x, -z, y).
  modelRoot.position.set(
    placement.offsetX + frame.position.x,
    placement.offsetY - frame.position.z,
    placement.height + frame.position.y,
  );
  modelRoot.scale.setScalar(placement.scale * frame.scaleMultiplier);
  modelRoot.rotation.set(
    degreesToRadians(placement.rotationX) + frame.rotationRadians.x,
    degreesToRadians(placement.rotationY) - frame.rotationRadians.z,
    degreesToRadians(placement.rotationZ) + frame.rotationRadians.y,
  );
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

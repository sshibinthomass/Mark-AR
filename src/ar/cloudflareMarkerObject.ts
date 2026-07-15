import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CloudflareModelOption } from '../app/cloudflareModels';
import type { ImageTargetAnimation } from '../app/imageTargetAnimation';
import { normalizeAnimation } from '../app/imageTargetAnimation';
import { normalizePlacement, type ImageTargetPlacement } from '../app/imageTargetPayload';
import { normalizeLocalPlacement, type TargetEditorGroup } from '../app/targetEditorGroups';
import {
  isTextTargetObject,
  type LocalTextTargetObject,
} from '../app/targetEditorObjects';
import { createTextObject3D } from '../scene/textObject3d';
import { createNormalizedTargetModelGroup } from '../scene/targetModelNormalization';
import { applyTargetAnimation, applyTargetPlacement } from '../scene/targetObjectTransform';
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
  const previewSpace = new Group();
  previewSpace.name = 'cloudflare-preview-space';
  previewSpace.rotation.x = Math.PI / 2;
  group.add(previewSpace);

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
    applyTargetPlacement(root, placement);
    previewSpace.add(root);
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
    applyTargetPlacement(modelRoot, placement);
    (parentGroup ?? previewSpace).add(modelRoot);

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
        applyTargetAnimation(
          animatedRoot.root,
          animatedRoot.placement,
          animatedRoot.animation,
          animatedRoot.elapsedSeconds,
        );
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
  return createNormalizedTargetModelGroup(gltf.scene, 'cloudflare-loaded-model');
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
  base.position.y = 0.08;
  base.rotation.x = -Math.PI / 2;
  fallback.add(base);
  return fallback;
}

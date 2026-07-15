import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ImageTargetAnimation } from '../app/imageTargetAnimation';
import { normalizeAnimation } from '../app/imageTargetAnimation';
import { normalizePlacement, type ImageTargetPlacement } from '../app/imageTargetPayload';
import { normalizeLocalPlacement, type TargetEditorGroup } from '../app/targetEditorGroups';
import { isTextTargetObject } from '../app/targetEditorObjects';
import {
  prepareTextObject3D,
  type PreparedTextObject3D,
} from '../scene/textObject3d';
import { createNormalizedTargetModelGroup } from '../scene/targetModelNormalization';
import { applyTargetAnimation, applyTargetPlacement } from '../scene/targetObjectTransform';
import type {
  CloudflarePlacedAsset,
  CloudflarePlacedObject,
} from './cloudflareMarkerObject';

export type TargetSceneLoadMode = 'fallback' | 'strict';

export type TargetSceneObject = {
  group: Group;
  ready: Promise<void>;
  update(deltaSeconds: number): void;
  dispose(): void;
};

type AnimatedRoot = {
  root: Group;
  placement: ImageTargetPlacement;
  animation: ImageTargetAnimation;
  elapsedSeconds: number;
};

type DisposedResources = {
  geometries: Set<Mesh['geometry']>;
  materials: Set<Material>;
  textures: Set<Texture>;
};

export function createTargetSceneObject(
  asset: CloudflarePlacedAsset,
  options: { loadMode?: TargetSceneLoadMode } = {},
): TargetSceneObject {
  const sceneRoot = new Group();
  sceneRoot.name = 'cloudflare-target-scene';
  const loadMode = options.loadMode ?? 'fallback';
  const loadModelGroup = asset.loadModelGroup ?? loadGltfModelGroup;
  const placedObjects = createPlacedObjects(asset);
  const groupRoots = new Map<string, Group>();
  const animatedRoots: AnimatedRoot[] = [];
  const resourceLoads: Promise<void>[] = [];
  const preparedTexts: PreparedTextObject3D[] = [];
  const disposedResources: DisposedResources = {
    geometries: new Set(),
    materials: new Set(),
    textures: new Set(),
  };
  let disposed = false;

  for (const targetGroup of normalizeAssetGroups(asset.groups)) {
    const root = new Group();
    root.name = `cloudflare-group-root-${targetGroup.id}`;
    const placement = normalizePlacement(targetGroup.placement);
    applyTargetPlacement(root, placement);
    sceneRoot.add(root);
    groupRoots.set(targetGroup.id, root);
    animatedRoots.push({
      root,
      placement,
      animation: normalizeAnimation(targetGroup.animation),
      elapsedSeconds: 0,
    });
  }

  for (const [index, object] of placedObjects.entries()) {
    const objectRoot = new Group();
    objectRoot.name = modelRootName(object, index, placedObjects.length);
    const parentGroup = object.groupId ? groupRoots.get(object.groupId) : undefined;
    const placement = parentGroup && object.localPlacement
      ? normalizeLocalPlacement(object.localPlacement)
      : object.placement
        ? normalizePlacement(object.placement)
        : normalizePlacement({ height: 0.04 });
    applyTargetPlacement(objectRoot, placement);
    (parentGroup ?? sceneRoot).add(objectRoot);

    if (isTextTargetObject(object)) {
      if (asset.createTextObject) {
        objectRoot.add(asset.createTextObject(object.text));
      } else {
        const preparedText = prepareTextObject3D(object.text);
        preparedTexts.push(preparedText);
        resourceLoads.push(preparedText.ready);
        objectRoot.add(preparedText.group);
      }
    } else {
      const load = loadModelGroup(object.model.url)
        .then((loadedModel) => {
          if (disposed) {
            disposeObjectTree(loadedModel, disposedResources);
            return;
          }
          loadedModel.name = loadedModel.name || 'cloudflare-loaded-model';
          objectRoot.add(loadedModel);
        })
        .catch((error: unknown) => {
          if (loadMode === 'strict') {
            throw error;
          }
          if (!disposed) {
            objectRoot.add(createModelLoadFallback());
          }
        });
      resourceLoads.push(load);
    }

    animatedRoots.push({
      root: objectRoot,
      placement,
      animation: normalizeAnimation(object.animation),
      elapsedSeconds: 0,
    });
  }

  return {
    group: sceneRoot,
    ready: Promise.all(resourceLoads).then(() => undefined),
    update(deltaSeconds) {
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
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const preparedText of preparedTexts) {
        preparedText.dispose();
      }
      disposeObjectTree(sceneRoot, disposedResources);
      sceneRoot.clear();
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

function disposeObjectTree(root: Object3D, disposed: DisposedResources): void {
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) {
      return;
    }
    if (!disposed.geometries.has(mesh.geometry)) {
      disposed.geometries.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of meshMaterials) {
      if (disposed.materials.has(material)) {
        continue;
      }
      disposed.materials.add(material);
      for (const value of Object.values(material)) {
        const texture = value as Texture | null;
        if (texture?.isTexture && !disposed.textures.has(texture)) {
          disposed.textures.add(texture);
          texture.dispose();
        }
      }
      material.dispose();
    }
  });
}

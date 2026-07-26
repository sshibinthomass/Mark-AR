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
import {
  isImageTargetObject,
  isModelTargetObject,
  isTextTargetObject,
  isYouTubeTargetObject,
  type YouTubeTargetObject,
} from '../app/targetEditorObjects';
import { prepareMediaPlane } from '../scene/mediaPlane3d';
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
  youtubeSurfaces: readonly TargetSceneYouTubeSurface[];
  selectableObjects: readonly TargetSceneSelectableObject[];
  update(deltaSeconds: number): void;
  dispose(): void;
};

export type TargetSceneYouTubeSurface = {
  objectId: string;
  root: Group;
  mesh: Mesh;
  youtube: YouTubeTargetObject['youtube'];
};

export type InteractiveYouTubeSurface = TargetSceneYouTubeSurface;

export type TargetSceneSelectableKind = 'image' | 'youtube' | 'text' | 'model';

export type TargetSceneSelectableObject = {
  objectId: string;
  kind: TargetSceneSelectableKind;
  interactionRoot: Group;
  contentRoot: Group;
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
  const youtubeSurfaces: InteractiveYouTubeSurface[] = [];
  const selectableObjects: TargetSceneSelectableObject[] = [];
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
    const objectId = selectableObjectId(object, index);
    const interactionRoot = new Group();
    interactionRoot.name = `cloudflare-interaction-root-${objectId}`;
    const objectRoot = new Group();
    objectRoot.name = modelRootName(object, index, placedObjects.length);
    const parentGroup = object.groupId ? groupRoots.get(object.groupId) : undefined;
    const placement = parentGroup && object.localPlacement
      ? normalizeLocalPlacement(object.localPlacement)
      : object.placement
        ? normalizePlacement(object.placement)
        : normalizePlacement({ height: 0.04 });
    applyTargetPlacement(objectRoot, placement);
    (parentGroup ?? sceneRoot).add(interactionRoot);
    interactionRoot.add(objectRoot);
    selectableObjects.push({
      objectId,
      kind: selectableKind(object),
      interactionRoot,
      contentRoot: objectRoot,
    });

    if (isTextTargetObject(object)) {
      if (asset.createTextObject) {
        objectRoot.add(asset.createTextObject(object.text));
      } else {
        const preparedText = prepareTextObject3D(object.text);
        preparedTexts.push(preparedText);
        resourceLoads.push(preparedText.ready);
        objectRoot.add(preparedText.group);
      }
    } else if (isImageTargetObject(object) || isYouTubeTargetObject(object)) {
      const prepared = prepareMediaPlane({
        objectId: object.id,
        kind: isImageTargetObject(object) ? 'image' : 'youtube',
        url: isImageTargetObject(object) ? object.image.url : object.youtube.thumbnailUrl,
        aspectRatio: isImageTargetObject(object) ? object.image.aspectRatio : 16 / 9,
      }, {
        loadTexture: asset.loadTexture,
        loadMode,
      });
      objectRoot.add(prepared.group);
      resourceLoads.push(prepared.ready);
      if (isYouTubeTargetObject(object)) {
        youtubeSurfaces.push({
          objectId: object.id,
          root: objectRoot,
          mesh: prepared.mesh,
          youtube: object.youtube,
        });
      }
    } else if (isModelTargetObject(object)) {
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
    } else {
      objectRoot.add(createModelLoadFallback());
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
    youtubeSurfaces,
    selectableObjects,
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

function selectableObjectId(object: CloudflarePlacedObject, index: number): string {
  if (object.id) {
    return object.id;
  }
  if (isModelTargetObject(object) && object.model.id) {
    return object.model.id;
  }
  return `object-${index + 1}`;
}

function selectableKind(object: CloudflarePlacedObject): TargetSceneSelectableKind {
  if (isImageTargetObject(object)) {
    return 'image';
  }
  if (isYouTubeTargetObject(object)) {
    return 'youtube';
  }
  if (isTextTargetObject(object)) {
    return 'text';
  }
  return 'model';
}

function createPlacedObjects(asset: CloudflarePlacedAsset): CloudflarePlacedObject[] {
  if (asset.objects?.length) {
    return asset.objects;
  }
  if (!asset.model) {
    return [];
  }
  return [{
    id: '',
    model: asset.model,
    placement: asset.placement
      ? normalizePlacement(asset.placement)
      : normalizePlacement({ height: 0.04 }),
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

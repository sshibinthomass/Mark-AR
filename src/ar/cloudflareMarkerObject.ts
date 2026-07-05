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
import type { MarkerObject } from './arObjects';

export type ModelGroupLoader = (modelUrl: string) => Promise<Group>;

export type CloudflarePlacedAsset = {
  model: CloudflareModelOption;
  baseImage?: ProcessedBaseImage;
  loadModelGroup?: ModelGroupLoader;
};

export function createCloudflareMarkerObject(asset: CloudflarePlacedAsset): MarkerObject {
  const group = new Group();
  group.name = 'cloudflare-model-object';

  if (asset.baseImage) {
    group.add(createProcessedBasePlane(asset.baseImage));
  }

  const modelRoot = new Group();
  modelRoot.name = 'cloudflare-model-root';
  modelRoot.position.z = asset.baseImage ? 0.12 : 0.04;
  group.add(modelRoot);

  const loadModelGroup = asset.loadModelGroup ?? loadGltfModelGroup;
  void loadModelGroup(asset.model.url)
    .then((loadedModel) => {
      loadedModel.name = loadedModel.name || 'cloudflare-loaded-model';
      modelRoot.add(loadedModel);
    })
    .catch(() => {
      modelRoot.add(createModelLoadFallback());
    });

  return {
    group,
    update: (deltaSeconds: number) => {
      modelRoot.rotation.z += deltaSeconds * 0.22;
    },
  };
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

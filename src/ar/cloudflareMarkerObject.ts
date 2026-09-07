import { Group, type Texture } from 'three';
import type { CloudflareModelOption } from '../app/cloudflareModels';
import type { ImageTargetPlacement } from '../app/imageTargetPayload';
import type { TargetEditorGroup } from '../app/targetEditorGroups';
import type { TargetEditorObject, TargetTextContent } from '../app/targetEditorObjects';
import type { MarkerObject } from './arObjects';
import { createTargetSceneObject } from './targetSceneObject';

type ModelGroupLoader = (modelUrl: string) => Promise<Group>;

export type CloudflarePlacedObject = TargetEditorObject;

export type CloudflarePlacedAsset = {
  model?: CloudflareModelOption;
  placement?: ImageTargetPlacement;
  objects?: CloudflarePlacedObject[];
  groups?: TargetEditorGroup[];
  loadModelGroup?: ModelGroupLoader;
  createTextObject?: (text: TargetTextContent) => Group;
  loadTexture?: (url: string) => Promise<Texture | undefined>;
};

export function createCloudflareMarkerObject(asset: CloudflarePlacedAsset): MarkerObject {
  const group = new Group();
  group.name = 'cloudflare-model-object';
  const targetScene = createTargetSceneObject(asset, { loadMode: 'fallback' });
  targetScene.group.name = 'cloudflare-preview-space';
  targetScene.group.rotation.x = Math.PI / 2;
  group.add(targetScene.group);

  return {
    group,
    update: (deltaSeconds) => targetScene.update(deltaSeconds),
    dispose: () => targetScene.dispose(),
    youtubeSurfaces: targetScene.youtubeSurfaces,
  };
}

import { Group } from 'three';
import type { CloudflareModelOption } from '../app/cloudflareModels';
import type { ImageTargetAnimation } from '../app/imageTargetAnimation';
import type { ImageTargetPlacement } from '../app/imageTargetPayload';
import type { TargetEditorGroup } from '../app/targetEditorGroups';
import type { LocalTextTargetObject } from '../app/targetEditorObjects';
import type { MarkerObject } from './arObjects';
import { createTargetSceneObject } from './targetSceneObject';

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
  const targetScene = createTargetSceneObject(asset, { loadMode: 'fallback' });
  targetScene.group.name = 'cloudflare-preview-space';
  targetScene.group.rotation.x = Math.PI / 2;
  group.add(targetScene.group);

  return {
    group,
    update: (deltaSeconds) => targetScene.update(deltaSeconds),
    dispose: () => targetScene.dispose(),
  };
}

import type { CloudflareModelOption, ModelVisibility } from './cloudflareModels';
import type {
  ImageTargetAnimation,
  ImageTargetAnimationMotion,
  ImageTargetAnimationPreset,
  ImageTargetAnimationProperty,
} from './imageTargetAnimation';
import { normalizeAnimation } from './imageTargetAnimation';
import type { ImageTargetImagePayload, ImageTargetPlacement } from './imageTargetPayload';
import { normalizePlacement } from './imageTargetPayload';
import {
  composeGroupPlacement,
  normalizeLocalPlacement,
  type TargetEditorGroup,
} from './targetEditorGroups';

export type CloudImageTargetGroup = TargetEditorGroup;

export type CloudImageTargetObject = {
  id: string;
  model: CloudflareModelOption;
  placement: ImageTargetPlacement;
  animation?: ImageTargetAnimation;
  groupId?: string;
  localPlacement?: ImageTargetPlacement;
};

export type CloudImageTarget = {
  id: string;
  label: string;
  imageUrl: string;
  imageObjectKey: string;
  model: CloudflareModelOption;
  placement: ImageTargetPlacement;
  objects: CloudImageTargetObject[];
  groups: CloudImageTargetGroup[];
  ownerEmail?: string;
  visibility?: ModelVisibility;
  createdAt?: string;
  updatedAt?: string;
};

type WorkerImageTargetModel = {
  id?: string;
  label?: string;
  url?: string;
  preview_url?: string;
};

type WorkerImageTargetObject = {
  id?: string;
  model?: WorkerImageTargetModel;
  placement?: {
    scale?: number;
    offset_x?: number;
    offset_y?: number;
    height?: number;
    rotation_x?: number;
    rotation_y?: number;
    rotation_z?: number;
  };
  group_id?: string;
  local_placement?: WorkerImageTargetPlacement;
  animation?: {
    preset?: string;
    tracks?: Array<{
      property?: string;
      motion?: string;
      amount?: number;
      speed?: number;
      phase?: number;
    }>;
    spin_axis?: string;
    spin_speed?: number;
    bob_height?: number;
    bob_speed?: number;
  };
};

type WorkerImageTargetPlacement = {
  scale?: number;
  offset_x?: number;
  offset_y?: number;
  height?: number;
  rotation_x?: number;
  rotation_y?: number;
  rotation_z?: number;
};

type WorkerImageTargetGroup = {
  id?: string;
  label?: string;
  placement?: WorkerImageTargetPlacement;
  animation?: WorkerImageTargetObject['animation'];
};

type WorkerImageTargetEntry = {
  id?: string;
  label?: string;
  image_url?: string;
  image_object_key?: string;
  model?: WorkerImageTargetModel;
  placement?: {
    scale?: number;
    offset_x?: number;
    offset_y?: number;
    height?: number;
    rotation_x?: number;
    rotation_y?: number;
    rotation_z?: number;
  };
  objects?: WorkerImageTargetObject[];
  groups?: WorkerImageTargetGroup[];
  owner_email?: string;
  visibility?: ModelVisibility;
  created_at?: string;
  updated_at?: string;
};

type WorkerImageTargetsResponse = {
  targets?: WorkerImageTargetEntry[];
  error?: string;
};

type WorkerErrorResponse = {
  error?: string;
};

type ClientInput = {
  apiUrl: string;
  authToken?: string | null;
  fetchImpl?: typeof fetch;
};

type CreateImageTargetInput = ClientInput &
  ImageTargetImagePayload & {
    label: string;
    model?: CloudflareModelOption;
    placement?: ImageTargetPlacement;
    objects?: CloudImageTargetObject[];
    groups?: CloudImageTargetGroup[];
  };

type UpdateImageTargetInput = ClientInput & {
  targetId: string;
  label?: string;
  model?: CloudflareModelOption;
  placement?: ImageTargetPlacement;
  objects?: CloudImageTargetObject[];
  groups?: CloudImageTargetGroup[];
} & Partial<ImageTargetImagePayload>;

type DeleteImageTargetInput = ClientInput & {
  targetId: string;
};

export async function listImageTargets({
  apiUrl,
  authToken,
  fetchImpl = fetch,
}: ClientInput): Promise<CloudImageTarget[]> {
  if (!apiUrl || !authToken) {
    return [];
  }

  const response = await fetchImpl(imageTargetsUrl(apiUrl), { headers: authHeaders(authToken) });
  const body = (await response.json()) as WorkerImageTargetsResponse;

  if (!response.ok) {
    throw new Error(body.error ?? `Image target list failed with HTTP ${response.status}.`);
  }

  return (body.targets ?? []).map(mapImageTargetEntry).filter((target): target is CloudImageTarget => Boolean(target));
}

export async function createImageTarget({
  apiUrl,
  authToken,
  fetchImpl = fetch,
  label,
  imageBase64,
  imageMimeType,
  model,
  placement,
  objects,
  groups,
}: CreateImageTargetInput): Promise<CloudImageTarget> {
  const normalizedGroups = normalizeCloudImageTargetGroups(groups);
  const requestObjects = imageTargetObjectsRequestBody(objects, normalizedGroups, model, placement);
  const response = await fetchImpl(imageTargetsUrl(apiUrl), {
    method: 'POST',
    headers: jsonHeaders(authToken),
    body: JSON.stringify({
      label,
      image_base64: imageBase64,
      image_mime_type: imageMimeType,
      model: requestObjects[0].model,
      placement: requestObjects[0].placement,
      objects: requestObjects,
      ...(normalizedGroups.length > 0 ? { groups: normalizedGroups.map(groupRequestBody) } : {}),
    }),
  });
  return parseImageTargetResponse(response, 'Image target create failed');
}

export async function updateImageTarget({
  apiUrl,
  authToken,
  fetchImpl = fetch,
  targetId,
  label,
  model,
  placement,
  objects,
  groups,
  imageBase64,
  imageMimeType,
}: UpdateImageTargetInput): Promise<CloudImageTarget> {
  const body: Record<string, unknown> = {};
  if (label !== undefined) {
    body.label = label;
  }
  if (model) {
    body.model = modelRequestBody(model);
  }
  if (placement) {
    body.placement = placementRequestBody(placement);
  }
  if (objects) {
    const normalizedGroups = normalizeCloudImageTargetGroups(groups);
    const requestObjects = imageTargetObjectsRequestBody(objects, normalizedGroups, model, placement);
    body.objects = requestObjects;
    body.model = requestObjects[0].model;
    body.placement = requestObjects[0].placement;
    body.groups = normalizedGroups.map(groupRequestBody);
  } else if (groups) {
    body.groups = normalizeCloudImageTargetGroups(groups).map(groupRequestBody);
  }
  if (imageBase64 !== undefined) {
    body.image_base64 = imageBase64;
  }
  if (imageMimeType !== undefined) {
    body.image_mime_type = imageMimeType;
  }

  const response = await fetchImpl(imageTargetItemUrl(apiUrl, targetId), {
    method: 'PATCH',
    headers: jsonHeaders(authToken),
    body: JSON.stringify(body),
  });
  return parseImageTargetResponse(response, 'Image target update failed');
}

export async function deleteImageTarget({
  apiUrl,
  authToken,
  fetchImpl = fetch,
  targetId,
}: DeleteImageTargetInput): Promise<void> {
  const response = await fetchImpl(imageTargetItemUrl(apiUrl, targetId), {
    method: 'DELETE',
    headers: authHeaders(authToken),
  });
  const body = (await response.json()) as WorkerErrorResponse;
  if (!response.ok) {
    throw new Error(body.error ?? `Image target delete failed with HTTP ${response.status}.`);
  }
}

function mapImageTargetEntry(entry: WorkerImageTargetEntry): CloudImageTarget | null {
  if (!entry.id || !entry.label || !entry.image_url || !entry.image_object_key) {
    return null;
  }
  const groups = mapImageTargetGroups(entry.groups);
  const objects = mapImageTargetObjects(entry, groups);
  const firstObject = objects[0];
  if (!firstObject) {
    return null;
  }

  return {
    id: entry.id,
    label: entry.label,
    imageUrl: entry.image_url,
    imageObjectKey: entry.image_object_key,
    model: firstObject.model,
    placement: firstObject.placement,
    objects,
    groups,
    ...(entry.owner_email ? { ownerEmail: entry.owner_email } : {}),
    ...(entry.visibility ? { visibility: entry.visibility } : {}),
    ...(entry.created_at ? { createdAt: entry.created_at } : {}),
    ...(entry.updated_at ? { updatedAt: entry.updated_at } : {}),
  };
}

function mapImageTargetObjects(
  entry: WorkerImageTargetEntry,
  groups: CloudImageTargetGroup[],
): CloudImageTargetObject[] {
  const objects = (entry.objects ?? [])
    .map((object, index) => mapImageTargetObject(object, index, groups))
    .filter((object): object is CloudImageTargetObject => Boolean(object));
  if (objects.length > 0) {
    return objects;
  }

  const legacyObject = mapImageTargetObject({
    id: 'object-1',
    model: entry.model,
    placement: entry.placement,
  }, 0, groups);
  return legacyObject ? [legacyObject] : [];
}

function mapImageTargetObject(
  object: WorkerImageTargetObject,
  index: number,
  groups: CloudImageTargetGroup[],
): CloudImageTargetObject | null {
  if (!object.model?.id || !object.model.label || !object.model.url) {
    return null;
  }

  const group = object.group_id ? groups.find((candidate) => candidate.id === object.group_id) : undefined;
  const localPlacement = group && object.local_placement
    ? normalizeLocalPlacement(placementFromWire(object.local_placement))
    : undefined;
  const placement = localPlacement && group
    ? composeGroupPlacement(group.placement, localPlacement)
    : normalizePlacement(placementFromWire(object.placement));
  return {
    id: object.id || `object-${index + 1}`,
    model: {
      id: object.model.id,
      label: object.model.label,
      url: object.model.url,
      ...(object.model.preview_url ? { previewUrl: object.model.preview_url } : {}),
    },
    placement,
    ...(group && localPlacement ? { groupId: group.id, localPlacement } : {}),
    ...(object.animation ? { animation: animationFromWire(object.animation) } : {}),
  };
}

function mapImageTargetGroups(groups: WorkerImageTargetGroup[] | undefined): CloudImageTargetGroup[] {
  const seen = new Set<string>();
  return (groups ?? []).flatMap((group) => {
    if (!group.id || !group.label || seen.has(group.id)) {
      return [];
    }
    seen.add(group.id);
    return [{
      id: group.id,
      label: group.label,
      placement: normalizePlacement(placementFromWire(group.placement)),
      animation: group.animation ? animationFromWire(group.animation) : normalizeAnimation(),
    }];
  });
}

function animationFromWire(animation: NonNullable<WorkerImageTargetObject['animation']>): ImageTargetAnimation {
  return normalizeAnimation({
    preset: animation.preset as ImageTargetAnimationPreset | undefined,
    tracks: animation.tracks?.map((track) => ({
      property: animationPropertyFromWire(track.property),
      motion: track.motion as ImageTargetAnimationMotion | undefined,
      amount: track.amount,
      speed: track.speed,
      phase: track.phase,
    })) as ImageTargetAnimation['tracks'] | undefined,
    spinAxis: animation.spin_axis as 'none' | 'x' | 'y' | 'z' | undefined,
    spinSpeed: animation.spin_speed,
    bobHeight: animation.bob_height,
    bobSpeed: animation.bob_speed,
  });
}

async function parseImageTargetResponse(response: Response, fallback: string): Promise<CloudImageTarget> {
  const body = (await response.json()) as WorkerImageTargetEntry & WorkerErrorResponse;
  if (!response.ok) {
    throw new Error(body.error ?? `${fallback} with HTTP ${response.status}.`);
  }
  const target = mapImageTargetEntry(body);
  if (!target) {
    throw new Error('Worker response did not include an image target.');
  }
  return target;
}

function imageTargetsUrl(apiUrl: string): string {
  return `${apiUrl.replace(/\/+$/, '')}/image-targets`;
}

function imageTargetItemUrl(apiUrl: string, targetId: string): string {
  return `${imageTargetsUrl(apiUrl)}/${encodeURIComponent(targetId)}`;
}

function modelRequestBody(model: CloudflareModelOption): Record<string, string> {
  return {
    id: model.id,
    label: model.label,
    url: model.url,
    ...(model.previewUrl ? { preview_url: model.previewUrl } : {}),
  };
}

function imageTargetObjectsRequestBody(
  objects: CloudImageTargetObject[] | undefined,
  groups: CloudImageTargetGroup[],
  legacyModel?: CloudflareModelOption,
  legacyPlacement?: ImageTargetPlacement,
): Array<{
  id: string;
  model: Record<string, string>;
  placement: Record<string, number>;
  animation?: WorkerAnimationRequestBody;
}> {
  const requestObjects = objects?.length
    ? objects
    : legacyModel
      ? [{ id: 'object-1', model: legacyModel, placement: normalizePlacement(legacyPlacement) }]
      : [];

  if (requestObjects.length === 0) {
    throw new Error('Choose at least one Cloudflare model.');
  }

  const resolvedObjects = resolveGroupedObjectsForSave(requestObjects, groups);
  return resolvedObjects.map((object, index) => ({
    id: object.id || `object-${index + 1}`,
    model: modelRequestBody(object.model),
    placement: placementRequestBody(object.placement),
    ...(object.groupId && object.localPlacement ? {
      group_id: object.groupId,
      local_placement: localPlacementRequestBody(object.localPlacement),
    } : {}),
    ...(object.animation ? { animation: animationRequestBody(object.animation) } : {}),
  }));
}

export function resolveGroupedObjectsForSave(
  objects: CloudImageTargetObject[],
  groups: CloudImageTargetGroup[],
): CloudImageTargetObject[] {
  const normalizedGroups = normalizeCloudImageTargetGroups(groups);
  return objects.map((object) => {
    const group = object.groupId
      ? normalizedGroups.find((candidate) => candidate.id === object.groupId)
      : undefined;
    if (!group || !object.localPlacement) {
      const { groupId: _groupId, localPlacement: _localPlacement, ...ungrouped } = object;
      return { ...ungrouped, placement: normalizePlacement(object.placement) };
    }
    const localPlacement = normalizeLocalPlacement(object.localPlacement);
    return {
      ...object,
      groupId: group.id,
      localPlacement,
      placement: composeGroupPlacement(group.placement, localPlacement),
    };
  });
}

export function normalizeCloudImageTargetGroups(
  groups: CloudImageTargetGroup[] | undefined,
): CloudImageTargetGroup[] {
  const seen = new Set<string>();
  return (groups ?? []).flatMap((group) => {
    if (!group.id || !group.label || seen.has(group.id)) {
      return [];
    }
    seen.add(group.id);
    return [{
      id: group.id,
      label: group.label,
      placement: normalizePlacement(group.placement),
      animation: normalizeAnimation(group.animation),
    }];
  });
}

function groupRequestBody(group: CloudImageTargetGroup): Record<string, unknown> {
  return {
    id: group.id,
    label: group.label,
    placement: placementRequestBody(group.placement),
    animation: animationRequestBody(group.animation),
  };
}

type WorkerAnimationRequestBody = {
  preset: ImageTargetAnimationPreset;
  tracks: Array<{
    property: string;
    motion: ImageTargetAnimationMotion;
    amount: number;
    speed: number;
    phase: number;
  }>;
  spin_axis?: 'none' | 'x' | 'y' | 'z';
  spin_speed?: number;
  bob_height?: number;
  bob_speed?: number;
};

function animationRequestBody(animation: ImageTargetAnimation): WorkerAnimationRequestBody {
  const normalized = normalizeAnimation(animation);
  const body: WorkerAnimationRequestBody = {
    preset: normalized.preset,
    tracks: normalized.tracks.map((track) => ({
      ...track,
      property: animationPropertyToWire(track.property),
    })),
  };

  const legacySpin = normalized.tracks.find((track) =>
    track.property.startsWith('rotation') && track.motion === 'spin' && track.phase === 0,
  );
  if (legacySpin) {
    body.spin_axis = legacySpin.property.at(-1)?.toLowerCase() as 'x' | 'y' | 'z';
    body.spin_speed = degreesToRadians(legacySpin.amount * legacySpin.speed);
  }

  const legacyBob = normalized.tracks.find((track) =>
    track.property === 'positionY' && track.motion === 'smooth' && track.phase === 0 && track.amount >= 0,
  );
  if (legacyBob) {
    body.bob_height = legacyBob.amount;
    body.bob_speed = legacyBob.speed * 2 * Math.PI;
  }
  return body;
}

function animationPropertyFromWire(value: unknown): ImageTargetAnimationProperty | undefined {
  const properties: Record<string, ImageTargetAnimationProperty> = {
    position_x: 'positionX',
    position_y: 'positionY',
    position_z: 'positionZ',
    rotation_x: 'rotationX',
    rotation_y: 'rotationY',
    rotation_z: 'rotationZ',
    scale: 'scale',
  };
  return typeof value === 'string' ? properties[value] : undefined;
}

function animationPropertyToWire(property: ImageTargetAnimationProperty): string {
  return property.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function placementRequestBody(placement: ImageTargetPlacement): Record<string, number> {
  const normalized = normalizePlacement(placement);
  return {
    scale: normalized.scale,
    offset_x: normalized.offsetX,
    offset_y: normalized.offsetY,
    height: normalized.height,
    rotation_x: normalized.rotationX,
    rotation_y: normalized.rotationY,
    rotation_z: normalized.rotationZ,
  };
}

function localPlacementRequestBody(placement: ImageTargetPlacement): Record<string, number> {
  const normalized = normalizeLocalPlacement(placement);
  return {
    scale: normalized.scale,
    offset_x: normalized.offsetX,
    offset_y: normalized.offsetY,
    height: normalized.height,
    rotation_x: normalized.rotationX,
    rotation_y: normalized.rotationY,
    rotation_z: normalized.rotationZ,
  };
}

function placementFromWire(placement: WorkerImageTargetPlacement | undefined): Partial<ImageTargetPlacement> {
  return {
    scale: placement?.scale,
    offsetX: placement?.offset_x,
    offsetY: placement?.offset_y,
    height: placement?.height,
    rotationX: placement?.rotation_x,
    rotationY: placement?.rotation_y,
    rotationZ: placement?.rotation_z,
  };
}

function jsonHeaders(authToken?: string | null): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...authHeaders(authToken),
  };
}

function authHeaders(authToken?: string | null): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

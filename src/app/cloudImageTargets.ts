import type { CloudflareModelOption, ModelVisibility } from './cloudflareModels';
import type { ImageTargetImagePayload, ImageTargetPlacement } from './imageTargetPayload';
import { normalizePlacement } from './imageTargetPayload';

export type CloudImageTarget = {
  id: string;
  label: string;
  imageUrl: string;
  imageObjectKey: string;
  model: CloudflareModelOption;
  placement: ImageTargetPlacement;
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
  };
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
    model: CloudflareModelOption;
    placement: ImageTargetPlacement;
  };

type UpdateImageTargetInput = ClientInput & {
  targetId: string;
  label?: string;
  model?: CloudflareModelOption;
  placement?: ImageTargetPlacement;
} & Partial<ImageTargetImagePayload>;

type DeleteImageTargetInput = ClientInput & {
  targetId: string;
};

export async function listImageTargets({
  apiUrl,
  authToken,
  fetchImpl = fetch,
}: ClientInput): Promise<CloudImageTarget[]> {
  if (!apiUrl) {
    return [];
  }

  const response = authToken
    ? await fetchImpl(imageTargetsUrl(apiUrl), { headers: authHeaders(authToken) })
    : await fetchImpl(imageTargetsUrl(apiUrl));
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
}: CreateImageTargetInput): Promise<CloudImageTarget> {
  const response = await fetchImpl(imageTargetsUrl(apiUrl), {
    method: 'POST',
    headers: jsonHeaders(authToken),
    body: JSON.stringify({
      label,
      image_base64: imageBase64,
      image_mime_type: imageMimeType,
      model: modelRequestBody(model),
      placement: placementRequestBody(placement),
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
  if (!entry.id || !entry.label || !entry.image_url || !entry.image_object_key || !entry.model?.id || !entry.model.label || !entry.model.url) {
    return null;
  }

  return {
    id: entry.id,
    label: entry.label,
    imageUrl: entry.image_url,
    imageObjectKey: entry.image_object_key,
    model: {
      id: entry.model.id,
      label: entry.model.label,
      url: entry.model.url,
      ...(entry.model.preview_url ? { previewUrl: entry.model.preview_url } : {}),
    },
    placement: normalizePlacement({
      scale: entry.placement?.scale,
      offsetX: entry.placement?.offset_x,
      offsetY: entry.placement?.offset_y,
      height: entry.placement?.height,
    }),
    ...(entry.owner_email ? { ownerEmail: entry.owner_email } : {}),
    ...(entry.visibility ? { visibility: entry.visibility } : {}),
    ...(entry.created_at ? { createdAt: entry.created_at } : {}),
    ...(entry.updated_at ? { updatedAt: entry.updated_at } : {}),
  };
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

function placementRequestBody(placement: ImageTargetPlacement): Record<string, number> {
  return {
    scale: placement.scale,
    offset_x: placement.offsetX,
    offset_y: placement.offsetY,
    height: placement.height,
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

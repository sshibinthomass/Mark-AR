export type ImageTargetPlacement = {
  scale: number;
  offsetX: number;
  offsetY: number;
  height: number;
};

export type ImageTargetImagePayload = {
  imageBase64: string;
  imageMimeType: string;
};

export const DEFAULT_IMAGE_TARGET_PLACEMENT: ImageTargetPlacement = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  height: 0.12,
};

const supportedTargetImageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function normalizePlacement(value?: Partial<ImageTargetPlacement>): ImageTargetPlacement {
  return {
    scale: clampFinite(value?.scale, DEFAULT_IMAGE_TARGET_PLACEMENT.scale, 0.1, 5),
    offsetX: clampFinite(value?.offsetX, DEFAULT_IMAGE_TARGET_PLACEMENT.offsetX, -1, 1),
    offsetY: clampFinite(value?.offsetY, DEFAULT_IMAGE_TARGET_PLACEMENT.offsetY, -1, 1),
    height: clampFinite(value?.height, DEFAULT_IMAGE_TARGET_PLACEMENT.height, 0, 1),
  };
}

export function validateTargetImagePayload(payload: ImageTargetImagePayload): string | null {
  if (!payload.imageBase64) {
    return 'Choose a target image.';
  }
  if (!supportedTargetImageMimeTypes.has(payload.imageMimeType)) {
    return 'Target image must be PNG, JPEG, or WebP.';
  }
  return null;
}

export function imageTargetDataUrl(payload: ImageTargetImagePayload): string {
  return `data:${payload.imageMimeType};base64,${payload.imageBase64}`;
}

function clampFinite(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

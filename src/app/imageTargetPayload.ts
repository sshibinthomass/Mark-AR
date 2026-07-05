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

const maxTargetImageBytes = 5 * 1024 * 1024;
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
  if (decodedBase64Size(payload.imageBase64) > maxTargetImageBytes) {
    return 'Target image must be 5 MB or smaller.';
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

function decodedBase64Size(value: string): number {
  let contentLength = 0;
  let padding = 0;

  for (let index = value.length - 1; index >= 0; index -= 1) {
    const char = value[index];
    if (char === '=') {
      padding += 1;
      continue;
    }
    if (isAsciiWhitespace(char)) {
      continue;
    }
    break;
  }

  for (let index = 0; index < value.length; index += 1) {
    if (!isAsciiWhitespace(value[index])) {
      contentLength += 1;
    }
  }

  if (contentLength === 0) {
    return 0;
  }

  return Math.floor((contentLength * 3) / 4) - Math.min(padding, 2);
}

function isAsciiWhitespace(value: string): boolean {
  return value === ' ' || value === '\n' || value === '\r' || value === '\t';
}

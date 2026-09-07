import { imageFileToCapturedImage } from '../capture/cameraCapture';
import {
  isSupportedTargetImageMimeType,
  normalizeTargetImageUrl,
  validateTargetImageFile,
  type PendingTargetImageSource,
  type SupportedTargetImageMimeType,
  type TargetImageContent,
} from './targetMedia';

type TargetImageDraft = {
  image: TargetImageContent;
  source: PendingTargetImageSource;
};

type Dimensions = { width: number; height: number };

type FileDraftDeps = {
  encode?: (file: File) => Promise<{ imageBase64: string; imageMimeType: string }>;
  measure?: (source: File | string) => Promise<Dimensions>;
};

type UrlDraftDeps = {
  measure?: (source: File | string) => Promise<Dimensions>;
};

export async function createTargetImageDraftFromFile(
  file: File,
  deps: FileDraftDeps = {},
): Promise<TargetImageDraft> {
  const validationError = validateTargetImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }
  const encoded = await (deps.encode ?? imageFileToCapturedImage)(file);
  if (!isSupportedTargetImageMimeType(encoded.imageMimeType)) {
    throw new Error('Image objects must be PNG, JPEG, or WebP.');
  }
  const dimensions = validateDimensions(await (deps.measure ?? measureImage)(file));
  const label = file.name.replace(/\.[^.]+$/, '').trim() || 'Image';
  return {
    image: {
      url: `data:${encoded.imageMimeType};base64,${encoded.imageBase64}`,
      label,
      ...dimensions,
      aspectRatio: dimensions.width / dimensions.height,
    },
    source: {
      source: 'upload',
      imageBase64: encoded.imageBase64,
      imageMimeType: encoded.imageMimeType as SupportedTargetImageMimeType,
    },
  };
}

export async function createTargetImageDraftFromUrl(
  input: string,
  deps: UrlDraftDeps = {},
): Promise<TargetImageDraft> {
  const url = normalizeTargetImageUrl(input);
  if (!url) {
    throw new Error('Enter a public HTTPS image URL.');
  }
  const dimensions = validateDimensions(await (deps.measure ?? measureImage)(url));
  const pathname = new URL(url).pathname;
  const label = decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) ?? 'Image');
  return {
    image: {
      url,
      label,
      ...dimensions,
      aspectRatio: dimensions.width / dimensions.height,
    },
    source: { source: 'url', sourceUrl: url },
  };
}

function validateDimensions(dimensions: Dimensions): Dimensions {
  if (
    !Number.isFinite(dimensions.width)
    || !Number.isFinite(dimensions.height)
    || dimensions.width <= 0
    || dimensions.height <= 0
  ) {
    throw new Error('Unable to read image dimensions.');
  }
  return dimensions;
}

async function measureImage(source: File | string): Promise<Dimensions> {
  const objectUrl = typeof source === 'string' ? undefined : URL.createObjectURL(source);
  try {
    return await new Promise<Dimensions>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error('Unable to load the image.'));
      image.src = typeof source === 'string' ? source : objectUrl ?? '';
    });
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

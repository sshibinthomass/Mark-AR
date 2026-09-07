const MAX_TARGET_MEDIA_IMAGE_BYTES = 5 * 1024 * 1024;

const SUPPORTED_TARGET_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type SupportedTargetImageMimeType =
  (typeof SUPPORTED_TARGET_IMAGE_MIME_TYPES)[number];

export type PendingTargetImageSource =
  | {
    source: 'upload';
    imageBase64: string;
    imageMimeType: SupportedTargetImageMimeType;
  }
  | {
    source: 'url';
    sourceUrl: string;
  };

export type TargetImageContent = {
  url: string;
  objectKey?: string;
  label: string;
  width: number;
  height: number;
  aspectRatio: number;
};

export type TargetYouTubeContent = {
  videoId: string;
  url: string;
  thumbnailUrl: string;
};

export function isSupportedTargetImageMimeType(
  value: unknown,
): value is SupportedTargetImageMimeType {
  return SUPPORTED_TARGET_IMAGE_MIME_TYPES.some((mimeType) => mimeType === value);
}

export function validateTargetImageFile(
  file: Pick<File, 'name' | 'size' | 'type'>,
): string | null {
  if (!isSupportedTargetImageMimeType(file.type)) {
    return 'Image objects must be PNG, JPEG, or WebP.';
  }
  if (file.size > MAX_TARGET_MEDIA_IMAGE_BYTES) {
    return 'Image objects must be 5 MB or smaller.';
  }
  return null;
}

export function normalizeTargetImageUrl(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:' || url.username || url.password) {
      return null;
    }
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      hostname === 'localhost'
      || hostname.endsWith('.localhost')
      || hostname === '0.0.0.0'
      || hostname === '::1'
      || isPrivateIpv4(hostname)
    ) {
      return null;
    }
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeYouTubeUrl(input: string): TargetYouTubeContent | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:') {
      return null;
    }
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    let videoId: string | null = null;
    if (hostname === 'youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
    } else if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      const segments = url.pathname.split('/').filter(Boolean);
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v');
      } else if (segments[0] === 'shorts' || segments[0] === 'embed') {
        videoId = segments[1] ?? null;
      }
    }
    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return null;
    }
    return {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch {
    return null;
  }
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return false;
  }
  const octets = parts.map(Number);
  if (octets.some((octet) => octet > 255)) {
    return false;
  }
  return (
    octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
  );
}

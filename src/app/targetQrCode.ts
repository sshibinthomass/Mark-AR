import qrcode from 'qrcode-generator';

export type RgbaImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TargetQrLayout = {
  canvas: Rect;
  qr: Rect;
  centerBadge: Rect;
  centerLogo: Rect;
  footerLogo: Rect;
  moduleSize: number;
  moduleCount: number;
  quietModules: 4;
  errorCorrectionLevel: 'H';
};

export type TargetQrArtifact = {
  blob: Blob;
  filename: string;
};

type TargetQrArtifactInput = {
  scanUrl: string;
  label: string;
  targetId: string;
};

type TargetQrArtifactDependencies = {
  baseUrl?: string;
  loadImage?: (url: string) => Promise<RgbaImage>;
  encodePng?: (image: RgbaImage) => Promise<Blob>;
};

type TargetQrDownloadDependencies = {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  createAnchor?: () => HTMLAnchorElement;
  scheduleCleanup?: (cleanup: () => void) => void;
};

const CANVAS_SIZE = 1200;
const QR_REGION_SIZE = 900;
const QR_REGION_X = 48;
const QR_REGION_Y = 48;
const QUIET_MODULES = 4;
const CENTER_LOGO_RATIO = 0.16;

export function targetQrAssetUrls(baseUrl = import.meta.env.BASE_URL): {
  centerLogoUrl: string;
  footerLogoUrl: string;
} {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return {
    centerLogoUrl: `${base}brand/qr/00-arvenilo-master-transparent-logo-QR.png`,
    footerLogoUrl: `${base}brand/qr/04-anchorar-platform-transparent-QR.png`,
  };
}

export function targetQrFilename(label: string, targetId: string): string {
  const slug = slugPart(label) || slugPart(targetId) || 'target';
  return `anchorar-${slug}-qr.png`;
}

export function composeTargetQrPixels(
  scanUrl: string,
  centerLogo: RgbaImage,
  footerLogo: RgbaImage,
): RgbaImage & { layout: TargetQrLayout } {
  const qr = qrcode(0, 'H');
  qr.addData(scanUrl, 'Byte');
  qr.make();

  const moduleCount = qr.getModuleCount();
  const moduleSize = Math.max(
    1,
    Math.floor(QR_REGION_SIZE / (moduleCount + QUIET_MODULES * 2)),
  );
  const qrSize = moduleSize * (moduleCount + QUIET_MODULES * 2);
  const qrRect = {
    x: QR_REGION_X + Math.floor((QR_REGION_SIZE - qrSize) / 2),
    y: QR_REGION_Y + Math.floor((QR_REGION_SIZE - qrSize) / 2),
    width: qrSize,
    height: qrSize,
  };
  const image = solidImage(CANVAS_SIZE, CANVAS_SIZE, [255, 255, 255, 255]);

  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (!qr.isDark(row, column)) {
        continue;
      }
      fillRect(image, {
        x: qrRect.x + (column + QUIET_MODULES) * moduleSize,
        y: qrRect.y + (row + QUIET_MODULES) * moduleSize,
        width: moduleSize,
        height: moduleSize,
      }, [5, 27, 29, 255]);
    }
  }

  const centerLogoMaxSize = Math.floor(qrRect.width * CENTER_LOGO_RATIO);
  const centerLogoRect = fitCenteredRect(
    centerLogo,
    centerLogoMaxSize,
    centerLogoMaxSize,
    qrRect.x + qrRect.width / 2,
    qrRect.y + qrRect.height / 2,
  );
  const centerBadge = clippedRect(expandRect(centerLogoRect, 18), qrRect);
  fillRect(image, centerBadge, [255, 255, 255, 255]);
  blendScaledImage(image, centerLogo, centerLogoRect);

  const footerLogoRect = fitBottomCenteredRect(footerLogo, {
    maxWidth: 620,
    maxHeight: 150,
    centerX: qrRect.x + qrRect.width / 2,
    bottom: CANVAS_SIZE - 48,
  });
  blendScaledImage(image, footerLogo, footerLogoRect);

  return {
    ...image,
    layout: {
      canvas: { x: 0, y: 0, width: CANVAS_SIZE, height: CANVAS_SIZE },
      qr: qrRect,
      centerBadge,
      centerLogo: centerLogoRect,
      footerLogo: footerLogoRect,
      moduleSize,
      moduleCount,
      quietModules: QUIET_MODULES,
      errorCorrectionLevel: 'H',
    },
  };
}

export async function createTargetQrArtifact(
  input: TargetQrArtifactInput,
  dependencies: TargetQrArtifactDependencies = {},
): Promise<TargetQrArtifact> {
  const urls = targetQrAssetUrls(dependencies.baseUrl);
  const loadImage = dependencies.loadImage ?? loadBrowserImage;
  const encodePng = dependencies.encodePng ?? encodeBrowserPng;
  const [centerLogo, footerLogo] = await Promise.all([
    loadImage(urls.centerLogoUrl),
    loadImage(urls.footerLogoUrl),
  ]);
  const image = composeTargetQrPixels(input.scanUrl, centerLogo, footerLogo);

  return {
    blob: await encodePng(image),
    filename: targetQrFilename(input.label, input.targetId),
  };
}

export function downloadTargetQrArtifact(
  artifact: TargetQrArtifact,
  dependencies: TargetQrDownloadDependencies = {},
): void {
  const createObjectURL = dependencies.createObjectURL ?? URL.createObjectURL.bind(URL);
  const revokeObjectURL = dependencies.revokeObjectURL ?? URL.revokeObjectURL.bind(URL);
  const createAnchor = dependencies.createAnchor ?? (() => document.createElement('a'));
  const scheduleCleanup = dependencies.scheduleCleanup ?? ((cleanup) => {
    window.setTimeout(cleanup, 0);
  });
  const objectUrl = createObjectURL(artifact.blob);
  const anchor = createAnchor();
  anchor.href = objectUrl;
  anchor.download = artifact.filename;
  anchor.click();
  anchor.remove?.();
  scheduleCleanup(() => revokeObjectURL(objectUrl));
}

function slugPart(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function solidImage(
  width: number,
  height: number,
  color: [number, number, number, number],
): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = color[0];
    data[index + 1] = color[1];
    data[index + 2] = color[2];
    data[index + 3] = color[3];
  }
  return { width, height, data };
}

function fillRect(
  image: RgbaImage,
  rect: Rect,
  color: [number, number, number, number],
): void {
  const startX = Math.max(0, Math.floor(rect.x));
  const startY = Math.max(0, Math.floor(rect.y));
  const endX = Math.min(image.width, Math.ceil(rect.x + rect.width));
  const endY = Math.min(image.height, Math.ceil(rect.y + rect.height));

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = (y * image.width + x) * 4;
      dataColor(image.data, index, color);
    }
  }
}

function blendScaledImage(destination: RgbaImage, source: RgbaImage, rect: Rect): void {
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  const startX = Math.floor(rect.x);
  const startY = Math.floor(rect.y);

  for (let targetY = 0; targetY < height; targetY += 1) {
    const y = startY + targetY;
    if (y < 0 || y >= destination.height) {
      continue;
    }
    const sourceY = Math.min(
      source.height - 1,
      Math.floor(targetY * source.height / height),
    );
    for (let targetX = 0; targetX < width; targetX += 1) {
      const x = startX + targetX;
      if (x < 0 || x >= destination.width) {
        continue;
      }
      const sourceX = Math.min(
        source.width - 1,
        Math.floor(targetX * source.width / width),
      );
      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      const destinationIndex = (y * destination.width + x) * 4;
      blendPixel(destination.data, destinationIndex, source.data, sourceIndex);
    }
  }
}

function blendPixel(
  destination: Uint8ClampedArray,
  destinationIndex: number,
  source: Uint8ClampedArray,
  sourceIndex: number,
): void {
  const alpha = source[sourceIndex + 3] / 255;
  const inverseAlpha = 1 - alpha;
  destination[destinationIndex] = Math.round(
    source[sourceIndex] * alpha + destination[destinationIndex] * inverseAlpha,
  );
  destination[destinationIndex + 1] = Math.round(
    source[sourceIndex + 1] * alpha + destination[destinationIndex + 1] * inverseAlpha,
  );
  destination[destinationIndex + 2] = Math.round(
    source[sourceIndex + 2] * alpha + destination[destinationIndex + 2] * inverseAlpha,
  );
  destination[destinationIndex + 3] = 255;
}

function dataColor(
  data: Uint8ClampedArray,
  index: number,
  color: [number, number, number, number],
): void {
  data[index] = color[0];
  data[index + 1] = color[1];
  data[index + 2] = color[2];
  data[index + 3] = color[3];
}

function fitCenteredRect(
  image: RgbaImage,
  maxWidth: number,
  maxHeight: number,
  centerX: number,
  centerY: number,
): Rect {
  const size = fitSize(image, maxWidth, maxHeight);
  return {
    x: Math.round(centerX - size.width / 2),
    y: Math.round(centerY - size.height / 2),
    ...size,
  };
}

function fitBottomCenteredRect(
  image: RgbaImage,
  bounds: {
    maxWidth: number;
    maxHeight: number;
    centerX: number;
    bottom: number;
  },
): Rect {
  const size = fitSize(image, bounds.maxWidth, bounds.maxHeight);
  return {
    x: Math.round(bounds.centerX - size.width / 2),
    y: Math.round(bounds.bottom - size.height),
    ...size,
  };
}

function fitSize(
  image: Pick<RgbaImage, 'width' | 'height'>,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  return {
    width: Math.max(1, Math.floor(image.width * scale)),
    height: Math.max(1, Math.floor(image.height * scale)),
  };
}

function expandRect(rect: Rect, padding: number): Rect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function clippedRect(rect: Rect, bounds: Rect): Rect {
  const x = Math.max(rect.x, bounds.x);
  const y = Math.max(rect.y, bounds.y);
  const right = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const bottom = Math.min(rect.y + rect.height, bounds.y + bounds.height);
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

async function loadBrowserImage(url: string): Promise<RgbaImage> {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await decodeImage(image);

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas is unavailable while loading QR branding.');
  }
  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return {
    width: imageData.width,
    height: imageData.height,
    data: new Uint8ClampedArray(imageData.data),
  };
}

async function decodeImage(image: HTMLImageElement): Promise<void> {
  if (typeof image.decode === 'function') {
    await image.decode();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => reject(new Error('Unable to load QR branding.')), {
      once: true,
    });
  });
}

async function encodeBrowserPng(image: RgbaImage): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas is unavailable while creating the QR code.');
  }
  const imageData = context.createImageData(image.width, image.height);
  imageData.data.set(image.data);
  context.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('Unable to encode the QR code as PNG.'));
    }, 'image/png');
  });
}

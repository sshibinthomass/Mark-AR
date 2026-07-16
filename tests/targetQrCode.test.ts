import { readFileSync } from 'node:fs';
import jsQR from 'jsqr';
import { describe, expect, it, vi } from 'vitest';
import {
  composeTargetQrPixels,
  createTargetQrArtifact,
  downloadTargetQrArtifact,
  targetQrAssetUrls,
  targetQrFilename,
  type RgbaImage,
} from '../src/app/targetQrCode';

describe('branded target QR artifacts', () => {
  it('uses base-aware URLs for both exact supplied logos', () => {
    expect(targetQrAssetUrls('/Mark-AR/')).toEqual({
      centerLogoUrl: '/Mark-AR/brand/qr/00-arvenilo-master-transparent-logo-QR.png',
      footerLogoUrl: '/Mark-AR/brand/qr/04-anchorar-platform-transparent-QR.png',
    });
    expect(targetQrAssetUrls('/Mark-AR')).toEqual({
      centerLogoUrl: '/Mark-AR/brand/qr/00-arvenilo-master-transparent-logo-QR.png',
      footerLogoUrl: '/Mark-AR/brand/qr/04-anchorar-platform-transparent-QR.png',
    });
  });

  it('keeps both tracked source assets at their approved dimensions', () => {
    expect(readPngSize('public/brand/qr/00-arvenilo-master-transparent-logo-QR.png')).toEqual([305, 249]);
    expect(readPngSize('public/brand/qr/04-anchorar-platform-transparent-QR.png')).toEqual([1558, 283]);
  });

  it('composes a branded square image that decodes to the exact target URL', () => {
    const scanUrl = 'https://example.com/Mark-AR/#/scan/scan%20target';
    const image = composeTargetQrPixels(
      scanUrl,
      fakeLogo(305, 249, [2, 42, 48, 255]),
      fakeLogo(1558, 283, [2, 42, 48, 255]),
    );
    const decoded = jsQR(image.data, image.width, image.height, {
      inversionAttempts: 'dontInvert',
    });

    expect([image.width, image.height]).toEqual([1200, 1200]);
    expect(decoded?.data).toBe(scanUrl);
    expect(image.layout.errorCorrectionLevel).toBe('H');
    expect(image.layout.quietModules).toBe(4);
    expect(image.layout.qr.width).toBeLessThanOrEqual(900);
    expect(image.layout.qr.height).toBeLessThanOrEqual(900);
    expect(image.layout.centerLogo.width).toBeLessThanOrEqual(image.layout.qr.width * 0.16);
    expect(image.layout.centerBadge.x).toBeGreaterThan(image.layout.qr.x);
    expect(image.layout.centerBadge.y).toBeGreaterThan(image.layout.qr.y);
    expect(image.layout.footerLogo.y).toBeGreaterThan(
      image.layout.qr.y + image.layout.qr.height,
    );
    expect(pixelAt(image, image.layout.qr.x, image.layout.qr.y)).toEqual([255, 255, 255, 255]);
  });

  it('creates filesystem-safe AnchorAR filenames with a target fallback', () => {
    expect(targetQrFilename('Product Marker 01', 'target-1')).toBe('anchorar-product-marker-01-qr.png');
    expect(targetQrFilename('  Café launch  ', 'target-1')).toBe('anchorar-cafe-launch-qr.png');
    expect(targetQrFilename('***', 'Target ABC')).toBe('anchorar-target-abc-qr.png');
  });

  it('loads both logos, composes the PNG, and returns its download name', async () => {
    const centerLogo = fakeLogo(305, 249, [2, 42, 48, 255]);
    const footerLogo = fakeLogo(1558, 283, [2, 42, 48, 255]);
    const blob = new Blob(['png'], { type: 'image/png' });
    const loadImage = vi.fn(async (url: string) => (
      url.includes('/00-') ? centerLogo : footerLogo
    ));
    const encodePng = vi.fn(async () => blob);

    const artifact = await createTargetQrArtifact(
      {
        scanUrl: 'https://example.com/Mark-AR/#/scan/one',
        label: 'Product marker',
        targetId: 'target-one',
      },
      {
        baseUrl: '/Mark-AR/',
        loadImage,
        encodePng,
      },
    );

    expect(loadImage.mock.calls.map(([url]) => url)).toEqual([
      '/Mark-AR/brand/qr/00-arvenilo-master-transparent-logo-QR.png',
      '/Mark-AR/brand/qr/04-anchorar-platform-transparent-QR.png',
    ]);
    expect(encodePng).toHaveBeenCalledWith(expect.objectContaining({
      width: 1200,
      height: 1200,
    }));
    expect(artifact).toEqual({
      blob,
      filename: 'anchorar-product-marker-qr.png',
    });
  });

  it('triggers one browser download and revokes its object URL after use', () => {
    const click = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:target-qr');
    const revokeObjectURL = vi.fn();
    const scheduleCleanup = vi.fn((cleanup: () => void) => cleanup());
    const anchor = {
      href: '',
      download: '',
      click,
    } as unknown as HTMLAnchorElement;

    downloadTargetQrArtifact(
      {
        blob: new Blob(['png'], { type: 'image/png' }),
        filename: 'anchorar-product-marker-qr.png',
      },
      {
        createObjectURL,
        revokeObjectURL,
        createAnchor: () => anchor,
        scheduleCleanup,
      },
    );

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(anchor.href).toBe('blob:target-qr');
    expect(anchor.download).toBe('anchorar-product-marker-qr.png');
    expect(click).toHaveBeenCalledOnce();
    expect(scheduleCleanup).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:target-qr');
  });
});

function readPngSize(path: string): [number, number] {
  const png = readFileSync(path);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

function fakeLogo(
  width: number,
  height: number,
  color: [number, number, number, number],
): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  const insetX = Math.floor(width * 0.12);
  const insetY = Math.floor(height * 0.12);

  for (let y = insetY; y < height - insetY; y += 1) {
    for (let x = insetX; x < width - insetX; x += 1) {
      const index = (y * width + x) * 4;
      data[index] = color[0];
      data[index + 1] = color[1];
      data[index + 2] = color[2];
      data[index + 3] = color[3];
    }
  }

  return { width, height, data };
}

function pixelAt(image: RgbaImage, x: number, y: number): [number, number, number, number] {
  const index = (y * image.width + x) * 4;
  return [
    image.data[index],
    image.data[index + 1],
    image.data[index + 2],
    image.data[index + 3],
  ];
}

import { describe, expect, it, vi } from 'vitest';
import {
  shareTargetQrArtifact,
  type TargetQrShareInput,
} from '../src/app/targetQrShare';

const scanUrl = 'https://example.com/Mark-AR/#/scan/scan-one';

function createInput(): TargetQrShareInput {
  return {
    artifact: {
      blob: new Blob(['png'], { type: 'image/png' }),
      filename: 'anchorar-product-marker-qr.png',
    },
    targetLabel: 'Product marker',
    scanUrl,
    download: vi.fn(),
    copy: vi.fn(async () => undefined),
  };
}

describe('target QR sharing', () => {
  it('shares a PNG file and repeats the exact URL in text and url fields', async () => {
    const input = createInput();
    const share = vi.fn(async (_data: ShareData) => undefined);
    const canShare = vi.fn((_data: ShareData) => true);

    const result = await shareTargetQrArtifact(input, { share, canShare });

    expect(result).toBe('shared');
    expect(canShare).toHaveBeenCalledWith({ files: [expect.any(File)] });
    expect(share).toHaveBeenCalledOnce();
    const payload = share.mock.calls[0][0];
    expect(payload.title).toBe('AnchorAR \u2014 Product marker');
    expect(payload.text).toBe(`Scan this QR code to open the AR experience: ${scanUrl}`);
    expect(payload.url).toBe(scanUrl);
    expect(payload.files).toHaveLength(1);
    expect(payload.files?.[0].name).toBe('anchorar-product-marker-qr.png');
    expect(payload.files?.[0].type).toBe('image/png');
    expect(input.download).not.toHaveBeenCalled();
    expect(input.copy).not.toHaveBeenCalled();
  });

  it('downloads and copies when native file sharing is unsupported', async () => {
    const input = createInput();
    const share = vi.fn(async (_data: ShareData) => undefined);

    const result = await shareTargetQrArtifact(input, {
      share,
      canShare: vi.fn(() => false),
    });

    expect(result).toBe('downloaded-and-copied');
    expect(input.download).toHaveBeenCalledWith(input.artifact);
    expect(input.copy).toHaveBeenCalledWith(scanUrl);
    expect(share).not.toHaveBeenCalled();
  });

  it('uses fallback when capability detection throws', async () => {
    const input = createInput();

    const result = await shareTargetQrArtifact(input, {
      share: vi.fn(async (_data: ShareData) => undefined),
      canShare: vi.fn(() => {
        throw new Error('capability unavailable');
      }),
    });

    expect(result).toBe('downloaded-and-copied');
    expect(input.download).toHaveBeenCalledOnce();
    expect(input.copy).toHaveBeenCalledWith(scanUrl);
  });

  it('treats AbortError as cancellation without fallback', async () => {
    const input = createInput();

    const result = await shareTargetQrArtifact(input, {
      share: vi.fn(async () => {
        throw new DOMException('Share cancelled', 'AbortError');
      }),
      canShare: vi.fn(() => true),
    });

    expect(result).toBe('cancelled');
    expect(input.download).not.toHaveBeenCalled();
    expect(input.copy).not.toHaveBeenCalled();
  });

  it('reports native share failures without invoking fallback', async () => {
    const input = createInput();

    const result = await shareTargetQrArtifact(input, {
      share: vi.fn(async () => {
        throw new Error('share target failed');
      }),
      canShare: vi.fn(() => true),
    });

    expect(result).toBe('failed');
    expect(input.download).not.toHaveBeenCalled();
    expect(input.copy).not.toHaveBeenCalled();
  });

  it('reports a partial fallback when the image downloads but copying fails', async () => {
    const input = createInput();
    input.copy = vi.fn(async () => {
      throw new Error('clipboard denied');
    });

    const result = await shareTargetQrArtifact(input, {
      share: null,
      canShare: null,
    });

    expect(result).toBe('downloaded-copy-failed');
    expect(input.download).toHaveBeenCalledWith(input.artifact);
    expect(input.copy).toHaveBeenCalledWith(scanUrl);
  });
});

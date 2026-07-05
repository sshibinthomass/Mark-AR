import { describe, expect, it, vi } from 'vitest';
import { ImageTargetPreview } from '../src/scene/ImageTargetPreview';

describe('ImageTargetPreview', () => {
  it('mounts a renderer and disposes it cleanly with injected dependencies', () => {
    const container = document.createElement('div');
    const rendererElement = document.createElement('canvas');
    const renderer = {
      domElement: rendererElement,
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    };

    const preview = new ImageTargetPreview(container, {
      createRenderer: () => renderer,
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
      loadModel: vi.fn(async () => undefined),
      loadTexture: vi.fn(async () => undefined),
    });

    expect(container.contains(rendererElement)).toBe(true);
    preview.dispose();
    expect(renderer.dispose).toHaveBeenCalled();
    expect(container.contains(rendererElement)).toBe(false);
  });
});

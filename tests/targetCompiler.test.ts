import { describe, expect, it, vi } from 'vitest';
import { AR_MARKERS } from '../src/ar/markerCatalog';
import { compileMarkerTargets } from '../src/ar/targetCompiler';

describe('compileMarkerTargets', () => {
  it('loads marker images in target order and returns a disposable object url', async () => {
    const loadedPaths: string[] = [];
    const progressValues: number[] = [];
    const compiledImages: HTMLImageElement[][] = [];
    const exported = new Uint8Array([1, 2, 3, 4]).buffer;
    const revokeObjectUrl = vi.fn();

    class FakeCompiler {
      async compileImageTargets(
        images: HTMLImageElement[],
        onProgress: (percent: number) => void,
      ): Promise<void> {
        compiledImages.push(images);
        onProgress(24.5);
        onProgress(100);
      }

      exportData(): ArrayBuffer {
        return exported;
      }
    }

    const result = await compileMarkerTargets(AR_MARKERS, {
      Compiler: FakeCompiler,
      createObjectUrl: () => 'blob:mark-ar-targets',
      loadImage: async (path) => {
        loadedPaths.push(path);
        const img = document.createElement('img');
        img.dataset.source = path;
        return img;
      },
      onProgress: (percent) => progressValues.push(percent),
      revokeObjectUrl,
    });

    expect(loadedPaths).toEqual(['/markers/aurora-gate.svg', '/markers/orbit-key.svg']);
    expect(compiledImages[0].map((image) => image.dataset.source)).toEqual(loadedPaths);
    expect(progressValues).toEqual([24.5, 100]);
    expect(result.imageTargetSrc).toBe('blob:mark-ar-targets');
    expect(result.targetCount).toBe(2);

    result.dispose();

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:mark-ar-targets');
  });
});

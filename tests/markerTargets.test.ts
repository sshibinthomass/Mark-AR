import { describe, expect, it } from 'vitest';
import { AR_MARKERS } from '../src/ar/markerCatalog';
import { createRuntimeMarkerTargets } from '../src/ar/markerTargets';

describe('marker target mapping', () => {
  it('combines built-in markers and cloud image targets with sequential target indices', () => {
    const targets = createRuntimeMarkerTargets({
      builtInMarkers: AR_MARKERS,
      cloudTargets: [
        {
          id: 'cloud-1',
          label: 'Product box',
          imageUrl: 'https://worker.example/image-targets/images/cloud-1.jpg',
          imageObjectKey: 'image-targets/images/cloud-1.jpg',
          model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
          placement: { scale: 1.2, offsetX: 0.1, offsetY: -0.2, height: 0.16 },
          objects: [
            {
              id: 'object-chair',
              model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
              placement: { scale: 1.2, offsetX: 0.1, offsetY: -0.2, height: 0.16 },
            },
            {
              id: 'object-plant',
              model: { id: 'generated-plant', label: 'Plant', url: 'https://worker.example/plant.glb' },
              placement: { scale: 0.8, offsetX: -0.3, offsetY: 0.2, height: 0.08 },
            },
          ],
        },
      ],
    });

    expect(targets.map((target) => target.marker.targetIndex)).toEqual([0, 1, 2]);
    expect(targets.at(-1)).toMatchObject({
      marker: {
        id: 'cloud-cloud-1',
        label: 'Product box',
        targetIndex: 2,
        imagePath: 'https://worker.example/image-targets/images/cloud-1.jpg',
      },
      cloudflareAsset: {
        model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
        placement: { scale: 1.2, offsetX: 0.1, offsetY: -0.2, height: 0.16 },
        objects: [
          {
            id: 'object-chair',
            model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
            placement: { scale: 1.2, offsetX: 0.1, offsetY: -0.2, height: 0.16 },
          },
          {
            id: 'object-plant',
            model: { id: 'generated-plant', label: 'Plant', url: 'https://worker.example/plant.glb' },
            placement: { scale: 0.8, offsetX: -0.3, offsetY: 0.2, height: 0.08 },
          },
        ],
      },
    });
  });
});

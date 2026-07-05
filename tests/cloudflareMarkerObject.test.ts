import { describe, expect, it } from 'vitest';
import { Group, Mesh } from 'three';
import { createCloudflareMarkerObject } from '../src/ar/cloudflareMarkerObject';

describe('createCloudflareMarkerObject', () => {
  it('places the processed base plane and loads the selected Cloudflare model above it', async () => {
    const loadedModel = new Group();
    loadedModel.name = 'loaded-chair';

    const markerObject = createCloudflareMarkerObject({
      model: {
        id: 'generated-chair',
        label: 'Chair',
        url: 'https://worker.example/models/chair.glb',
      },
      baseImage: {
        imageBase64: 'processed-image',
        imageMimeType: 'image/png',
      },
      loadModelGroup: async () => loadedModel,
    });

    await Promise.resolve();

    const basePlane = markerObject.group.getObjectByName('processed-base-plane');
    const modelRoot = markerObject.group.getObjectByName('cloudflare-model-root') as Group;

    expect(markerObject.group.name).toBe('cloudflare-model-object');
    expect(basePlane).toBeInstanceOf(Mesh);
    expect(modelRoot.children).toContain(loadedModel);
    expect(modelRoot.position.z).toBeGreaterThan(0);
  });
});

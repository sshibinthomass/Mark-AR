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

  it('loads multiple placed Cloudflare models above one base plane', async () => {
    const chairModel = new Group();
    chairModel.name = 'loaded-chair';
    const plantModel = new Group();
    plantModel.name = 'loaded-plant';
    const loadedModels = [chairModel, plantModel];

    const markerObject = createCloudflareMarkerObject({
      objects: [
        {
          id: 'chair-object',
          model: {
            id: 'generated-chair',
            label: 'Chair',
            url: 'https://worker.example/models/chair.glb',
          },
          placement: { scale: 1.2, offsetX: 0.15, offsetY: -0.2, height: 0.16 },
        },
        {
          id: 'plant-object',
          model: {
            id: 'generated-plant',
            label: 'Plant',
            url: 'https://worker.example/models/plant.glb',
          },
          placement: { scale: 0.8, offsetX: -0.2, offsetY: 0.1, height: 0.08 },
        },
      ],
      baseImage: {
        imageBase64: 'processed-image',
        imageMimeType: 'image/png',
      },
      loadModelGroup: async () => loadedModels.shift() ?? new Group(),
    });

    await Promise.resolve();
    await Promise.resolve();

    const chairRoot = markerObject.group.getObjectByName('cloudflare-model-root-chair-object') as Group;
    const plantRoot = markerObject.group.getObjectByName('cloudflare-model-root-plant-object') as Group;

    expect(markerObject.group.getObjectByName('processed-base-plane')).toBeInstanceOf(Mesh);
    expect(chairRoot.children).toContain(chairModel);
    expect(chairRoot.position.x).toBeCloseTo(0.15);
    expect(chairRoot.position.y).toBeCloseTo(-0.2);
    expect(chairRoot.position.z).toBeCloseTo(0.16);
    expect(chairRoot.scale.x).toBeCloseTo(1.2);
    expect(plantRoot.children).toContain(plantModel);
    expect(plantRoot.position.x).toBeCloseTo(-0.2);
    expect(plantRoot.position.y).toBeCloseTo(0.1);
    expect(plantRoot.position.z).toBeCloseTo(0.08);
    expect(plantRoot.scale.x).toBeCloseTo(0.8);
  });
});

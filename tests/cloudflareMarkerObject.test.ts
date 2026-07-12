import { describe, expect, it } from 'vitest';
import { Group } from 'three';
import { createCloudflareMarkerObject } from '../src/ar/cloudflareMarkerObject';

describe('createCloudflareMarkerObject', () => {
  it('loads the selected Cloudflare model into a marker object', async () => {
    const loadedModel = new Group();
    loadedModel.name = 'loaded-chair';

    const markerObject = createCloudflareMarkerObject({
      model: {
        id: 'generated-chair',
        label: 'Chair',
        url: 'https://worker.example/models/chair.glb',
      },
      loadModelGroup: async () => loadedModel,
    });

    await Promise.resolve();

    const modelRoot = markerObject.group.getObjectByName('cloudflare-model-root') as Group;

    expect(markerObject.group.name).toBe('cloudflare-model-object');
    expect(markerObject.group.getObjectByName('processed-base-plane')).toBeUndefined();
    expect(modelRoot.children).toContain(loadedModel);
    expect(modelRoot.position.z).toBeGreaterThan(0);
  });

  it('loads multiple placed Cloudflare models', async () => {
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
          placement: { scale: 1.2, offsetX: 0.15, offsetY: -0.2, height: 0.16, rotationX: 0, rotationY: 30, rotationZ: 0 },
        },
        {
          id: 'plant-object',
          model: {
            id: 'generated-plant',
            label: 'Plant',
            url: 'https://worker.example/models/plant.glb',
          },
          placement: { scale: 0.8, offsetX: -0.2, offsetY: 0.1, height: 0.08, rotationX: -15, rotationY: 0, rotationZ: 45 },
        },
      ],
      loadModelGroup: async () => loadedModels.shift() ?? new Group(),
    });

    await Promise.resolve();
    await Promise.resolve();

    const chairRoot = markerObject.group.getObjectByName('cloudflare-model-root-chair-object') as Group;
    const plantRoot = markerObject.group.getObjectByName('cloudflare-model-root-plant-object') as Group;

    expect(markerObject.group.getObjectByName('processed-base-plane')).toBeUndefined();
    expect(chairRoot.children).toContain(chairModel);
    expect(chairRoot.position.x).toBeCloseTo(0.15);
    expect(chairRoot.position.y).toBeCloseTo(-0.2);
    expect(chairRoot.position.z).toBeCloseTo(0.16);
    expect(chairRoot.scale.x).toBeCloseTo(1.2);
    expect(chairRoot.rotation.y).toBeCloseTo(Math.PI / 6);
    expect(plantRoot.children).toContain(plantModel);
    expect(plantRoot.position.x).toBeCloseTo(-0.2);
    expect(plantRoot.position.y).toBeCloseTo(0.1);
    expect(plantRoot.position.z).toBeCloseTo(0.08);
    expect(plantRoot.scale.x).toBeCloseTo(0.8);
    expect(plantRoot.rotation.x).toBeCloseTo(-Math.PI / 12);
    expect(plantRoot.rotation.z).toBeCloseTo(Math.PI / 4);
  });

  it('applies per-object spin and bob animation in the AR runtime', async () => {
    const loadedModel = new Group();

    const markerObject = createCloudflareMarkerObject({
      objects: [
        {
          id: 'animated-object',
          model: {
            id: 'generated-lamp',
            label: 'Lamp',
            url: 'https://worker.example/models/lamp.glb',
          },
          placement: { scale: 1, offsetX: 0, offsetY: 0.1, height: 0.2 },
          animation: { spinAxis: 'y', spinSpeed: 2, bobHeight: 0.1, bobSpeed: Math.PI },
        },
      ],
      loadModelGroup: async () => loadedModel,
    });

    await Promise.resolve();
    markerObject.update(0.5);

    const modelRoot = markerObject.group.getObjectByName('cloudflare-model-root-animated-object') as Group;
    expect(modelRoot.rotation.y).toBeCloseTo(1);
    expect(modelRoot.position.x).toBeCloseTo(0);
    expect(modelRoot.position.y).toBeCloseTo(0.1);
    expect(modelRoot.position.z).toBeCloseTo(0.3);
  });

  it('renders local text objects in AR without loading a GLB', async () => {
    const textGroup = new Group();
    textGroup.name = 'local-text-3d-object';
    const loadModelGroup = async () => {
      throw new Error('text should not load a GLB');
    };

    const markerObject = createCloudflareMarkerObject({
      objects: [
        {
          kind: 'text',
          id: 'text-object',
          text: { value: 'வணக்கம் AR', language: 'tamil', font: 'tamil-ui' },
          placement: { scale: 1.1, offsetX: 0.25, offsetY: -0.1, height: 0.22, rotationX: 0, rotationY: 15, rotationZ: 0 },
        },
      ],
      loadModelGroup,
      createTextObject: () => textGroup,
    });

    const textRoot = markerObject.group.getObjectByName('cloudflare-model-root-text-object') as Group;

    expect(textRoot.children).toContain(textGroup);
    expect(textRoot.position.x).toBeCloseTo(0.25);
    expect(textRoot.position.y).toBeCloseTo(-0.1);
    expect(textRoot.position.z).toBeCloseTo(0.22);
    expect(textRoot.rotation.y).toBeCloseTo(Math.PI / 12);
  });
});

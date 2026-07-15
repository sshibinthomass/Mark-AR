import { describe, expect, it, vi } from 'vitest';
import {
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';
import { createCloudflareMarkerObject } from '../src/ar/cloudflareMarkerObject';

describe('createCloudflareMarkerObject', () => {
  it('preserves the complete preview transform beneath one MindAR basis', async () => {
    const textModel = new Group();
    const markerObject = createCloudflareMarkerObject({
      groups: [{
        id: 'room',
        label: 'Room',
        placement: {
          scale: 1.2,
          offsetX: 0.3,
          offsetY: -0.25,
          height: 0.4,
          rotationX: 10,
          rotationY: 20,
          rotationZ: 30,
        },
      }],
      objects: [
        {
          id: 'chair',
          model: { id: 'chair', label: 'Chair', url: 'chair.glb' },
          groupId: 'room',
          localPlacement: {
            scale: 0.8,
            offsetX: -0.2,
            offsetY: 0.15,
            height: 0.1,
            rotationX: -15,
            rotationY: 25,
            rotationZ: 40,
          },
          placement: {
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            height: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
          },
        },
        {
          kind: 'text',
          id: 'title',
          text: { value: 'Exact AR', language: 'english', font: 'studio-sans' },
          placement: {
            scale: 1.1,
            offsetX: 0.25,
            offsetY: -0.1,
            height: 0.22,
            rotationX: 5,
            rotationY: 15,
            rotationZ: -10,
          },
        },
      ],
      loadModelGroup: async () => new Group(),
      createTextObject: () => textModel,
    });
    await Promise.resolve();

    const previewSpace = markerObject.group.getObjectByName('cloudflare-preview-space') as Group;
    const groupRoot = markerObject.group.getObjectByName('cloudflare-group-root-room') as Group;
    const chairRoot = markerObject.group.getObjectByName('cloudflare-model-root-chair') as Group;
    const textRoot = markerObject.group.getObjectByName('cloudflare-model-root-title') as Group;

    expect(previewSpace?.parent).toBe(markerObject.group);
    expect(previewSpace?.rotation.x).toBeCloseTo(Math.PI / 2);
    expect(groupRoot.parent).toBe(previewSpace);
    expect(chairRoot.parent).toBe(groupRoot);
    expect(textRoot.parent).toBe(previewSpace);
    expect(groupRoot.position.toArray()).toEqual([0.3, 0.4, -0.25]);
    expect(chairRoot.position.toArray()).toEqual([-0.2, 0.1, 0.15]);
    expect(textRoot.position.toArray()).toEqual([0.25, 0.22, -0.1]);

    markerObject.group.updateMatrixWorld(true);
    const authoredTextMatrix = new Matrix4().compose(
      new Vector3(0.25, 0.22, -0.1),
      new Quaternion().setFromEuler(new Euler(5 * Math.PI / 180, 15 * Math.PI / 180, -10 * Math.PI / 180)),
      new Vector3(1.1, 1.1, 1.1),
    );
    const expectedTextWorld = new Matrix4()
      .makeRotationX(Math.PI / 2)
      .multiply(authoredTextMatrix);

    const authoredGroupMatrix = new Matrix4().compose(
      new Vector3(0.3, 0.4, -0.25),
      new Quaternion().setFromEuler(new Euler(10 * Math.PI / 180, 20 * Math.PI / 180, 30 * Math.PI / 180)),
      new Vector3(1.2, 1.2, 1.2),
    );
    const authoredChairMatrix = new Matrix4().compose(
      new Vector3(-0.2, 0.1, 0.15),
      new Quaternion().setFromEuler(new Euler(-15 * Math.PI / 180, 25 * Math.PI / 180, 40 * Math.PI / 180)),
      new Vector3(0.8, 0.8, 0.8),
    );
    const expectedChairWorld = new Matrix4()
      .makeRotationX(Math.PI / 2)
      .multiply(authoredGroupMatrix)
      .multiply(authoredChairMatrix);

    textRoot.matrixWorld.elements.forEach((value, index) => {
      expect(value).toBeCloseTo(expectedTextWorld.elements[index]);
    });
    chairRoot.matrixWorld.elements.forEach((value, index) => {
      expect(value).toBeCloseTo(expectedChairWorld.elements[index]);
    });
  });

  it('renders group roots with shared animation and additive child animation', async () => {
    const loadedModels = [new Group(), new Group(), new Group()];
    const markerObject = createCloudflareMarkerObject({
      groups: [{
        id: 'room', label: 'Room',
        placement: { scale: 1.5, offsetX: 0.2, offsetY: -0.1, height: 0.3, rotationX: 0, rotationY: 30, rotationZ: 0 },
        animation: { preset: 'custom', tracks: [{ property: 'positionY', motion: 'smooth', amount: 0.1, speed: 0.5, phase: 0 }] },
      }],
      objects: [
        {
          id: 'chair-object', model: { id: 'chair', label: 'Chair', url: 'chair.glb' }, groupId: 'room',
          localPlacement: { scale: 1, offsetX: -0.2, offsetY: 0, height: 0, rotationX: 0, rotationY: 0, rotationZ: 0 },
          placement: { scale: 1.5, offsetX: -0.1, offsetY: -0.1, height: 0.3, rotationX: 0, rotationY: 30, rotationZ: 0 },
          animation: { preset: 'custom', tracks: [{ property: 'rotationZ', motion: 'smooth', amount: 30, speed: 0.5, phase: 0 }] },
        },
        {
          id: 'lamp-object', model: { id: 'lamp', label: 'Lamp', url: 'lamp.glb' }, groupId: 'room',
          localPlacement: { scale: 0.8, offsetX: 0.2, offsetY: 0, height: 0.1, rotationX: 0, rotationY: 0, rotationZ: 0 },
          placement: { scale: 1.2, offsetX: 0.5, offsetY: -0.1, height: 0.45, rotationX: 0, rotationY: 30, rotationZ: 0 },
        },
        {
          id: 'orphan-object', model: { id: 'plant', label: 'Plant', url: 'plant.glb' }, groupId: 'missing',
          localPlacement: { scale: 1, offsetX: 9, offsetY: 9, height: 9, rotationX: 0, rotationY: 0, rotationZ: 0 },
          placement: { scale: 0.7, offsetX: -0.4, offsetY: 0.2, height: 0.05, rotationX: 0, rotationY: 0, rotationZ: 0 },
        },
      ],
      loadModelGroup: async () => loadedModels.shift() ?? new Group(),
    });
    await Promise.resolve();
    await Promise.resolve();

    const groupRoot = markerObject.group.getObjectByName('cloudflare-group-root-room') as Group;
    const chairRoot = markerObject.group.getObjectByName('cloudflare-model-root-chair-object') as Group;
    const lampRoot = markerObject.group.getObjectByName('cloudflare-model-root-lamp-object') as Group;
    const orphanRoot = markerObject.group.getObjectByName('cloudflare-model-root-orphan-object') as Group;
    const previewSpace = markerObject.group.getObjectByName('cloudflare-preview-space') as Group;
    expect(groupRoot).toBeTruthy();
    expect(groupRoot.position.x).toBeCloseTo(0.2);
    expect(groupRoot.position.y).toBeCloseTo(0.3);
    expect(groupRoot.position.z).toBeCloseTo(-0.1);
    expect(groupRoot.scale.x).toBeCloseTo(1.5);
    expect(chairRoot.parent).toBe(groupRoot);
    expect(lampRoot.parent).toBe(groupRoot);
    expect(chairRoot.position.x).toBeCloseTo(-0.2);
    expect(lampRoot.position.y).toBeCloseTo(0.1);
    expect(lampRoot.position.z).toBeCloseTo(0);
    expect(orphanRoot.parent).toBe(previewSpace);
    expect(orphanRoot.position.x).toBeCloseTo(-0.4);
    expect(orphanRoot.position.y).toBeCloseTo(0.05);
    expect(orphanRoot.position.z).toBeCloseTo(0.2);

    markerObject.update(0.5);
    expect(groupRoot.position.y).toBeCloseTo(0.4);
    expect(groupRoot.position.z).toBeCloseTo(-0.1);
    expect(chairRoot.rotation.y).toBeCloseTo(0);
    expect(chairRoot.rotation.z).toBeCloseTo(Math.PI / 6);
    expect(lampRoot.rotation.z).toBeCloseTo(0);
  });

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
    expect(modelRoot.parent?.name).toBe('cloudflare-preview-space');
    expect(modelRoot.position.y).toBeGreaterThan(0);
    expect(modelRoot.position.z).toBeCloseTo(0);
  });

  it('keeps the model-load fallback facing out of the target at its original clearance', async () => {
    const markerObject = createCloudflareMarkerObject({
      model: {
        id: 'missing-model',
        label: 'Missing model',
        url: 'https://worker.example/models/missing.glb',
      },
      loadModelGroup: async () => {
        throw new Error('model unavailable');
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    markerObject.group.updateMatrixWorld(true);

    const fallbackPlane = markerObject.group.getObjectByName('model-load-fallback-plane') as Mesh;
    const worldPosition = fallbackPlane.getWorldPosition(new Vector3());
    const worldNormal = new Vector3(0, 0, 1).applyQuaternion(
      fallbackPlane.getWorldQuaternion(new Quaternion()),
    );

    expect(worldPosition.x).toBeCloseTo(0);
    expect(worldPosition.y).toBeCloseTo(0);
    expect(worldPosition.z).toBeCloseTo(0.12);
    expect(worldNormal.x).toBeCloseTo(0);
    expect(worldNormal.y).toBeCloseTo(0);
    expect(worldNormal.z).toBeCloseTo(1);
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
    expect(chairRoot.position.y).toBeCloseTo(0.16);
    expect(chairRoot.position.z).toBeCloseTo(-0.2);
    expect(chairRoot.scale.x).toBeCloseTo(1.2);
    expect(chairRoot.rotation.y).toBeCloseTo(Math.PI / 6);
    expect(plantRoot.children).toContain(plantModel);
    expect(plantRoot.position.x).toBeCloseTo(-0.2);
    expect(plantRoot.position.y).toBeCloseTo(0.08);
    expect(plantRoot.position.z).toBeCloseTo(0.1);
    expect(plantRoot.scale.x).toBeCloseTo(0.8);
    expect(plantRoot.rotation.x).toBeCloseTo(-Math.PI / 12);
    expect(plantRoot.rotation.z).toBeCloseTo(Math.PI / 4);
  });

  it('applies animation tracks relative to the saved preview placement without drift', async () => {
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
          placement: {
            scale: 2,
            offsetX: 0.2,
            offsetY: 0.1,
            height: 0.3,
            rotationX: 10,
            rotationY: 20,
            rotationZ: 30,
          },
          animation: {
            preset: 'custom',
            tracks: [
              { property: 'positionX', motion: 'smooth', amount: 0.4, speed: 0.5, phase: 0 },
              { property: 'rotationZ', motion: 'smooth', amount: 30, speed: 0.5, phase: 0 },
              { property: 'scale', motion: 'smooth', amount: 0.25, speed: 0.5, phase: 0 },
            ],
          },
        },
      ],
      loadModelGroup: async () => loadedModel,
    });

    await Promise.resolve();
    markerObject.update(0.5);

    const modelRoot = markerObject.group.getObjectByName('cloudflare-model-root-animated-object') as Group;
    expect(modelRoot.position.x).toBeCloseTo(0.6);
    expect(modelRoot.position.y).toBeCloseTo(0.3);
    expect(modelRoot.position.z).toBeCloseTo(0.1);
    expect(modelRoot.rotation.x).toBeCloseTo(Math.PI / 18);
    expect(modelRoot.rotation.y).toBeCloseTo(Math.PI / 9);
    expect(modelRoot.rotation.z).toBeCloseTo(Math.PI / 3);
    expect(modelRoot.scale.x).toBeCloseTo(2.5);

    markerObject.update(0.5);

    expect(modelRoot.position.x).toBeCloseTo(0.2);
    expect(modelRoot.rotation.y).toBeCloseTo(Math.PI / 9);
    expect(modelRoot.rotation.z).toBeCloseTo(Math.PI / 6);
    expect(modelRoot.scale.x).toBeCloseTo(2);
  });

  it('keeps turntable and position tracks in preview axes under the MindAR basis', async () => {
    const markerObject = createCloudflareMarkerObject({
      objects: [
        {
          id: 'turntable-object',
          model: {
            id: 'chair',
            label: 'Chair',
            url: 'https://worker.example/models/chair.glb',
          },
          placement: {
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            height: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
          },
          animation: {
            preset: 'custom',
            tracks: [
              { property: 'positionY', motion: 'smooth', amount: 0.4, speed: 0.5, phase: 0 },
              { property: 'positionZ', motion: 'smooth', amount: 0.2, speed: 0.5, phase: 0 },
              { property: 'rotationY', motion: 'spin', amount: 360, speed: 0.5, phase: 0 },
              { property: 'rotationZ', motion: 'smooth', amount: 30, speed: 0.5, phase: 0 },
            ],
          },
        },
      ],
      loadModelGroup: async () => new Group(),
    });

    await Promise.resolve();
    markerObject.update(0.5);

    const modelRoot = markerObject.group.getObjectByName('cloudflare-model-root-turntable-object') as Group;
    expect(modelRoot.parent?.name).toBe('cloudflare-preview-space');
    expect(modelRoot.position.y).toBeCloseTo(0.4);
    expect(modelRoot.position.z).toBeCloseTo(0.2);
    expect(modelRoot.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(modelRoot.rotation.z).toBeCloseTo(Math.PI / 6);
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
    expect(textRoot.parent?.name).toBe('cloudflare-preview-space');
    expect(textRoot.position.x).toBeCloseTo(0.25);
    expect(textRoot.position.y).toBeCloseTo(0.22);
    expect(textRoot.position.z).toBeCloseTo(-0.1);
    expect(textRoot.rotation.y).toBeCloseTo(Math.PI / 12);
  });

  it('delegates disposal to the shared target scene exactly once', async () => {
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial();
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const loadedModel = new Group().add(new Mesh(geometry, material));
    const markerObject = createCloudflareMarkerObject({
      model: {
        id: 'generated-chair',
        label: 'Chair',
        url: 'https://worker.example/models/chair.glb',
      },
      loadModelGroup: async () => loadedModel,
    });

    await Promise.resolve();
    markerObject.dispose?.();
    markerObject.dispose?.();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(markerObject.group.getObjectByName('cloudflare-preview-space')?.children).toHaveLength(0);
  });
});

import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Texture,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createTargetSceneObject } from '../src/ar/targetSceneObject';

describe('createTargetSceneObject', () => {
  it('builds the complete saved scene directly in Y-up space and applies authored animations', async () => {
    const textGroup = new Group();
    const scene = createTargetSceneObject({
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
        animation: {
          preset: 'custom',
          tracks: [{ property: 'positionX', motion: 'smooth', amount: 0.1, speed: 0.5, phase: 0 }],
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
          animation: {
            preset: 'custom',
            tracks: [{ property: 'positionY', motion: 'smooth', amount: 0.4, speed: 0.5, phase: 0 }],
          },
        },
        {
          kind: 'text',
          id: 'title',
          text: { value: 'Floor scene', language: 'english', font: 'studio-sans' },
          placement: {
            scale: 1.1,
            offsetX: 0.25,
            offsetY: -0.1,
            height: 0.22,
            rotationX: 5,
            rotationY: 15,
            rotationZ: -10,
          },
          animation: {
            preset: 'custom',
            tracks: [{ property: 'rotationY', motion: 'spin', amount: 360, speed: 0.5, phase: 0 }],
          },
        },
      ],
      loadModelGroup: async () => new Group(),
      createTextObject: () => textGroup,
    }, { loadMode: 'strict' });

    await scene.ready;

    const groupRoot = scene.group.getObjectByName('cloudflare-group-root-room') as Group;
    const chairRoot = scene.group.getObjectByName('cloudflare-model-root-chair') as Group;
    const titleRoot = scene.group.getObjectByName('cloudflare-model-root-title') as Group;
    expect(scene.group.name).toBe('cloudflare-target-scene');
    expect(scene.group.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    expect(groupRoot.position.toArray()).toEqual([0.3, 0.4, -0.25]);
    expect(groupRoot.scale.toArray()).toEqual([1.2, 1.2, 1.2]);
    expect(groupRoot.rotation.x).toBeCloseTo(Math.PI / 18);
    expect(groupRoot.rotation.y).toBeCloseTo(Math.PI / 9);
    expect(groupRoot.rotation.z).toBeCloseTo(Math.PI / 6);
    expect(chairRoot.parent).toBe(groupRoot);
    expect(chairRoot.position.toArray()).toEqual([-0.2, 0.1, 0.15]);
    expect(chairRoot.scale.toArray()).toEqual([0.8, 0.8, 0.8]);
    expect(chairRoot.rotation.x).toBeCloseTo(-Math.PI / 12);
    expect(chairRoot.rotation.y).toBeCloseTo(25 * Math.PI / 180);
    expect(chairRoot.rotation.z).toBeCloseTo(2 * Math.PI / 9);
    expect(titleRoot.parent).toBe(scene.group);
    expect(titleRoot.position.toArray()).toEqual([0.25, 0.22, -0.1]);
    expect(titleRoot.scale.toArray()).toEqual([1.1, 1.1, 1.1]);
    expect(titleRoot.children).toContain(textGroup);

    scene.update(0.5);

    expect(groupRoot.position.x).toBeCloseTo(0.4);
    expect(chairRoot.position.y).toBeCloseTo(0.5);
    expect(titleRoot.rotation.y).toBeCloseTo(15 * Math.PI / 180 + Math.PI / 2);
  });

  it('keeps ready pending until every model load finishes', async () => {
    let resolveChair!: (group: Group) => void;
    let resolveTable!: (group: Group) => void;
    const modelPromises = new Map([
      ['chair.glb', new Promise<Group>((resolve) => { resolveChair = resolve; })],
      ['table.glb', new Promise<Group>((resolve) => { resolveTable = resolve; })],
    ]);
    const scene = createTargetSceneObject({
      objects: [
        { id: 'chair', model: { id: 'chair', label: 'Chair', url: 'chair.glb' } },
        { id: 'table', model: { id: 'table', label: 'Table', url: 'table.glb' } },
      ],
      loadModelGroup: (url) => modelPromises.get(url)!,
    }, { loadMode: 'strict' });
    let ready = false;
    void scene.ready.then(() => { ready = true; });

    await Promise.resolve();
    expect(ready).toBe(false);
    resolveChair(new Group());
    await Promise.resolve();
    await Promise.resolve();
    expect(ready).toBe(false);
    resolveTable(new Group());
    await scene.ready;
    expect(ready).toBe(true);
  });

  it('includes prepared text geometry in ready', async () => {
    const scene = createTargetSceneObject({
      objects: [{
        kind: 'text',
        id: 'title',
        text: { value: 'Ready text', language: 'english', font: 'studio-sans' },
        placement: {
          scale: 1,
          offsetX: 0,
          offsetY: 0,
          height: 0.2,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
        },
      }],
    }, { loadMode: 'strict' });

    expect(scene.group.getObjectByName('local-text-3d-mesh')).toBeUndefined();
    await scene.ready;
    expect(scene.group.getObjectByName('local-text-3d-mesh')).toBeInstanceOf(Mesh);
  });

  it('rejects model failures in strict mode', async () => {
    const scene = createTargetSceneObject({
      model: { id: 'missing', label: 'Missing', url: 'missing.glb' },
      loadModelGroup: async () => { throw new Error('model unavailable'); },
    }, { loadMode: 'strict' });

    await expect(scene.ready).rejects.toThrow('model unavailable');
  });

  it('inserts a fallback plane when a model fails in fallback mode', async () => {
    const scene = createTargetSceneObject({
      model: { id: 'missing', label: 'Missing', url: 'missing.glb' },
      loadModelGroup: async () => { throw new Error('model unavailable'); },
    }, { loadMode: 'fallback' });

    await expect(scene.ready).resolves.toBeUndefined();
    expect(scene.group.getObjectByName('model-load-fallback-plane')).toBeInstanceOf(Mesh);
  });

  it('disposes each unique mesh resource exactly once', async () => {
    const geometry = new PlaneGeometry(1, 1);
    const texture = new Texture();
    const material = new MeshBasicMaterial({ map: texture });
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const textureDispose = vi.spyOn(texture, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const loaded = new Group();
    loaded.add(new Mesh(geometry, material), new Mesh(geometry, material));
    const scene = createTargetSceneObject({
      model: { id: 'chair', label: 'Chair', url: 'chair.glb' },
      loadModelGroup: async () => loaded,
    }, { loadMode: 'strict' });
    await scene.ready;

    scene.dispose();
    scene.dispose();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(scene.group.children).toHaveLength(0);
  });

  it('disposes a model that finishes loading after the scene was disposed', async () => {
    let resolveModel!: (group: Group) => void;
    const modelPromise = new Promise<Group>((resolve) => { resolveModel = resolve; });
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial();
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const loaded = new Group().add(new Mesh(geometry, material));
    const scene = createTargetSceneObject({
      model: { id: 'chair', label: 'Chair', url: 'chair.glb' },
      loadModelGroup: async () => modelPromise,
    }, { loadMode: 'strict' });

    scene.dispose();
    resolveModel(loaded);
    await scene.ready;

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(scene.group.children).toHaveLength(0);
  });
});

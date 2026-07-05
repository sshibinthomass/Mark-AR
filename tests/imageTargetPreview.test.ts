import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Texture } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageTargetPreview } from '../src/scene/ImageTargetPreview';

describe('ImageTargetPreview', () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  });

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

  it('binds native frame APIs to window when dependencies are not injected', () => {
    const container = document.createElement('div');
    const rendererElement = document.createElement('canvas');
    const renderer = {
      domElement: rendererElement,
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    };
    const cancelFrame = vi.fn();
    let requestFrameThis: unknown;

    window.requestAnimationFrame = function boundFrameCheck(this: unknown): number {
      requestFrameThis = this;
      return 1;
    };
    window.cancelAnimationFrame = cancelFrame;

    const preview = new ImageTargetPreview(container, {
      createRenderer: () => renderer,
      loadModel: vi.fn(async () => undefined),
      loadTexture: vi.fn(async () => undefined),
    });

    expect(requestFrameThis).toBe(window);
    preview.dispose();
    expect(cancelFrame).toHaveBeenCalledWith(1);
  });

  it('disposes replaced GPU-backed preview resources on update and dispose', async () => {
    const container = document.createElement('div');
    const renderer = {
      domElement: document.createElement('canvas'),
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    };

    const firstTexture = new Texture();
    const secondTexture = new Texture();
    const firstTextureDispose = vi.spyOn(firstTexture, 'dispose');
    const secondTextureDispose = vi.spyOn(secondTexture, 'dispose');

    const firstModel = createDisposableModel();
    const secondModel = createDisposableModel();

    const loadTexture = vi
      .fn<() => Promise<Texture | undefined>>()
      .mockResolvedValueOnce(firstTexture)
      .mockResolvedValueOnce(secondTexture);
    const loadModel = vi
      .fn<() => Promise<Group | undefined>>()
      .mockResolvedValueOnce(firstModel.group)
      .mockResolvedValueOnce(secondModel.group);

    const preview = new ImageTargetPreview(container, {
      createRenderer: () => renderer,
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
      loadTexture,
      loadModel,
    });

    await preview.update({
      imageUrl: 'blob:first',
      model: { id: 'model-1', label: 'Model 1', url: 'https://example.com/model-1.glb', visibility: 'public' },
      placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.1 },
    });

    await preview.update({
      imageUrl: 'blob:second',
      model: { id: 'model-2', label: 'Model 2', url: 'https://example.com/model-2.glb', visibility: 'public' },
      placement: { scale: 1.5, offsetX: 0.2, offsetY: -0.1, height: 0.3 },
    });

    expect(firstTextureDispose).toHaveBeenCalledTimes(1);
    expect(firstModel.geometryDispose).toHaveBeenCalledTimes(1);
    expect(firstModel.materialDispose).toHaveBeenCalledTimes(1);

    preview.dispose();

    expect(secondTextureDispose).toHaveBeenCalledTimes(1);
    expect(secondModel.geometryDispose).toHaveBeenCalledTimes(1);
    expect(secondModel.materialDispose).toHaveBeenCalledTimes(1);
  });

  it('moves a loaded model by dragging on the preview canvas', async () => {
    const container = document.createElement('div');
    Object.defineProperties(container, {
      clientWidth: { value: 500 },
      clientHeight: { value: 500 },
    });
    const rendererElement = document.createElement('canvas');
    rendererElement.setPointerCapture = vi.fn(() => {
      throw new Error('No active pointer');
    });
    rendererElement.releasePointerCapture = vi.fn(() => {
      throw new Error('No active pointer');
    });
    const renderer = {
      domElement: rendererElement,
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    };
    const placementChanges: unknown[] = [];
    const model = createDisposableModel();

    const preview = new ImageTargetPreview(container, {
      createRenderer: () => renderer,
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
      loadModel: vi.fn(async () => model.group),
      loadTexture: vi.fn(async () => undefined),
      onPlacementChange: (placement) => placementChanges.push(placement),
    });

    await preview.update({
      model: { id: 'model-1', label: 'Model 1', url: 'https://example.com/model-1.glb', visibility: 'public' },
      placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12 },
    });

    dispatchPointer(rendererElement, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 200 });
    dispatchPointer(rendererElement, 'pointermove', { pointerId: 1, clientX: 250, clientY: 150 });
    dispatchPointer(rendererElement, 'pointerup', { pointerId: 1, clientX: 250, clientY: 150 });

    expect(placementChanges.at(-1)).toMatchObject({
      objectId: 'object-1',
      placement: {
        scale: 1,
        offsetX: 0.2,
        offsetY: -0.2,
        height: 0.12,
      },
    });
    expect(model.group.position.x).toBeCloseTo(0.2);
    expect(model.group.position.z).toBeCloseTo(-0.2);

    preview.dispose();
  });

  it('scales a loaded model with a two-finger pinch on the preview canvas', async () => {
    const container = document.createElement('div');
    Object.defineProperties(container, {
      clientWidth: { value: 500 },
      clientHeight: { value: 500 },
    });
    const rendererElement = document.createElement('canvas');
    const renderer = {
      domElement: rendererElement,
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    };
    const placementChanges: unknown[] = [];
    const model = createDisposableModel();

    const preview = new ImageTargetPreview(container, {
      createRenderer: () => renderer,
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
      loadModel: vi.fn(async () => model.group),
      loadTexture: vi.fn(async () => undefined),
      onPlacementChange: (placement) => placementChanges.push(placement),
    });

    await preview.update({
      model: { id: 'model-1', label: 'Model 1', url: 'https://example.com/model-1.glb', visibility: 'public' },
      placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12 },
    });

    dispatchPointer(rendererElement, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 200 });
    dispatchPointer(rendererElement, 'pointerdown', { pointerId: 2, clientX: 300, clientY: 200 });
    dispatchPointer(rendererElement, 'pointermove', { pointerId: 2, clientX: 400, clientY: 200 });
    dispatchPointer(rendererElement, 'pointerup', { pointerId: 2, clientX: 400, clientY: 200 });
    dispatchPointer(rendererElement, 'pointerup', { pointerId: 1, clientX: 200, clientY: 200 });

    expect(placementChanges.at(-1)).toMatchObject({
      objectId: 'object-1',
      placement: {
        scale: 2,
        offsetX: 0,
        offsetY: 0,
        height: 0.12,
      },
    });
    expect(model.group.scale.x).toBeCloseTo(2);

    preview.dispose();
  });

  it('moves only the selected object when multiple preview objects are loaded', async () => {
    const container = document.createElement('div');
    Object.defineProperties(container, {
      clientWidth: { value: 500 },
      clientHeight: { value: 500 },
    });
    const rendererElement = document.createElement('canvas');
    const renderer = {
      domElement: rendererElement,
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    };
    const placementChanges: unknown[] = [];
    const chair = createDisposableModel();
    const lamp = createDisposableModel();
    const loadModel = vi
      .fn<() => Promise<Group | undefined>>()
      .mockResolvedValueOnce(chair.group)
      .mockResolvedValueOnce(lamp.group);

    const preview = new ImageTargetPreview(container, {
      createRenderer: () => renderer,
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
      loadModel,
      loadTexture: vi.fn(async () => undefined),
      onPlacementChange: (placement) => placementChanges.push(placement),
    });

    await preview.update({
      objects: [
        {
          id: 'chair-object',
          model: { id: 'chair', label: 'Chair', url: 'https://example.com/chair.glb', visibility: 'public' },
          placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12 },
        },
        {
          id: 'lamp-object',
          model: { id: 'lamp', label: 'Lamp', url: 'https://example.com/lamp.glb', visibility: 'public' },
          placement: { scale: 0.8, offsetX: 0.25, offsetY: 0.15, height: 0.2 },
        },
      ],
      selectedObjectId: 'lamp-object',
    });

    dispatchPointer(rendererElement, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 200 });
    dispatchPointer(rendererElement, 'pointermove', { pointerId: 1, clientX: 250, clientY: 150 });
    dispatchPointer(rendererElement, 'pointerup', { pointerId: 1, clientX: 250, clientY: 150 });

    const placementChange = placementChanges.at(-1) as {
      objectId: string;
      placement: { scale: number; offsetX: number; offsetY: number; height: number };
    };
    expect(placementChange.objectId).toBe('lamp-object');
    expect(placementChange.placement.scale).toBeCloseTo(0.8);
    expect(placementChange.placement.offsetX).toBeCloseTo(0.45);
    expect(placementChange.placement.offsetY).toBeCloseTo(-0.05);
    expect(placementChange.placement.height).toBeCloseTo(0.2);
    expect(chair.group.position.x).toBeCloseTo(0);
    expect(chair.group.position.z).toBeCloseTo(0);
    expect(lamp.group.position.x).toBeCloseTo(0.45);
    expect(lamp.group.position.z).toBeCloseTo(-0.05);

    preview.dispose();
  });
});

function createDisposableModel() {
  const geometry = new PlaneGeometry(1, 1);
  const material = new MeshBasicMaterial();
  const geometryDispose = vi.spyOn(geometry, 'dispose');
  const materialDispose = vi.spyOn(material, 'dispose');
  const mesh = new Mesh(geometry, material);
  const group = new Group();
  group.add(mesh);
  return { group, geometryDispose, materialDispose };
}

function dispatchPointer(
  target: HTMLElement,
  type: string,
  values: { pointerId: number; clientX: number; clientY: number },
): void {
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & typeof values;
  Object.assign(event, values);
  target.dispatchEvent(event);
}

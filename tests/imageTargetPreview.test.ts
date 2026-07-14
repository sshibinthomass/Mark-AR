import { Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Texture } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageTargetPreview, type PreviewCameraView } from '../src/scene/ImageTargetPreview';

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

  it('uses a grey editor viewport background', () => {
    const container = document.createElement('div');
    const renderer = {
      domElement: document.createElement('canvas'),
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

    const scene = (preview as unknown as { scene: { background: Color } }).scene;
    expect(scene.background.getHexString()).toBe('6b6b6b');

    preview.dispose();
  });

  it('resizes the renderer when the browser viewport changes', () => {
    let containerWidth = 714;
    let containerHeight = 554;
    const container = document.createElement('div');
    Object.defineProperties(container, {
      clientWidth: { get: () => containerWidth },
      clientHeight: { get: () => containerHeight },
    });
    const renderer = {
      domElement: document.createElement('canvas'),
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

    containerWidth = 366;
    containerHeight = 420;
    window.dispatchEvent(new Event('resize'));

    expect(renderer.setSize).toHaveBeenLastCalledWith(366, 420);

    preview.dispose();
  });

  it('selects a loaded model by clicking it in the preview canvas', async () => {
    const container = document.createElement('div');
    Object.defineProperties(container, {
      clientWidth: { value: 500 },
      clientHeight: { value: 500 },
    });
    const rendererElement = document.createElement('canvas');
    mockCanvasRect(rendererElement, { width: 500, height: 500 });
    const renderer = {
      domElement: rendererElement,
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    };
    const selectionChanges: string[] = [];
    const model = createDisposableModel();

    const preview = new ImageTargetPreview(container, {
      createRenderer: () => renderer,
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
      loadModel: vi.fn(async () => model.group),
      loadTexture: vi.fn(async () => undefined),
      onSelectionChange: (objectId) => selectionChanges.push(objectId),
    });

    await preview.update({
      objects: [
        {
          id: 'chair-object',
          model: { id: 'chair', label: 'Chair', url: 'https://example.com/chair.glb', visibility: 'public' },
          placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12 },
        },
      ],
    });

    dispatchPointer(rendererElement, 'pointerdown', { pointerId: 1, clientX: 250, clientY: 250 });
    dispatchPointer(rendererElement, 'pointerup', { pointerId: 1, clientX: 250, clientY: 250 });

    expect(selectionChanges).toEqual(['chair-object']);

    preview.dispose();
  });

  it('clears the selected object when clicking empty preview space', async () => {
    const container = document.createElement('div');
    Object.defineProperties(container, {
      clientWidth: { value: 500 },
      clientHeight: { value: 500 },
    });
    const rendererElement = document.createElement('canvas');
    mockCanvasRect(rendererElement, { width: 500, height: 500 });
    const renderer = {
      domElement: rendererElement,
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    };
    const selectionChanges: Array<string | undefined> = [];
    const model = createDisposableModel();

    const preview = new ImageTargetPreview(container, {
      createRenderer: () => renderer,
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
      loadModel: vi.fn(async () => model.group),
      loadTexture: vi.fn(async () => undefined),
      onSelectionChange: (objectId) => selectionChanges.push(objectId),
    });

    await preview.update({
      objects: [
        {
          id: 'chair-object',
          model: { id: 'chair', label: 'Chair', url: 'https://example.com/chair.glb', visibility: 'public' },
          placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12 },
        },
      ],
      selectedObjectId: 'chair-object',
    });

    dispatchPointer(rendererElement, 'pointerdown', { pointerId: 1, clientX: 20, clientY: 20 });
    dispatchPointer(rendererElement, 'pointerup', { pointerId: 1, clientX: 20, clientY: 20 });

    expect(selectionChanges).toEqual([undefined]);

    preview.dispose();
  });

  it('adds a visible target midpoint marker at the preview origin', () => {
    const container = document.createElement('div');
    const renderer = {
      domElement: document.createElement('canvas'),
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

    const scene = (preview as unknown as { scene: { getObjectByName: (name: string) => Group | undefined } }).scene;
    const marker = scene.getObjectByName('target-midpoint-marker');

    expect(marker).toBeTruthy();
    expect(marker?.position.x).toBeCloseTo(0);
    expect(marker?.position.z).toBeCloseTo(0);
    expect(marker?.children.length).toBeGreaterThanOrEqual(3);

    preview.dispose();
  });

  it('orbits the camera with a normal empty-space preview drag instead of moving the model', async () => {
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
    const cameraChanges: PreviewCameraView[] = [];
    const model = createDisposableModel();

    const preview = new ImageTargetPreview(container, {
      createRenderer: () => renderer,
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
      loadModel: vi.fn(async () => model.group),
      loadTexture: vi.fn(async () => undefined),
      onPlacementChange: (placement) => placementChanges.push(placement),
      onCameraChange: (camera) => cameraChanges.push(camera),
    });

    await preview.update({
      model: { id: 'model-1', label: 'Model 1', url: 'https://example.com/model-1.glb', visibility: 'public' },
      placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12 },
    });

    dispatchPointer(rendererElement, 'pointerdown', { pointerId: 1, clientX: 460, clientY: 460 });
    dispatchPointer(rendererElement, 'pointermove', { pointerId: 1, clientX: 560, clientY: 420 });
    dispatchPointer(rendererElement, 'pointerup', { pointerId: 1, clientX: 560, clientY: 420 });

    expect(placementChanges).toHaveLength(0);
    expect(cameraChanges.at(-1)).toMatchObject({
      yawDegrees: 45,
      height: 1.5,
    });
    expect(model.group.position.x).toBeCloseTo(0);
    expect(model.group.position.z).toBeCloseTo(0);

    preview.dispose();
  });

  it('pans and zooms the camera with Blender-style viewport gestures', async () => {
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
    const cameraChanges: PreviewCameraView[] = [];
    const model = createDisposableModel();

    const preview = new ImageTargetPreview(container, {
      createRenderer: () => renderer,
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
      loadModel: vi.fn(async () => model.group),
      loadTexture: vi.fn(async () => undefined),
      onPlacementChange: (placement) => placementChanges.push(placement),
      onCameraChange: (camera) => cameraChanges.push(camera),
    });

    await preview.update({
      model: { id: 'model-1', label: 'Model 1', url: 'https://example.com/model-1.glb', visibility: 'public' },
      placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12 },
    });

    dispatchPointer(rendererElement, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 200, shiftKey: true });
    dispatchPointer(rendererElement, 'pointermove', { pointerId: 1, clientX: 250, clientY: 170, shiftKey: true });
    dispatchPointer(rendererElement, 'pointerup', { pointerId: 1, clientX: 250, clientY: 170, shiftKey: true });

    expect(cameraChanges.at(-1)).toMatchObject({
      targetX: -0.21,
      targetHeight: -0.126,
      targetZ: 0,
    });

    dispatchWheel(rendererElement, { deltaY: -240 });

    expect(cameraChanges.at(-1)?.distance).toBeLessThan(2.1);
    expect(placementChanges).toHaveLength(0);

    preview.dispose();
  });

  it('zooms the camera with a two-pointer pinch by default', async () => {
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
    const cameraChanges: PreviewCameraView[] = [];
    const model = createDisposableModel();

    const preview = new ImageTargetPreview(container, {
      createRenderer: () => renderer,
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
      loadModel: vi.fn(async () => model.group),
      loadTexture: vi.fn(async () => undefined),
      onPlacementChange: (placement) => placementChanges.push(placement),
      onCameraChange: (camera) => cameraChanges.push(camera),
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

    expect(placementChanges).toHaveLength(0);
    expect(cameraChanges.at(-1)?.distance).toBeCloseTo(1.05);
    expect(model.group.scale.x).toBeCloseTo(1);

    preview.dispose();
  });

  it('applies Blender numeric camera shortcuts while the preview has focus', async () => {
    const container = document.createElement('div');
    const rendererElement = document.createElement('canvas');
    const renderer = {
      domElement: rendererElement,
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    };
    const cameraChanges: PreviewCameraView[] = [];

    const preview = new ImageTargetPreview(container, {
      createRenderer: () => renderer,
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
      loadModel: vi.fn(async () => undefined),
      loadTexture: vi.fn(async () => undefined),
      onCameraChange: (camera) => cameraChanges.push(camera),
    });

    dispatchKeyboard(rendererElement, 'keydown', { key: '7' });

    expect(cameraChanges.at(-1)).toMatchObject({
      distance: 0.9,
      height: 3,
      yawDegrees: 0,
    });

    preview.dispose();
  });

  it('moves a loaded model with explicit Alt-drag transform on the preview canvas', async () => {
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

    dispatchPointer(rendererElement, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 200, altKey: true });
    dispatchPointer(rendererElement, 'pointermove', { pointerId: 1, clientX: 250, clientY: 150, altKey: true });
    dispatchPointer(rendererElement, 'pointerup', { pointerId: 1, clientX: 250, clientY: 150, altKey: true });

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

  it('applies placement rotation and updates it from a direct rotate drag', async () => {
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
      placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 15, rotationZ: 0 },
    });

    expect(model.group.rotation.y).toBeCloseTo(Math.PI / 12);

    dispatchKeyboard(rendererElement, 'keydown', { key: 'e' });
    dispatchPointer(rendererElement, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 200 });
    dispatchPointer(rendererElement, 'pointermove', { pointerId: 1, clientX: 300, clientY: 200 });
    dispatchPointer(rendererElement, 'pointerup', { pointerId: 1, clientX: 300, clientY: 200 });

    expect(placementChanges.at(-1)).toMatchObject({
      objectId: 'object-1',
      placement: {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        height: 0.12,
        rotationX: 0,
        rotationY: 60,
        rotationZ: 0,
      },
    });
    expect(model.group.rotation.y).toBeCloseTo(Math.PI / 3);

    preview.dispose();
  });

  it('moves a loaded model after the Blender grab shortcut is pressed', async () => {
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

    dispatchKeyboard(rendererElement, 'keydown', { key: 'g' });
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

  it('scales a loaded model after the Blender scale shortcut is pressed', async () => {
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

    dispatchKeyboard(rendererElement, 'keydown', { key: 's' });
    dispatchPointer(rendererElement, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 200 });
    dispatchPointer(rendererElement, 'pointermove', { pointerId: 1, clientX: 200, clientY: 100 });
    dispatchPointer(rendererElement, 'pointerup', { pointerId: 1, clientX: 200, clientY: 100 });

    const placementChange = placementChanges.at(-1) as {
      placement: { scale: number; offsetX: number; offsetY: number; height: number };
    };
    expect(placementChange.placement.scale).toBeCloseTo(Math.E);
    expect(placementChange.placement.offsetX).toBeCloseTo(0);
    expect(placementChange.placement.offsetY).toBeCloseTo(0);
    expect(placementChange.placement.height).toBeCloseTo(0.12);
    expect(model.group.scale.x).toBeCloseTo(Math.E);

    preview.dispose();
  });

  it('switches transform mode in place without reloading the selected model', async () => {
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
    const modeChanges: string[] = [];
    const model = createDisposableModel();
    const loadModel = vi.fn(async () => model.group);

    const preview = new ImageTargetPreview(container, {
      createRenderer: () => renderer,
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
      loadModel,
      loadTexture: vi.fn(async () => undefined),
      onPlacementChange: (placement) => placementChanges.push(placement),
      onTransformModeChange: (mode) => modeChanges.push(mode),
    });

    await preview.update({
      model: { id: 'model-1', label: 'Model 1', url: 'https://example.com/model-1.glb', visibility: 'public' },
      placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 0, rotationZ: 0 },
    });

    preview.setTransformMode('rotate');
    dispatchPointer(rendererElement, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 200, altKey: true });
    dispatchPointer(rendererElement, 'pointermove', { pointerId: 1, clientX: 300, clientY: 200, altKey: true });
    dispatchPointer(rendererElement, 'pointerup', { pointerId: 1, clientX: 300, clientY: 200, altKey: true });

    expect(loadModel).toHaveBeenCalledTimes(1);
    expect(modeChanges).toEqual(['rotate']);
    expect(placementChanges.at(-1)).toMatchObject({
      objectId: 'object-1',
      placement: {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        height: 0.12,
        rotationY: 45,
      },
    });
    expect(model.group.rotation.y).toBeCloseTo(Math.PI / 4);

    preview.dispose();
  });

  it('scales a loaded model with an explicit Alt two-pointer pinch on the preview canvas', async () => {
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

    dispatchPointer(rendererElement, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 200, altKey: true });
    dispatchPointer(rendererElement, 'pointerdown', { pointerId: 2, clientX: 300, clientY: 200, altKey: true });
    dispatchPointer(rendererElement, 'pointermove', { pointerId: 2, clientX: 400, clientY: 200, altKey: true });
    dispatchPointer(rendererElement, 'pointerup', { pointerId: 2, clientX: 400, clientY: 200, altKey: true });
    dispatchPointer(rendererElement, 'pointerup', { pointerId: 1, clientX: 200, clientY: 200, altKey: true });

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

    dispatchPointer(rendererElement, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 200, altKey: true });
    dispatchPointer(rendererElement, 'pointermove', { pointerId: 1, clientX: 250, clientY: 150, altKey: true });
    dispatchPointer(rendererElement, 'pointerup', { pointerId: 1, clientX: 250, clientY: 150, altKey: true });

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

  it('creates selectable 3D text objects without loading a GLB model', async () => {
    const container = document.createElement('div');
    const rendererElement = document.createElement('canvas');
    const renderer = {
      domElement: rendererElement,
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    };
    const textGroup = new Group();
    textGroup.name = 'local-text-3d-object';
    const loadModel = vi.fn(async () => createDisposableModel().group);
    const createTextObject = vi.fn(() => textGroup);

    const preview = new ImageTargetPreview(container, {
      createRenderer: () => renderer,
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
      loadModel,
      loadTexture: vi.fn(async () => undefined),
      createTextObject,
    });

    await preview.update({
      objects: [
        {
          kind: 'text',
          id: 'text-object',
          text: { value: 'Hallo AR', language: 'german', font: 'studio-serif' },
          placement: { scale: 1.2, offsetX: 0.15, offsetY: -0.2, height: 0.32, rotationX: 0, rotationY: 20, rotationZ: 0 },
        },
      ],
      selectedObjectId: 'text-object',
    });

    expect(loadModel).not.toHaveBeenCalled();
    expect(createTextObject).toHaveBeenCalledWith({ value: 'Hallo AR', language: 'german', font: 'studio-serif' });
    expect(textGroup.position.x).toBeCloseTo(0.15);
    expect(textGroup.position.y).toBeCloseTo(0.32);
    expect(textGroup.position.z).toBeCloseTo(-0.2);
    expect(textGroup.scale.x).toBeCloseTo(1.2);
    expect(textGroup.rotation.y).toBeCloseTo(Math.PI / 9);

    preview.dispose();
  });

  it('positions the preview camera from camera controls', async () => {
    const container = document.createElement('div');
    const renderer = {
      domElement: document.createElement('canvas'),
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

    await preview.update({
      camera: { distance: 3, height: 1.4, yawDegrees: 90, targetHeight: 0.2 },
    });

    const camera = (preview as unknown as { camera: { position: { x: number; y: number; z: number } } }).camera;
    expect(camera.position.x).toBeCloseTo(3);
    expect(camera.position.y).toBeCloseTo(1.4);
    expect(camera.position.z).toBeCloseTo(0);

    preview.dispose();
  });

  it('applies animation tracks relative to the saved placement without drift', async () => {
    const container = document.createElement('div');
    const renderer = {
      domElement: document.createElement('canvas'),
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    };
    let frameCallback: FrameRequestCallback | undefined;
    const model = createDisposableModel();

    const preview = new ImageTargetPreview(container, {
      createRenderer: () => renderer,
      requestFrame: (callback) => {
        frameCallback = callback;
        return 1;
      },
      cancelFrame: vi.fn(),
      loadModel: vi.fn(async () => model.group),
      loadTexture: vi.fn(async () => undefined),
    });

    await preview.update({
      objects: [
        {
          id: 'animated-object',
          model: { id: 'lamp', label: 'Lamp', url: 'https://example.com/lamp.glb', visibility: 'public' },
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
      selectedObjectId: 'animated-object',
    });

    frameCallback?.(1000);
    frameCallback?.(1500);

    expect(model.group.position.x).toBeCloseTo(0.6);
    expect(model.group.position.y).toBeCloseTo(0.3);
    expect(model.group.position.z).toBeCloseTo(0.1);
    expect(model.group.rotation.x).toBeCloseTo(Math.PI / 18);
    expect(model.group.rotation.y).toBeCloseTo(Math.PI / 9);
    expect(model.group.rotation.z).toBeCloseTo(Math.PI / 3);
    expect(model.group.scale.x).toBeCloseTo(2.5);

    frameCallback?.(2000);

    expect(model.group.position.x).toBeCloseTo(0.2);
    expect(model.group.rotation.z).toBeCloseTo(Math.PI / 6);
    expect(model.group.scale.x).toBeCloseTo(2);

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

function mockCanvasRect(target: HTMLElement, values: { width: number; height: number }): void {
  target.getBoundingClientRect = vi.fn(() => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: values.width,
    bottom: values.height,
    width: values.width,
    height: values.height,
    toJSON: () => ({}),
  }));
}

function dispatchPointer(
  target: HTMLElement,
  type: string,
  values: {
    pointerId: number;
    clientX: number;
    clientY: number;
    altKey?: boolean;
    button?: number;
    ctrlKey?: boolean;
    metaKey?: boolean;
    pointerType?: string;
    shiftKey?: boolean;
  },
): void {
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & typeof values;
  Object.assign(event, { button: 0, pointerType: 'mouse', ...values });
  target.dispatchEvent(event);
}

function dispatchWheel(target: HTMLElement, values: { deltaY: number }): void {
  const event = new Event('wheel', { bubbles: true, cancelable: true }) as Event & typeof values;
  Object.assign(event, values);
  target.dispatchEvent(event);
}

function dispatchKeyboard(target: HTMLElement, type: string, values: { key: string }): void {
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & typeof values;
  Object.assign(event, values);
  target.dispatchEvent(event);
}

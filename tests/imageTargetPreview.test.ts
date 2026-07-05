import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Texture } from 'three';
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

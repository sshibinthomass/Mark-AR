import { Mesh, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { prepareMediaPlane } from '../src/scene/mediaPlane3d';

describe('prepareMediaPlane', () => {
  it('loads an aspect-preserving selectable image plane', async () => {
    const texture = new Texture();
    const prepared = prepareMediaPlane({
      objectId: 'poster',
      kind: 'image',
      url: 'https://cdn.example/poster.webp',
      aspectRatio: 1.5,
    }, {
      loadTexture: async () => texture,
      loadMode: 'strict',
    });

    await prepared.ready;

    expect(prepared.mesh).toBeInstanceOf(Mesh);
    expect(prepared.mesh.name).toBe('target-media-plane-poster');
    expect(prepared.mesh.geometry.parameters.width).toBe(1.5);
    expect(prepared.mesh.geometry.parameters.height).toBe(1);
    expect(prepared.mesh.userData.targetObjectId).toBe('poster');
    expect(prepared.mesh.material.map).toBe(texture);
  });

  it('clamps extreme aspect ratios and falls back without rejecting', async () => {
    const prepared = prepareMediaPlane({
      objectId: 'narrow',
      kind: 'youtube',
      url: 'https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg',
      aspectRatio: 100,
    }, {
      loadTexture: async () => {
        throw new Error('offline');
      },
      loadMode: 'fallback',
    });

    await expect(prepared.ready).resolves.toBeUndefined();
    expect(prepared.mesh.geometry.parameters.width).toBe(5);
    expect(prepared.mesh.material.map).toBeNull();
    expect(prepared.group.getObjectByName('target-media-play-indicator')).toBeTruthy();
  });

  it('disposes its texture, material, and geometry only once', async () => {
    const texture = new Texture();
    const textureDispose = vi.spyOn(texture, 'dispose');
    const prepared = prepareMediaPlane({
      objectId: 'poster',
      kind: 'image',
      url: 'poster.webp',
      aspectRatio: 1,
    }, {
      loadTexture: async () => texture,
      loadMode: 'strict',
    });
    const materialDispose = vi.spyOn(prepared.mesh.material, 'dispose');
    const geometryDispose = vi.spyOn(prepared.mesh.geometry, 'dispose');
    await prepared.ready;

    prepared.dispose();
    prepared.dispose();

    expect(textureDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
  });
});

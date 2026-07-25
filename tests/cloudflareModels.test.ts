import { describe, expect, it, vi } from 'vitest';
import {
  loadCloudflareModelOptions,
} from '../src/app/cloudflareModels';

describe('Cloudflare model client', () => {
  it('uses the media-capable Mark-AR Worker by default', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ models: [] }), { status: 200 }));

    await loadCloudflareModelOptions({
      authToken: 'token-123',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://mark-ar-targets.sshibinthomass.workers.dev/generate-3d/models',
      { headers: { Authorization: 'Bearer token-123' } },
    );
  });

  it('uses only static public models while signed out', async () => {
    const fetchImpl = vi.fn();

    const models = await loadCloudflareModelOptions({
      apiUrl: 'https://worker.example/generate-3d',
      authToken: null,
      fetchImpl,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(models.map((model) => model.label)).toEqual([
      'Fast output',
      'Image 4 output',
      'Image fast output',
    ]);
  });

  it('loads static Cloudflare assets plus generated Worker models', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          models: [
            {
              id: 'capture-1',
              label: 'Chair',
              model_url: 'https://worker.example/models/generated/chair.glb',
              preview_url: 'https://worker.example/previews/chair.png',
              visibility: 'public',
            },
          ],
        }),
        { status: 200 },
      );
    });

    const models = await loadCloudflareModelOptions({
      apiUrl: 'https://worker.example/generate-3d',
      authToken: 'token-123',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith('https://worker.example/generate-3d/models', {
      headers: { Authorization: 'Bearer token-123' },
    });
    expect(models.map((model) => model.label)).toEqual([
      'Fast output',
      'Image 4 output',
      'Image fast output',
      'Chair',
    ]);
    expect(models.at(-1)).toMatchObject({
      id: 'generated-capture-1',
      url: 'https://worker.example/models/generated/chair.glb',
      previewUrl: 'https://worker.example/previews/chair.png',
      visibility: 'public',
    });
  });

});

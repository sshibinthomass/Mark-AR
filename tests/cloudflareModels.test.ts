import { describe, expect, it, vi } from 'vitest';
import {
  extractProcessedBaseImage,
  loadCloudflareModelOptions,
} from '../src/app/cloudflareModels';

describe('Cloudflare model client', () => {
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

  it('sends captured images to the Worker extraction route with the auth token', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          image_base64: 'processed-image',
          image_mime_type: 'image/png',
          target_object: 'Chair',
        }),
        { status: 200 },
      );
    });

    const result = await extractProcessedBaseImage({
      apiUrl: 'https://worker.example/generate-3d',
      imageBase64: 'raw-image',
      imageMimeType: 'image/jpeg',
      targetObject: ' Chair ',
      authToken: 'token-123',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith('https://worker.example/extract-image', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_base64: 'raw-image',
        image_mime_type: 'image/jpeg',
        target_object: 'Chair',
      }),
    });
    expect(result).toEqual({
      imageBase64: 'processed-image',
      imageMimeType: 'image/png',
      targetObject: 'Chair',
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  createImageTarget,
  deleteImageTarget,
  listImageTargets,
  updateImageTarget,
} from '../src/app/cloudImageTargets';

describe('cloud image target client', () => {
  it('lists cloud image targets with an auth token', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      targets: [
        {
          id: 'target-1',
          label: 'Product box',
          image_url: 'https://worker.example/image-targets/images/target-1.jpg',
          image_object_key: 'image-targets/images/target-1.jpg',
          model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
          placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.12 },
          owner_email: 'maker@example.com',
          visibility: 'private',
          created_at: '2026-07-05T18:00:00.000Z',
          updated_at: '2026-07-05T18:00:00.000Z',
        },
      ],
    }), { status: 200 }));

    const targets = await listImageTargets({
      apiUrl: 'https://worker.example/generate-3d',
      authToken: 'token-123',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith('https://worker.example/generate-3d/image-targets', {
      headers: { Authorization: 'Bearer token-123' },
    });
    expect(targets).toEqual([
      {
        id: 'target-1',
        label: 'Product box',
        imageUrl: 'https://worker.example/image-targets/images/target-1.jpg',
        imageObjectKey: 'image-targets/images/target-1.jpg',
        model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
        placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12 },
        objects: [
          {
            id: 'object-1',
            model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
            placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12 },
          },
        ],
        ownerEmail: 'maker@example.com',
        visibility: 'private',
        createdAt: '2026-07-05T18:00:00.000Z',
        updatedAt: '2026-07-05T18:00:00.000Z',
      },
    ]);
  });

  it('maps multi-object image targets while keeping first-object aliases', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      targets: [
        {
          id: 'target-1',
          label: 'Product box',
          image_url: 'https://worker.example/image-targets/images/target-1.jpg',
          image_object_key: 'image-targets/images/target-1.jpg',
          model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
          placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.12 },
          objects: [
            {
              id: 'object-chair',
              model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
              placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.12 },
            },
            {
              id: 'object-plant',
              model: { id: 'generated-plant', label: 'Plant', url: 'https://worker.example/plant.glb' },
              placement: { scale: 0.8, offset_x: -0.2, offset_y: 0.15, height: 0.08 },
            },
          ],
        },
      ],
    }), { status: 200 }));

    const targets = await listImageTargets({
      apiUrl: 'https://worker.example/generate-3d',
      fetchImpl,
    });

    expect(targets[0]).toMatchObject({
      model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
      placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12 },
      objects: [
        {
          id: 'object-chair',
          model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
          placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12 },
        },
        {
          id: 'object-plant',
          model: { id: 'generated-plant', label: 'Plant', url: 'https://worker.example/plant.glb' },
          placement: { scale: 0.8, offsetX: -0.2, offsetY: 0.15, height: 0.08 },
        },
      ],
    });
  });

  it('creates image targets with image, model, and placement payloads', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      id: 'target-1',
      label: 'Product box',
      image_url: 'https://worker.example/image-targets/images/target-1.jpg',
      image_object_key: 'image-targets/images/target-1.jpg',
      model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
      placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.1, height: 0.2 },
      visibility: 'private',
      created_at: '2026-07-05T18:00:00.000Z',
      updated_at: '2026-07-05T18:00:00.000Z',
    }), { status: 201 }));

    const target = await createImageTarget({
      apiUrl: 'https://worker.example/generate-3d',
      authToken: 'token-123',
      fetchImpl,
      label: 'Product box',
      imageBase64: 'aW1hZ2U=',
      imageMimeType: 'image/jpeg',
      model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
      placement: { scale: 1.2, offsetX: 0.1, offsetY: -0.1, height: 0.2 },
    });

    expect(fetchImpl).toHaveBeenCalledWith('https://worker.example/generate-3d/image-targets', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        label: 'Product box',
        image_base64: 'aW1hZ2U=',
        image_mime_type: 'image/jpeg',
        model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
        placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.1, height: 0.2 },
        objects: [
          {
            id: 'object-1',
            model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
            placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.1, height: 0.2 },
          },
        ],
      }),
    });
    expect(target.id).toBe('target-1');
  });

  it('creates image targets with multiple placed objects', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      id: 'target-1',
      label: 'Product box',
      image_url: 'https://worker.example/image-targets/images/target-1.jpg',
      image_object_key: 'image-targets/images/target-1.jpg',
      model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
      placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.1, height: 0.2 },
      objects: [
        {
          id: 'object-chair',
          model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
          placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.1, height: 0.2 },
        },
        {
          id: 'object-plant',
          model: { id: 'generated-plant', label: 'Plant', url: 'https://worker.example/plant.glb' },
          placement: { scale: 0.7, offset_x: -0.2, offset_y: 0.2, height: 0.1 },
        },
      ],
    }), { status: 201 }));

    await createImageTarget({
      apiUrl: 'https://worker.example/generate-3d',
      fetchImpl,
      label: 'Product box',
      imageBase64: 'aW1hZ2U=',
      imageMimeType: 'image/jpeg',
      objects: [
        {
          id: 'object-chair',
          model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
          placement: { scale: 1.2, offsetX: 0.1, offsetY: -0.1, height: 0.2 },
        },
        {
          id: 'object-plant',
          model: { id: 'generated-plant', label: 'Plant', url: 'https://worker.example/plant.glb' },
          placement: { scale: 0.7, offsetX: -0.2, offsetY: 0.2, height: 0.1 },
        },
      ],
    });

    expect(fetchImpl).toHaveBeenCalledWith('https://worker.example/generate-3d/image-targets', expect.objectContaining({
      body: JSON.stringify({
        label: 'Product box',
        image_base64: 'aW1hZ2U=',
        image_mime_type: 'image/jpeg',
        model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
        placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.1, height: 0.2 },
        objects: [
          {
            id: 'object-chair',
            model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
            placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.1, height: 0.2 },
          },
          {
            id: 'object-plant',
            model: { id: 'generated-plant', label: 'Plant', url: 'https://worker.example/plant.glb' },
            placement: { scale: 0.7, offset_x: -0.2, offset_y: 0.2, height: 0.1 },
          },
        ],
      }),
    }));
  });

  it('updates and deletes image targets by id', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'target-1',
        label: 'Renamed',
        image_url: 'https://worker.example/image-targets/images/target-1.jpg',
        image_object_key: 'image-targets/images/target-1.jpg',
        model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
        placement: { scale: 1.5, offset_x: 0, offset_y: 0, height: 0.12 },
        visibility: 'private',
        created_at: '2026-07-05T18:00:00.000Z',
        updated_at: '2026-07-05T18:10:00.000Z',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ deleted: true, id: 'target-1' }), { status: 200 }));

    await updateImageTarget({
      apiUrl: 'https://worker.example/generate-3d',
      authToken: 'token-123',
      fetchImpl,
      targetId: 'target-1',
      label: 'Renamed',
      placement: { scale: 1.5, offsetX: 0, offsetY: 0, height: 0.12 },
    });
    await deleteImageTarget({
      apiUrl: 'https://worker.example/generate-3d',
      authToken: 'token-123',
      fetchImpl,
      targetId: 'target-1',
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(1, 'https://worker.example/generate-3d/image-targets/target-1', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        label: 'Renamed',
        placement: { scale: 1.5, offset_x: 0, offset_y: 0, height: 0.12 },
      }),
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, 'https://worker.example/generate-3d/image-targets/target-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-123' },
    });
  });
});

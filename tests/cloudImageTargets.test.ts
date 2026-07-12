import { describe, expect, it, vi } from 'vitest';
import {
  createImageTarget,
  deleteImageTarget,
  listImageTargets,
  updateImageTarget,
} from '../src/app/cloudImageTargets';

describe('cloud image target client', () => {
  it('does not call the protected image target list while signed out', async () => {
    const fetchImpl = vi.fn();

    const targets = await listImageTargets({
      apiUrl: 'https://worker.example/generate-3d',
      authToken: null,
      fetchImpl,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(targets).toEqual([]);
  });

  it('lists cloud image targets with an auth token', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      targets: [
        {
          id: 'target-1',
          label: 'Product box',
          image_url: 'https://worker.example/image-targets/images/target-1.jpg',
          image_object_key: 'image-targets/images/target-1.jpg',
          model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
          placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.12, rotation_x: 0, rotation_y: 45, rotation_z: 0 },
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
        placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 45, rotationZ: 0 },
        objects: [
          {
            id: 'object-1',
            model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
            placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 45, rotationZ: 0 },
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
          placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.12, rotation_x: 0, rotation_y: 20, rotation_z: 0 },
          objects: [
            {
              id: 'object-chair',
              model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
              placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.12, rotation_x: 0, rotation_y: 20, rotation_z: 0 },
            },
            {
              id: 'object-plant',
              model: { id: 'generated-plant', label: 'Plant', url: 'https://worker.example/plant.glb' },
              placement: { scale: 0.8, offset_x: -0.2, offset_y: 0.15, height: 0.08, rotation_x: -15, rotation_y: 0, rotation_z: 30 },
              animation: { spin_axis: 'y', spin_speed: 1.5, bob_height: 0.08, bob_speed: 2 },
            },
          ],
        },
      ],
    }), { status: 200 }));

    const targets = await listImageTargets({
      apiUrl: 'https://worker.example/generate-3d',
      authToken: 'token-123',
      fetchImpl,
    });

    expect(targets[0]).toMatchObject({
      model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
      placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 20, rotationZ: 0 },
      objects: [
        {
          id: 'object-chair',
          model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
          placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 20, rotationZ: 0 },
        },
        {
          id: 'object-plant',
          model: { id: 'generated-plant', label: 'Plant', url: 'https://worker.example/plant.glb' },
          placement: { scale: 0.8, offsetX: -0.2, offsetY: 0.15, height: 0.08, rotationX: -15, rotationY: 0, rotationZ: 30 },
          animation: { spinAxis: 'y', spinSpeed: 1.5, bobHeight: 0.08, bobSpeed: 2 },
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
      placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.1, height: 0.2, rotation_x: 10, rotation_y: 20, rotation_z: 30 },
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
      placement: { scale: 1.2, offsetX: 0.1, offsetY: -0.1, height: 0.2, rotationX: 10, rotationY: 20, rotationZ: 30 },
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
        placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.1, height: 0.2, rotation_x: 10, rotation_y: 20, rotation_z: 30 },
        objects: [
          {
            id: 'object-1',
            model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
            placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.1, height: 0.2, rotation_x: 10, rotation_y: 20, rotation_z: 30 },
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
      placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.1, height: 0.2, rotation_x: 10, rotation_y: 20, rotation_z: 30 },
      objects: [
        {
          id: 'object-chair',
          model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
          placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.1, height: 0.2, rotation_x: 5, rotation_y: 15, rotation_z: 25 },
        },
        {
          id: 'object-plant',
          model: { id: 'generated-plant', label: 'Plant', url: 'https://worker.example/plant.glb' },
          placement: { scale: 0.7, offset_x: -0.2, offset_y: 0.2, height: 0.1, rotation_x: -10, rotation_y: 0, rotation_z: 40 },
          animation: { spin_axis: 'x', spin_speed: 2, bob_height: 0.05, bob_speed: 3 },
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
          placement: { scale: 1.2, offsetX: 0.1, offsetY: -0.1, height: 0.2, rotationX: 5, rotationY: 15, rotationZ: 25 },
        },
        {
          id: 'object-plant',
          model: { id: 'generated-plant', label: 'Plant', url: 'https://worker.example/plant.glb' },
          placement: { scale: 0.7, offsetX: -0.2, offsetY: 0.2, height: 0.1, rotationX: -10, rotationY: 0, rotationZ: 40 },
          animation: { spinAxis: 'x', spinSpeed: 2, bobHeight: 0.05, bobSpeed: 3 },
        },
      ],
    });

    expect(fetchImpl).toHaveBeenCalledWith('https://worker.example/generate-3d/image-targets', expect.objectContaining({
      body: JSON.stringify({
        label: 'Product box',
        image_base64: 'aW1hZ2U=',
        image_mime_type: 'image/jpeg',
        model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
        placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.1, height: 0.2, rotation_x: 5, rotation_y: 15, rotation_z: 25 },
        objects: [
          {
            id: 'object-chair',
            model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
            placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.1, height: 0.2, rotation_x: 5, rotation_y: 15, rotation_z: 25 },
          },
          {
            id: 'object-plant',
            model: { id: 'generated-plant', label: 'Plant', url: 'https://worker.example/plant.glb' },
            placement: { scale: 0.7, offset_x: -0.2, offset_y: 0.2, height: 0.1, rotation_x: -10, rotation_y: 0, rotation_z: 40 },
            animation: { spin_axis: 'x', spin_speed: 2, bob_height: 0.05, bob_speed: 3 },
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
        placement: { scale: 1.5, offset_x: 0, offset_y: 0, height: 0.12, rotation_x: 0, rotation_y: 90, rotation_z: 0 },
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
      placement: { scale: 1.5, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 90, rotationZ: 0 },
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
        placement: { scale: 1.5, offset_x: 0, offset_y: 0, height: 0.12, rotation_x: 0, rotation_y: 90, rotation_z: 0 },
      }),
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, 'https://worker.example/generate-3d/image-targets/target-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-123' },
    });
  });
});

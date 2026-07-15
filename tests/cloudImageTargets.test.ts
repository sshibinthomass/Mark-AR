import { describe, expect, it, vi } from 'vitest';
import {
  createImageTarget,
  deleteImageTarget,
  getImageTargetForScan,
  listImageTargets,
  updateImageTarget,
} from '../src/app/cloudImageTargets';
import { createLocalTextObject } from '../src/app/targetEditorObjects';

describe('cloud image target client', () => {
  it('loads exactly one scan target without auth and maps its access fields', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      id: 'target-1',
      label: 'Product box',
      image_url: 'https://worker.example/image-targets/images/target-1.jpg',
      image_object_key: 'image-targets/images/target-1.jpg',
      model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
      placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.12 },
      scan_id: 'scan-abc',
      access_mode: 'anyone_with_link',
      allowed_emails: [],
    }), { status: 200 }));

    const target = await getImageTargetForScan({
      apiUrl: 'https://worker.example/generate-3d',
      scanId: 'scan-abc',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://worker.example/generate-3d/image-targets/scan/scan-abc',
      { headers: {} },
    );
    expect(target).toMatchObject({
      id: 'target-1',
      scanId: 'scan-abc',
      accessMode: 'anyone_with_link',
      allowedEmails: [],
    });
  });

  it('sends optional auth for focused scans and preserves response status on errors', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: 'Login required.' }), { status: 401 }));

    const request = getImageTargetForScan({
      apiUrl: 'https://worker.example/generate-3d',
      scanId: 'scan owner',
      authToken: 'token-123',
      fetchImpl,
    });

    await expect(request).rejects.toMatchObject({ message: 'Login required.', status: 401 });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://worker.example/generate-3d/image-targets/scan/scan%20owner',
      { headers: { Authorization: 'Bearer token-123' } },
    );
  });

  it('parses editable groups and resolves grouped objects while falling back for missing groups', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      targets: [{
        id: 'target-grouped', label: 'Grouped room', image_url: 'https://worker.example/room.jpg', image_object_key: 'room.jpg',
        model: { id: 'chair', label: 'Chair', url: 'chair.glb' },
        placement: { scale: 1, offset_x: 0.5, offset_y: 0, height: 0.3 },
        groups: [
          {
            id: 'room', label: 'Room',
            placement: { scale: 1, offset_x: 0.3, offset_y: 0, height: 0.4, rotation_x: 0, rotation_y: 0, rotation_z: 0 },
            animation: { preset: 'gentle-float', tracks: [{ property: 'position_y', motion: 'smooth', amount: 0.1, speed: 0.5, phase: 0 }] },
          },
          { id: 'room', label: 'Duplicate', placement: { scale: 2, offset_x: 0, offset_y: 0, height: 0 } },
        ],
        objects: [
          {
            id: 'chair-object', model: { id: 'chair', label: 'Chair', url: 'chair.glb' }, group_id: 'room',
            local_placement: { scale: 1, offset_x: 0.2, offset_y: 0, height: -0.1, rotation_x: 0, rotation_y: 0, rotation_z: 0 },
            placement: { scale: 1, offset_x: 0.9, offset_y: 0, height: 0.9 },
          },
          {
            id: 'orphan-object', model: { id: 'lamp', label: 'Lamp', url: 'lamp.glb' }, group_id: 'missing',
            local_placement: { scale: 1, offset_x: 1, offset_y: 1, height: 1 },
            placement: { scale: 0.8, offset_x: -0.1, offset_y: 0.2, height: 0.15, rotation_x: 0, rotation_y: 20, rotation_z: 0 },
          },
        ],
      }],
    }), { status: 200 }));

    const [target] = await listImageTargets({ apiUrl: 'https://worker.example', authToken: 'token', fetchImpl });

    expect(target.groups).toHaveLength(1);
    expect(target.groups[0]).toMatchObject({ id: 'room', label: 'Room', animation: { preset: 'gentle-float' } });
    expect(target.objects[0]).toMatchObject({
      groupId: 'room',
      localPlacement: { offsetX: 0.2, height: -0.1 },
      placement: { offsetX: 0.5, offsetY: 0 },
    });
    expect(target.objects[0].placement.height).toBeCloseTo(0.3);
    expect(target.objects[1]).toMatchObject({
      placement: { scale: 0.8, offsetX: -0.1, offsetY: 0.2, height: 0.15 },
    });
    expect(target.objects[1].groupId).toBeUndefined();
    expect(target.objects[1].localPlacement).toBeUndefined();
    expect(target.placement.offsetX).toBeCloseTo(0.5);
    expect(target.placement.height).toBeCloseTo(0.3);
  });

  it('serializes groups, child-local placements, and resolved legacy aliases', async () => {
    const group = {
      id: 'room', label: 'Room',
      placement: { scale: 2, offsetX: 0.2, offsetY: -0.1, height: 0.4, rotationX: 0, rotationY: 0, rotationZ: 0 },
      animation: { preset: 'pulse' as const, tracks: [{ property: 'scale' as const, motion: 'smooth' as const, amount: 0.1, speed: 0.5, phase: 0 }] },
    };
    const responseBody = {
      id: 'target-grouped', label: 'Grouped room', image_url: 'https://worker.example/room.jpg', image_object_key: 'room.jpg',
      model: { id: 'chair', label: 'Chair', url: 'chair.glb' },
      placement: { scale: 1, offset_x: -0.2, offset_y: -0.1, height: 0.2, rotation_x: 0, rotation_y: 0, rotation_z: 0 },
      groups: [{ id: 'room', label: 'Room', placement: { scale: 2, offset_x: 0.2, offset_y: -0.1, height: 0.4, rotation_x: 0, rotation_y: 0, rotation_z: 0 }, animation: { preset: 'pulse', tracks: [{ property: 'scale', motion: 'smooth', amount: 0.1, speed: 0.5, phase: 0 }] } }],
      objects: [{ id: 'chair-object', model: { id: 'chair', label: 'Chair', url: 'chair.glb' }, group_id: 'room', local_placement: { scale: 0.5, offset_x: -0.2, offset_y: 0, height: -0.1, rotation_x: 0, rotation_y: 0, rotation_z: 0 }, placement: { scale: 1, offset_x: -0.2, offset_y: -0.1, height: 0.2, rotation_x: 0, rotation_y: 0, rotation_z: 0 } }],
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(responseBody), { status: 201 }));

    await createImageTarget({
      apiUrl: 'https://worker.example', fetchImpl, label: 'Grouped room', imageBase64: 'aW1hZ2U=', imageMimeType: 'image/jpeg',
      groups: [group],
      objects: [{
        id: 'chair-object', model: { id: 'chair', label: 'Chair', url: 'chair.glb' },
        placement: { scale: 9, offsetX: 0.9, offsetY: 0.9, height: 0.9, rotationX: 0, rotationY: 0, rotationZ: 0 },
        groupId: 'room',
        localPlacement: { scale: 0.5, offsetX: -0.2, offsetY: 0, height: -0.1, rotationX: 0, rotationY: 0, rotationZ: 0 },
      }],
    });

    const request = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(request.groups).toEqual([expect.objectContaining({
      id: 'room', label: 'Room',
      placement: { scale: 2, offset_x: 0.2, offset_y: -0.1, height: 0.4, rotation_x: 0, rotation_y: 0, rotation_z: 0 },
      animation: expect.objectContaining({ preset: 'pulse' }),
    })]);
    expect(request.objects[0]).toMatchObject({
      group_id: 'room',
      local_placement: { scale: 0.5, offset_x: -0.2, offset_y: 0, height: -0.1, rotation_x: 0, rotation_y: 0, rotation_z: 0 },
      placement: { scale: 1, offset_x: -0.2, offset_y: -0.1, height: 0.2, rotation_x: 0, rotation_y: 0, rotation_z: 0 },
    });
    expect(request.model).toEqual(request.objects[0].model);
    expect(request.placement).toEqual(request.objects[0].placement);
  });

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
        groups: [],
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
          animation: {
            preset: 'custom',
            tracks: [
              { property: 'rotationY', motion: 'spin', amount: 360, speed: 1.5 / (2 * Math.PI), phase: 0 },
              { property: 'positionY', motion: 'smooth', amount: 0.08, speed: 2 / (2 * Math.PI), phase: 0 },
            ],
          },
        },
      ],
    });
  });

  it('maps complete custom text objects beside cloud model objects', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      targets: [{
        id: 'target-mixed',
        label: 'Mixed target',
        image_url: 'https://worker.example/image-targets/images/target-mixed.jpg',
        image_object_key: 'image-targets/images/target-mixed.jpg',
        model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
        placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.12 },
        objects: [
          {
            kind: 'model',
            id: 'object-chair',
            model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
            placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.12 },
          },
          {
            kind: 'text',
            id: 'text-greeting',
            text: {
              value: 'Hallo AR',
              language: 'german',
              font: 'studio-sans-bold',
              color: '#112233',
              fill_mode: 'gradient',
              gradient_start: '#223344',
              gradient_end: '#334455',
              gradient_direction: 'diagonal',
              side_color: '#445566',
              depth: 0.08,
              bevel: 0.01,
              gloss: 0.9,
              style_preset: 'gold-bevel',
            },
            placement: { scale: 1.2, offset_x: 0.2, offset_y: -0.1, height: 0.3, rotation_y: 25 },
            animation: {
              preset: 'gentle-float',
              tracks: [{ property: 'position_y', motion: 'smooth', amount: 0.1, speed: 0.5, phase: 0 }],
            },
          },
        ],
      }],
    }), { status: 200 }));

    const [target] = await listImageTargets({
      apiUrl: 'https://worker.example/generate-3d',
      authToken: 'token-123',
      fetchImpl,
    });

    expect(target.objects[1]).toMatchObject({
      kind: 'text',
      id: 'text-greeting',
      text: {
        value: 'Hallo AR',
        language: 'german',
        font: 'studio-sans-bold',
        color: '#112233',
        fillMode: 'gradient',
        gradientStart: '#223344',
        gradientEnd: '#334455',
        gradientDirection: 'diagonal',
        sideColor: '#445566',
        depth: 0.08,
        bevel: 0.01,
        gloss: 0.9,
        stylePreset: 'gold-bevel',
      },
      placement: { scale: 1.2, offsetX: 0.2, offsetY: -0.1, height: 0.3, rotationY: 25 },
      animation: { preset: 'gentle-float' },
    });
  });

  it('maps preset animation tracks from cloud image targets', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      targets: [
        {
          id: 'target-1',
          label: 'Orbiting product',
          image_url: 'https://worker.example/image-targets/images/target-1.jpg',
          image_object_key: 'image-targets/images/target-1.jpg',
          model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
          placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.12 },
          objects: [
            {
              id: 'object-chair',
              model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
              placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.12 },
              animation: {
                preset: 'orbit',
                tracks: [
                  { property: 'position_x', motion: 'smooth', amount: 0.18, speed: 0.3, phase: 0 },
                  { property: 'position_z', motion: 'smooth', amount: 0.18, speed: 0.3, phase: 90 },
                ],
              },
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

    expect(targets[0].objects[0].animation).toEqual({
      preset: 'orbit',
      tracks: [
        { property: 'positionX', motion: 'smooth', amount: 0.18, speed: 0.3, phase: 0 },
        { property: 'positionZ', motion: 'smooth', amount: 0.18, speed: 0.3, phase: 90 },
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
      access: { accessMode: 'specific_accounts', allowedEmails: ['friend@example.com'] },
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
            kind: 'model',
            id: 'object-1',
            model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
            placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.1, height: 0.2, rotation_x: 10, rotation_y: 20, rotation_z: 30 },
          },
        ],
        access_mode: 'specific_accounts',
        allowed_emails: ['friend@example.com'],
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
          animation: {
            preset: 'custom',
            tracks: [
              { property: 'rotationX', motion: 'spin', amount: 360, speed: 0.5, phase: 0 },
              { property: 'positionY', motion: 'smooth', amount: 0.05, speed: 0.5, phase: 0 },
            ],
          },
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
            kind: 'model',
            id: 'object-chair',
            model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
            placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.1, height: 0.2, rotation_x: 5, rotation_y: 15, rotation_z: 25 },
          },
          {
            kind: 'model',
            id: 'object-plant',
            model: { id: 'generated-plant', label: 'Plant', url: 'https://worker.example/plant.glb' },
            placement: { scale: 0.7, offset_x: -0.2, offset_y: 0.2, height: 0.1, rotation_x: -10, rotation_y: 0, rotation_z: 40 },
            animation: {
              preset: 'custom',
              tracks: [
                { property: 'rotation_x', motion: 'spin', amount: 360, speed: 0.5, phase: 0 },
                { property: 'position_y', motion: 'smooth', amount: 0.05, speed: 0.5, phase: 0 },
              ],
              spin_axis: 'x',
              spin_speed: Math.PI,
              bob_height: 0.05,
              bob_speed: Math.PI,
            },
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

  it('updates a text-only target without requiring legacy model aliases', async () => {
    const textObject = createLocalTextObject({
      id: 'text-only',
      text: {
        value: 'Reusable text',
        language: 'english',
        font: 'studio-serif-bold',
        color: '#123456',
        fillMode: 'solid',
        sideColor: '#234567',
        depth: 0.09,
        bevel: 0.012,
        gloss: 0.8,
      },
    });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      id: 'target-text',
      label: 'Text target',
      image_url: 'https://worker.example/image-targets/images/target-text.jpg',
      image_object_key: 'image-targets/images/target-text.jpg',
      objects: [{
        kind: 'text',
        id: textObject.id,
        text: {
          value: textObject.text.value,
          language: textObject.text.language,
          font: textObject.text.font,
          color: textObject.text.color,
          fill_mode: textObject.text.fillMode,
          gradient_start: textObject.text.gradientStart,
          gradient_end: textObject.text.gradientEnd,
          gradient_direction: textObject.text.gradientDirection,
          side_color: textObject.text.sideColor,
          depth: textObject.text.depth,
          bevel: textObject.text.bevel,
          gloss: textObject.text.gloss,
          style_preset: textObject.text.stylePreset,
        },
        placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.12 },
      }],
      groups: [],
    }), { status: 200 }));

    const target = await updateImageTarget({
      apiUrl: 'https://worker.example/generate-3d',
      authToken: 'token-123',
      fetchImpl,
      targetId: 'target-text',
      label: 'Text target',
      objects: [textObject],
      groups: [],
    });

    const request = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(request).not.toHaveProperty('model');
    expect(request).not.toHaveProperty('placement');
    expect(request.objects).toEqual([expect.objectContaining({
      kind: 'text',
      id: 'text-only',
      text: expect.objectContaining({ value: 'Reusable text', font: 'studio-serif-bold' }),
    })]);
    expect(target.model).toBeUndefined();
    expect(target.objects[0]).toMatchObject({ kind: 'text', id: 'text-only' });
  });
});

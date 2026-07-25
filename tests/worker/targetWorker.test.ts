import { describe, expect, it, vi } from 'vitest';
import { handleRequest, type WorkerEnv } from '../../worker/src/index';

class MemoryBucket {
  readonly values = new Map<string, { bytes: Uint8Array; contentType?: string }>();

  async get(key: string) {
    const value = this.values.get(key);
    if (!value) return null;
    return {
      body: value.bytes,
      httpMetadata: { contentType: value.contentType },
      text: async () => new TextDecoder().decode(value.bytes),
      arrayBuffer: async () => value.bytes.buffer.slice(
        value.bytes.byteOffset,
        value.bytes.byteOffset + value.bytes.byteLength,
      ),
    };
  }

  async put(key: string, value: string | ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
    const bytes = typeof value === 'string'
      ? new TextEncoder().encode(value)
      : value instanceof Uint8Array ? value : new Uint8Array(value);
    this.values.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
  }

  async delete(key: string) {
    this.values.delete(key);
  }
}

describe('Mark-AR target Worker', () => {
  it('keeps non-admin local signups pending when no legacy auth service is configured', async () => {
    const bucket = new MemoryBucket();
    const env = createEnv(bucket);
    const response = await handleRequest(new Request('https://worker.example/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'new-user@example.com',
        password: 'correct horse battery staple',
        name: 'New user',
      }),
    }), env);
    const body = await response.json() as { user: { status: string }; token?: string };

    expect(response.status).toBe(201);
    expect(body.user.status).toBe('pending');
    expect(body).not.toHaveProperty('token');
  });

  it('filters the local model fallback for anonymous, owner, and non-owner callers', async () => {
    const bucket = new MemoryBucket();
    const ownerEnv = createEnv(bucket);
    await bucket.put('models/generated/index.json', JSON.stringify({
      models: [{
        id: 'private-1',
        owner_email: 'owner@example.com',
        visibility: 'private',
      }, {
        id: 'public-1',
        owner_email: 'owner@example.com',
        visibility: 'public',
      }],
    }));
    const ownerToken = await signupAndLogin(ownerEnv);
    const usersObject = await bucket.get('auth/users/index.json');
    const usersIndex = JSON.parse(await usersObject!.text!()) as { users: any[] };
    usersIndex.users.push({
      email: 'other@example.com',
      role: 'user',
      status: 'active',
      password_hash: '',
      password_salt: '',
      created_at: '2026-07-25T12:00:00Z',
      updated_at: '2026-07-25T12:00:00Z',
    });
    await bucket.put('auth/users/index.json', JSON.stringify(usersIndex));
    const otherToken = await createLocalSessionToken('other@example.com', 'user', ownerEnv.AUTH_SECRET);

    const anonymous = await handleRequest(new Request(
      'https://worker.example/generate-3d/models',
    ), ownerEnv);
    const owner = await handleRequest(new Request(
      'https://worker.example/generate-3d/models',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    ), ownerEnv);
    const nonOwner = await handleRequest(new Request(
      'https://worker.example/generate-3d/models',
      { headers: { Authorization: `Bearer ${otherToken}` } },
    ), ownerEnv);

    expect((await anonymous.json() as { models: any[] }).models.map((model) => model.id)).toEqual(['public-1']);
    expect((await owner.json() as { models: any[] }).models.map((model) => model.id)).toEqual(['private-1', 'public-1']);
    expect((await nonOwner.json() as { models: any[] }).models.map((model) => model.id)).toEqual(['public-1']);
  });

  it('delegates authentication and model visibility to the legacy production service', async () => {
    const bucket = new MemoryBucket();
    const env = createEnv(bucket);
    (env as WorkerEnv & { LEGACY_WORKER_ORIGIN: string }).LEGACY_WORKER_ORIGIN =
      'https://legacy.example';
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://legacy.example/auth/signup') {
        return new Response(JSON.stringify({
          user: { email: 'pending@example.com', role: 'user', status: 'pending' },
        }), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      if (url === 'https://legacy.example/generate-3d/models') {
        return new Response(JSON.stringify({
          models: [{ id: 'public-1', visibility: 'public' }],
        }), { headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('not found', { status: 404 });
    });

    const signup = await handleRequest(new Request('https://worker.example/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'pending@example.com',
        password: 'correct horse battery staple',
        name: 'Pending',
      }),
    }), env, { fetch: fetchImpl });
    const models = await handleRequest(new Request('https://worker.example/generate-3d/models', {
      headers: { Authorization: 'Bearer legacy-token' },
    }), env, { fetch: fetchImpl });

    expect(signup.status).toBe(201);
    expect(await signup.json()).toEqual({
      user: { email: 'pending@example.com', role: 'user', status: 'pending' },
    });
    expect(models.status).toBe(200);
    expect(await models.json()).toEqual({
      models: [{ id: 'public-1', visibility: 'public' }],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('uses the legacy session endpoint to authorize target access', async () => {
    const bucket = new MemoryBucket();
    const env = createEnv(bucket);
    (env as WorkerEnv & { LEGACY_WORKER_ORIGIN: string }).LEGACY_WORKER_ORIGIN =
      'https://legacy.example';
    await bucket.put('image-targets/index.json', JSON.stringify({
      targets: [{
        id: 'owned-target',
        label: 'Owned',
        image_url: 'https://worker.example/image-targets/images/owned.png',
        image_object_key: 'image-targets/images/owned.png',
        objects: [{
          kind: 'youtube',
          id: 'video-1',
          youtube: {
            video_id: 'dQw4w9WgXcQ',
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
          },
          placement: placement(),
        }],
        groups: [],
        owner_email: 'owner@example.com',
        visibility: 'private',
        scan_id: 'scan-owned',
        access_mode: 'owner_only',
        allowed_emails: [],
        created_at: '2026-07-25T12:00:00Z',
        updated_at: '2026-07-25T12:00:00Z',
      }],
    }));
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('https://legacy.example/auth/session');
      return new Response(JSON.stringify({
        user: {
          email: 'owner@example.com',
          role: 'user',
          status: 'active',
        },
      }), { headers: { 'Content-Type': 'application/json' } });
    });

    const response = await handleRequest(new Request(
      'https://worker.example/generate-3d/image-targets',
      { headers: { Authorization: 'Bearer legacy-token' } },
    ), env, { fetch: fetchImpl });
    const body = await response.json() as { targets: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.targets.map((target) => target.id)).toEqual(['owned-target']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('stores uploaded object images in R2 and returns durable media objects', async () => {
    const bucket = new MemoryBucket();
    const env = createEnv(bucket);
    const token = await signupAndLogin(env);
    const response = await handleRequest(new Request('https://worker.example/generate-3d/image-targets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        label: 'Poster target',
        image_base64: btoa('marker'),
        image_mime_type: 'image/png',
        objects: [{
          kind: 'image',
          id: 'poster-1',
          image: {
            url: 'data:image/png;base64,draft',
            label: 'Poster',
            width: 1200,
            height: 800,
            aspect_ratio: 1.5,
            pending_source: {
              source: 'upload',
              image_base64: btoa('poster'),
              image_mime_type: 'image/png',
            },
          },
          placement: placement(),
        }, {
          kind: 'youtube',
          id: 'video-1',
          youtube: {
            video_id: 'dQw4w9WgXcQ',
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
          },
          placement: placement(),
        }],
      }),
    }), env, {
      now: () => new Date('2026-07-25T12:00:00.000Z'),
      randomUUID: () => 'target-uuid',
      fetch: vi.fn(),
    });

    expect(response.status).toBe(201);
    const body = await response.json() as { target: any };
    expect(body.target.objects[0].image).toMatchObject({
      url: 'https://worker.example/image-targets/media/target-uuid/poster-1.png',
      object_key: 'image-targets/media/target-uuid/poster-1.png',
      label: 'Poster',
      width: 1200,
      height: 800,
      aspect_ratio: 1.5,
    });
    expect(body.target.objects[0].image.pending_source).toBeUndefined();
    expect(body.target.objects[1].youtube.video_id).toBe('dQw4w9WgXcQ');
    expect(bucket.values.has('image-targets/media/target-uuid/poster-1.png')).toBe(true);
  });

  it('imports public HTTPS images with limits and removes replaced or deleted R2 media', async () => {
    const bucket = new MemoryBucket();
    const env = createEnv(bucket);
    const token = await signupAndLogin(env);
    const fetchImpl = vi.fn(async () => new Response('remote-image', {
      headers: { 'Content-Type': 'image/webp', 'Content-Length': '12' },
    }));
    const created = await createUrlTarget(env, token, fetchImpl);
    const target = (await created.json() as { target: any }).target;
    const originalKey = target.objects[0].image.object_key;
    expect(bucket.values.has(originalKey)).toBe(true);

    const updated = await handleRequest(new Request(`https://worker.example/generate-3d/image-targets/${target.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ objects: [] }),
    }), env, { now: () => new Date('2026-07-25T13:00:00Z'), randomUUID: crypto.randomUUID, fetch: fetchImpl });
    expect(updated.status).toBe(400);
    expect(await updated.json()).toEqual({ error: 'Add at least one target object.' });
    expect(bucket.values.has(originalKey)).toBe(true);

    const removed = await handleRequest(new Request(`https://worker.example/generate-3d/image-targets/${target.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }), env, { now: () => new Date('2026-07-25T14:00:00Z'), randomUUID: crypto.randomUUID, fetch: fetchImpl });
    const removedBody = await removed.json();
    expect({ status: removed.status, body: removedBody }).toMatchObject({
      status: 200,
      body: { deleted: true },
    });
    expect(bucket.values.has(target.image_object_key)).toBe(false);
  });

  it('preserves the exact object ID when an image-only target becomes YouTube-only', async () => {
    const bucket = new MemoryBucket();
    const env = createEnv(bucket);
    const token = await signupAndLogin(env);
    const fetchImpl = vi.fn(async () => new Response('remote-image', {
      headers: { 'Content-Type': 'image/webp', 'Content-Length': '12' },
    }));
    const created = await createUrlTarget(env, token, fetchImpl);
    const createdTarget = (await created.json() as { target: any }).target;

    expect(created.status).toBe(201);
    expect(createdTarget.objects.map((object: { id: string }) => object.id)).toEqual(['remote-1']);

    const updated = await handleRequest(new Request(
      `https://worker.example/generate-3d/image-targets/${createdTarget.id}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objects: [{
            kind: 'youtube',
            id: 'video-only-1',
            youtube: {
              video_id: 'dQw4w9WgXcQ',
              url: 'https://youtu.be/dQw4w9WgXcQ',
              thumbnail_url: 'https://example.invalid/ignored.jpg',
            },
            placement: placement(),
          }],
        }),
      },
    ), env, {
      now: () => new Date('2026-07-25T13:00:00Z'),
      randomUUID: crypto.randomUUID,
      fetch: fetchImpl,
    });
    const updatedTarget = (await updated.json() as { target: any }).target;

    expect(updated.status).toBe(200);
    expect(updatedTarget.objects).toHaveLength(1);
    expect(updatedTarget.objects[0]).toMatchObject({
      kind: 'youtube',
      id: 'video-only-1',
      youtube: {
        video_id: 'dQw4w9WgXcQ',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      },
    });
    const scanned = await handleRequest(new Request(
      `https://worker.example/generate-3d/image-targets/scan/${updatedTarget.scan_id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ), env, {
      now: () => new Date('2026-07-25T13:00:00Z'),
      randomUUID: crypto.randomUUID,
      fetch: fetchImpl,
    });
    const scannedTarget = (await scanned.json() as { target: any }).target;
    expect(scanned.status).toBe(200);
    expect(scannedTarget.objects.map((object: { id: string }) => object.id)).toEqual(['video-only-1']);
  });

  it('normalizes legacy public targets when their owner lists them', async () => {
    const bucket = new MemoryBucket();
    const env = createEnv(bucket);
    const token = await signupAndLogin(env);
    await bucket.put('image-targets/index.json', JSON.stringify({
      targets: [{
        id: 'legacy-public',
        label: 'Legacy public',
        image_url: 'https://worker.example/image-targets/images/legacy.png',
        image_object_key: 'image-targets/images/legacy.png',
        model: {
          id: 'legacy-model',
          label: 'Legacy model',
          url: 'https://worker.example/models/generated/legacy.glb',
        },
        placement: placement(),
        owner_email: 'owner@example.com',
        visibility: 'public',
        created_at: '2026-07-01T12:00:00Z',
        updated_at: '2026-07-01T12:00:00Z',
      }],
    }));

    const response = await handleRequest(new Request(
      'https://worker.example/generate-3d/image-targets',
      { headers: { Authorization: `Bearer ${token}` } },
    ), env, {
      now: () => new Date('2026-07-25T12:00:00Z'),
      randomUUID: () => 'legacy-scan-id',
      fetch: vi.fn(),
    });
    const target = (await response.json() as { targets: any[] }).targets[0];

    expect(response.status).toBe(200);
    expect(target).toMatchObject({
      id: 'legacy-public',
      scan_id: 'legacy-scan-id',
      access_mode: 'anyone_with_link',
      allowed_emails: [],
    });
    expect(target.objects).toEqual([{
      kind: 'model',
      id: 'object-1',
      model: {
        id: 'legacy-model',
        label: 'Legacy model',
        url: 'https://worker.example/models/generated/legacy.glb',
      },
      placement: placement(),
    }]);
  });

  it('rejects non-canonical submitted object IDs instead of changing them', async () => {
    const bucket = new MemoryBucket();
    const env = createEnv(bucket);
    const token = await signupAndLogin(env);
    const response = await handleRequest(new Request(
      'https://worker.example/generate-3d/image-targets',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: 'Invalid ID',
          image_base64: btoa('marker'),
          image_mime_type: 'image/png',
          objects: [{
            kind: 'youtube',
            id: ' video-with-spaces ',
            youtube: { video_id: 'dQw4w9WgXcQ' },
            placement: placement(),
          }],
        }),
      },
    ), env, {
      now: () => new Date('2026-07-25T12:00:00Z'),
      randomUUID: () => 'invalid-id-target',
      fetch: vi.fn(),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Target object IDs must use only letters, numbers, dot, underscore, or hyphen.',
    });

    const collisionProne = await handleRequest(new Request(
      'https://worker.example/generate-3d/image-targets',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: 'Collision-prone ID',
          image_base64: btoa('marker'),
          image_mime_type: 'image/png',
          objects: [{
            kind: 'youtube',
            id: 'video:one',
            youtube: { video_id: 'dQw4w9WgXcQ' },
            placement: placement(),
          }],
        }),
      },
    ), env, {
      now: () => new Date('2026-07-25T12:00:00Z'),
      randomUUID: () => 'collision-id-target',
      fetch: vi.fn(),
    });

    expect(collisionProne.status).toBe(400);
    expect(await collisionProne.json()).toEqual({
      error: 'Target object IDs must use only letters, numbers, dot, underscore, or hyphen.',
    });
  });

  it('cancels URL image streams immediately after they exceed 5 MB', async () => {
    const bucket = new MemoryBucket();
    const env = createEnv(bucket);
    const token = await signupAndLogin(env);
    let cancelled = false;
    const oneMegabyte = new Uint8Array(1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let index = 0; index < 6; index += 1) {
          controller.enqueue(oneMegabyte);
        }
      },
      cancel() {
        cancelled = true;
      },
    });
    const fetchImpl = vi.fn(async () => new Response(stream, {
      headers: { 'Content-Type': 'image/webp' },
    }));

    const response = await createUrlTarget(env, token, fetchImpl);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Image objects must be 5 MB or smaller.' });
    expect(cancelled).toBe(true);
  });

  it('rejects private image URLs before fetching them', async () => {
    const bucket = new MemoryBucket();
    const env = createEnv(bucket);
    const token = await signupAndLogin(env);
    const fetchImpl = vi.fn();
    const response = await createUrlTarget(env, token, fetchImpl, 'https://127.0.0.1/private.png');
    expect(response.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

function createEnv(bucket: MemoryBucket): WorkerEnv {
  return {
    AUTH_SECRET: 'test-secret-at-least-32-characters-long',
    ADMIN_EMAIL: 'owner@example.com',
    PUBLIC_ORIGIN: 'https://worker.example',
    ASSET_BUCKET: bucket,
  };
}

async function signupAndLogin(env: WorkerEnv): Promise<string> {
  const signup = await handleRequest(new Request('https://worker.example/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.com', password: 'correct horse battery staple', name: 'Owner' }),
  }), env);
  expect(signup.status).toBe(201);
  return (await signup.json() as { token: string }).token;
}

async function createUrlTarget(
  env: WorkerEnv,
  token: string,
  fetchImpl: typeof fetch,
  sourceUrl = 'https://cdn.example/poster.webp',
): Promise<Response> {
  return handleRequest(new Request('https://worker.example/generate-3d/image-targets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      label: 'Remote image',
      image_base64: btoa('marker'),
      image_mime_type: 'image/png',
      objects: [{
        kind: 'image',
        id: 'remote-1',
        image: {
          url: sourceUrl,
          label: 'Remote',
          width: 640,
          height: 480,
          aspect_ratio: 4 / 3,
          pending_source: { source: 'url', source_url: sourceUrl },
        },
        placement: placement(),
      }],
    }),
  }), env, {
    now: () => new Date('2026-07-25T12:00:00Z'),
    randomUUID: () => 'remote-target',
    fetch: fetchImpl,
  });
}

function placement() {
  return {
    scale: 1,
    offset_x: 0,
    offset_y: 0,
    height: 0.12,
    rotation_x: 0,
    rotation_y: 0,
    rotation_z: 0,
  };
}

async function createLocalSessionToken(
  email: string,
  role: 'admin' | 'user',
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    sub: email,
    role,
    jti: 'test-session',
    iat: now,
    exp: now + 3600,
  })));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)),
  );
  return `${payload}.${base64Url(signature)}`;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

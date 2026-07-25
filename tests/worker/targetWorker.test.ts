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
    expect(updated.status).toBe(200);
    expect(bucket.values.has(originalKey)).toBe(false);

    const removed = await handleRequest(new Request(`https://worker.example/generate-3d/image-targets/${target.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }), env, { now: () => new Date('2026-07-25T14:00:00Z'), randomUUID: crypto.randomUUID, fetch: fetchImpl });
    expect(removed.status).toBe(200);
    expect(bucket.values.has(target.image_object_key)).toBe(false);
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

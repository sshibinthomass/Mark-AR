# Cloud Image Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build cloud-backed image targets so a user can upload an image, bind a Cloudflare GLB model to it, save it in Cloudflare R2, and scan that image in Mark-AR to show the saved model.

**Architecture:** Extend the existing Web-AR Cloudflare Worker because it already owns auth, R2, generated model visibility, CORS, and signed sessions. Mark-AR consumes the new image-target API, renders a target-management page with a Three.js preview, and starts MindAR with built-in marker targets plus cloud targets in one compiled target set.

**Tech Stack:** TypeScript, Vite, Vitest, Three.js, MindAR image tracking, Cloudflare Workers, Cloudflare R2, GitHub Pages.

## Global Constraints

- Saved image targets are cloud-backed, not local-only.
- A target saved on one approved account is available from another browser after signing in with the same account.
- Admin users can see and manage all targets, matching generated-model behavior.
- Mark-AR route for this workflow is `#/targets`.
- Saved targets default to `private`.
- Accepted target image MIME types are `image/png`, `image/jpeg`, and `image/webp`.
- Decoded target image payloads larger than 5 MB are rejected.
- Placement fields are `scale`, `offset_x`, `offset_y`, and `height`.
- Rotation controls are out of scope for this implementation.
- Commit after each feature slice.

---

## File Structure

- Modify `D:\Github-Projects\Web-AR\worker\src\index.ts`: add Worker route handling, R2 helpers, validation, visibility filtering, and image serving for image targets.
- Modify `D:\Github-Projects\Web-AR\tests\worker\generateModelWorker.test.ts`: add Worker API tests for create/list/update/delete/serve behavior.
- Create `D:\Github-Projects\Mark-AR\src\app\cloudImageTargets.ts`: Mark-AR client for Worker image-target routes.
- Create `D:\Github-Projects\Mark-AR\tests\cloudImageTargets.test.ts`: endpoint mapping, auth headers, payload mapping, and error handling tests.
- Create `D:\Github-Projects\Mark-AR\src\app\imageTargetPayload.ts`: payload validation, placement defaults, and image data helpers.
- Create `D:\Github-Projects\Mark-AR\tests\imageTargetPayload.test.ts`: validation/default tests.
- Create `D:\Github-Projects\Mark-AR\src\ar\markerTargets.ts`: converts built-in markers and cloud image targets into runtime MindAR targets with sequential indices.
- Modify `D:\Github-Projects\Mark-AR\src\ar\mindarRuntime.ts`: accept runtime targets and per-target Cloudflare assets.
- Modify `D:\Github-Projects\Mark-AR\src\ar\cloudflareMarkerObject.ts`: apply saved placement values to Cloudflare model groups.
- Modify `D:\Github-Projects\Mark-AR\tests\mindarRuntime.test.ts`: verify per-target objects and target indices.
- Create `D:\Github-Projects\Mark-AR\tests\markerTargets.test.ts`: verify cloud target mapping and sequential indices.
- Create `D:\Github-Projects\Mark-AR\src\scene\ImageTargetPreview.ts`: Three.js preview for uploaded image plus selected model.
- Create `D:\Github-Projects\Mark-AR\tests\imageTargetPreview.test.ts`: verify preview lifecycle can be constructed with injected renderer/loader dependencies.
- Modify `D:\Github-Projects\Mark-AR\src\ui\pageRoutes.ts`: add the `targets` route.
- Modify `D:\Github-Projects\Mark-AR\src\ui\appShell.ts`: add navigation, home card, and target page controls.
- Modify `D:\Github-Projects\Mark-AR\src\main.ts`: wire target page state, cloud target list, save/delete actions, preview updates, and scanner target loading.
- Modify `D:\Github-Projects\Mark-AR\src\style.css`: style the targets page and preview controls in the existing Web-AR-like theme.
- Modify `D:\Github-Projects\Mark-AR\tests\pageRoutes.test.ts`: include `targets`.
- Modify `D:\Github-Projects\Mark-AR\tests\appShell.test.ts`: assert target page controls exist.

---

### Task 1: Web-AR Worker Image Target API

**Files:**
- Modify: `D:\Github-Projects\Web-AR\worker\src\index.ts`
- Modify: `D:\Github-Projects\Web-AR\tests\worker\generateModelWorker.test.ts`

**Interfaces:**
- Consumes: existing `requireApprovedUser(request, env, deps)`, `requireAdminUser(request, env, deps)`, `readOptionalApprovedUser(request, env, deps)`, `jsonResponse`, `readJsonObject`, `writeJsonObject`, `base64ToArrayBuffer`, `getPublicOrigin`, `formatTimestamp`, `safeObjectKeyPart`, `appendAuditEvent`, and generated-model visibility patterns from `index.ts`.
- Produces:
  - `GET /generate-3d/image-targets`
  - `POST /generate-3d/image-targets`
  - `PATCH /generate-3d/image-targets/:id`
  - `DELETE /generate-3d/image-targets/:id`
  - `GET /image-targets/images/:file`
  - Worker response record shape `ImageTargetEntry`.

- [ ] **Step 1: Write failing Worker tests**

Append these tests inside `describe('handleGenerateModelRequest', () => { ... })` in `D:\Github-Projects\Web-AR\tests\worker\generateModelWorker.test.ts`.

```ts
  it('creates a private image target for an approved user and stores the uploaded image', async () => {
    const { bucket, objects } = createMemoryBucket({
      'image-targets/index.json': JSON.stringify({ targets: [] }),
    });
    const env = createEnv({ MODEL_BUCKET: bucket });
    const deps = { fetch: vi.fn(), now: () => new Date('2026-07-05T18:00:00Z') };
    const adminToken = await createAdminToken(env, deps);
    const ownerToken = await createApprovedUserToken(env, deps, adminToken, 'maker@example.com');

    const response = await handleGenerateModelRequest(
      withAuth(new Request('https://worker.example/generate-3d/image-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: ' Product box ',
          image_base64: 'aW1hZ2U=',
          image_mime_type: 'image/jpeg',
          model: {
            id: 'generated-fc-123',
            label: 'Chair',
            url: 'https://worker.example/models/generated/chair.glb',
            preview_url: 'https://worker.example/models/generated/previews/chair.png',
          },
          placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.2, height: 0.16 },
        }),
      }), ownerToken),
      env,
      deps,
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      id: 'target-20260705-180000-product-box',
      label: 'Product box',
      image_url: 'https://worker.example/image-targets/images/target-20260705-180000-product-box.jpg',
      image_object_key: 'image-targets/images/target-20260705-180000-product-box.jpg',
      model: {
        id: 'generated-fc-123',
        label: 'Chair',
        url: 'https://worker.example/models/generated/chair.glb',
        preview_url: 'https://worker.example/models/generated/previews/chair.png',
      },
      placement: { scale: 1.2, offset_x: 0.1, offset_y: -0.2, height: 0.16 },
      owner_email: 'maker@example.com',
      visibility: 'private',
      created_at: '2026-07-05T18:00:00.000Z',
      updated_at: '2026-07-05T18:00:00.000Z',
    });
    expect(objects.get('image-targets/images/target-20260705-180000-product-box.jpg')).toEqual(
      new Uint8Array([105, 109, 97, 103, 101]).buffer,
    );
    expect(JSON.parse(objects.get('image-targets/index.json') as string)).toEqual({
      targets: [expect.objectContaining({ id: 'target-20260705-180000-product-box' })],
    });
    expect(JSON.parse(objects.get('image-targets/records/target-20260705-180000-product-box.json') as string)).toEqual(
      expect.objectContaining({ id: 'target-20260705-180000-product-box' }),
    );
  });

  it('requires an approved session to create image targets and validates image payloads', async () => {
    const env = createEnv();
    const deps = { fetch: vi.fn(), now: () => new Date('2026-07-05T18:00:00Z') };

    const unauthenticated = await handleGenerateModelRequest(
      new Request('https://worker.example/generate-3d/image-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: 'aW1hZ2U=', image_mime_type: 'image/jpeg' }),
      }),
      env,
      deps,
    );

    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toEqual({ error: 'Login required.' });

    const adminToken = await createAdminToken(env, deps);
    const invalidMime = await handleGenerateModelRequest(
      withAuth(new Request('https://worker.example/generate-3d/image-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: 'aW1hZ2U=',
          image_mime_type: 'image/gif',
          model: { id: 'm1', label: 'Chair', url: 'https://worker.example/chair.glb' },
        }),
      }), adminToken),
      env,
      deps,
    );

    expect(invalidMime.status).toBe(400);
    expect(await invalidMime.json()).toEqual({
      error: 'image_mime_type must be image/png, image/jpeg, or image/webp.',
    });
  });

  it('lists image targets by public visibility, owner, and admin access', async () => {
    const { bucket } = createMemoryBucket({
      'image-targets/index.json': JSON.stringify({
        targets: [
          {
            id: 'public-target',
            label: 'Public target',
            image_url: 'https://worker.example/image-targets/images/public-target.jpg',
            image_object_key: 'image-targets/images/public-target.jpg',
            model: { id: 'm-public', label: 'Public chair', url: 'https://worker.example/public.glb' },
            placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.12 },
            owner_email: 'maker@example.com',
            visibility: 'public',
            created_at: '2026-07-05T18:00:00.000Z',
            updated_at: '2026-07-05T18:00:00.000Z',
          },
          {
            id: 'private-target',
            label: 'Private target',
            image_url: 'https://worker.example/image-targets/images/private-target.jpg',
            image_object_key: 'image-targets/images/private-target.jpg',
            model: { id: 'm-private', label: 'Private chair', url: 'https://worker.example/private.glb' },
            placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.12 },
            owner_email: 'maker@example.com',
            visibility: 'private',
            created_at: '2026-07-05T18:01:00.000Z',
            updated_at: '2026-07-05T18:01:00.000Z',
          },
          {
            id: 'other-private-target',
            label: 'Other private target',
            image_url: 'https://worker.example/image-targets/images/other-private-target.jpg',
            image_object_key: 'image-targets/images/other-private-target.jpg',
            model: { id: 'm-other', label: 'Other table', url: 'https://worker.example/other.glb' },
            placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.12 },
            owner_email: 'other@example.com',
            visibility: 'private',
            created_at: '2026-07-05T18:02:00.000Z',
            updated_at: '2026-07-05T18:02:00.000Z',
          },
        ],
      }),
    });
    const env = createEnv({ MODEL_BUCKET: bucket });
    const deps = { fetch: vi.fn(), now: () => new Date('2026-07-05T18:10:00Z') };
    const adminToken = await createAdminToken(env, deps);
    const ownerToken = await createApprovedUserToken(env, deps, adminToken, 'maker@example.com');

    const guestResponse = await handleGenerateModelRequest(
      new Request('https://worker.example/generate-3d/image-targets'),
      env,
      deps,
    );
    const ownerResponse = await handleGenerateModelRequest(
      withAuth(new Request('https://worker.example/generate-3d/image-targets'), ownerToken),
      env,
      deps,
    );
    const adminResponse = await handleGenerateModelRequest(
      withAuth(new Request('https://worker.example/generate-3d/image-targets'), adminToken),
      env,
      deps,
    );

    expect(((await guestResponse.json()) as { targets: Array<{ id: string }> }).targets.map((target) => target.id)).toEqual([
      'public-target',
    ]);
    expect(((await ownerResponse.json()) as { targets: Array<{ id: string }> }).targets.map((target) => target.id)).toEqual([
      'private-target',
      'public-target',
    ]);
    expect(((await adminResponse.json()) as { targets: Array<{ id: string }> }).targets.map((target) => target.id)).toEqual([
      'other-private-target',
      'private-target',
      'public-target',
    ]);
  });

  it('allows only owners or admins to update and delete image targets', async () => {
    const storedObjects = new Map<string, string | ArrayBuffer>();
    storedObjects.set('image-targets/images/private-target.jpg', new Uint8Array([1, 2, 3]).buffer);
    storedObjects.set('image-targets/records/private-target.json', JSON.stringify({ id: 'private-target' }));
    storedObjects.set(
      'image-targets/index.json',
      JSON.stringify({
        targets: [
          {
            id: 'private-target',
            label: 'Private target',
            image_url: 'https://worker.example/image-targets/images/private-target.jpg',
            image_object_key: 'image-targets/images/private-target.jpg',
            model: { id: 'm-private', label: 'Private chair', url: 'https://worker.example/private.glb' },
            placement: { scale: 1, offset_x: 0, offset_y: 0, height: 0.12 },
            owner_email: 'maker@example.com',
            visibility: 'private',
            created_at: '2026-07-05T18:01:00.000Z',
            updated_at: '2026-07-05T18:01:00.000Z',
          },
        ],
      }),
    );
    const env = createEnv({
      MODEL_BUCKET: {
        get: vi.fn((key: string) => {
          const value = storedObjects.get(key);
          return Promise.resolve(value ? { body: value, httpMetadata: { contentType: 'application/json' } } : null);
        }),
        put: vi.fn((key: string, value: ArrayBuffer | ReadableStream | string) => {
          if (typeof value === 'string' || value instanceof ArrayBuffer) {
            storedObjects.set(key, value);
          }
          return Promise.resolve(undefined);
        }),
        delete: vi.fn((key: string) => {
          storedObjects.delete(key);
          return Promise.resolve(undefined);
        }),
      },
    });
    const deps = { fetch: vi.fn(), now: () => new Date('2026-07-05T18:20:00Z') };
    const adminToken = await createAdminToken(env, deps);
    const ownerToken = await createApprovedUserToken(env, deps, adminToken, 'maker@example.com');
    const otherToken = await createApprovedUserToken(env, deps, adminToken, 'other@example.com');

    const forbidden = await handleGenerateModelRequest(
      withAuth(new Request('https://worker.example/generate-3d/image-targets/private-target', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Nope' }),
      }), otherToken),
      env,
      deps,
    );
    const updated = await handleGenerateModelRequest(
      withAuth(new Request('https://worker.example/generate-3d/image-targets/private-target', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Renamed target', placement: { scale: 1.5 } }),
      }), ownerToken),
      env,
      deps,
    );
    const deleted = await handleGenerateModelRequest(
      withAuth(new Request('https://worker.example/generate-3d/image-targets/private-target', { method: 'DELETE' }), adminToken),
      env,
      deps,
    );

    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ error: 'Only the owner or an admin can manage this image target.' });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      id: 'private-target',
      label: 'Renamed target',
      placement: { scale: 1.5, offset_x: 0, offset_y: 0, height: 0.12 },
      updated_at: '2026-07-05T18:20:00.000Z',
    });
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ deleted: true, id: 'private-target' });
    expect(JSON.parse(storedObjects.get('image-targets/index.json') as string)).toEqual({ targets: [] });
    expect(storedObjects.has('image-targets/images/private-target.jpg')).toBe(false);
    expect(storedObjects.has('image-targets/records/private-target.json')).toBe(false);
  });

  it('serves uploaded image target files from R2', async () => {
    const env = createEnv({
      MODEL_BUCKET: {
        get: vi.fn().mockResolvedValue({
          body: new Uint8Array([0xff, 0xd8, 0xff]).buffer,
          httpMetadata: { contentType: 'image/jpeg' },
        }),
        put: vi.fn().mockResolvedValue(undefined),
      },
    });

    const response = await handleGenerateModelRequest(
      new Request('https://worker.example/image-targets/images/target.jpg'),
      env,
      { fetch: vi.fn(), now: () => new Date('2026-07-05T18:00:00Z') },
    );

    expect(env.MODEL_BUCKET.get).toHaveBeenCalledWith('image-targets/images/target.jpg');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff]));
  });
```

- [ ] **Step 2: Run Worker tests to verify they fail**

Run:

```powershell
cd D:\Github-Projects\Web-AR
npm test -- tests/worker/generateModelWorker.test.ts
```

Expected: FAIL because `/generate-3d/image-targets` and `/image-targets/images/...` are not implemented.

- [ ] **Step 3: Add Worker types and route constants**

In `D:\Github-Projects\Web-AR\worker\src\index.ts`, add these constants near the generated-model key constants:

```ts
const imageTargetsIndexKey = 'image-targets/index.json';
const imageTargetRecordPrefix = 'image-targets/records/';
const imageTargetImagePrefix = 'image-targets/images/';
const maxImageTargetBytes = 5 * 1024 * 1024;
const allowedImageTargetMimeTypes = ['image/png', 'image/jpeg', 'image/webp'] as const;
```

Add these types near the generated-model request/entry types:

```ts
type ImageTargetVisibility = ModelVisibility;

type ImageTargetPlacement = {
  scale: number;
  offset_x: number;
  offset_y: number;
  height: number;
};

type ImageTargetModel = {
  id: string;
  label: string;
  url: string;
  preview_url?: string;
};

type ImageTargetEntry = {
  id: string;
  label: string;
  image_url: string;
  image_object_key: string;
  model: ImageTargetModel;
  placement: ImageTargetPlacement;
  owner_email?: string;
  visibility?: ImageTargetVisibility;
  created_at: string;
  updated_at: string;
};

type ImageTargetsIndex = {
  targets: ImageTargetEntry[];
};

type ImageTargetRequestBody = {
  label?: unknown;
  image_base64?: unknown;
  image_mime_type?: unknown;
  model?: unknown;
  placement?: unknown;
  visibility?: unknown;
};
```

- [ ] **Step 4: Add Worker routing**

In `routeGenerateModelRequest`, add these branches before the final `request.method !== 'POST'` block:

```ts
  if (request.method === 'GET' && url.pathname.startsWith('/image-targets/images/')) {
    return serveImageTarget(url.pathname.slice(1), env);
  }

  if (request.method === 'GET' && url.pathname === '/generate-3d/image-targets') {
    const index = await readImageTargetsIndex(env);
    const auth = await readOptionalApprovedUser(request, env, deps);
    const visibleTargets = index.targets.filter((target) => isImageTargetVisibleToUser(target, auth?.user ?? null));
    return jsonResponse({
      targets: visibleTargets.sort((left, right) => right.created_at.localeCompare(left.created_at)),
    });
  }

  if (request.method === 'POST' && url.pathname === '/generate-3d/image-targets') {
    const auth = await requireApprovedUser(request, env, deps);
    if (auth instanceof Response) {
      return auth;
    }
    return handleImageTargetCreateRequest(request, env, deps, url, auth.user);
  }

  if (url.pathname.startsWith('/generate-3d/image-targets/')) {
    const auth = await requireApprovedUser(request, env, deps);
    if (auth instanceof Response) {
      return auth;
    }
    const targetId = decodeURIComponent(url.pathname.replace('/generate-3d/image-targets/', ''));
    return handleImageTargetManagementRequest(request, env, deps, url, targetId, auth.user);
  }
```

- [ ] **Step 5: Implement Worker image-target helpers**

Add these helper functions near generated-model management helpers in `index.ts`:

```ts
async function handleImageTargetCreateRequest(
  request: Request,
  env: WorkerEnv,
  deps: GenerateModelDeps,
  url: URL,
  user: StoredUser,
): Promise<Response> {
  if (!env.MODEL_BUCKET) {
    return jsonResponse({ error: 'Model bucket binding is not configured.' }, 500);
  }

  const body = await readJsonBody<ImageTargetRequestBody>(request);
  if (!body.ok) {
    return jsonResponse({ error: body.error }, 400);
  }

  const imageMimeType = normalizeImageTargetMimeType(body.value.image_mime_type);
  if (!imageMimeType) {
    return jsonResponse({ error: 'image_mime_type must be image/png, image/jpeg, or image/webp.' }, 400);
  }

  if (typeof body.value.image_base64 !== 'string' || body.value.image_base64.length === 0) {
    return jsonResponse({ error: 'image_base64 is required.' }, 400);
  }

  const model = normalizeImageTargetModel(body.value.model);
  if (!model) {
    return jsonResponse({ error: 'model with id, label, and url is required.' }, 400);
  }

  const now = deps.now();
  const label = normalizeModelLabel(body.value.label) ?? 'Image target';
  const id = `target-${formatTimestamp(now)}-${slugifyModelLabel(label)}`;
  const extension = imageTargetExtension(imageMimeType);
  const objectKey = `${imageTargetImagePrefix}${id}.${extension}`;
  const imageBytes = base64ToArrayBuffer(stripDataUrlPrefix(body.value.image_base64));
  if (imageBytes.byteLength > maxImageTargetBytes) {
    return jsonResponse({ error: 'Image target uploads must be 5 MB or smaller.' }, 400);
  }

  const entry: ImageTargetEntry = {
    id,
    label,
    image_url: `${getPublicOrigin(env, url.origin)}/${objectKey}`,
    image_object_key: objectKey,
    model,
    placement: normalizeImageTargetPlacement(body.value.placement),
    owner_email: user.email,
    visibility: 'private',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  await env.MODEL_BUCKET.put(objectKey, imageBytes, {
    httpMetadata: { contentType: imageMimeType },
  });
  await upsertImageTargetEntry(env, entry);
  await appendAuditEvent(env, deps, {
    actor: user.email,
    action: 'image-target.create',
    target: id,
    status: 'ok',
  });

  return jsonResponse(entry, 201);
}

async function handleImageTargetManagementRequest(
  request: Request,
  env: WorkerEnv,
  deps: GenerateModelDeps,
  url: URL,
  targetId: string,
  user: StoredUser,
): Promise<Response> {
  if (!targetId) {
    return jsonResponse({ error: 'target_id is required.' }, 400);
  }
  if (!env.MODEL_BUCKET) {
    return jsonResponse({ error: 'Model bucket binding is not configured.' }, 500);
  }

  if (request.method === 'PATCH') {
    return updateImageTarget(request, env, deps, url, targetId, user);
  }

  if (request.method === 'DELETE') {
    return deleteImageTarget(env, deps, targetId, user);
  }

  return jsonResponse({ error: 'Only PATCH and DELETE requests are supported for image targets.' }, 405);
}

async function updateImageTarget(
  request: Request,
  env: WorkerEnv,
  deps: GenerateModelDeps,
  url: URL,
  targetId: string,
  user: StoredUser,
): Promise<Response> {
  const body = await readJsonBody<ImageTargetRequestBody>(request);
  if (!body.ok) {
    return jsonResponse({ error: body.error }, 400);
  }

  const index = await readImageTargetsIndex(env);
  const targetIndex = index.targets.findIndex((target) => target.id === targetId);
  if (targetIndex === -1) {
    return jsonResponse({ error: 'Image target not found.' }, 404);
  }

  const existingTarget = index.targets[targetIndex];
  if (!canManageImageTarget(existingTarget, user)) {
    return jsonResponse({ error: 'Only the owner or an admin can manage this image target.' }, 403);
  }

  const now = deps.now();
  const nextTarget: ImageTargetEntry = {
    ...existingTarget,
    label: normalizeModelLabel(body.value.label) ?? existingTarget.label,
    model: normalizeImageTargetModel(body.value.model) ?? existingTarget.model,
    placement: normalizeImageTargetPlacement(body.value.placement, existingTarget.placement),
    visibility: normalizeModelVisibility(body.value.visibility) ?? existingTarget.visibility,
    updated_at: now.toISOString(),
  };

  const imageMimeType = normalizeImageTargetMimeType(body.value.image_mime_type);
  if (body.value.image_mime_type !== undefined && !imageMimeType) {
    return jsonResponse({ error: 'image_mime_type must be image/png, image/jpeg, or image/webp.' }, 400);
  }
  if (typeof body.value.image_base64 === 'string' && body.value.image_base64.length > 0) {
    const mimeType = imageMimeType ?? 'image/png';
    const imageBytes = base64ToArrayBuffer(stripDataUrlPrefix(body.value.image_base64));
    if (imageBytes.byteLength > maxImageTargetBytes) {
      return jsonResponse({ error: 'Image target uploads must be 5 MB or smaller.' }, 400);
    }
    const objectKey = `${imageTargetImagePrefix}${targetId}.${imageTargetExtension(mimeType)}`;
    if (objectKey !== existingTarget.image_object_key) {
      await env.MODEL_BUCKET.delete(existingTarget.image_object_key);
    }
    await env.MODEL_BUCKET.put(objectKey, imageBytes, {
      httpMetadata: { contentType: mimeType },
    });
    nextTarget.image_object_key = objectKey;
    nextTarget.image_url = `${getPublicOrigin(env, url.origin)}/${objectKey}`;
  }

  index.targets[targetIndex] = nextTarget;
  await writeImageTargetsIndex(env, index);
  await writeJsonObject(env, imageTargetRecordKey(targetId), nextTarget);
  await appendAuditEvent(env, deps, {
    actor: user.email,
    action: 'image-target.update',
    target: targetId,
    status: 'ok',
  });

  return jsonResponse(nextTarget);
}

async function deleteImageTarget(
  env: WorkerEnv,
  deps: GenerateModelDeps,
  targetId: string,
  user: StoredUser,
): Promise<Response> {
  const index = await readImageTargetsIndex(env);
  const target = index.targets.find((entry) => entry.id === targetId);
  if (!target) {
    return jsonResponse({ error: 'Image target not found.' }, 404);
  }
  if (!canManageImageTarget(target, user)) {
    return jsonResponse({ error: 'Only the owner or an admin can manage this image target.' }, 403);
  }

  await writeImageTargetsIndex(env, {
    targets: index.targets.filter((entry) => entry.id !== targetId),
  });
  await env.MODEL_BUCKET.delete(target.image_object_key);
  await env.MODEL_BUCKET.delete(imageTargetRecordKey(targetId));
  await appendAuditEvent(env, deps, {
    actor: user.email,
    action: 'image-target.delete',
    target: targetId,
    status: 'ok',
  });

  return jsonResponse({ deleted: true, id: targetId });
}

async function serveImageTarget(objectKey: string, env: WorkerEnv): Promise<Response> {
  if (!env.MODEL_BUCKET) {
    return jsonResponse({ error: 'Model bucket binding is not configured.' }, 500);
  }
  if (!objectKey.startsWith(imageTargetImagePrefix)) {
    return jsonResponse({ error: 'Image target not found.' }, 404);
  }

  const object = await env.MODEL_BUCKET.get(objectKey);
  if (!object?.body) {
    return jsonResponse({ error: 'Image target not found.' }, 404);
  }

  return new Response(object.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': object.httpMetadata?.contentType ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
```

- [ ] **Step 6: Implement Worker index/validation helpers**

Add these helper functions near existing model index helpers:

```ts
async function readImageTargetsIndex(env: WorkerEnv): Promise<ImageTargetsIndex> {
  return readJsonObject<ImageTargetsIndex>(env, imageTargetsIndexKey, { targets: [] });
}

async function writeImageTargetsIndex(env: WorkerEnv, index: ImageTargetsIndex): Promise<void> {
  await writeJsonObject(env, imageTargetsIndexKey, index);
}

async function upsertImageTargetEntry(env: WorkerEnv, entry: ImageTargetEntry): Promise<void> {
  const index = await readImageTargetsIndex(env);
  const existingIndex = index.targets.findIndex((target) => target.id === entry.id);
  if (existingIndex >= 0) {
    index.targets[existingIndex] = entry;
  } else {
    index.targets.push(entry);
  }
  await writeImageTargetsIndex(env, index);
  await writeJsonObject(env, imageTargetRecordKey(entry.id), entry);
}

function imageTargetRecordKey(targetId: string): string {
  return `${imageTargetRecordPrefix}${safeObjectKeyPart(targetId)}.json`;
}

function normalizeImageTargetMimeType(value: unknown): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  return typeof value === 'string' && allowedImageTargetMimeTypes.includes(value as 'image/png' | 'image/jpeg' | 'image/webp')
    ? (value as 'image/png' | 'image/jpeg' | 'image/webp')
    : null;
}

function imageTargetExtension(mimeType: 'image/png' | 'image/jpeg' | 'image/webp'): string {
  if (mimeType === 'image/png') {
    return 'png';
  }
  if (mimeType === 'image/webp') {
    return 'webp';
  }
  return 'jpg';
}

function normalizeImageTargetModel(value: unknown): ImageTargetModel | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) {
    return null;
  }
  if (typeof candidate.label !== 'string' || !candidate.label.trim()) {
    return null;
  }
  if (typeof candidate.url !== 'string' || !candidate.url.trim()) {
    return null;
  }
  return {
    id: candidate.id.trim(),
    label: candidate.label.trim(),
    url: candidate.url.trim(),
    ...(typeof candidate.preview_url === 'string' && candidate.preview_url.trim()
      ? { preview_url: candidate.preview_url.trim() }
      : {}),
  };
}

function normalizeImageTargetPlacement(value: unknown, fallback: ImageTargetPlacement = defaultImageTargetPlacement()): ImageTargetPlacement {
  if (!value || typeof value !== 'object') {
    return fallback;
  }
  const candidate = value as Record<string, unknown>;
  return {
    scale: normalizeFinitePlacementNumber(candidate.scale, fallback.scale, 0.1, 5),
    offset_x: normalizeFinitePlacementNumber(candidate.offset_x, fallback.offset_x, -1, 1),
    offset_y: normalizeFinitePlacementNumber(candidate.offset_y, fallback.offset_y, -1, 1),
    height: normalizeFinitePlacementNumber(candidate.height, fallback.height, 0, 1),
  };
}

function defaultImageTargetPlacement(): ImageTargetPlacement {
  return { scale: 1, offset_x: 0, offset_y: 0, height: 0.12 };
}

function normalizeFinitePlacementNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function isImageTargetVisibleToUser(target: ImageTargetEntry, user: StoredUser | null): boolean {
  if (user?.role === 'admin') {
    return true;
  }
  if ((target.visibility ?? 'public') === 'public') {
    return true;
  }
  return Boolean(user && target.owner_email === user.email);
}

function canManageImageTarget(target: ImageTargetEntry, user: StoredUser): boolean {
  if (user.role === 'admin') {
    return true;
  }
  return Boolean(target.owner_email && target.owner_email === user.email);
}
```

- [ ] **Step 7: Run Worker tests to verify they pass**

Run:

```powershell
cd D:\Github-Projects\Web-AR
npm test -- tests/worker/generateModelWorker.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Worker API feature**

Run:

```powershell
cd D:\Github-Projects\Web-AR
git status --short
git add worker\src\index.ts tests\worker\generateModelWorker.test.ts
git commit -m "feat: add cloud image target api"
```

Expected: one commit containing only Worker source and Worker tests.

---

### Task 2: Mark-AR Cloud Target Client and Payload Helpers

**Files:**
- Create: `D:\Github-Projects\Mark-AR\src\app\cloudImageTargets.ts`
- Create: `D:\Github-Projects\Mark-AR\src\app\imageTargetPayload.ts`
- Create: `D:\Github-Projects\Mark-AR\tests\cloudImageTargets.test.ts`
- Create: `D:\Github-Projects\Mark-AR\tests\imageTargetPayload.test.ts`

**Interfaces:**
- Consumes: `CloudflareModelOption` and `ModelVisibility` from `src/app/cloudflareModels.ts`.
- Produces:
  - `CloudImageTarget`
  - `ImageTargetPlacement`
  - `DEFAULT_IMAGE_TARGET_PLACEMENT`
  - `createImageTarget(apiInput)`
  - `listImageTargets(apiInput)`
  - `updateImageTarget(apiInput)`
  - `deleteImageTarget(apiInput)`
  - `normalizePlacement(input)`
  - `imageTargetDataUrl(payload)`

- [ ] **Step 1: Write failing client and payload tests**

Create `D:\Github-Projects\Mark-AR\tests\cloudImageTargets.test.ts`:

```ts
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
        ownerEmail: 'maker@example.com',
        visibility: 'private',
        createdAt: '2026-07-05T18:00:00.000Z',
        updatedAt: '2026-07-05T18:00:00.000Z',
      },
    ]);
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
      }),
    });
    expect(target.id).toBe('target-1');
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
```

Create `D:\Github-Projects\Mark-AR\tests\imageTargetPayload.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMAGE_TARGET_PLACEMENT,
  imageTargetDataUrl,
  normalizePlacement,
  validateTargetImagePayload,
} from '../src/app/imageTargetPayload';

describe('image target payload helpers', () => {
  it('normalizes placement values with safe defaults and bounds', () => {
    expect(normalizePlacement()).toEqual(DEFAULT_IMAGE_TARGET_PLACEMENT);
    expect(normalizePlacement({ scale: 99, offsetX: -5, offsetY: 5, height: -1 })).toEqual({
      scale: 5,
      offsetX: -1,
      offsetY: 1,
      height: 0,
    });
  });

  it('validates supported target images and creates data URLs', () => {
    expect(validateTargetImagePayload({ imageBase64: 'abc', imageMimeType: 'image/jpeg' })).toEqual(null);
    expect(imageTargetDataUrl({ imageBase64: 'abc', imageMimeType: 'image/jpeg' })).toBe('data:image/jpeg;base64,abc');
    expect(validateTargetImagePayload({ imageBase64: '', imageMimeType: 'image/jpeg' })).toBe('Choose a target image.');
    expect(validateTargetImagePayload({ imageBase64: 'abc', imageMimeType: 'image/gif' })).toBe(
      'Target image must be PNG, JPEG, or WebP.',
    );
  });
});
```

- [ ] **Step 2: Run Mark-AR tests to verify they fail**

Run:

```powershell
cd D:\Github-Projects\Mark-AR
npm test -- tests/cloudImageTargets.test.ts tests/imageTargetPayload.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement payload helpers**

Create `D:\Github-Projects\Mark-AR\src\app\imageTargetPayload.ts`:

```ts
export type ImageTargetPlacement = {
  scale: number;
  offsetX: number;
  offsetY: number;
  height: number;
};

export type ImageTargetImagePayload = {
  imageBase64: string;
  imageMimeType: string;
};

export const DEFAULT_IMAGE_TARGET_PLACEMENT: ImageTargetPlacement = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  height: 0.12,
};

const supportedTargetImageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function normalizePlacement(value?: Partial<ImageTargetPlacement>): ImageTargetPlacement {
  return {
    scale: clampFinite(value?.scale, DEFAULT_IMAGE_TARGET_PLACEMENT.scale, 0.1, 5),
    offsetX: clampFinite(value?.offsetX, DEFAULT_IMAGE_TARGET_PLACEMENT.offsetX, -1, 1),
    offsetY: clampFinite(value?.offsetY, DEFAULT_IMAGE_TARGET_PLACEMENT.offsetY, -1, 1),
    height: clampFinite(value?.height, DEFAULT_IMAGE_TARGET_PLACEMENT.height, 0, 1),
  };
}

export function validateTargetImagePayload(payload: ImageTargetImagePayload): string | null {
  if (!payload.imageBase64) {
    return 'Choose a target image.';
  }
  if (!supportedTargetImageMimeTypes.has(payload.imageMimeType)) {
    return 'Target image must be PNG, JPEG, or WebP.';
  }
  return null;
}

export function imageTargetDataUrl(payload: ImageTargetImagePayload): string {
  return `data:${payload.imageMimeType};base64,${payload.imageBase64}`;
}

function clampFinite(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}
```

- [ ] **Step 4: Implement cloud image target client**

Create `D:\Github-Projects\Mark-AR\src\app\cloudImageTargets.ts`:

```ts
import type { CloudflareModelOption, ModelVisibility } from './cloudflareModels';
import type { ImageTargetImagePayload, ImageTargetPlacement } from './imageTargetPayload';
import { normalizePlacement } from './imageTargetPayload';

export type CloudImageTarget = {
  id: string;
  label: string;
  imageUrl: string;
  imageObjectKey: string;
  model: CloudflareModelOption;
  placement: ImageTargetPlacement;
  ownerEmail?: string;
  visibility?: ModelVisibility;
  createdAt?: string;
  updatedAt?: string;
};

type WorkerImageTargetModel = {
  id?: string;
  label?: string;
  url?: string;
  preview_url?: string;
};

type WorkerImageTargetEntry = {
  id?: string;
  label?: string;
  image_url?: string;
  image_object_key?: string;
  model?: WorkerImageTargetModel;
  placement?: {
    scale?: number;
    offset_x?: number;
    offset_y?: number;
    height?: number;
  };
  owner_email?: string;
  visibility?: ModelVisibility;
  created_at?: string;
  updated_at?: string;
};

type WorkerImageTargetsResponse = {
  targets?: WorkerImageTargetEntry[];
  error?: string;
};

type WorkerErrorResponse = {
  error?: string;
};

type ClientInput = {
  apiUrl: string;
  authToken?: string | null;
  fetchImpl?: typeof fetch;
};

type CreateImageTargetInput = ClientInput &
  ImageTargetImagePayload & {
    label: string;
    model: CloudflareModelOption;
    placement: ImageTargetPlacement;
  };

type UpdateImageTargetInput = ClientInput & {
  targetId: string;
  label?: string;
  model?: CloudflareModelOption;
  placement?: ImageTargetPlacement;
} & Partial<ImageTargetImagePayload>;

type DeleteImageTargetInput = ClientInput & {
  targetId: string;
};

export async function listImageTargets({
  apiUrl,
  authToken,
  fetchImpl = fetch,
}: ClientInput): Promise<CloudImageTarget[]> {
  if (!apiUrl) {
    return [];
  }

  const response = authToken
    ? await fetchImpl(imageTargetsUrl(apiUrl), { headers: authHeaders(authToken) })
    : await fetchImpl(imageTargetsUrl(apiUrl));
  const body = (await response.json()) as WorkerImageTargetsResponse;

  if (!response.ok) {
    throw new Error(body.error ?? `Image target list failed with HTTP ${response.status}.`);
  }

  return (body.targets ?? []).map(mapImageTargetEntry).filter((target): target is CloudImageTarget => Boolean(target));
}

export async function createImageTarget({
  apiUrl,
  authToken,
  fetchImpl = fetch,
  label,
  imageBase64,
  imageMimeType,
  model,
  placement,
}: CreateImageTargetInput): Promise<CloudImageTarget> {
  const response = await fetchImpl(imageTargetsUrl(apiUrl), {
    method: 'POST',
    headers: jsonHeaders(authToken),
    body: JSON.stringify({
      label,
      image_base64: imageBase64,
      image_mime_type: imageMimeType,
      model: modelRequestBody(model),
      placement: placementRequestBody(placement),
    }),
  });
  return parseImageTargetResponse(response, 'Image target create failed');
}

export async function updateImageTarget({
  apiUrl,
  authToken,
  fetchImpl = fetch,
  targetId,
  label,
  model,
  placement,
  imageBase64,
  imageMimeType,
}: UpdateImageTargetInput): Promise<CloudImageTarget> {
  const body: Record<string, unknown> = {};
  if (label !== undefined) {
    body.label = label;
  }
  if (model) {
    body.model = modelRequestBody(model);
  }
  if (placement) {
    body.placement = placementRequestBody(placement);
  }
  if (imageBase64 !== undefined) {
    body.image_base64 = imageBase64;
  }
  if (imageMimeType !== undefined) {
    body.image_mime_type = imageMimeType;
  }

  const response = await fetchImpl(imageTargetItemUrl(apiUrl, targetId), {
    method: 'PATCH',
    headers: jsonHeaders(authToken),
    body: JSON.stringify(body),
  });
  return parseImageTargetResponse(response, 'Image target update failed');
}

export async function deleteImageTarget({
  apiUrl,
  authToken,
  fetchImpl = fetch,
  targetId,
}: DeleteImageTargetInput): Promise<void> {
  const response = await fetchImpl(imageTargetItemUrl(apiUrl, targetId), {
    method: 'DELETE',
    headers: authHeaders(authToken),
  });
  const body = (await response.json()) as WorkerErrorResponse;
  if (!response.ok) {
    throw new Error(body.error ?? `Image target delete failed with HTTP ${response.status}.`);
  }
}

function mapImageTargetEntry(entry: WorkerImageTargetEntry): CloudImageTarget | null {
  if (!entry.id || !entry.label || !entry.image_url || !entry.image_object_key || !entry.model?.id || !entry.model.label || !entry.model.url) {
    return null;
  }

  return {
    id: entry.id,
    label: entry.label,
    imageUrl: entry.image_url,
    imageObjectKey: entry.image_object_key,
    model: {
      id: entry.model.id,
      label: entry.model.label,
      url: entry.model.url,
      ...(entry.model.preview_url ? { previewUrl: entry.model.preview_url } : {}),
    },
    placement: normalizePlacement({
      scale: entry.placement?.scale,
      offsetX: entry.placement?.offset_x,
      offsetY: entry.placement?.offset_y,
      height: entry.placement?.height,
    }),
    ...(entry.owner_email ? { ownerEmail: entry.owner_email } : {}),
    ...(entry.visibility ? { visibility: entry.visibility } : {}),
    ...(entry.created_at ? { createdAt: entry.created_at } : {}),
    ...(entry.updated_at ? { updatedAt: entry.updated_at } : {}),
  };
}

async function parseImageTargetResponse(response: Response, fallback: string): Promise<CloudImageTarget> {
  const body = (await response.json()) as WorkerImageTargetEntry & WorkerErrorResponse;
  if (!response.ok) {
    throw new Error(body.error ?? `${fallback} with HTTP ${response.status}.`);
  }
  const target = mapImageTargetEntry(body);
  if (!target) {
    throw new Error('Worker response did not include an image target.');
  }
  return target;
}

function imageTargetsUrl(apiUrl: string): string {
  return `${apiUrl.replace(/\/+$/, '')}/image-targets`;
}

function imageTargetItemUrl(apiUrl: string, targetId: string): string {
  return `${imageTargetsUrl(apiUrl)}/${encodeURIComponent(targetId)}`;
}

function modelRequestBody(model: CloudflareModelOption): Record<string, string> {
  return {
    id: model.id,
    label: model.label,
    url: model.url,
    ...(model.previewUrl ? { preview_url: model.previewUrl } : {}),
  };
}

function placementRequestBody(placement: ImageTargetPlacement): Record<string, number> {
  return {
    scale: placement.scale,
    offset_x: placement.offsetX,
    offset_y: placement.offsetY,
    height: placement.height,
  };
}

function jsonHeaders(authToken?: string | null): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...authHeaders(authToken),
  };
}

function authHeaders(authToken?: string | null): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}
```

- [ ] **Step 5: Run client tests**

Run:

```powershell
cd D:\Github-Projects\Mark-AR
npm test -- tests/cloudImageTargets.test.ts tests/imageTargetPayload.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit client feature**

Run:

```powershell
cd D:\Github-Projects\Mark-AR
git status --short
git add src\app\cloudImageTargets.ts src\app\imageTargetPayload.ts tests\cloudImageTargets.test.ts tests\imageTargetPayload.test.ts
git commit -m "feat: add cloud image target client"
```

Expected: one commit containing the Mark-AR client and helper tests.

---

### Task 3: Mark-AR Runtime Support for Cloud Targets

**Files:**
- Create: `D:\Github-Projects\Mark-AR\src\ar\markerTargets.ts`
- Modify: `D:\Github-Projects\Mark-AR\src\ar\mindarRuntime.ts`
- Modify: `D:\Github-Projects\Mark-AR\src\ar\cloudflareMarkerObject.ts`
- Modify: `D:\Github-Projects\Mark-AR\tests\mindarRuntime.test.ts`
- Create: `D:\Github-Projects\Mark-AR\tests\markerTargets.test.ts`

**Interfaces:**
- Consumes: `CloudImageTarget` from Task 2 and `CloudflarePlacedAsset` from `cloudflareMarkerObject.ts`.
- Produces:
  - `RuntimeMarkerTarget`
  - `createRuntimeMarkerTargets({ builtInMarkers, cloudTargets, selectedModel, processedBaseImage })`
  - `startMarkerAR(container, { targets })`
  - `CloudflarePlacedAsset.placement?: ImageTargetPlacement`

- [ ] **Step 1: Write failing runtime target tests**

Create `D:\Github-Projects\Mark-AR\tests\markerTargets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AR_MARKERS } from '../src/ar/markerCatalog';
import { createRuntimeMarkerTargets } from '../src/ar/markerTargets';

describe('marker target mapping', () => {
  it('combines built-in markers and cloud image targets with sequential target indices', () => {
    const targets = createRuntimeMarkerTargets({
      builtInMarkers: AR_MARKERS,
      cloudTargets: [
        {
          id: 'cloud-1',
          label: 'Product box',
          imageUrl: 'https://worker.example/image-targets/images/cloud-1.jpg',
          imageObjectKey: 'image-targets/images/cloud-1.jpg',
          model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
          placement: { scale: 1.2, offsetX: 0.1, offsetY: -0.2, height: 0.16 },
        },
      ],
    });

    expect(targets.map((target) => target.marker.targetIndex)).toEqual([0, 1, 2]);
    expect(targets.at(-1)).toMatchObject({
      marker: {
        id: 'cloud-cloud-1',
        label: 'Product box',
        targetIndex: 2,
        imagePath: 'https://worker.example/image-targets/images/cloud-1.jpg',
      },
      cloudflareAsset: {
        model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
        placement: { scale: 1.2, offsetX: 0.1, offsetY: -0.2, height: 0.16 },
      },
    });
  });
});
```

Extend `D:\Github-Projects\Mark-AR\tests\mindarRuntime.test.ts` with:

```ts
  it('uses per-target Cloudflare assets when runtime targets include saved models', () => {
    const anchors: Array<{
      group: Group;
      onTargetFound?: () => void;
      onTargetLost?: () => void;
      targetIndex: number;
    }> = [];
    const scene = { add: vi.fn() };
    const mindarThree = {
      addAnchor: (targetIndex: number) => {
        const anchor = { group: new Group(), targetIndex };
        anchors.push(anchor);
        return anchor;
      },
      scene,
    };

    const objects = setupMarkerAnchors(
      mindarThree,
      [
        { marker: AR_MARKERS[0] },
        {
          marker: { ...AR_MARKERS[1], label: 'Cloud target' },
          cloudflareAsset: {
            model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
            placement: { scale: 1.5, offsetX: 0.1, offsetY: 0.2, height: 0.2 },
          },
        },
      ],
    );

    expect(objects).toHaveLength(2);
    expect(anchors.map((anchor) => anchor.group.children[0].name)).toEqual([
      'crystal-tower-object',
      'cloudflare-model-object',
    ]);
  });
```

- [ ] **Step 2: Run runtime tests to verify they fail**

Run:

```powershell
cd D:\Github-Projects\Mark-AR
npm test -- tests/markerTargets.test.ts tests/mindarRuntime.test.ts
```

Expected: FAIL because `markerTargets.ts` does not exist and `setupMarkerAnchors` does not accept runtime target entries.

- [ ] **Step 3: Add placement to Cloudflare marker object**

In `D:\Github-Projects\Mark-AR\src\ar\cloudflareMarkerObject.ts`, extend `CloudflarePlacedAsset`:

```ts
import type { ImageTargetPlacement } from '../app/imageTargetPayload';

export type CloudflarePlacedAsset = {
  model: CloudflareModelOption;
  baseImage?: ProcessedBaseImage;
  placement?: ImageTargetPlacement;
  loadModelGroup?: LoadModelGroup;
};
```

In `createCloudflareMarkerObject`, apply placement to `modelRoot` after it is created:

```ts
  const placement = asset.placement;
  if (placement) {
    modelRoot.position.set(placement.offsetX, placement.height, placement.offsetY);
    modelRoot.scale.setScalar(placement.scale);
  }
```

If `modelRoot` already has a z/y default for base image behavior, replace the height coordinate with the existing vertical axis used in that file. Preserve the existing base-image plane behavior.

- [ ] **Step 4: Implement runtime target mapper**

Create `D:\Github-Projects\Mark-AR\src\ar\markerTargets.ts`:

```ts
import type { CloudImageTarget } from '../app/cloudImageTargets';
import type { CloudflareModelOption, ProcessedBaseImage } from '../app/cloudflareModels';
import { AR_MARKERS, type MarkerSpec } from './markerCatalog';
import type { CloudflarePlacedAsset } from './cloudflareMarkerObject';

export type RuntimeMarkerTarget = {
  marker: MarkerSpec;
  cloudflareAsset?: CloudflarePlacedAsset;
};

type CreateRuntimeMarkerTargetsInput = {
  builtInMarkers?: MarkerSpec[];
  cloudTargets?: CloudImageTarget[];
  selectedModel?: CloudflareModelOption;
  processedBaseImage?: ProcessedBaseImage;
};

export function createRuntimeMarkerTargets({
  builtInMarkers = AR_MARKERS,
  cloudTargets = [],
  selectedModel,
  processedBaseImage,
}: CreateRuntimeMarkerTargetsInput = {}): RuntimeMarkerTarget[] {
  const builtInTargets = builtInMarkers.map((marker, index) => ({
    marker: { ...marker, targetIndex: index },
    ...(selectedModel
      ? {
          cloudflareAsset: {
            model: selectedModel,
            ...(processedBaseImage ? { baseImage: processedBaseImage } : {}),
          },
        }
      : {}),
  }));

  const cloudRuntimeTargets = cloudTargets.map((target, index) => ({
    marker: {
      id: `cloud-${target.id}`,
      label: target.label,
      targetIndex: builtInTargets.length + index,
      imagePath: target.imageUrl,
      object: { kind: 'orbitBeacon' as const, color: 0x78ffb6, accentColor: 0xff4f8b },
    },
    cloudflareAsset: {
      model: target.model,
      placement: target.placement,
    },
  }));

  return [...builtInTargets, ...cloudRuntimeTargets];
}
```

- [ ] **Step 5: Update MindAR runtime to accept target lists**

In `D:\Github-Projects\Mark-AR\src\ar\mindarRuntime.ts`:

Import `RuntimeMarkerTarget` and `createRuntimeMarkerTargets`.

Change `StartMarkerARHooks`:

```ts
export type StartMarkerARHooks = {
  targets?: RuntimeMarkerTarget[];
  cloudflareAsset?: CloudflarePlacedAsset;
  onCompileProgress?: (percent: number) => void;
  onMarkerVisibility?: (event: MarkerVisibilityEvent) => void;
  onReady?: () => void;
};
```

Change `setupMarkerAnchors` signature and implementation:

```ts
export function setupMarkerAnchors(
  mindarThree: Pick<MindARThreeInstance, 'addAnchor' | 'scene'>,
  targets: RuntimeMarkerTarget[] = createRuntimeMarkerTargets(),
  onMarkerVisibility?: (event: MarkerVisibilityEvent) => void,
  fallbackCloudflareAsset?: CloudflarePlacedAsset,
): MarkerObject[] {
  return targets.map((target) => {
    const anchor = mindarThree.addAnchor(target.marker.targetIndex);
    const cloudflareAsset = target.cloudflareAsset ?? fallbackCloudflareAsset;
    const markerObject = cloudflareAsset
      ? createCloudflareMarkerObject(cloudflareAsset)
      : createMarkerObject(target.marker.object);

    anchor.group.add(markerObject.group);
    mindarThree.scene.add(anchor.group);

    anchor.onTargetFound = () => onMarkerVisibility?.({ marker: target.marker, visible: true });
    anchor.onTargetLost = () => onMarkerVisibility?.({ marker: target.marker, visible: false });

    return markerObject;
  });
}
```

Change compilation in `startMarkerAR`:

```ts
  const targets = hooks.targets ?? createRuntimeMarkerTargets({
    selectedModel: hooks.cloudflareAsset?.model,
    processedBaseImage: hooks.cloudflareAsset?.baseImage,
  });
  const compiledTargets = await compileMarkerTargets(
    targets.map((target) => target.marker),
    {
      Compiler,
      onProgress: hooks.onCompileProgress,
    },
  );
```

Change scene setup to pass `targets`:

```ts
  const markerObjects = setupScene(
    mindarThree,
    targets,
    hooks.onMarkerVisibility,
    hooks.cloudflareAsset,
  );
```

Change `setupScene` signature:

```ts
function setupScene(
  mindarThree: MindARThreeInstance,
  targets: RuntimeMarkerTarget[],
  onMarkerVisibility?: (event: MarkerVisibilityEvent) => void,
  cloudflareAsset?: CloudflarePlacedAsset,
): MarkerObject[] {
  const ambient = new AmbientLight(0xffffff, 1.7);
  const directional = new DirectionalLight(0xffffff, 1.2);
  directional.position.set(0.6, 1, 1.4);
  mindarThree.scene.add(ambient);
  mindarThree.scene.add(directional);

  return setupMarkerAnchors(mindarThree, targets, onMarkerVisibility, cloudflareAsset);
}
```

- [ ] **Step 6: Run runtime tests**

Run:

```powershell
cd D:\Github-Projects\Mark-AR
npm test -- tests/markerTargets.test.ts tests/mindarRuntime.test.ts tests/cloudflareMarkerObject.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit runtime feature**

Run:

```powershell
cd D:\Github-Projects\Mark-AR
git add src\ar\markerTargets.ts src\ar\mindarRuntime.ts src\ar\cloudflareMarkerObject.ts tests\markerTargets.test.ts tests\mindarRuntime.test.ts
git commit -m "feat: support cloud image targets in marker runtime"
```

Expected: one commit containing runtime mapping and tests.

---

### Task 4: Mark-AR Targets Page and 3D Preview

**Files:**
- Create: `D:\Github-Projects\Mark-AR\src\scene\ImageTargetPreview.ts`
- Create: `D:\Github-Projects\Mark-AR\tests\imageTargetPreview.test.ts`
- Modify: `D:\Github-Projects\Mark-AR\src\ui\pageRoutes.ts`
- Modify: `D:\Github-Projects\Mark-AR\src\ui\appShell.ts`
- Modify: `D:\Github-Projects\Mark-AR\src\style.css`
- Modify: `D:\Github-Projects\Mark-AR\src\main.ts`
- Modify: `D:\Github-Projects\Mark-AR\tests\pageRoutes.test.ts`
- Modify: `D:\Github-Projects\Mark-AR\tests\appShell.test.ts`

**Interfaces:**
- Consumes: `CloudImageTarget`, `createImageTarget`, `deleteImageTarget`, `listImageTargets`, `imageFileToCapturedImage`, `loadCloudflareModelOptions`, `createRuntimeMarkerTargets`, and `startMarkerAR`.
- Produces:
  - Target page controls:
    - `#target-image-file`
  - `#target-label`
    - `#target-model-select`
    - `#target-preview-stage`
    - `#target-scale`
    - `#target-offset-x`
    - `#target-offset-y`
    - `#target-height`
    - `#save-image-target`
    - `#refresh-image-targets`
    - `#image-target-status`
    - `#saved-image-target-list`
  - `ImageTargetPreview` with `update({ imageUrl, model, placement })` and `dispose()`.

- [ ] **Step 1: Write failing route/shell tests**

Update `D:\Github-Projects\Mark-AR\tests\pageRoutes.test.ts` so route expectations include `targets`:

```ts
expect(PAGE_ROUTES).toContain('targets');
expect(routeFromHash('#/targets')).toBe('targets');
expect(hrefForRoute('targets')).toBe('#/targets');
```

Update `D:\Github-Projects\Mark-AR\tests\appShell.test.ts` with assertions:

```ts
expect(container.querySelector('[data-page="targets"]')).toBeTruthy();
expect(container.querySelector('#target-image-file')).toBeTruthy();
expect(container.querySelector('#target-model-select')).toBeTruthy();
expect(container.querySelector('#target-preview-stage')).toBeTruthy();
expect(container.querySelector('#save-image-target')).toBeTruthy();
expect(container.querySelector('#saved-image-target-list')).toBeTruthy();
```

Create `D:\Github-Projects\Mark-AR\tests\imageTargetPreview.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run UI tests to verify they fail**

Run:

```powershell
cd D:\Github-Projects\Mark-AR
npm test -- tests/pageRoutes.test.ts tests/appShell.test.ts tests/imageTargetPreview.test.ts
```

Expected: FAIL because route, shell controls, and preview class do not exist.

- [ ] **Step 3: Add targets route and shell controls**

Update `D:\Github-Projects\Mark-AR\src\ui\pageRoutes.ts`:

```ts
export const PAGE_ROUTES = ['home', 'scan', 'base', 'models', 'targets', 'markers', 'account'] as const;
```

Update `modeCards` in `appShell.ts` to include:

```ts
  {
    route: 'targets',
    badge: 'IMG+3D',
    title: 'Image targets',
    text: 'Upload a target image, bind it to a Cloudflare model, and save it to the cloud.',
    action: 'Create target',
  },
```

Add nav link:

```ts
${renderRouteLink('targets', 'Targets')}
```

Add the `targets` page before `markers`:

```ts
      <section class="page" data-page="targets" hidden aria-label="Cloud image targets">
        ${renderPageHeader('Image targets', 'Upload a scan image, place a model above it, and save the pairing to Cloudflare.')}
        <section class="target-workspace">
          <div class="target-editor">
            <section class="tool-card">
              <div class="tool-card-head">
                <p class="eyebrow">Cloud target</p>
                <p id="image-target-status">Sign in, choose an image, and select a model.</p>
              </div>
              <label>
                <span>Target label</span>
                <input id="target-label" type="text" value="" aria-label="Target label" />
              </label>
              <label class="file-control">
                <span>Target image</span>
                <input id="target-image-file" type="file" accept="image/png,image/jpeg,image/webp" />
              </label>
              <label>
                <span>Cloudflare model</span>
                <select id="target-model-select">
                  <option value="">Loading models...</option>
                </select>
              </label>
              <div class="placement-grid">
                <label><span>Scale</span><input id="target-scale" type="range" min="0.1" max="5" step="0.1" value="1" /></label>
                <label><span>X offset</span><input id="target-offset-x" type="range" min="-1" max="1" step="0.05" value="0" /></label>
                <label><span>Y offset</span><input id="target-offset-y" type="range" min="-1" max="1" step="0.05" value="0" /></label>
                <label><span>Height</span><input id="target-height" type="range" min="0" max="1" step="0.02" value="0.12" /></label>
              </div>
              <div class="button-row">
                <button id="save-image-target" class="primary" type="button">Save target</button>
                <button id="refresh-image-targets" type="button">Refresh targets</button>
              </div>
            </section>
            <section class="tool-card saved-target-card">
              <div class="tool-card-head">
                <p class="eyebrow">Saved</p>
                <p>Cloud image targets</p>
              </div>
              <div id="saved-image-target-list" class="saved-target-list"></div>
            </section>
          </div>
          <div id="target-preview-stage" class="target-preview-stage" aria-label="3D target preview"></div>
        </section>
      </section>
```

- [ ] **Step 4: Implement preview class**

Create `D:\Github-Projects\Mark-AR\src\scene\ImageTargetPreview.ts`:

```ts
import {
  AmbientLight,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Texture,
  TextureLoader,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CloudflareModelOption } from '../app/cloudflareModels';
import type { ImageTargetPlacement } from '../app/imageTargetPayload';
import { normalizePlacement } from '../app/imageTargetPayload';

type PreviewRenderer = Pick<WebGLRenderer, 'domElement' | 'setPixelRatio' | 'setSize' | 'render' | 'dispose'>;

type PreviewDeps = {
  createRenderer?: () => PreviewRenderer;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (frameId: number) => void;
  loadTexture?: (url: string) => Promise<Texture | undefined>;
  loadModel?: (url: string) => Promise<Group | undefined>;
};

type PreviewState = {
  imageUrl?: string;
  model?: CloudflareModelOption;
  placement?: ImageTargetPlacement;
};

export class ImageTargetPreview {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(45, 1, 0.01, 100);
  private readonly renderer: PreviewRenderer;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (frameId: number) => void;
  private readonly loadTexture: (url: string) => Promise<Texture | undefined>;
  private readonly loadModel: (url: string) => Promise<Group | undefined>;
  private readonly imageRoot = new Group();
  private readonly modelRoot = new Group();
  private frameId = 0;
  private disposed = false;

  constructor(private readonly container: HTMLElement, deps: PreviewDeps = {}) {
    this.renderer = deps.createRenderer?.() ?? new WebGLRenderer({ antialias: true, alpha: true });
    this.requestFrame = deps.requestFrame ?? requestAnimationFrame;
    this.cancelFrame = deps.cancelFrame ?? cancelAnimationFrame;
    this.loadTexture = deps.loadTexture ?? defaultLoadTexture;
    this.loadModel = deps.loadModel ?? defaultLoadModel;

    this.camera.position.set(0, 1.1, 2.1);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new AmbientLight(0xffffff, 1.6));
    const keyLight = new DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(1, 2, 2);
    this.scene.add(keyLight, this.imageRoot, this.modelRoot);
    this.container.append(this.renderer.domElement);
    this.resize();
    this.render = this.render.bind(this);
    this.frameId = this.requestFrame(this.render);
  }

  async update(state: PreviewState): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.clearGroup(this.imageRoot);
    this.clearGroup(this.modelRoot);
    const placement = normalizePlacement(state.placement);

    if (state.imageUrl) {
      const texture = await this.loadTexture(state.imageUrl);
      const material = new MeshBasicMaterial({ map: texture });
      const plane = new Mesh(new PlaneGeometry(1, 0.7), material);
      plane.rotation.x = -Math.PI / 2;
      this.imageRoot.add(plane);
    }

    if (state.model) {
      const model = await this.loadModel(state.model.url);
      if (model) {
        model.position.set(placement.offsetX, placement.height, placement.offsetY);
        model.scale.setScalar(placement.scale);
        this.modelRoot.add(model);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.frameId) {
      this.cancelFrame(this.frameId);
    }
    this.clearGroup(this.imageRoot);
    this.clearGroup(this.modelRoot);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize(): void {
    const width = Math.max(320, this.container.clientWidth || 320);
    const height = Math.max(280, this.container.clientHeight || 360);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
  }

  private render(): void {
    if (this.disposed) {
      return;
    }
    this.modelRoot.rotation.y += 0.01;
    this.renderer.render(this.scene, this.camera);
    this.frameId = this.requestFrame(this.render);
  }

  private clearGroup(group: Group): void {
    group.clear();
  }
}

function defaultLoadTexture(url: string): Promise<Texture> {
  return new TextureLoader().loadAsync(url);
}

async function defaultLoadModel(url: string): Promise<Group> {
  const gltf = await new GLTFLoader().loadAsync(url);
  return gltf.scene;
}
```

- [ ] **Step 5: Wire target page in main**

In `D:\Github-Projects\Mark-AR\src\main.ts`, import:

```ts
import {
  createImageTarget,
  deleteImageTarget,
  listImageTargets,
  type CloudImageTarget,
} from './app/cloudImageTargets';
import {
  DEFAULT_IMAGE_TARGET_PLACEMENT,
  imageTargetDataUrl,
  normalizePlacement,
  validateTargetImagePayload,
  type ImageTargetImagePayload,
  type ImageTargetPlacement,
} from './app/imageTargetPayload';
import { createRuntimeMarkerTargets } from './ar/markerTargets';
import { ImageTargetPreview } from './scene/ImageTargetPreview';
```

Add element queries after existing controls:

```ts
const targetImageFile = document.querySelector<HTMLInputElement>('#target-image-file');
const targetLabelInput = document.querySelector<HTMLInputElement>('#target-label');
const targetModelSelect = document.querySelector<HTMLSelectElement>('#target-model-select');
const targetPreviewStage = document.querySelector<HTMLElement>('#target-preview-stage');
const targetScaleInput = document.querySelector<HTMLInputElement>('#target-scale');
const targetOffsetXInput = document.querySelector<HTMLInputElement>('#target-offset-x');
const targetOffsetYInput = document.querySelector<HTMLInputElement>('#target-offset-y');
const targetHeightInput = document.querySelector<HTMLInputElement>('#target-height');
const saveImageTargetButton = document.querySelector<HTMLButtonElement>('#save-image-target');
const refreshImageTargetsButton = document.querySelector<HTMLButtonElement>('#refresh-image-targets');
const imageTargetStatus = document.querySelector<HTMLElement>('#image-target-status');
const savedImageTargetList = document.querySelector<HTMLElement>('#saved-image-target-list');
```

Add state:

```ts
let cloudImageTargets: CloudImageTarget[] = [];
let targetImagePayload: ImageTargetImagePayload | undefined;
let targetPlacement: ImageTargetPlacement = DEFAULT_IMAGE_TARGET_PLACEMENT;
let imageTargetPreview: ImageTargetPreview | undefined;
```

After rendering model options, also populate target model select:

```ts
function renderTargetModelOptions(models: CloudflareModelOption[]): void {
  if (!targetModelSelect) {
    return;
  }
  targetModelSelect.innerHTML = '';
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = models.length ? 'Choose a Cloudflare model' : 'No models loaded';
  targetModelSelect.append(emptyOption);
  for (const model of models) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.label;
    targetModelSelect.append(option);
  }
}
```

Add handlers:

```ts
targetImageFile?.addEventListener('change', async () => {
  const file = targetImageFile.files?.[0];
  if (!file) {
    return;
  }
  targetImagePayload = await imageFileToCapturedImage(file);
  targetLabelInput!.value = targetLabelInput!.value || file.name.replace(/\.[^.]+$/, '');
  await updateTargetPreview();
});

[targetScaleInput, targetOffsetXInput, targetOffsetYInput, targetHeightInput].forEach((input) => {
  input?.addEventListener('input', () => {
    targetPlacement = readTargetPlacement();
    void updateTargetPreview();
  });
});

targetModelSelect?.addEventListener('change', () => {
  void updateTargetPreview();
});

saveImageTargetButton?.addEventListener('click', async () => {
  await saveCurrentImageTarget();
});

refreshImageTargetsButton?.addEventListener('click', async () => {
  await refreshImageTargets();
});
```

Add implementation functions:

```ts
function ensureImageTargetPreview(): ImageTargetPreview | undefined {
  if (!targetPreviewStage) {
    return undefined;
  }
  imageTargetPreview ??= new ImageTargetPreview(targetPreviewStage);
  return imageTargetPreview;
}

function readTargetPlacement(): ImageTargetPlacement {
  return normalizePlacement({
    scale: Number(targetScaleInput?.value),
    offsetX: Number(targetOffsetXInput?.value),
    offsetY: Number(targetOffsetYInput?.value),
    height: Number(targetHeightInput?.value),
  });
}

function getSelectedTargetModel(): CloudflareModelOption | undefined {
  const selectedId = targetModelSelect?.value;
  return cloudflareModels.find((model) => model.id === selectedId);
}

async function updateTargetPreview(): Promise<void> {
  const preview = ensureImageTargetPreview();
  if (!preview) {
    return;
  }
  await preview.update({
    imageUrl: targetImagePayload ? imageTargetDataUrl(targetImagePayload) : undefined,
    model: getSelectedTargetModel(),
    placement: targetPlacement,
  });
}

async function saveCurrentImageTarget(): Promise<void> {
  if (!authToken) {
    updateImageTargetStatus('Sign in before saving an image target.', true);
    return;
  }
  if (!targetImagePayload) {
    updateImageTargetStatus('Choose a target image.', true);
    return;
  }
  const validationError = validateTargetImagePayload(targetImagePayload);
  if (validationError) {
    updateImageTargetStatus(validationError, true);
    return;
  }
  const model = getSelectedTargetModel();
  if (!model) {
    updateImageTargetStatus('Choose a Cloudflare model.', true);
    return;
  }

  updateImageTargetStatus('Saving image target...', false);
  await createImageTarget({
    apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
    authToken,
    label: targetLabelInput?.value.trim() || 'Image target',
    imageBase64: targetImagePayload.imageBase64,
    imageMimeType: targetImagePayload.imageMimeType,
    model,
    placement: targetPlacement,
  });
  updateImageTargetStatus('Image target saved to Cloudflare.', false);
  await refreshImageTargets();
}

async function refreshImageTargets(): Promise<void> {
  cloudImageTargets = await listImageTargets({
    apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
    authToken,
  });
  renderSavedImageTargets();
}

function renderSavedImageTargets(): void {
  if (!savedImageTargetList) {
    return;
  }
  savedImageTargetList.innerHTML = '';
  if (cloudImageTargets.length === 0) {
    savedImageTargetList.textContent = 'No cloud image targets saved yet.';
    return;
  }
  for (const target of cloudImageTargets) {
    const row = document.createElement('article');
    row.className = 'saved-target-row';
    row.innerHTML = `
      <img src="${target.imageUrl}" alt="${target.label}" />
      <div>
        <strong>${target.label}</strong>
        <span>${target.model.label}</span>
      </div>
      <button type="button" data-delete-target="${target.id}">Delete</button>
    `;
    row.querySelector<HTMLButtonElement>('[data-delete-target]')?.addEventListener('click', async () => {
      await deleteImageTarget({ apiUrl: DEFAULT_GENERATE_MODEL_API_URL, authToken, targetId: target.id });
      await refreshImageTargets();
    });
    savedImageTargetList.append(row);
  }
}

function updateImageTargetStatus(message: string, isError: boolean): void {
  if (!imageTargetStatus) {
    return;
  }
  imageTargetStatus.textContent = message;
  imageTargetStatus.classList.toggle('is-error', isError);
}
```

Update model loading success path to call `renderTargetModelOptions(cloudflareModels)`. Update auth login/logout success paths to call `refreshImageTargets()`.

- [ ] **Step 6: Update scanner start to include cloud targets**

In the existing `startButton` handler in `main.ts`, before `startMarkerAR`, build targets:

```ts
const selectedModel = getSelectedModel();
const runtimeTargets = createRuntimeMarkerTargets({
  cloudTargets: cloudImageTargets,
  selectedModel,
  processedBaseImage,
});
session = await startMarkerAR(stage, {
  targets: runtimeTargets,
  onCompileProgress: (percent) => {
    status.textContent = `Compiling targets ${Math.round(percent)}%`;
  },
  onMarkerVisibility: (event) => {
    status.textContent = event.visible ? `${event.marker.label} active` : `${event.marker.label} lost`;
  },
  onReady: () => {
    status.textContent = 'Camera active. Scan a built-in marker or saved cloud image target.';
  },
});
```

Remove the old `cloudflareAsset` argument from this call because the selected model is now folded into `runtimeTargets`.

- [ ] **Step 7: Add CSS for targets page**

In `D:\Github-Projects\Mark-AR\src\style.css`, add:

```css
.target-workspace {
  display: grid;
  grid-template-columns: minmax(280px, 420px) minmax(320px, 1fr);
  gap: 20px;
  align-items: stretch;
}

.target-editor {
  display: grid;
  gap: 16px;
}

.placement-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.target-preview-stage {
  min-height: 520px;
  border: 2px solid #111318;
  border-radius: 8px;
  overflow: hidden;
  background: #101417;
}

.target-preview-stage canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.saved-target-list {
  display: grid;
  gap: 10px;
}

.saved-target-row {
  display: grid;
  grid-template-columns: 64px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 10px;
  border: 2px solid #111318;
  border-radius: 8px;
  background: #fff;
}

.saved-target-row img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #111318;
}

.saved-target-row div {
  display: grid;
  gap: 4px;
}

.saved-target-row span {
  color: #58616d;
  font-size: 0.9rem;
}

.is-error {
  color: #c62828;
}

@media (max-width: 840px) {
  .target-workspace {
    grid-template-columns: 1fr;
  }

  .target-preview-stage {
    min-height: 380px;
  }
}
```

- [ ] **Step 8: Run UI tests**

Run:

```powershell
cd D:\Github-Projects\Mark-AR
npm test -- tests/pageRoutes.test.ts tests/appShell.test.ts tests/imageTargetPreview.test.ts tests/cloudImageTargets.test.ts tests/imageTargetPayload.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit target page feature**

Run:

```powershell
cd D:\Github-Projects\Mark-AR
git add src\scene\ImageTargetPreview.ts tests\imageTargetPreview.test.ts src\ui\pageRoutes.ts src\ui\appShell.ts src\style.css src\main.ts tests\pageRoutes.test.ts tests\appShell.test.ts
git commit -m "feat: add cloud image target page"
```

Expected: one commit containing route, shell, preview, page wiring, and tests.

---

### Task 5: End-to-End Verification, Deploy Worker, Publish Pages

**Files:**
- No planned source edits.
- If verification exposes a defect, edit only the file that owns the failing behavior and add or update the focused test that reproduces it.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: deployed Worker supporting image targets and GitHub Pages deployment containing the new `#/targets` page and scanner integration.

- [ ] **Step 1: Run full Worker verification**

Run:

```powershell
cd D:\Github-Projects\Web-AR
npm test
npm run build
```

Expected: PASS for tests and TypeScript/Vite build.

- [ ] **Step 2: Deploy Worker**

Run:

```powershell
cd D:\Github-Projects\Web-AR
npm run worker:deploy
```

Expected: Wrangler deploy succeeds for `web-ar-generate-model`.

- [ ] **Step 3: Run full Mark-AR verification**

Run:

```powershell
cd D:\Github-Projects\Mark-AR
npm test
npm run build
$env:GITHUB_PAGES='true'; npm run build
```

Expected: PASS for tests, local build, and GitHub Pages build.

- [ ] **Step 4: Browser smoke test local Mark-AR**

Run the dev server on the allowed local origin:

```powershell
cd D:\Github-Projects\Mark-AR
npm run dev -- --host 127.0.0.1 --port 5182
```

Open `http://127.0.0.1:5182/Mark-AR/#/targets` and verify:

- The target page renders.
- Worker login still succeeds.
- Cloudflare model dropdown loads static and Worker models.
- Uploading a PNG/JPEG/WebP image shows the preview stage.
- Saving a target creates a new row in the saved target list after refresh.
- Reloading the page and signing in again shows the saved target from Cloudflare.
- `#/scan` compiles built-in markers plus cloud targets and reaches camera-ready state.

- [ ] **Step 5: Push Mark-AR and confirm GitHub Pages**

Run:

```powershell
cd D:\Github-Projects\Mark-AR
git status --short
git push
```

Expected: push succeeds and the GitHub Pages workflow starts.

After the workflow finishes, verify:

```powershell
Invoke-WebRequest -Uri https://sshibinthomass.github.io/Mark-AR/ -UseBasicParsing | Select-Object -ExpandProperty StatusCode
```

Expected: `200`.

- [ ] **Step 6: Commit any verification fixes**

If Step 4 exposes a defect, fix only that defect, rerun the failed verification command, and commit:

```powershell
cd D:\Github-Projects\Mark-AR
git add src tests
git commit -m "fix: stabilize cloud image target flow"
git push
```

Expected: no uncommitted Mark-AR changes remain after the final push.

---

## Self-Review Checklist

- Spec coverage: Task 1 covers Worker routes/R2/auth/visibility; Task 2 covers Mark-AR client and payload validation; Task 3 covers MindAR runtime mapping; Task 4 covers the `#/targets` page and 3D preview; Task 5 covers Worker deploy, GitHub Pages build, and manual scanner verification.
- Red-flag scan: no unresolved markers or unspecified validation steps remain.
- Type consistency: Worker uses snake_case records; Mark-AR maps those to camelCase types. Placement maps `offset_x`/`offset_y` to `offsetX`/`offsetY`. Route URLs derive from the existing `/generate-3d` base URL.

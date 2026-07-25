# Target Media Objects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add draggable image and inline YouTube objects to AnchorAR targets and make the repository self-contained with a focused Cloudflare Worker and R2 persistence.

**Architecture:** Extend the target-object union and wire format first, then reuse the existing placement/group/animation paths for media planes. Studio remains WebGL-only; AR combines WebGL thumbnails with a CSS3D YouTube player layer. A focused Worker in this repository preserves the existing auth/model/target API while importing image-object sources into R2 transactionally.

**Tech Stack:** TypeScript 6, Vite 8, Vitest 4, Three.js 0.150, MindAR, YouTube IFrame Player API, Cloudflare Workers, Wrangler 4, Cloudflare R2.

## Global Constraints

- Image and YouTube objects are flat rectangular objects with full 3D placement, rotation, uniform scale, grouping, animation, keyboard control, and drag selection.
- Image inputs support local PNG, JPEG, and WebP files and public HTTPS image URLs.
- Every stored image is at most 5 MB and is copied into R2; external URLs are not runtime dependencies after save.
- YouTube accepts watch, `youtu.be`, Shorts, and embed URLs; playback starts only after a tap and never opens fullscreen.
- Studio shows a non-playing YouTube thumbnail; AR uses an inline CSS3D iframe at the same transform.
- Target loss pauses and hides YouTube playback; reacquisition restores the thumbnail without autoplay.
- Existing model/text records, target images, access rules, scan IDs, and R2 prefixes remain compatible.
- The Mark-AR Worker excludes Modal, OpenAI, speech, generation-job, and cron pipelines.
- Existing unrelated untracked or dirty files in the original repository and sibling repositories must not be modified.

---

## File Structure

### Frontend domain and persistence

- `src/app/targetMedia.ts` — image file/URL validation, YouTube URL normalization, media labels, and draft source types.
- `src/app/targetEditorObjects.ts` — four-kind object union, constructors, type guards, and common labels.
- `src/app/cloudImageTargets.ts` — media wire schemas, request mapping, response normalization, and pending media sources.
- `src/app/targetPersistence.ts` — canonical comparison for media objects.
- `src/app/targetEditorSession.ts` — cloned media sessions without draft Base64 leakage.

### Frontend rendering and runtime

- `src/scene/mediaPlane3d.ts` — aspect-preserving image/thumbnail planes, placeholders, and disposal.
- `src/scene/ImageTargetPreview.ts` — load image and YouTube planes through the shared plane factory.
- `src/ar/targetSceneObject.ts` — create AR media planes and expose interactive YouTube surfaces.
- `src/ar/cloudflareMarkerObject.ts` — forward media visibility, pointer activation, and disposal.
- `src/ar/youtubePlayerManager.ts` — load the IFrame API, mirror 3D transforms into CSS3D, control playback, and isolate errors.
- `src/ar/mindarRuntime.ts` — mount CSS3D, route taps, propagate marker visibility, resize, render, and dispose.
- `src/ar/markerTargets.ts` — preserve media objects when constructing runtime targets.

### Frontend UI

- `src/ui/appShell.ts` — one unified Objects tab and four add-object panels.
- `src/ui/targetObjectList.ts` — media rows, labels, badges, and accessible delete names.
- `src/ui/targetInspectorTabs.ts` — remove the obsolete Text tab expectation.
- `src/main.ts` — draft media state, input handlers, object creation, save payloads, reload/reset cleanup, and status copy.
- `src/style.css` — structural unified-object and media control styles.
- `src/styles/arvenilo-redesign.css` — final branded media controls and responsive rules.

### Worker

- `worker/src/types.ts` — R2, environment, auth, model, target, group, object, and request types.
- `worker/src/http.ts` — CORS, JSON, route, and bounded-body helpers.
- `worker/src/storage.ts` — R2 JSON read/write and public asset responses.
- `worker/src/auth.ts` — password hashing, signed sessions, account routes, and authorization.
- `worker/src/models.ts` — generated-model list and stored model/preview serving.
- `worker/src/media.ts` — upload/import validation, SSRF protection, image dimensions, R2 writes, rollback, and cleanup.
- `worker/src/imageTargets.ts` — target normalization, access control, create/update/list/scan/delete transactions.
- `worker/src/index.ts` — focused route composition and Worker export.
- `wrangler.jsonc` — Mark-AR Worker name, compatibility date, public origin, and R2 binding.
- `.env.example` — frontend Worker URL and allowed origin examples without secrets.
- `package.json` / `package-lock.json` — Wrangler scripts and dependency.

### Tests and documentation

- `tests/targetMedia.test.ts`
- `tests/targetEditorObjects.test.ts`
- `tests/cloudImageTargets.test.ts`
- `tests/targetPersistence.test.ts`
- `tests/mediaPlane3d.test.ts`
- `tests/imageTargetPreview.test.ts`
- `tests/targetSceneObject.test.ts`
- `tests/youtubePlayerManager.test.ts`
- `tests/mindarRuntime.test.ts`
- `tests/targetObjectList.test.ts`
- `tests/appShell.test.ts`
- `tests/targetMediaEditorIntegration.test.ts`
- `tests/targetSpecificScanIntegration.test.ts`
- `tests/worker/markArWorker.test.ts`
- `README.md`

---

### Task 1: Define and validate media object types

**Files:**
- Create: `src/app/targetMedia.ts`
- Modify: `src/app/targetEditorObjects.ts`
- Test: `tests/targetMedia.test.ts`
- Test: `tests/targetEditorObjects.test.ts`

**Interfaces:**
- Produces: `PendingTargetImageSource`, `TargetImageContent`, `TargetYouTubeContent`.
- Produces: `normalizeYouTubeUrl(input: string): TargetYouTubeContent | null`.
- Produces: `validateTargetImageFile(file: Pick<File, 'name' | 'size' | 'type'>): string | null`.
- Produces: `createLocalImageObject(input: { id: string; image: TargetImageContent; placement?: Partial<ImageTargetPlacement>; animation?: Partial<ImageTargetAnimation> }): ImageTargetObject`.
- Produces: `createYouTubeObject(input: { id: string; youtube: TargetYouTubeContent; placement?: Partial<ImageTargetPlacement>; animation?: Partial<ImageTargetAnimation> }): YouTubeTargetObject`.
- Produces: `isImageTargetObject(object: unknown): object is ImageTargetObject`.
- Produces: `isYouTubeTargetObject(object: unknown): object is YouTubeTargetObject`.
- Produces: `targetObjectLabel(object: TargetEditorObject): string`.

- [ ] **Step 1: Write failing media validation tests**

```ts
it.each([
  ['https://www.youtube.com/watch?v=M7lc1UVf-VE', 'M7lc1UVf-VE'],
  ['https://youtu.be/M7lc1UVf-VE?t=12', 'M7lc1UVf-VE'],
  ['https://www.youtube.com/shorts/M7lc1UVf-VE', 'M7lc1UVf-VE'],
  ['https://www.youtube.com/embed/M7lc1UVf-VE', 'M7lc1UVf-VE'],
])('normalizes %s', (input, videoId) => {
  expect(normalizeYouTubeUrl(input)).toEqual({
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  });
});

it('rejects unsupported and oversized image files', () => {
  expect(validateTargetImageFile({ name: 'poster.gif', type: 'image/gif', size: 10 }))
    .toBe('Image objects must be PNG, JPEG, or WebP.');
  expect(validateTargetImageFile({ name: 'poster.png', type: 'image/png', size: 5 * 1024 * 1024 + 1 }))
    .toBe('Image objects must be 5 MB or smaller.');
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- tests/targetMedia.test.ts tests/targetEditorObjects.test.ts`

Expected: FAIL because `targetMedia.ts`, the media object types, and constructors do not exist.

- [ ] **Step 3: Implement the minimal media domain**

```ts
export type PendingTargetImageSource =
  | { source: 'upload'; imageBase64: string; imageMimeType: SupportedTargetImageMimeType }
  | { source: 'url'; sourceUrl: string };

export type TargetImageContent = {
  url: string;
  objectKey?: string;
  label: string;
  width: number;
  height: number;
  aspectRatio: number;
};

export type TargetYouTubeContent = {
  videoId: string;
  url: string;
  thumbnailUrl: string;
};
```

Use explicit host/path parsing, an exact 11-character ID check, HTTPS canonical URLs, the existing placement/animation defaults, and a `TargetObjectBase` shared by all four variants. Make the model guard check the model kind explicitly instead of treating every non-text object as a model.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- tests/targetMedia.test.ts tests/targetEditorObjects.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the domain change**

```powershell
git add src/app/targetMedia.ts src/app/targetEditorObjects.ts tests/targetMedia.test.ts tests/targetEditorObjects.test.ts
git commit -m "feat: define target media objects"
```

### Task 2: Extend target serialization and integrity checks

**Files:**
- Modify: `src/app/cloudImageTargets.ts`
- Modify: `src/app/targetPersistence.ts`
- Modify: `src/app/targetEditorSession.ts`
- Test: `tests/cloudImageTargets.test.ts`
- Test: `tests/targetPersistence.test.ts`
- Test: `tests/targetEditorSession.test.ts`

**Interfaces:**
- Consumes: media types and guards from Task 1.
- Produces: `mediaSources?: Record<string, PendingTargetImageSource>` on create/update inputs.
- Produces wire kinds `image` and `youtube`, with pending source data emitted only in authenticated save requests.

- [ ] **Step 1: Write failing wire-format tests**

```ts
it('sends pending image bytes but returns only durable image metadata', async () => {
  await createImageTarget({
    apiUrl: 'https://worker.example/generate-3d',
    authToken: 'token',
    fetchImpl,
    label: 'Media target',
    imageBase64: 'bWFya2Vy',
    imageMimeType: 'image/png',
    objects: [imageObject, youtubeObject],
    mediaSources: {
      imageOne: { source: 'upload', imageBase64: 'cG9zdGVy', imageMimeType: 'image/webp' },
    },
  });

  const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
  expect(body.objects[0]).toMatchObject({
    kind: 'image',
    image: {
      label: 'poster.webp',
      pending_source: { source: 'upload', image_base64: 'cG9zdGVy', image_mime_type: 'image/webp' },
    },
  });
  expect(body.objects[1]).toMatchObject({
    kind: 'youtube',
    youtube: { video_id: 'M7lc1UVf-VE' },
  });
});
```

Add response tests for snake_case media metadata, malformed media filtering without dropping valid sibling objects, compatibility with legacy model aliases, and canonical persistence mismatch messages.

- [ ] **Step 2: Run focused persistence tests and verify RED**

Run: `npm test -- tests/cloudImageTargets.test.ts tests/targetPersistence.test.ts tests/targetEditorSession.test.ts`

Expected: FAIL because media wire kinds and canonicalization are not implemented.

- [ ] **Step 3: Implement media request/response mapping**

Define complete wire types:

```ts
type WorkerImageTargetImageObject = WorkerImageTargetObjectBase & {
  kind: 'image';
  image?: {
    url?: string;
    object_key?: string;
    label?: string;
    width?: number;
    height?: number;
    aspect_ratio?: number;
    pending_source?: WorkerPendingImageSource;
  };
};

type WorkerImageTargetYouTubeObject = WorkerImageTargetObjectBase & {
  kind: 'youtube';
  youtube?: { video_id?: string; url?: string; thumbnail_url?: string };
};
```

Serialize pending image data only when `mediaSources[object.id]` exists. Never retain pending data in `CloudImageTarget`, scan state, or editor session clones. Canonical persistence compares durable media metadata and the common transform fields.

- [ ] **Step 4: Run focused persistence tests and verify GREEN**

Run: `npm test -- tests/cloudImageTargets.test.ts tests/targetPersistence.test.ts tests/targetEditorSession.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the persistence change**

```powershell
git add src/app/cloudImageTargets.ts src/app/targetPersistence.ts src/app/targetEditorSession.ts tests/cloudImageTargets.test.ts tests/targetPersistence.test.ts tests/targetEditorSession.test.ts
git commit -m "feat: persist target media objects"
```

### Task 3: Render draggable media planes in Studio and AR

**Files:**
- Create: `src/scene/mediaPlane3d.ts`
- Modify: `src/scene/ImageTargetPreview.ts`
- Modify: `src/ar/targetSceneObject.ts`
- Modify: `src/ar/cloudflareMarkerObject.ts`
- Test: `tests/mediaPlane3d.test.ts`
- Test: `tests/imageTargetPreview.test.ts`
- Test: `tests/targetSceneObject.test.ts`
- Test: `tests/cloudflareMarkerObject.test.ts`

**Interfaces:**
- Consumes: `TargetImageContent` and `TargetYouTubeContent`.
- Produces: `prepareMediaPlane(content, deps): PreparedMediaPlane`.
- Produces: `InteractiveYouTubeSurface { objectId, mesh, content, setMarkerVisible }`.
- Extends `TargetSceneObject` with `youtubeSurfaces`.

- [ ] **Step 1: Write failing plane and scene tests**

```ts
it('creates an aspect-preserving selectable image plane', async () => {
  const texture = new Texture();
  const prepared = prepareMediaPlane(
    { kind: 'image', url: 'poster.webp', width: 1200, height: 800, aspectRatio: 1.5 },
    { loadTexture: async () => texture },
  );
  await prepared.ready;
  const mesh = prepared.group.getObjectByName('target-media-plane') as Mesh<PlaneGeometry>;
  expect(mesh.geometry.parameters.width).toBe(1.5);
  expect(mesh.geometry.parameters.height).toBe(1);
  expect(mesh.userData.targetObjectId).toBe('poster');
});
```

Add tests proving image and YouTube groups are inserted under group roots, receive placement/animation, are raycast-selectable in `ImageTargetPreview`, reuse texture disposal safely, and return a placeholder in fallback mode.

- [ ] **Step 2: Run rendering tests and verify RED**

Run: `npm test -- tests/mediaPlane3d.test.ts tests/imageTargetPreview.test.ts tests/targetSceneObject.test.ts tests/cloudflareMarkerObject.test.ts`

Expected: FAIL because the plane factory and media branches do not exist.

- [ ] **Step 3: Implement the shared media plane factory**

`prepareMediaPlane` creates a named `Group` containing a double-sided
`MeshBasicMaterial` plane. Geometry width is `clamp(aspectRatio, 0.2, 5)` and
height is `1`. YouTube adds a separate translucent play-triangle mesh that does
not replace the raycast target. Loading failures create a branded fallback
plane in fallback mode and reject in strict mode. `dispose()` releases each
owned texture, material, and geometry exactly once.

Update Preview and target-scene object creation to branch in this order:

```ts
if (isTextTargetObject(object)) { /* text */ }
else if (isImageTargetObject(object)) { /* image plane */ }
else if (isYouTubeTargetObject(object)) { /* thumbnail plane + surface */ }
else { /* model */ }
```

Keep the common object root as the transform-control attachment so drag, rotate,
scale, grouping, keyboard controls, and animation require no media-specific
transform code.

- [ ] **Step 4: Run rendering tests and verify GREEN**

Run: `npm test -- tests/mediaPlane3d.test.ts tests/imageTargetPreview.test.ts tests/targetSceneObject.test.ts tests/cloudflareMarkerObject.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the rendering change**

```powershell
git add src/scene/mediaPlane3d.ts src/scene/ImageTargetPreview.ts src/ar/targetSceneObject.ts src/ar/cloudflareMarkerObject.ts tests/mediaPlane3d.test.ts tests/imageTargetPreview.test.ts tests/targetSceneObject.test.ts tests/cloudflareMarkerObject.test.ts
git commit -m "feat: render draggable target media planes"
```

### Task 4: Add inline tracked YouTube playback

**Files:**
- Create: `src/ar/youtubePlayerManager.ts`
- Modify: `src/ar/mindarRuntime.ts`
- Modify: `src/ar/arObjects.ts`
- Test: `tests/youtubePlayerManager.test.ts`
- Test: `tests/mindarRuntime.test.ts`

**Interfaces:**
- Consumes: `InteractiveYouTubeSurface` from Task 3.
- Produces: `YouTubePlayerManager`.
- Produces methods `register(surface)`, `activateFromPointer(ndc, camera)`, `setMarkerVisible(markerId, visible)`, `update(camera)`, `resize(width, height)`, and `dispose()`.

- [ ] **Step 1: Write failing player lifecycle tests**

```ts
it('plays only after a pointer hit and restores the thumbnail after target loss', async () => {
  const manager = new YouTubePlayerManager(container, {
    createCssRenderer,
    createPlayer,
    raycast: () => surface,
  });
  manager.register(surface);

  await manager.activateFromPointer({ x: 0, y: 0 }, camera);
  expect(createPlayer).toHaveBeenCalledWith(expect.objectContaining({
    videoId: 'M7lc1UVf-VE',
    playerVars: expect.objectContaining({ autoplay: 0, playsinline: 1 }),
  }));
  expect(player.playVideo).toHaveBeenCalledOnce();
  expect(surface.mesh.visible).toBe(false);

  manager.setMarkerVisible('cloud-target-1', false);
  expect(player.pauseVideo).toHaveBeenCalledOnce();
  expect(surface.mesh.visible).toBe(false);

  manager.setMarkerVisible('cloud-target-1', true);
  expect(player.destroy).toHaveBeenCalledOnce();
  expect(surface.mesh.visible).toBe(true);
});
```

Add tests for one API script promise, duplicate-tap suppression, transform
decomposition into `CSS3DObject`, player errors returning to thumbnail,
renderer resize, marker/session isolation, and idempotent disposal.

- [ ] **Step 2: Run YouTube runtime tests and verify RED**

Run: `npm test -- tests/youtubePlayerManager.test.ts tests/mindarRuntime.test.ts`

Expected: FAIL because the player manager and MindAR hooks are absent.

- [ ] **Step 3: Implement CSS3D and MindAR integration**

Create the CSS renderer once per marker AR session with an absolute,
pointer-events-aware DOM layer aligned to the MindAR canvas. Register every
surface after anchors are built. A canvas `pointerup` converts client
coordinates to normalized device coordinates and asks the manager to raycast
only visible surfaces.

The manager creates an iframe player only after a hit. The initial player is
cued with controls and `playsinline: 1`; `playVideo()` occurs inside the
pointer-activation promise. On every frame, decompose the source object root's
world matrix into the CSS3D object's position, quaternion, and scale, then
render the CSS scene with the MindAR camera. Keep the idle WebGL thumbnail as
the sole representation before activation and after target reacquisition.

Extend marker objects with optional visibility and pointer surfaces without
changing built-in marker behavior. `stop()` removes the pointer listener,
destroys players, removes CSS DOM, and remains safe after a partial MindAR
startup failure.

- [ ] **Step 4: Run YouTube runtime tests and verify GREEN**

Run: `npm test -- tests/youtubePlayerManager.test.ts tests/mindarRuntime.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit inline YouTube playback**

```powershell
git add src/ar/youtubePlayerManager.ts src/ar/mindarRuntime.ts src/ar/arObjects.ts tests/youtubePlayerManager.test.ts tests/mindarRuntime.test.ts
git commit -m "feat: play tracked YouTube objects inline"
```

### Task 5: Build the unified Objects authoring workflow

**Files:**
- Modify: `src/ui/appShell.ts`
- Modify: `src/ui/targetObjectList.ts`
- Modify: `src/ui/targetInspectorTabs.ts`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Modify: `src/styles/arvenilo-redesign.css`
- Test: `tests/appShell.test.ts`
- Test: `tests/targetObjectList.test.ts`
- Create: `tests/targetMediaEditorIntegration.test.ts`
- Modify: `tests/newTargetAnimationDefaults.test.ts`
- Modify: `tests/targetObjectControlsSelection.test.ts`

**Interfaces:**
- Consumes: media constructors, validation, pending-source types, and save inputs.
- Produces: a unified `data-add-object-kind` UI state and draft media map keyed by object ID.

- [ ] **Step 1: Write failing unified UI and editor tests**

```ts
it('keeps all four object creators in one Objects tab', () => {
  const container = renderAppShell();
  expect(container.querySelector('[data-target-inspector-tab="text"]')).toBeNull();
  expect(container.querySelectorAll('[data-add-object-kind]')).toHaveLength(4);
  expect([...container.querySelectorAll('[data-add-object-kind]')].map((node) => node.textContent?.trim()))
    .toEqual(['3D model', 'Text', 'Image', 'YouTube video']);
  expect(container.querySelector('#target-model-rail')?.closest('[data-object-creator="model"]')).toBeTruthy();
  expect(container.querySelector('#add-target-text')?.closest('[data-object-creator="text"]')).toBeTruthy();
});
```

Add integration tests that upload a file, add an image URL, add a YouTube URL,
select each new row, use existing placement controls, remove an unsaved media
object, reset the editor, save pending sources, reload durable objects, and
preserve default per-object animation.

- [ ] **Step 2: Run unified UI tests and verify RED**

Run: `npm test -- tests/appShell.test.ts tests/targetObjectList.test.ts tests/targetMediaEditorIntegration.test.ts tests/newTargetAnimationDefaults.test.ts tests/targetObjectControlsSelection.test.ts`

Expected: FAIL because the Media creators and unified tab do not exist.

- [ ] **Step 3: Implement the unified Objects tab**

Move the existing model rail and text form into the Objects panel. Add a
four-button segmented toolbar using `aria-pressed`, four labeled creator
containers, image file/URL fields, and a YouTube URL field. Only the selected
creator is visible. Keep the placed list and grouping toolbar below the creator.

Maintain:

```ts
let targetMediaSources = new Map<string, PendingTargetImageSource>();
```

For local files, validate, read Base64, obtain dimensions from a browser image,
and create a preview data URL. For URL drafts, require HTTPS and create an image
object using the entered URL; the Worker performs authoritative import
validation on save. For YouTube, normalize before creation. Removing/resetting
an unsaved image deletes its pending source and revokes any owned object URL.
Loading a saved target starts with an empty pending-source map.

Update object messages and rows through `targetObjectLabel` so no model
property is read from media variants. Pass `Object.fromEntries(targetMediaSources)`
to create/update requests. Change the empty-save message to
`Add at least one object before saving.`

- [ ] **Step 4: Add responsive branded styles**

Create a compact object-kind toolbar, bordered creator region, media input grid,
type badges, thumbnail swatches, and mobile stacking rules using the existing
Arvenilo tokens. Preserve 44 px touch targets, visible focus states, and the
current inspector width.

- [ ] **Step 5: Run unified UI tests and verify GREEN**

Run: `npm test -- tests/appShell.test.ts tests/targetObjectList.test.ts tests/targetMediaEditorIntegration.test.ts tests/newTargetAnimationDefaults.test.ts tests/targetObjectControlsSelection.test.ts`

Expected: PASS with no warnings.

- [ ] **Step 6: Commit the authoring workflow**

```powershell
git add src/ui/appShell.ts src/ui/targetObjectList.ts src/ui/targetInspectorTabs.ts src/main.ts src/style.css src/styles/arvenilo-redesign.css tests/appShell.test.ts tests/targetObjectList.test.ts tests/targetMediaEditorIntegration.test.ts tests/newTargetAnimationDefaults.test.ts tests/targetObjectControlsSelection.test.ts
git commit -m "feat: unify target object authoring"
```

### Task 6: Add the focused Mark-AR Worker and transactional R2 media storage

**Files:**
- Create: `worker/src/types.ts`
- Create: `worker/src/http.ts`
- Create: `worker/src/storage.ts`
- Create: `worker/src/auth.ts`
- Create: `worker/src/models.ts`
- Create: `worker/src/media.ts`
- Create: `worker/src/imageTargets.ts`
- Create: `worker/src/index.ts`
- Create: `tests/worker/markArWorker.test.ts`
- Create: `wrangler.jsonc`
- Create: `.env.example`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/app/cloudflareModels.ts`

**Interfaces:**
- Consumes: the Task 2 wire contract.
- Produces: existing `/auth/*`, `/generate-3d/models`, stored asset, `/generate-3d/image-targets`, and scan routes.
- Produces: transactional image-object import into `image-targets/media/<target-id>/`.

- [ ] **Step 1: Add Wrangler without changing runtime dependencies**

Run: `npm install --save-dev wrangler@^4.105.0`

Add scripts:

```json
{
  "worker:dev": "wrangler dev",
  "worker:deploy": "wrangler deploy"
}
```

- [ ] **Step 2: Write failing Worker compatibility and media tests**

```ts
it('imports uploaded and URL image objects into target-scoped R2 keys', async () => {
  fetchMock.mockResolvedValueOnce(new Response(webpBytes, {
    headers: { 'content-type': 'image/webp', 'content-length': String(webpBytes.byteLength) },
  }));
  const response = await worker.fetch(authenticatedTargetCreate({
    objects: [
      imageUploadObject('poster-upload'),
      imageUrlObject('poster-url', 'https://cdn.example/poster.webp'),
      youtubeObject('video-one', 'M7lc1UVf-VE'),
    ],
  }), env, context);

  expect(response.status).toBe(201);
  const body = await response.json() as ImageTargetEntry;
  expect(body.objects[0].image.object_key).toMatch(
    /^image-targets\/media\/[^/]+\/poster-upload-[^.]+\.png$/,
  );
  expect(body.objects[1].image.object_key).toMatch(
    /^image-targets\/media\/[^/]+\/poster-url-[^.]+\.webp$/,
  );
  expect(JSON.stringify(body)).not.toContain('image_base64');
  expect(body.objects[2].youtube.video_id).toBe('M7lc1UVf-VE');
});
```

Also test existing account signup/login/session, generated-model visibility,
stored asset serving, legacy target reads, scan access modes, 5 MB limits,
unsupported MIME, non-HTTPS URLs, credentials, localhost, IPv4/IPv6 private and
metadata ranges, unsafe redirects, missing/large content-length, streaming
overflow, invalid image headers, create rollback, update rollback, stale-media
cleanup, target deletion, CORS, and unauthorized writes.

- [ ] **Step 3: Run Worker tests and verify RED**

Run: `npm test -- tests/worker/markArWorker.test.ts`

Expected: FAIL because no local Worker exists.

- [ ] **Step 4: Implement focused auth, storage, and model modules**

Port only the required compatible schemas from the committed `Web-AR` Worker:

- PBKDF2 password hashing with per-user salts.
- HMAC-signed, expiring session tokens and revoked-session storage.
- Signup, login, session, logout, user list, and approval/status routes used by
  `webArAuth.ts`.
- Generated-model index reads with public/owner/admin filtering.
- Model, preview, target image, and target media R2 streaming with stored content
  types.

Keep prefixes `auth/`, `models/generated/`, and `image-targets/` so the same R2
bucket remains readable. Do not copy generation endpoints, job state, Modal,
OpenAI, audio, cron, or upload-model management.

- [ ] **Step 5: Implement safe image import and dimension parsing**

```ts
export async function resolvePendingImage(
  source: PendingImageSource,
  deps: MediaDeps,
): Promise<ResolvedImage> {
  const bytes = source.source === 'upload'
    ? decodeValidatedUpload(source)
    : await fetchValidatedPublicImage(source.source_url, deps.fetch);
  const dimensions = readImageDimensions(bytes, sourceMimeType);
  return { bytes, mimeType: sourceMimeType, ...dimensions };
}
```

Validate every redirect before fetching it. Resolve DNS where the runtime
provides lookup support; also reject literal private IPv4/IPv6 hosts and blocked
host names before requests. Use manual redirects, a maximum of three redirects,
an abort timeout, a 5 MB streaming accumulator, MIME sniff/header agreement,
and PNG/JPEG/WebP header readers for dimensions.

- [ ] **Step 6: Implement target transactions**

Normalize all four object kinds and group fields. For create, allocate the
target ID before resolving media so final target-scoped keys are known. Store
media, then record, then index; delete every new key after a later failure. For
update, retain unchanged durable image keys, version replacements, write record
then index, rollback new writes on failure, and delete old unreferenced keys
only after success. For delete, update the index and remove the target image,
record, and owned `image-targets/media/<target-id>/` keys referenced by the
record.

- [ ] **Step 7: Add Wrangler and frontend environment configuration**

Use:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "mark-ar-api",
  "main": "worker/src/index.ts",
  "compatibility_date": "2026-07-25",
  "workers_dev": true,
  "preview_urls": true,
  "vars": {
    "PUBLIC_MODEL_ORIGIN": "https://mark-ar-api.sshibinthomass.workers.dev"
  },
  "r2_buckets": [{
    "binding": "MODEL_BUCKET",
    "bucket_name": "web-ar-model-assets"
  }]
}
```

Change `DEFAULT_GENERATE_MODEL_API_URL` to prefer
`import.meta.env.VITE_MARK_AR_API_URL`, retaining the current deployed URL only
as the documented migration fallback.

- [ ] **Step 8: Run Worker tests and verify GREEN**

Run: `npm test -- tests/worker/markArWorker.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit the Worker**

```powershell
git add worker tests/worker/markArWorker.test.ts wrangler.jsonc .env.example package.json package-lock.json src/app/cloudflareModels.ts
git commit -m "feat: add self-contained Mark-AR worker"
```

### Task 7: Verify complete save, scan, and playback behavior

**Files:**
- Modify: `tests/targetSpecificScanIntegration.test.ts`
- Modify: `tests/savedTargetEditingIntegration.test.ts`
- Modify: `tests/markerTargets.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: all previous task interfaces.
- Produces: end-to-end regression coverage and operator documentation.

- [ ] **Step 1: Write failing cross-layer integration tests**

Add a saved target containing one model, text, image, and YouTube object.
Assert that:

```ts
expect(createSingleTargetRuntimeMarker(savedTarget)[0].cloudflareAsset?.objects)
  .toEqual(savedTarget.objects);
expect(lastPreviewState.objects?.map((object) => object.kind ?? 'model'))
  .toEqual(['model', 'text', 'image', 'youtube']);
expect(updatedTarget.objects.find(isImageTargetObject)?.image.objectKey)
  .toMatch(/^image-targets\/media\//);
```

Verify editing does not re-upload unchanged durable images, replacing an image
sends one pending source, scan startup registers a YouTube surface, target loss
pauses it, and back/restart flows do not retain a player from the previous AR
session.

- [ ] **Step 2: Run integration tests and verify RED**

Run: `npm test -- tests/targetSpecificScanIntegration.test.ts tests/savedTargetEditingIntegration.test.ts tests/markerTargets.test.ts`

Expected: FAIL until all cross-layer media state is connected.

- [ ] **Step 3: Fix only missing cross-layer wiring**

Pass media objects unchanged through marker target construction, make preview
session cloning preserve durable metadata, ensure reset/edit flows clear pending
sources, and route marker visibility to the matching YouTube surfaces. Do not
add new object kinds or deployment behavior in this task.

- [ ] **Step 4: Update operator documentation**

Document:

- `npm run worker:dev`
- `npm run worker:deploy`
- `VITE_MARK_AR_API_URL`
- `AUTH_SECRET` as a Wrangler secret
- `ALLOWED_ORIGINS`
- R2 binding and existing bucket reuse
- why URL images are imported
- YouTube inline/CSS3D limitations
- production migration and R2 backup steps

- [ ] **Step 5: Run focused integration tests and verify GREEN**

Run: `npm test -- tests/targetSpecificScanIntegration.test.ts tests/savedTargetEditingIntegration.test.ts tests/markerTargets.test.ts`

Expected: PASS.

- [ ] **Step 6: Run the complete verification gate**

Run:

```powershell
npm test
npm run build
npx wrangler deploy --dry-run
git diff --check
git status --short --branch
```

Expected:

- All frontend and Worker tests pass with zero failures.
- TypeScript and Vite production build exit 0.
- Wrangler dry-run bundles the local Worker without deployment.
- No whitespace errors.
- Only intentional feature files are changed.

- [ ] **Step 7: Perform browser and device checks**

Run the Vite app and confirm in a real browser:

1. The Objects tab contains 3D model, Text, Image, and YouTube video creators.
2. Uploaded and URL images appear as selectable, draggable planes.
3. YouTube appears as a selectable thumbnail plane in Studio.
4. Move, vertical drag, rotate, scale, group, animate, delete, save, and reload
   work for image and YouTube objects.
5. A camera-capable mobile browser scans the marker.
6. Image objects render in AR.
7. Tapping the YouTube thumbnail starts inline playback.
8. Target loss pauses and hides playback.
9. Reacquisition shows the thumbnail without autoplay.
10. AR exit releases the player and a second session creates only one player.

- [ ] **Step 8: Commit final integration and documentation**

```powershell
git add tests/targetSpecificScanIntegration.test.ts tests/savedTargetEditingIntegration.test.ts tests/markerTargets.test.ts README.md
git commit -m "test: verify target media experiences"
```

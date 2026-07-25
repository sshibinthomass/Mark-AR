# Target Media Objects Design

**Date:** 2026-07-25

**Branch:** `codex/target-media-objects`

**Status:** Approved

## Objective

Make AnchorAR targets support images and YouTube videos as first-class spatial
objects alongside 3D models and text. Creators must be able to add, select,
drag, move vertically, rotate on all three axes, scale, group, animate, delete,
save, reload, and scan these media objects.

The `Mark-AR` repository must also become self-contained for the backend
capabilities it consumes. A dedicated Cloudflare Worker in this repository will
own authentication, model listing, target persistence and scanning, target
image storage, and image-object storage. The unrelated 3D generation pipeline
in the sibling `Web-AR` repository will not be copied.

## Scope

### Included

- A unified **Objects** tab for adding 3D models, text, images, and YouTube
  videos.
- Image objects created from PNG, JPEG, or WebP files up to 5 MB.
- Image objects created from public HTTPS image URLs.
- Import of both uploaded and URL-based images into Cloudflare R2.
- Flat rectangular image meshes positioned and transformed in 3D space.
- YouTube objects represented by a thumbnail plane until the user taps them in
  AR.
- Inline, non-fullscreen YouTube playback attached to the saved 3D transform.
- Target save, update, list, scan, access-control, and delete support for both
  media kinds.
- Cleanup of R2 image-object files that are replaced or no longer referenced.
- A reduced Cloudflare Worker and Wrangler configuration located in `Mark-AR`.
- Automated unit, integration, Worker, lifecycle, and build verification.

### Excluded

- Fullscreen YouTube playback.
- YouTube autoplay.
- Downloading, proxying, or storing YouTube video streams.
- Arbitrary non-YouTube video URLs or uploaded video files.
- Volumetric image geometry. An image is a flat plane with a 3D transform.
- Copying Modal, OpenAI, speech, image-generation, or job-polling pipelines from
  `Web-AR`.
- True WebGL occlusion, lighting, shadows, or material effects for the active
  cross-origin YouTube iframe.

## User Experience

### Unified Objects tab

The existing separate Text tab is removed. The Objects tab becomes the single
place to add and manage every target object. Its add-object toolbar contains:

1. **3D model**
2. **Text**
3. **Image**
4. **YouTube video**

Choosing a type reveals only that type's compact input panel:

- **3D model:** the existing model library.
- **Text:** the existing content, language, font, and style-preset inputs.
- **Image:** a file picker and an image URL input. Entering one source clears
  the other before the object is added.
- **YouTube video:** a YouTube URL input and an Add video action.

The placed-object list remains below the add controls. Each row shows a type
label and useful identity:

- Model label for a 3D model.
- Content excerpt for text.
- File name or source host for an image.
- YouTube video ID or resolved title when available for a video.

Adding an object selects it immediately and enables the existing Object tab.
The Object tab continues to own placement, rotation, scale, animation, and text
style controls. Image and YouTube objects use the shared transform and
animation controls. Text-only style controls remain visible only for text.

### Studio preview

An image object is a selectable Three.js `Mesh` backed by `PlaneGeometry` and a
texture. The geometry preserves the source aspect ratio while the existing
uniform scale control changes its overall size. It participates in raycasting,
dragging, selection outlines, grouping, keyboard controls, and animation like
the existing model and text objects.

A YouTube object is also represented by a selectable Three.js plane in the
Studio. It uses the video's thumbnail with a play indicator. Studio playback is
intentionally disabled so iframe controls cannot capture pointer events needed
for editing.

Local image files use a temporary object/data URL for immediate preview.
URL-based images use the entered URL for the draft preview only when browser
loading succeeds. A failed draft preview shows an explicit media placeholder
without losing the editable object.

### AR playback

Saved image objects render as ordinary textured WebGL planes.

Saved YouTube objects begin as textured thumbnail planes. A tap is resolved by
raycasting against the plane. Once activated:

1. The WebGL thumbnail plane is hidden.
2. A YouTube iframe is created with the IFrame Player API.
3. The iframe is wrapped in a `CSS3DObject`.
4. The CSS3D object receives the same world transform and animation state as
   the thumbnail plane.
5. Playback begins because the API call follows a direct user gesture.

Playback stays inline by using the YouTube `playsinline` setting. It never
requests fullscreen.

When MindAR reports target loss, the player is paused and hidden. Reacquiring
the target restores the thumbnail rather than resuming automatically. The user
must tap again. Exiting or restarting AR destroys every player and releases
textures, event handlers, DOM nodes, and renderer resources.

An unavailable, private, removed, or embedding-disabled YouTube video retains
its thumbnail and reports a concise playback error without failing the AR
session.

## Architecture

### Shared object model

`TargetEditorObject` becomes a four-kind discriminated union:

```ts
type TargetEditorObject =
  | ModelTargetObject
  | TextTargetObject
  | ImageTargetObject
  | YouTubeTargetObject;
```

All variants retain the shared object fields:

```ts
type TargetObjectBase = {
  id: string;
  placement: ImageTargetPlacement;
  animation?: ImageTargetAnimation;
  groupId?: string;
  localPlacement?: ImageTargetPlacement;
};
```

Image content uses durable metadata plus an optional draft source:

```ts
type TargetImageContent = {
  url: string;
  objectKey?: string;
  label: string;
  width: number;
  height: number;
  aspectRatio: number;
};

type ImageTargetObject = TargetObjectBase & {
  kind: 'image';
  image: TargetImageContent;
};
```

Draft file bytes or an import URL are maintained separately from the
serializable target object until save. This prevents Base64 data from leaking
into editor lists, saved records, or scan responses.

YouTube content stores a canonical identity:

```ts
type TargetYouTubeContent = {
  videoId: string;
  url: string;
  thumbnailUrl: string;
};

type YouTubeTargetObject = TargetObjectBase & {
  kind: 'youtube';
  youtube: TargetYouTubeContent;
};
```

Supported input forms include canonical watch URLs, `youtu.be` links, Shorts
URLs, and YouTube embed URLs. Validation extracts an 11-character video ID and
rewrites the input to a canonical watch URL. Non-YouTube hosts and malformed
IDs are rejected before an object is created.

### Rendering boundaries

Media concerns are split into focused units:

- **Media validation and normalization:** file rules, URL parsing, YouTube ID
  extraction, and canonical metadata.
- **Image plane factory:** texture loading, aspect-ratio geometry, placeholders,
  and disposal.
- **YouTube thumbnail plane factory:** WebGL representation used for editing
  and idle AR.
- **YouTube player manager:** IFrame API loading, CSS3D object lifecycle,
  tracking visibility, tap activation, errors, and disposal.
- **Target scene integration:** chooses the correct factory for each object kind
  while preserving shared placement, grouping, and animation behavior.

The Studio preview remains WebGL-only. The AR runtime adds a transparent
`CSS3DRenderer` layer aligned with the existing MindAR camera and scene. It is
resized with the WebGL renderer and rendered from the same animation loop.

YouTube iframes cannot become WebGL textures because they are cross-origin DOM
content. CSS3D supplies hierarchical 3D transforms but does not participate in
WebGL materials, geometry, depth, or occlusion. These limitations are accepted
for the active player; the idle thumbnail remains a normal WebGL plane.

References:

- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- [YouTube embedded-player parameters](https://developers.google.com/youtube/player_parameters)
- [Three.js CSS3DRenderer](https://threejs.org/docs/pages/CSS3DRenderer.html)
- [MDN: WebGL textures and cross-origin controls](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL)

## Persistence and Cloud Storage

### Dedicated Mark-AR Worker

`Mark-AR` receives a `worker/` source tree and `wrangler.jsonc`. The Worker
contains only:

- CORS and response helpers.
- Signup, login, session, logout, and the account operations currently required
  by the frontend.
- Read-only generated-model listing and asset serving needed by the model
  picker.
- Image-target create, update, list, scan, and delete routes.
- Target and media asset serving from R2.
- Image-object validation, URL import, storage, rollback, and cleanup.

It uses the existing R2 schemas and prefixes where compatibility is required,
allowing deployment against the current bucket without discarding accounts,
models, targets, or scan links. The Worker name and public origin are specific
to Mark-AR. Secrets remain Wrangler secrets and are never committed.

The frontend's Worker base URL becomes an environment-configurable Vite value
with a documented development fallback. Production migration requires
deploying the new Worker and setting the production URL; it does not require
changes to `Web-AR`.

### Image-object save contract

Uploaded file bytes and URL imports travel only in authenticated target create
or update requests. Each pending image object identifies one of:

```ts
type PendingTargetImageSource =
  | { source: 'upload'; imageBase64: string; imageMimeType: string }
  | { source: 'url'; sourceUrl: string };
```

The Worker validates all pending image sources before making the target record
visible:

- Upload MIME type must be PNG, JPEG, or WebP.
- Decoded upload size must be at most 5 MB.
- Import URLs must be HTTPS.
- URL credentials, fragments, nonstandard ports, loopback hosts, localhost,
  link-local addresses, private network ranges, and metadata-service addresses
  are rejected.
- Redirects are followed only through the same validation policy and a bounded
  redirect count.
- The response must identify PNG, JPEG, or WebP content.
- Download streaming stops once the 5 MB limit is exceeded.
- Image dimensions must be positive and decodable.

R2 image-object keys use a target-scoped prefix:

```text
image-targets/media/<target-id>/<object-id>-<version>.<extension>
```

The stored target object contains only the returned public URL, object key,
label, dimensions, and aspect ratio. Scan responses therefore remain small and
contain no Base64 payloads.

### Transaction and cleanup behavior

For target creation, media files are written first, followed by the target
record and then the index. A failure rolls back new media and record objects.

For target updates:

1. Resolve and store replacement media under versioned keys.
2. Write the new record.
3. Update the index.
4. Roll back the new record and new media if the index update fails.
5. After durable success, delete replaced or removed media keys.

For target deletion, the Worker removes the target image, every owned
image-object key, and the target record after updating the index. Failures are
reported without silently claiming deletion.

External image URLs are never retained as runtime dependencies after save.
They are imported into R2 so a third-party host cannot later break the AR
experience.

## Compatibility

- Existing model and text target records continue to normalize and load.
- The legacy top-level `model` and `placement` aliases remain populated from the
  first model object for older clients.
- Existing target image URLs, record keys, scan IDs, access modes, and allowed
  email rules remain unchanged.
- Unknown object kinds received by an older or malformed record are ignored
  without discarding valid sibling objects.
- Saved targets must still contain at least one valid object of any supported
  kind; the old model-or-text-only wording is updated throughout.

## Error Handling

The Studio prevents invalid media objects from being added and uses actionable
messages:

- Unsupported or oversized image files.
- Invalid, unsafe, unreachable, or unsupported image URLs.
- Invalid YouTube URLs.
- Failed thumbnail or image preview loads.
- Worker upload/import failures.
- Target responses that do not preserve saved media objects.

Saving stays in the editor when an error occurs. Existing objects and local
draft media remain available for correction and retry.

AR errors are isolated to the affected object. A failed image shows a
placeholder plane. A failed YouTube player returns to its thumbnail and exposes
a short status message. Other objects and marker tracking continue.

## Testing Strategy

### Frontend unit tests

- File MIME and 5 MB validation.
- Image URL and YouTube URL normalization.
- Object type guards and labels.
- Image aspect-ratio geometry and resource disposal.
- YouTube thumbnail creation and player-state transitions.
- Serialization and wire-format mapping for all four object kinds.
- Selection, grouping, transforms, animation, cloning, and deletion for media
  objects.

### Studio integration tests

- The unified Objects tab exposes all four add flows.
- The removed Text tab no longer appears.
- File and URL image drafts render and select.
- YouTube thumbnail objects render and select.
- Media objects use existing drag, keyboard, Object-tab, grouping, and
  animation paths.
- Create, update, reload, and response-integrity checks preserve media.

### AR runtime tests

- Saved image planes load at the correct transform.
- YouTube begins as a thumbnail.
- A raycast tap creates one inline player at the matching transform.
- Repeated taps do not create duplicate players.
- Target loss pauses and hides the player.
- Target reacquisition restores the thumbnail without autoplay.
- Player errors are isolated.
- AR shutdown disposes WebGL and CSS3D resources.

### Worker tests

- Existing authentication, model-list, and target behaviors remain compatible.
- Upload and URL-import validation accepts supported images and rejects unsafe
  inputs.
- Media is stored under target-scoped R2 keys.
- Records and scan responses contain durable metadata without Base64.
- Create and update rollback removes newly written media after later failures.
- Update and delete remove only unreferenced owned media.
- Access-control rules protect target management and scanning.

### Verification

Before completion:

1. Run the complete frontend and Worker test suites.
2. Run TypeScript and Vite production builds.
3. Run focused browser checks for all four add-object flows and transform
   controls.
4. Run a camera-capable device check for image tracking, image rendering, and
   tap-to-play inline YouTube behavior.
5. Confirm marker loss and AR exit pause and dispose the player.

## Deployment Notes

Implementation prepares deployment artifacts but does not deploy automatically.
Deployment requires:

1. A Cloudflare Worker name and route.
2. The R2 bucket binding.
3. `AUTH_SECRET` configured with Wrangler secrets.
4. Allowed frontend origins.
5. The deployed Worker public origin.
6. The Mark-AR frontend Worker URL environment value.

Reusing the existing R2 bucket preserves current accounts, models, targets, and
scan links. A backup of the relevant R2 indexes and records is recommended
before the first production deployment of the reduced Worker.

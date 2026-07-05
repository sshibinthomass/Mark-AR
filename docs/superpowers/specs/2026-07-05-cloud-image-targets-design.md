# Cloud Image Targets Design

## Goal

Add a cloud-backed image target workflow to Mark-AR. A signed-in user can upload an image, select a Cloudflare-hosted 3D model, preview the model positioned above the image in a 3D view, save the pairing to Cloudflare storage, and later scan that same image so the saved model appears on top of it.

## Scope

This feature spans two repositories:

- `D:\Github-Projects\Web-AR`: extend the existing Cloudflare Worker and R2 storage that already manages auth, generated models, uploaded GLBs, owner metadata, and visibility.
- `D:\Github-Projects\Mark-AR`: add the image-target page, cloud target client, 3D preview, and MindAR runtime support for cloud targets.

The saved image target must be cloud-backed, not local-only. A target saved on one approved account should be available from another browser after signing in with the same account. Admin users should be able to see/manage all targets, matching the generated-model behavior.

## User Flow

1. User opens Mark-AR and signs in through the existing Worker auth controls.
2. User navigates to a new `#/targets` page.
3. User uploads a target image.
4. User selects one model from the Cloudflare model library, including generated and uploaded GLB entries returned by the Worker.
5. User previews the uploaded image as a plane with the selected GLB placed above it in a Three.js preview.
6. User adjusts placement with simple controls for scale, x/y offset, and height.
7. User saves the target to Cloudflare.
8. On `#/scan`, Mark-AR loads saved cloud targets, compiles their stored image URLs with the built-in marker images, and maps each saved model to its matching MindAR anchor.

## Cloudflare Worker Design

Extend the existing `web-ar-generate-model` Worker instead of creating a separate backend. This reuses the current R2 bucket, bearer-token sessions, approved-account checks, owner/private visibility rules, CORS behavior, and audit logging style.

New routes:

- `GET /generate-3d/image-targets`: list visible image targets.
- `POST /generate-3d/image-targets`: create an image target. Requires an approved user.
- `PATCH /generate-3d/image-targets/:id`: update label, visibility, selected model, placement, or target image. Requires owner or admin.
- `DELETE /generate-3d/image-targets/:id`: delete target metadata and stored image. Requires owner or admin.
- `GET /image-targets/images/:file`: serve stored target images from R2 with cache headers and CORS.

The list route follows generated model visibility semantics:

- Guests see public targets only, if public visibility is supported in the UI.
- Signed-in users see their private targets and public targets.
- Admin users see all targets.

For the initial Mark-AR UI, saved targets default to `private` to match uploaded/generated model writes.

## R2 Storage

Use the existing `MODEL_BUCKET` binding with a separate namespace:

- `image-targets/index.json`: list of target records.
- `image-targets/records/{id}.json`: full record for one target, useful for direct lookup and future migration.
- `image-targets/images/{id}.{ext}`: uploaded target image bytes.

Target record shape:

```json
{
  "id": "target-20260705-180000-product-box",
  "label": "Product box",
  "image_url": "https://web-ar-generate-model.sshibinthomass.workers.dev/image-targets/images/target-20260705-180000-product-box.jpg",
  "image_object_key": "image-targets/images/target-20260705-180000-product-box.jpg",
  "model": {
    "id": "generated-fc-123",
    "label": "Chair",
    "url": "https://web-ar-generate-model.sshibinthomass.workers.dev/models/generated/capture.glb",
    "preview_url": "https://web-ar-generate-model.sshibinthomass.workers.dev/models/generated/previews/capture.png"
  },
  "placement": {
    "scale": 1,
    "offset_x": 0,
    "offset_y": 0,
    "height": 0.12
  },
  "owner_email": "maker@example.com",
  "visibility": "private",
  "created_at": "2026-07-05T18:00:00.000Z",
  "updated_at": "2026-07-05T18:00:00.000Z"
}
```

The Worker stores model metadata in the target record instead of only storing a model id. This lets the scanner load the exact GLB URL later even if the model dropdown order changes.

## Mark-AR Frontend Design

Add a new route and page:

- Route: `#/targets`
- Nav label: `Targets`
- Purpose: upload image, choose model, adjust 3D placement, save/list/delete cloud targets.

New frontend modules:

- `src/app/cloudImageTargets.ts`: Worker client for list/create/update/delete image targets.
- `src/app/imageTargetPayload.ts`: validation and conversion helpers for upload payloads and target image data URLs.
- `src/scene/ImageTargetPreview.ts`: Three.js preview scene that renders the uploaded image plane and selected GLB with saved placement values.
- `src/ar/markerTargets.ts`: maps built-in markers and cloud targets into a unified runtime target list.

The page reuses existing auth state and model loading from `cloudflareModels.ts`. The cloud target list refreshes after login, model reload, save, and delete.

## AR Runtime Design

The current runtime compiles `AR_MARKERS` only and can apply one optional Cloudflare model to every marker. Change it to compile a caller-provided target list.

Add a runtime target type:

```ts
type RuntimeMarkerTarget = {
  marker: MarkerSpec;
  cloudflareAsset?: CloudflarePlacedAsset;
};
```

Built-in markers continue to use local marker objects unless the current scan page has a selected global model. Cloud image targets always use their saved model and placement. Each target receives a sequential MindAR target index before compilation so built-in and cloud targets can share one compiled `.mind` file.

## Placement

The preview and AR render path use the same placement fields:

- `scale`: model scale multiplier.
- `offset_x`: horizontal shift on the image plane.
- `offset_y`: vertical shift on the image plane.
- `height`: distance above the image plane.

The first version keeps rotation automatic and upright. Rotation controls are out of scope for this implementation because scale and offsets are enough to place a model visibly on an image target.

## Error Handling

Mark-AR should show clear status text for these cases:

- Not signed in when saving a cloud target.
- No target image uploaded.
- No Cloudflare model selected.
- Worker rejects an image upload or returns validation errors.
- Saved target image cannot be loaded by the MindAR compiler.
- Saved GLB cannot be loaded. In this case, use the existing Cloudflare object fallback visual.

The Worker should return JSON errors with the same style as generated-model routes. Image upload validation should reject missing base64, MIME types outside `image/png`, `image/jpeg`, and `image/webp`, and decoded image payloads larger than 5 MB.

## Testing

Worker tests in `D:\Github-Projects\Web-AR`:

- Creating a target requires an approved user.
- Created targets store image bytes, owner email, private visibility, model metadata, and placement.
- Listing filters by guest, owner, and admin visibility.
- PATCH allows owner/admin updates and rejects other users.
- DELETE removes the index entry, record object, and image object.
- Public image serving returns image content with CORS headers.

Mark-AR tests:

- Route tests include `targets`.
- App shell test verifies target page controls exist.
- Cloud target client tests cover list/create/update/delete endpoint mapping and auth headers.
- Runtime tests verify built-in and cloud targets compile together and that each anchor gets the correct object.
- Preview helper tests validate placement defaults and payload validation.

Manual verification:

1. Run Web-AR Worker tests.
2. Deploy the Worker.
3. Run Mark-AR tests and GitHub Pages build.
4. Start Mark-AR locally on an allowed origin.
5. Sign in, upload a target image, select a model, save it, refresh, confirm it reloads from cloud.
6. Open scan mode, scan the uploaded image on another screen or printout, and confirm the selected GLB appears on that image.

## Commit Strategy

Use feature-sized commits:

1. Design spec.
2. Web-AR Worker image-target API and tests.
3. Mark-AR cloud target client and tests.
4. Mark-AR targets page and 3D preview.
5. Mark-AR scanner/runtime integration.
6. Deploy Worker, publish GitHub Pages, and record verification.

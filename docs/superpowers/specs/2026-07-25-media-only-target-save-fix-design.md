# Media-only Target Save Fix

## Problem

The published GitHub Pages app still calls the legacy `web-ar-generate-model`
Worker. That Worker recognizes only model and text target objects. When an image
or YouTube object is submitted, it removes the object and either:

- rejects the request because no valid model or text remains; or
- returns a saved target without the submitted object ID, which triggers the
  editor's authoring-integrity error.

The Mark-AR Worker already accepts model, text, image, and YouTube objects and
preserves their IDs.

## Design

Deploy the repository-local Worker as `mark-ar-targets`, bound to the existing
`web-ar-model-assets` R2 bucket so existing models, marker images, and target
records remain available. Delegate authentication, account approval, rate
limiting, administration, and generated-model listing to the established
`web-ar-generate-model` Worker. Target CRUD and image-object storage remain
owned by Mark-AR. Existing sessions and private-model visibility rules are
therefore preserved.

The frontend's production target API becomes:

`https://mark-ar-targets.sshibinthomass.workers.dev/generate-3d`

GitHub Pages will receive the same endpoint through `VITE_TARGET_API_URL`.

## Validation Contract

A target must contain at least one supported object. Each object is validated
by kind:

- `model` requires model metadata;
- `text` requires text metadata;
- `image` requires durable R2 metadata or a pending upload/URL source;
- `youtube` requires a valid 11-character YouTube video ID.

Image-only and YouTube-only targets are valid. Empty object arrays remain
invalid. Save and update responses must preserve every submitted object ID.

## Testing and Release

- Add a regression test proving the default client endpoint no longer calls the
  legacy Worker.
- Verify production authentication and model listing are delegated to the
  established service.
- Reject empty updates and non-canonical object IDs.
- Normalize legacy target records before returning or updating them.
- Retain and run Worker tests for image-only storage and media ID preservation.
- Run the complete test suite, application build, and Worker dry-run.
- Deploy the Worker, verify its health, delegated security boundaries, and
  media-only target lifecycle.
- Push the configuration change to `main`, wait for GitHub Pages, and verify the
  published JavaScript uses the new Worker origin.

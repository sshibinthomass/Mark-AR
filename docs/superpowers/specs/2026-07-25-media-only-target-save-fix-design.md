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
`web-ar-model-assets` R2 bucket so existing users, models, marker images, and
target records remain available. Give the new Worker its own `AUTH_SECRET`.
Existing passwords remain compatible, but existing sessions will need to sign
in once against the new Worker.

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
- Retain and run Worker tests for image-only storage and media ID preservation.
- Run the complete test suite, application build, and Worker dry-run.
- Deploy the Worker, verify its health and media-only target lifecycle.
- Push the configuration change to `main`, wait for GitHub Pages, and verify the
  published JavaScript uses the new Worker origin.

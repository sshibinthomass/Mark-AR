# Target Model Loader Design

## Goal

Give immediate, accessible feedback while a selected 3D model downloads and is prepared for the target preview.

## Behavior

- Clicking a model card marks that card busy and shows a centered loading overlay over the preview.
- The overlay says `Loading <model label>…` and leaves the existing preview visible underneath.
- Repeated clicks on the busy card are disabled.
- The busy state ends when the corresponding preview update finishes, whether it succeeds or fails.
- If selections overlap, only the latest preview request may clear the visible loading state.

## Structure

`modelRail.ts` renders the per-card busy state. `main.ts` owns the latest-request token and coordinates model selection with `ImageTargetPreview.update()`. Existing styles provide the visual overlay and compact spinner without introducing dependencies.

## Verification

Vitest covers accessible busy markup and request lifecycle behavior. The full test suite and production build must pass, followed by a browser check of `#/targets`.

# Local Text Targets Design

## Goal

Add local-only text objects to the `#/targets` editor. A user can type text, choose English, German, or Tamil helper copy, choose a font style, place the text in the 3D preview, and use the current AR session to view it on the uploaded image target without saving the text to Cloudflare.

## Scope

This first implementation does not persist text. Cloudflare image-target create and update calls continue to receive only GLB model objects. If the user saves a target that contains only local text, the UI asks for at least one Cloudflare model instead of storing the text.

## Editor Behavior

- Add a compact text panel to the existing target setup card.
- Provide a text area, language selector, font selector, and `Add text` button.
- Language presets set the text field to short English, German, and Tamil examples.
- Font options render as 3D scene objects for every supported option.
- Added text appears in the same object list as GLB models and can be selected.
- Selected text uses the existing Move, Rotate, Scale, and Animation controls.

## Rendering

Text renders as a Three.js 3D object, not an HTML overlay. The first implementation uses a thin 3D sign mesh with a canvas-generated text texture so each browser font stack, including Tamil-capable stacks, can render into the preview and AR runtime without extra font downloads.

## Current-Session AR

When a target image is uploaded and local text exists, `Start AR` includes a draft image target built from the current editor state. The draft target compiles from the current target image data URL and attaches the local text objects plus any local GLB objects. This draft target is in memory only.

## Save Behavior

Before calling `createImageTarget`, the editor filters the mixed object list down to model objects. Text objects are ignored. Saved target lists loaded from Cloudflare remain model-only.

## Tests

- Object helpers normalize text inputs and filter saveable GLB objects.
- App shell exposes text, language, font, and add-text controls.
- Preview creates a 3D text object for local text entries.
- AR object factory renders text objects without trying to load a GLB.
- Runtime target mapping includes a local draft target but does not mutate saved cloud targets.

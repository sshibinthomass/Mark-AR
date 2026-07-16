# Branded Target QR Download Design

## Goal

Automatically create a branded, downloadable QR code for every saved target's stable scan URL. After a target is created successfully for the first time, Mark-AR prompts the creator to download or share the QR. The same QR remains available from the saved-target row at any time.

## Confirmed Requirements

- Every saved target with a `scanId` has a QR code encoding its exact absolute `#/scan/<scan_id>` URL.
- QR generation runs locally in Mark-AR. It does not call an external QR service or require the Worker to store a generated image.
- The supplied `00-arvenilo-master-transparent-logo-QR.png` appears in the center of the QR.
- The supplied `04-anchorar-platform-transparent-QR.png` appears outside the QR at the bottom-right of the final image.
- The QR prompt appears only after the target's first successful creation.
- Editing or re-saving an existing target never opens the prompt.
- Every saved-target row provides a permanent `Download QR` action.
- The downloaded result is a high-resolution PNG suitable for sharing and printing.

## Asset Handling

The implementation copies the exact supplied source files into tracked Mark-AR assets so they are available in local builds and on GitHub Pages:

- Source `D:/Arvenilo/arvenilo-site/Arvenilo-Brand-Package/04-Transparent-Logos/00-arvenilo-master-transparent-logo-QR.png`
- Source `D:/Arvenilo/arvenilo-site/Arvenilo-Brand-Package/04-Transparent-Logos/04-anchorar-platform-transparent-QR.png`

The deployed asset URLs must respect Vite's configured base path. Both images are loaded from the same origin before drawing, preventing a cross-origin canvas from blocking PNG export.

## QR Composition

Mark-AR uses a local QR encoder and a canvas compositor. The QR encoder receives the target's absolute scan URL and uses high error correction.

The exported PNG uses a square white canvas:

- 1200 by 1200 pixels;
- a 900-pixel QR region near the top-left;
- a standards-compliant quiet zone included around the QR modules;
- dark modules on white for strong contrast;
- the `00` logo centered inside a white protective badge and limited to approximately 16 percent of the QR width;
- the `04` logo placed entirely below and outside the QR quiet zone, aligned to the bottom-right.

The outer logo must never overlap the QR region or its quiet zone. The center badge must not cover any finder pattern. QR output uses error-correction level `H`, and the implementation verifies that the composed result still decodes to the exact target URL.

## First-Creation Prompt

The prompt opens only from the successful create-target path, after the Worker returns the persisted target and its stable `scanId`. The update-target path does not invoke it. No persistent dismissal flag is needed because the trigger is tied to the creation operation rather than page rendering or target loading.

The modal heading is:

> Your AR experience is ready

The instruction is:

> Share this QR code with your audience. Scan it to open the AR experience, allow camera access, then point the camera at the target image to reveal the content in augmented reality.

The modal displays the generated QR preview and provides:

- `Download QR` as the primary action;
- `Copy link`;
- `Open scanner`;
- `Done`.

The modal enters with a short fade-and-scale animation. When reduced motion is requested, it appears without motion. It uses dialog semantics, moves focus into the prompt, supports keyboard navigation and Escape, and returns focus to the save control when closed.

## Permanent Saved-Target Action

For every saved target with a `scanId`, the existing link-action area adds `Download QR` beside `Copy link` and `Open scanner`.

Selecting `Download QR` generates the same branded image from the current stable URL and downloads it immediately. The operation does not change the selected target or open the first-creation modal.

The PNG filename follows:

`anchorar-<target-label>-qr.png`

The target label is converted to a filesystem-safe lowercase slug. If it produces no usable characters, the target ID is used as the fallback.

## Component Boundaries

QR encoding and branded canvas composition live in a focused app helper. It accepts a scan URL, target label, and logo assets, then returns a PNG `Blob` and filename. This unit has no knowledge of target persistence or modal state.

A focused UI component owns the first-creation dialog, preview state, animation, accessible controls, and callbacks. It receives a saved target and delegates generation, copying, navigation, and closing to explicit handlers.

The saved-target list receives an `onDownloadQr` callback in the same style as its existing copy-link callback. It only renders the action when `scanId` exists.

`main.ts` coordinates the feature:

1. create a new target;
2. confirm the returned target and stable scan URL;
3. refresh the saved-target list;
4. open the first-creation prompt with its loading state;
5. generate and display the QR preview;
6. leave the edit/update path unchanged except for the permanent row action.

## Loading and Error Handling

While the QR is being composed, the modal shows a visible generation state and disables only actions that require the image. `Copy link`, `Open scanner`, and `Done` remain available when possible.

If logo loading or QR composition fails:

- the saved target remains successful and unchanged;
- the prompt stays open with the stable URL;
- an inline error explains that the QR could not be prepared;
- `Try again` is offered;
- the permanent saved-row action can retry later.

If a target lacks `scanId`, no QR action is shown because there is no stable target URL to encode.

Repeated download clicks are guarded so one target does not start overlapping canvas-generation jobs. Object URLs created for downloads are revoked after use.

If the prompt is closed while generation is still running, its eventual result is ignored and any generated object URL is released rather than reopening or updating the closed prompt.

## Verification

Automated tests cover:

- encoding the exact absolute target scan URL;
- high error correction and the required quiet zone;
- placement bounds for the center `00` logo and exterior bottom-right `04` logo;
- decoding the final composed PNG back to the original URL;
- safe filename generation;
- opening the modal after a successful create;
- not opening it after an update;
- all modal actions and retry behavior;
- rendering `Download QR` only for saved targets with a `scanId`;
- reduced-motion and accessible dialog behavior;
- GitHub Pages base-path asset resolution.

Completion also requires:

- the full Mark-AR test suite;
- a normal production build;
- a `GITHUB_PAGES=true` production build;
- browser verification that a newly created target opens the animated prompt;
- browser verification that later edits do not reopen it;
- downloading from both the prompt and the saved-target row;
- confirming both PNGs are branded identically and decode to the target's exact scan URL;
- a real-device scan check at practical screen and print sizes.

## Out of Scope

- Storing QR PNGs in the Web-AR Worker or R2.
- Generating QR codes through a third-party web service.
- Automatically downloading without the creator choosing `Download QR`.
- Showing the creation prompt after editing, re-saving, loading, or scanning an existing target.
- Adding QR analytics, expiry, rotation, or custom QR styling controls.

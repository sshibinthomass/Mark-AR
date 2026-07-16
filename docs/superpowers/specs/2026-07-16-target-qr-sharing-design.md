# Target QR Sharing Design

## Goal

Add a `Share QR` action to the first-creation QR popup so a creator can send the generated branded QR image and its exact scan URL through the device share sheet. When the browser cannot share files, the same action downloads the QR image and copies the URL so both remain ready to send manually.

## Confirmed Requirements

- The share action exists in the QR popup only; saved-target row actions remain unchanged.
- `Share QR` is the first and primary popup action.
- The existing `Download QR` action remains available as a secondary action.
- Native sharing uses the already-generated branded PNG and the exact absolute `#/scan/<scan_id>` URL already held by the popup.
- The native share payload includes the PNG file, a target-specific title, text containing the scan URL, and the URL field.
- WhatsApp, Instagram, and other eligible destinations are selected from the operating system or browser share sheet. Mark-AR does not hard-code social-network buttons.
- If native file sharing is unavailable, one click downloads the PNG and copies the scan URL.
- A user cancelling the native share sheet causes no download, clipboard write, or error message.
- The popup remains open after sharing or fallback so the creator can download, copy, or open the scanner again.

## Platform Boundary

The Web Share API exposes only the share targets made available by the current browser and operating system. Mark-AR can provide both the file and URL, but a receiving application may omit or transform individual fields. The URL therefore appears in both the share text and the dedicated URL field to maximize compatibility.

Before opening the native share sheet, Mark-AR checks both `navigator.share` and `navigator.canShare({ files: [file] })`. If either capability is missing, the capability check returns false, or the check throws, Mark-AR uses the download-and-copy fallback. Native sharing is started directly from the button click, without awaiting another operation first, so the browser's transient user-activation requirement is preserved.

Reference behavior:

- Web Share API: <https://www.w3.org/TR/web-share/>
- MDN `Navigator.share()`: <https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share>

## User Interface

The ready-state popup action order is:

1. `Share QR` — primary
2. `Download QR` — secondary
3. `Copy link` — secondary
4. `Open scanner` — secondary
5. `Done` — quiet

`Try again` continues to appear only when QR generation fails.

`Share QR` and `Download QR` are disabled while the PNG is being generated and when generation has failed. During a share attempt, the share button is disabled and its label changes to `Sharing…` to prevent overlapping requests. The original label and enabled state are restored after the operation settles.

The popup adds a polite status region for share results:

- Native share completed: `QR code and scan link shared.`
- Fallback completed: `QR downloaded and scan link copied. Attach the QR image and paste the link in your app.`
- Fallback download completed but clipboard copy failed: `QR downloaded. Copy the scan link manually from above.`
- Native share failed for a reason other than cancellation: `The QR could not be shared. Try again or use Download QR and Copy link.`

Opening the popup, retrying QR generation, or starting a new share clears stale share status. Cancelling the share sheet leaves the status unchanged and does not present cancellation as an error.

The new action participates in the existing focus trap and responsive wrapping. Existing dialog animation, reduced-motion behavior, keyboard behavior, and focus restoration remain unchanged.

## Sharing Flow

The popup already retains a `TargetQrArtifact` containing the PNG `Blob` and filename, while its open input retains the target label and scan URL. The click flow is:

1. Ignore the click unless the popup is open and a current artifact exists.
2. Convert the artifact to a `File` using its existing filename and `image/png` MIME type.
3. Build a target-specific payload:
   - title: `AnchorAR — <target label>`;
   - text: `Scan this QR code to open the AR experience: <scan URL>`;
   - url: the exact scan URL;
   - files: the one branded PNG file.
4. If native file sharing is supported, call `navigator.share(payload)` immediately.
5. If the share promise resolves, show the native-share success status.
6. If it rejects with `AbortError`, restore the button without fallback or error.
7. If it rejects for another reason, show the actionable native-share failure status and keep the popup open.
8. If native file sharing is unsupported, invoke the existing PNG download helper and clipboard-copy flow from the same click, then show the complete or partial fallback status.

The native path never also downloads or copies. The fallback path never opens an empty or text-only share sheet.

## Component Boundaries

A focused app helper owns share capability detection, `File` construction, payload construction, cancellation classification, and fallback orchestration. Its browser dependencies are injectable so native, unsupported, cancelled, and failed paths are deterministic in tests. It consumes a `TargetQrArtifact`, target label, scan URL, download callback, and copy callback, and returns a small result union for UI messaging.

The QR dialog owns only presentation state. Its handler contract gains `onShare(scanUrl, targetLabel)`. The component renders the share button, exposes a busy-state method, and displays or clears the share status. It does not access browser sharing APIs itself.

`main.ts` coordinates the current popup artifact with the helper. It reuses the existing artifact, download helper, and clipboard helper; it does not regenerate the QR, change target persistence, or alter the saved-target list.

## Error Handling

- Missing popup artifact is treated as a guarded no-op because the button is disabled until generation completes.
- Capability-check failures use the download-and-copy fallback.
- `AbortError` is a normal cancellation outcome.
- Other native-share errors produce the actionable inline message and preserve all popup controls.
- If clipboard copying fails during fallback, the PNG still downloads and the visible scan URL plus existing `Copy link` button remain available.
- Share state is reset when the dialog closes or a different target opens, preventing a late result from changing a later popup session.

## Verification

Automated tests cover:

- constructing a PNG `File` with the artifact filename;
- providing the exact URL in both text and URL payload fields;
- native sharing without invoking download or clipboard fallback;
- fallback download and clipboard copy when file sharing is unsupported;
- fallback when capability detection throws;
- `AbortError` without fallback or error status;
- non-cancellation native-share failure messaging;
- partial fallback messaging when clipboard copy fails;
- rendering and ordering `Share QR` as the primary action;
- disabling share while loading or failed and enabling it when ready;
- the `Sharing…` busy state and repeated-click guard;
- routing the current target label and URL through the dialog handler;
- preserving dialog focus trapping and responsive action wrapping;
- integration with the retained first-creation QR artifact.

Completion also requires the focused tests, the full test suite, a normal production build, a `GITHUB_PAGES=true` production build, and browser verification of the popup's native or fallback behavior. Publication requires merging to `main`, pushing it, waiting for the Pages workflow, and confirming the live bundle contains the share action.

## Out of Scope

- Hard-coded WhatsApp, Instagram, or other social-network buttons.
- Guaranteeing that every receiving application preserves every Web Share payload field.
- Sharing from saved-target rows.
- Regenerating, uploading, or persistently storing a second QR artifact.
- Changing the QR image composition, logo alignment, scan URL, or first-creation-only popup trigger.

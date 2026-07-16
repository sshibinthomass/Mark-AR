# Scanner Overlay Lifecycle Design

## Goal

Keep all marker-scanner visuals and camera resources scoped to the Scan page. The scanning guide must render only inside the camera stage, and leaving Scan must stop the camera and remove every scanner-related visual.

## Root Cause

The route lifecycle already calls the active marker session's `stop()` method and clears the camera stage.

The remaining white scanner frame is MindAR's built-in scanning UI. MindAR creates its loading, compatibility, and scanning overlays as children of `document.body`, outside the Scan page. Its `stop()` implementation stops the media tracks and removes the video, but it does not hide or remove those body-level overlays. Consequently:

- the scanning frame remains visible after navigation;
- restarting the scanner can create additional global overlays;
- hiding the Scan page cannot hide the orphaned UI.

## Chosen Approach

The application will own the marker-scanning presentation.

MindAR's built-in loading, scanning, and compatibility overlays will be disabled when the runtime instance is created. The app will render one scanner guide inside `#ar-stage`, alongside the existing idle state, camera video, and renderer layers.

This approach is preferred over editing vendored MindAR code or deleting global overlays after each stop:

- it does not modify bundled third-party source;
- scanner UI ownership follows the camera stage lifecycle;
- page hiding and stage cleanup work naturally;
- restart and abort paths cannot accumulate global overlays;
- the guide can match the application's visual language and accessibility rules.

## Scanner States

The camera stage has four presentation states:

1. **Idle**
   - Camera is not active.
   - The existing idle placeholder is visible.
   - The scanner guide is absent.

2. **Starting**
   - Target compilation or camera startup is in progress.
   - The idle placeholder is removed.
   - A scanner guide is visible inside the camera stage.
   - Status text continues to report compilation and startup progress.

3. **Scanning**
   - Camera and marker processing are active, but no target is visible.
   - The scanner guide remains visible inside the camera stage.

4. **Target visible**
   - At least one marker is currently tracked.
   - The scanner guide is hidden so it does not cover the anchored scene.
   - If all targets are lost, the guide becomes visible again.

The scanner guide is decorative and must be marked `aria-hidden="true"`. Current state and recovery instructions remain in the existing live status region.

## Lifecycle and Data Flow

`startCurrentArSession()` remains the owner of route-level scanner state. It asks the marker runtime to start and receives marker visibility events.

The marker runtime will:

- construct MindAR with `uiLoading`, `uiScanning`, and `uiError` disabled;
- continue forwarding marker visibility events;
- stop MindAR, rendering, marker objects, and compiled targets idempotently.

The Scan page will:

- install one in-stage scanner guide before startup;
- track visible target IDs or indexes so multiple-target scanning behaves correctly;
- hide the guide when at least one target is visible;
- show it when no targets are visible;
- remove it when startup fails, is aborted, switches to floor mode, restarts, or leaves Scan;
- restore the idle placeholder whenever the marker scanner is fully stopped outside an immediate restart.

Existing request versions and `AbortController` checks remain authoritative for stale asynchronous starts. A late session that resolves after navigation must be stopped and must not recreate scanner UI.

## Navigation Behavior

When the active location changes from Scan to another route:

- pending marker startup is aborted;
- an active marker session is stopped;
- any active or prepared floor session is stopped and disposed;
- camera-stage children are removed;
- app-owned scanner visuals are removed;
- scan controls return to their idle labels and status;
- the destination page is the only visible page.

Returning to Scan does not automatically reopen the generic camera. It shows the idle state and requires `Start camera`. Existing exact target scan links retain their automatic marker startup behavior.

## Error Handling

- A camera or compilation failure removes the scanner guide and leaves `Start camera` available for retry.
- An abort caused by navigation, restart, or switching to floor mode is silent and cannot publish a stale error.
- If MindAR partially starts, its stop path remains idempotent and attempts to stop any acquired media tracks.
- The app does not scan `document.body` and delete third-party nodes as routine cleanup.

## Testing

Implementation follows test-driven development.

### Runtime tests

- MindAR is constructed with all built-in UI overlays disabled.
- Stopping an active session remains idempotent.
- Aborting during compilation, scene setup, or camera startup cleans up without publishing a session.

### Integration tests

- Starting Scan creates exactly one guide inside `#ar-stage`.
- The guide is never attached to `document.body` outside the stage.
- Finding a target hides the guide.
- Losing the last visible target shows it again.
- Restarting the camera does not duplicate the guide.
- Navigating Home while starting or active removes the guide, clears the stage, and stops the session.
- A late-resolving session after navigation is stopped and cannot restore scanner visuals.
- Switching from marker scanning to floor placement removes the marker guide.
- Returning from floor placement creates one fresh marker guide for the restarted marker session.

### Verification

Completion requires:

- focused scanner lifecycle tests;
- the full Vitest suite;
- a production build;
- browser verification at a mobile viewport that the guide is confined to the camera card;
- navigation verification that Home, Targets, and Account never display scanner UI after leaving Scan.

## Out of Scope

- Changing marker compilation, recognition thresholds, or target matching.
- Changing exact scan-link authentication behavior.
- Changing floor-placement WebXR behavior.
- Editing vendored MindAR bundles.
- Redesigning unrelated Scan page controls.

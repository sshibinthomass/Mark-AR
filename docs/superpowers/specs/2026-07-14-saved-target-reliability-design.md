# Saved Target Reliability Design

## Goal

Make saved-target editing fail safe as well as lossless. Text, per-object animation, transforms, and groups must survive a save/reopen round trip, and a server or refresh mismatch must never erase the editor's local authoring state.

## Confirmed Root Causes

1. The production Cloudflare Worker was last deployed on 2026-07-08. The complete mixed model/text object contract and custom animation tracks were added on 2026-07-14, so production still filters text objects and reduces animation to the legacy spin/bob fields.
2. A normal object click in both the object list and the 3D preview keeps an existing multi-selection when the clicked object is already selected. Animation edits and resets therefore continue to target every selected object even though the UI interaction looks like a single-object selection.
3. Mark-AR trusts the target returned by the Worker and immediately rehydrates it. A lossy response can replace the complete local draft with a reduced server record.
4. `refreshImageTargets` clears the last good saved-target list on a transient error. When this happens after a successful PATCH/POST, the UI reports the entire save as failed.

## Selected Remediation

### Selection semantics

A click without Ctrl or Command always replaces the selection with the clicked object, whether the click occurs in the list or directly in the 3D preview. Ctrl or Command remains the only additive/toggle gesture. Animation preset changes, custom-track changes, and reset then continue using the explicit current selection.

### Persistence acknowledgement

Before rehydrating a successful create/update response, Mark-AR compares canonical authoring state for every submitted object and used group with the returned target. Canonical state includes:

- object ID and kind;
- model metadata or normalized text content and complete styles;
- world and local placement;
- per-object animation preset and tracks;
- group membership;
- group label, placement, and animation.

Order is not significant, but missing, added, changed, or duplicate IDs are mismatches. Optional missing animation fields normalize to the existing `none` default. A mismatch reports that the server did not preserve the target and keeps the local editor state intact.

### Refresh behavior

A failed list refresh keeps the last successful list and active editor. A successful refresh is staged until it returns the saved target and that record passes the same complete-state comparison; missing or lossy refreshed records never replace the last good card cache. If create/update returned a complete target but the following list refresh fails, the editor loads the confirmed save response and reports: the target was saved, but the list could not refresh. It must not report that the save itself failed.

### Worker release boundary

The Worker code already contains the required typed persistence and passing in-memory R2 tests. It must be verified and deployed from a clean checkout at committed `Web-AR` HEAD so the unrelated local CORS edits are not included. Existing records that were already saved through the old Worker cannot regain data the old Worker discarded; users must resave those targets from any still-open complete editor draft or recreate the missing fields.

## Test Coverage

- Normal list and 3D-preview clicks collapse multi-selection and a subsequent animation change affects only the clicked object.
- Canonical persistence comparison accepts normalized complete round trips.
- It rejects missing text, changed per-object animation, changed text styling, missing groups, and changed local placement.
- A lossy update response does not replace the current editor objects.
- A manual refresh failure preserves the last good list and current editor.
- A successful save followed by refresh failure is distinguished from a failed save.
- A successful refresh that omits the saved target or returns lossy state cannot replace the last good saved card.
- Existing Mark-AR and Worker suites, normal builds, and GitHub Pages builds remain green.
- A signed-in browser flow creates/updates, reloads, and reopens a mixed target after the Worker release.

## Out of Scope

- Recovering text or tracks already discarded by the old production Worker.
- Nested groups, cross-target object templates, or multi-user conflict resolution.
- Changing the animation preset catalogue or embedded GLTF clip playback.

# Animation Presets and Custom Tracks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add editable animation presets and manual transform tracks that play identically in target preview and AR while preserving saved spin/bob records.

**Architecture:** Treat every preset as immutable track data and evaluate tracks with a pure shared function. Keep the dynamic editor in a focused UI module, leave `main.ts` as the state/event bridge, and apply evaluated offsets relative to each object's saved placement in both renderers.

**Tech Stack:** TypeScript 6, Three.js r150, Vite 8, Vitest 4, happy-dom.

## Global Constraints

- Existing cloud records with `spin_axis`, `spin_speed`, `bob_height`, and `bob_speed` must keep their visible motion.
- New animation tracks must use Position X/Y/Z, Rotation X/Y/Z, or Overall scale.
- Smooth, Triangle, and Spin are the only motion types; Spin is valid only for rotation.
- Preset edits become Custom, and Reset animation produces None with no tracks.
- Preview and AR must evaluate the same animation configuration relative to saved placement, without transform drift.
- No new runtime dependency.
- Keep `.codex-remote-attachments/` untracked.

---

### Task 1: Animation model, presets, migration, and evaluator

**Files:**
- Modify: `src/app/imageTargetAnimation.ts`
- Modify: `tests/imageTargetAnimation.test.ts`

**Interfaces:**
- Produces: `ImageTargetAnimationPreset`, `ImageTargetAnimationProperty`, `ImageTargetAnimationMotion`, `ImageTargetAnimationTrack`, `ImageTargetAnimation`, and `ImageTargetAnimationFrame`.
- Produces: `animationForPreset(preset): ImageTargetAnimation`, `normalizeAnimation(value): ImageTargetAnimation`, and `evaluateAnimationFrame(animation, elapsedSeconds): ImageTargetAnimationFrame`.

- [ ] **Step 1: Write failing model and preset tests**

Add assertions for the new default `{ preset: 'none', tracks: [] }`, every named preset, defensive cloning, invalid `spin` on Position, property-specific clamping, normalized phase, and legacy spin/bob conversion using `speed / (2 * Math.PI)`.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm.cmd test -- tests/imageTargetAnimation.test.ts`

Expected: FAIL because the track types and `animationForPreset` do not exist and the default still uses spin/bob fields.

- [ ] **Step 3: Implement the types, preset table, and normalization**

Define the exact unions from the design, freeze internal preset arrays, return cloned tracks, cap tracks at 16, clamp position amount to `[-2, 2]`, rotation amount to `[-720, 720]`, scale amount to `[-0.9, 3]`, speed to `[-4, 4]`, and phase to `[0, 360)`. Accept either the new shape or legacy spin/bob fields.

- [ ] **Step 4: Add failing evaluator tests**

Cover zero offsets, sine quarter-cycle, triangle half-cycle, continuous spin, 90-degree phase, additive same-property tracks, and a scale multiplier no lower than `0.05`.

- [ ] **Step 5: Run the evaluator tests and confirm RED**

Run: `npm.cmd test -- tests/imageTargetAnimation.test.ts`

Expected: FAIL because `evaluateAnimationFrame` is not implemented.

- [ ] **Step 6: Implement the minimal pure evaluator**

Use `Math.sin(2 * Math.PI * speed * seconds + phaseRadians)` for Smooth; a centered `[-1, 1]` triangle wave for Triangle; and `amount * speed * seconds + phase` degrees for Spin. Convert all rotation offsets to radians before returning the frame.

- [ ] **Step 7: Verify GREEN and commit**

Run: `npm.cmd test -- tests/imageTargetAnimation.test.ts`

Expected: PASS.

Commit: `feat: add animation presets and track evaluation`

### Task 2: Preview and AR runtime parity

**Files:**
- Modify: `src/scene/ImageTargetPreview.ts`
- Modify: `src/ar/cloudflareMarkerObject.ts`
- Modify: `tests/imageTargetPreview.test.ts`
- Modify: `tests/cloudflareMarkerObject.test.ts`

**Interfaces:**
- Consumes: `evaluateAnimationFrame(animation, elapsedSeconds)` from Task 1.
- Produces: identical placement-relative position, rotation, and scale behavior in preview and AR.

- [ ] **Step 1: Write failing preview tests**

Create an object with Position X Smooth, Rotation Z Smooth, and Scale Smooth tracks. Advance the bound frame callback to a known timestamp and assert that position starts from `offsetX/height/offsetY`, rotation starts from placement degrees, and scale starts from placement scale before frame offsets are added or multiplied.

- [ ] **Step 2: Confirm preview RED**

Run: `npm.cmd test -- tests/imageTargetPreview.test.ts`

Expected: FAIL because the preview still reads spin/bob fields and mutates rotation incrementally.

- [ ] **Step 3: Apply shared frames in the preview**

For every loaded object, recompute position, rotation, and scale from its normalized placement plus the evaluated frame. Do not increment any existing transform.

- [ ] **Step 4: Write failing AR tests**

Extend the AR fixture with the same three tracks and assert the same offsets after `update(deltaSeconds)`, including placement-relative Z mapping used by MindAR.

- [ ] **Step 5: Confirm AR RED**

Run: `npm.cmd test -- tests/cloudflareMarkerObject.test.ts`

Expected: FAIL because AR still calls the legacy `applyAnimation` spin/bob path.

- [ ] **Step 6: Apply shared frames in AR**

Store the full normalized base placement with each animated root and replace the legacy incremental helper with placement-relative evaluation.

- [ ] **Step 7: Verify both runtimes and commit**

Run: `npm.cmd test -- tests/imageTargetPreview.test.ts tests/cloudflareMarkerObject.test.ts`

Expected: PASS.

Commit: `feat: play animation tracks in preview and AR`

### Task 3: Cloud parsing and backward-compatible serialization

**Files:**
- Modify: `src/app/cloudImageTargets.ts`
- Modify: `tests/cloudImageTargets.test.ts`

**Interfaces:**
- Consumes: new animation types and `normalizeAnimation` from Task 1.
- Produces: snake-case `{ preset, tracks }` request data and parsing for new plus legacy Worker records.

- [ ] **Step 1: Write failing cloud tests**

Add a Worker response containing `preset: 'orbit'` and two `tracks` entries, then assert the parsed client object. Add a save test asserting snake-case track properties. Keep the existing legacy spin/bob response assertions.

- [ ] **Step 2: Confirm cloud RED**

Run: `npm.cmd test -- tests/cloudImageTargets.test.ts`

Expected: FAIL because the wire type and request body know only spin/bob fields.

- [ ] **Step 3: Extend the wire contract**

Add optional `preset` and `tracks` to the Worker animation type; map snake-case wire fields to the client track type; serialize normalized tracks; and include compatible legacy aliases for Rotation Spin and Position Y Smooth tracks.

- [ ] **Step 4: Verify cloud GREEN and commit**

Run: `npm.cmd test -- tests/cloudImageTargets.test.ts`

Expected: PASS, including unchanged legacy cases.

Commit: `feat: persist custom animation tracks`

### Task 4: Preset and custom-track editor

**Files:**
- Create: `src/ui/animationTrackEditor.ts`
- Create: `tests/animationTrackEditor.test.ts`
- Modify: `src/ui/appShell.ts`
- Modify: `tests/appShell.test.ts`
- Modify: `src/style.css`

**Interfaces:**
- Consumes: `ImageTargetAnimation` and track types from Task 1.
- Produces: `createAnimationTrackEditor(container, options)` returning `{ render(animation), destroy() }`; `options.onChange(animation)` fires for edits, additions, and removals.

- [ ] **Step 1: Write failing shell and editor tests**

Assert the preset selector, track host, Add motion, and Reset animation controls exist in the Animation details. In the editor test, render Orbit, assert two track cards and accessible labels, edit an amount, verify `onChange` receives `preset: 'custom'`, add the default Position Y track, remove a track, and verify Spin is unavailable for position.

- [ ] **Step 2: Confirm UI RED**

Run: `npm.cmd test -- tests/appShell.test.ts tests/animationTrackEditor.test.ts`

Expected: FAIL because the shell still exposes spin/bob controls and the editor module does not exist.

- [ ] **Step 3: Implement the static shell and DOM editor**

Use DOM construction and event delegation. Render native `<select>` and `<input type="range">` controls with visible `<output>` values. Update amount bounds and units when the selected property changes. Disable or remove Spin when the property is not rotation. Emit cloned normalized state on every user change.

- [ ] **Step 4: Style the focused manual editor**

Add compact track cards using the existing teal/ink visual language, two-column control grids at desktop widths, one column on narrow panels, a clear Remove action, `:focus-visible` states, and `prefers-reduced-motion` compatibility. Do not change global typography or unrelated inspector layout.

- [ ] **Step 5: Verify UI GREEN and commit**

Run: `npm.cmd test -- tests/appShell.test.ts tests/animationTrackEditor.test.ts`

Expected: PASS with no console errors.

Commit: `feat: add preset and custom animation editor`

### Task 5: Main editor state integration

**Files:**
- Modify: `src/main.ts`
- Modify: `tests/newTargetAnimationDefaults.test.ts`
- Create: `tests/targetAnimationEditorIntegration.test.ts`

**Interfaces:**
- Consumes: `animationForPreset` and `createAnimationTrackEditor`.
- Produces: per-selected-object preset selection, Custom edits, reset behavior, and preview refresh.

- [ ] **Step 1: Write failing integration tests**

Mount the app, select Showcase, assert the selected object's animation receives its configured tracks, edit a track and assert the preset becomes Custom, switch selected objects and assert independent animation state, reset and assert None, and add a new object to assert the default remains None.

- [ ] **Step 2: Confirm integration RED**

Run: `npm.cmd test -- tests/targetAnimationEditorIntegration.test.ts tests/newTargetAnimationDefaults.test.ts`

Expected: FAIL because `main.ts` still queries and synchronizes the legacy fields.

- [ ] **Step 3: Replace legacy input wiring**

Instantiate one track editor for the shell host. On preset change, call `animationForPreset`, store it on the selected object, render it, and refresh the preview. On editor change, store Custom state and refresh. On selection changes, call `render(selected.animation)`. Reset with `animationForPreset('none')`. Remove all obsolete spin/bob DOM queries and listeners.

- [ ] **Step 4: Verify integration GREEN and commit**

Run: `npm.cmd test -- tests/targetAnimationEditorIntegration.test.ts tests/newTargetAnimationDefaults.test.ts`

Expected: PASS.

Commit: `feat: wire animation presets into target editor`

### Task 6: Regression, build, and browser verification

**Files:**
- Modify only if verification exposes a defect in the files already listed.

**Interfaces:**
- Produces: evidence that the feature works across tests, both build modes, and the real `#/targets` UI.

- [ ] **Step 1: Run the full test suite**

Run: `npm.cmd test`

Expected: all suites and tests pass.

- [ ] **Step 2: Run both production builds**

Run: `npm.cmd run build`

Expected: TypeScript and Vite succeed.

Run: `$env:GITHUB_PAGES='true'; npm.cmd run build`

Expected: TypeScript and Vite succeed with `/Mark-AR/` asset paths.

- [ ] **Step 3: Start and probe the real app**

Run: `npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort`

Probe: `Invoke-WebRequest http://127.0.0.1:5173/`

Expected: HTTP 200 and title `Mark AR`.

- [ ] **Step 4: Browser smoke `#/targets`**

Open `http://127.0.0.1:5173/#/targets`. Verify Gentle float, Turntable, Orbit, Pulse, and Custom produce visibly different preview motion; editing a track changes the selector to Custom; Reset stops motion; switching objects preserves independent state; the panel remains usable at desktop and mobile widths; and no browser console errors appear.

- [ ] **Step 5: Inspect the final diff**

Run: `git status --short` and `git diff --check`.

Expected: only scoped source, test, style, and documentation files are changed; no whitespace errors; `.codex-remote-attachments/` remains untracked.

# Local Text Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local-only 3D text objects to the Mark-AR target editor and current AR session without storing text in Cloudflare.

**Architecture:** Introduce a mixed target-editor object type that wraps existing Cloudflare model objects and new local text objects. Reuse the existing preview, object list, placement controls, animation controls, and runtime target pipeline while filtering text out at save time.

**Tech Stack:** TypeScript, Vite, Vitest, Three.js, MindAR image tracking.

## Global Constraints

- Text objects are local-only in this implementation.
- Cloudflare create/update payloads must contain only GLB model objects.
- Text must render as a Three.js 3D scene object for every font option.
- Language options are English, German, and Tamil.
- Existing saved image target behavior remains model-only.

---

## File Structure

- Create `src/app/targetEditorObjects.ts`: mixed model/text object types, text presets, font options, normalization, and save filtering.
- Test `tests/targetEditorObjects.test.ts`: text defaults, language/font options, and model-only save filtering.
- Modify `src/ui/appShell.ts`: add text controls in the existing target setup card.
- Modify `tests/appShell.test.ts`: assert text controls exist.
- Modify `src/scene/ImageTargetPreview.ts`: render local text objects and keep transform controls working against both model and text groups.
- Modify `tests/imageTargetPreview.test.ts`: verify preview builds a text group for a local text object.
- Modify `src/ar/cloudflareMarkerObject.ts`: render local text objects in AR and keep GLB loading untouched.
- Modify `tests/cloudflareMarkerObject.test.ts`: verify text creates a runtime group without model loading.
- Modify `src/ar/markerTargets.ts`: accept an optional local draft image target.
- Modify `tests/markerTargets.test.ts`: verify draft target mapping includes text objects.
- Modify `src/main.ts`: wire text controls, local object selection, save filtering, and draft target AR startup.
- Modify `src/style.css`: style the text panel within the current target card.

## Tasks

### Task 1: Local Object Helpers

- [ ] Write `tests/targetEditorObjects.test.ts` covering `TEXT_LANGUAGE_OPTIONS`, `TEXT_FONT_OPTIONS`, `normalizeTargetText`, `createLocalTextObject`, `isModelTargetObject`, and `saveableModelObjects`.
- [ ] Run `npm test -- tests/targetEditorObjects.test.ts` and confirm it fails because the module is missing.
- [ ] Create `src/app/targetEditorObjects.ts` with the mixed object types and helpers.
- [ ] Run `npm test -- tests/targetEditorObjects.test.ts` and confirm it passes.

### Task 2: UI Controls

- [ ] Update `tests/appShell.test.ts` to expect `#target-text-value`, `#target-text-language`, `#target-text-font`, and `#add-target-text`.
- [ ] Run `npm test -- tests/appShell.test.ts` and confirm it fails.
- [ ] Add the controls to `src/ui/appShell.ts` and matching compact styles to `src/style.css`.
- [ ] Run `npm test -- tests/appShell.test.ts` and confirm it passes.

### Task 3: Preview And Runtime Text Rendering

- [ ] Add preview and runtime tests for text object rendering.
- [ ] Run the focused tests and confirm they fail.
- [ ] Add a reusable Three.js text sign factory and call it from preview/runtime code.
- [ ] Run the focused tests and confirm they pass.

### Task 4: Main Wiring And Draft AR Target

- [ ] Update `tests/markerTargets.test.ts` to cover a draft target with text.
- [ ] Run the focused test and confirm it fails.
- [ ] Wire `src/main.ts` to add/select/remove local text, filter save payloads, and include the draft target at AR startup.
- [ ] Run focused tests and then full `npm test` and `npm run build`.

## Self-Review Checklist

- Spec coverage: local-only storage, 3D rendering, font/language controls, placement controls, and current-session AR target mapping are covered.
- Placeholder scan: no unresolved implementation placeholders remain.
- Type consistency: text objects use `kind: 'text'`; GLB objects use `kind: 'model'`; save filtering returns `CloudImageTargetObject[]`.

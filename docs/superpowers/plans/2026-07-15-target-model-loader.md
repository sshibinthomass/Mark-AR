# Target Model Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a loader from model-card click until the latest 3D preview update completes.

**Architecture:** Extend the model rail with a declarative busy model id, and coordinate it from `main.ts` around the existing asynchronous preview update. A monotonically increasing request token prevents stale downloads from clearing newer loading feedback.

**Tech Stack:** TypeScript, DOM APIs, Three.js, CSS, Vitest/happy-dom

## Global Constraints

- Preserve the existing target editor layout and visual language.
- The loader must be accessible through `aria-busy` and live status text.
- Only the latest model selection may clear the loader.
- Add no runtime dependency.

---

### Task 1: Model-card busy presentation

**Files:**
- Modify: `src/ui/modelRail.ts`
- Modify: `src/style.css`
- Test: `tests/modelRail.test.ts`

**Interfaces:**
- Consumes: `CloudflareModelOption.id` and `CloudflareModelOption.label`
- Produces: `loadingModelId?: string` input and `.target-model-card-loader` markup

- [ ] Write a Vitest assertion that the loading model card has `aria-busy="true"`, is disabled, and includes `Loading Chair…` status text.
- [ ] Run `npm.cmd test -- tests/modelRail.test.ts` and confirm the new assertion fails because busy markup is absent.
- [ ] Add `loadingModelId?: string`, render the busy attributes/status markup, and add a restrained spinner treatment in `src/style.css`.
- [ ] Run `npm.cmd test -- tests/modelRail.test.ts` and confirm it passes.

### Task 2: Preview loading lifecycle

**Files:**
- Modify: `src/main.ts`
- Test: `tests/targetModelRailInteraction.test.ts`

**Interfaces:**
- Consumes: `renderTargetModelRail(..., { loadingModelId })` and `updateTargetPreview(): Promise<void>`
- Produces: latest-request loading coordination for model selections

- [ ] Add an integration assertion that clicking a model renders its busy loader until the preview promise settles.
- [ ] Run `npm.cmd test -- tests/targetModelRailInteraction.test.ts` and confirm it fails for the missing loading state.
- [ ] Track the active model and request token in `src/main.ts`, re-render the rail at start/end, and clear only from the latest request.
- [ ] Run both focused tests, then `npm.cmd test` and `npm.cmd run build`.
- [ ] Open `#/targets`, click an uncached model, and verify the overlay appears and clears when the model renders.

# 3D Text Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add more local 3D text fonts and PowerPoint-like text fill/material controls for solid and gradient text.

**Architecture:** Extend the local-only `TargetTextContent` model with style fields, keep Cloudflare save filtering unchanged, render controls in the existing Targets text panel, and apply style choices inside `src/scene/textObject3d.ts` when creating `TextGeometry` materials. Use built-in Three typeface JSON fonts plus the existing Noto Sans Tamil TTF asset.

**Tech Stack:** TypeScript, Vite, Three.js `TextGeometry`, Vitest, GitHub Pages workflow.

## Global Constraints

- Text objects remain local-only and must continue to be filtered out of Cloudflare saved model objects.
- The first useful screen stays the existing Targets editor; do not add a landing page.
- Controls must remain compact on mobile and not block the 3D preview.
- Tests must be written before production code changes and verified red/green.

---

### Task 1: Text Style Data And Controls

**Files:**
- Modify: `src/app/targetEditorObjects.ts`
- Modify: `src/ui/appShell.ts`
- Modify: `src/main.ts`
- Modify: `src/ui/targetObjectList.ts`
- Test: `tests/targetEditorObjects.test.ts`
- Test: `tests/appShell.test.ts`
- Test: `tests/targetObjectList.test.ts`

**Interfaces:**
- Produces: `TargetTextFillMode = 'solid' | 'gradient'`
- Produces: `TargetTextGradientDirection = 'horizontal' | 'vertical' | 'diagonal' | 'depth'`
- Extends: `TargetTextContent` with `fillMode`, `gradientStart`, `gradientEnd`, `gradientDirection`, `sideColor`, `depth`, `bevel`, `gloss`, `stylePreset`

- [ ] **Step 1: Write failing tests**

Update tests to expect expanded font IDs, new color/style controls in the shell, normalized style defaults, and style metadata in text rows.

- [ ] **Step 2: Run failing tests**

Run: `npm test -- tests/targetEditorObjects.test.ts tests/appShell.test.ts tests/targetObjectList.test.ts`

Expected: FAIL because controls and fields do not exist.

- [ ] **Step 3: Implement data and controls**

Add validated text style fields, render compact controls for fill mode, gradient colors/direction, side color, depth, bevel, gloss, and presets, and read those controls when creating local text objects.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/targetEditorObjects.test.ts tests/appShell.test.ts tests/targetObjectList.test.ts`

Expected: PASS.

### Task 2: 3D Text Renderer Styling

**Files:**
- Modify: `src/scene/textObject3d.ts`
- Test: `tests/textObject3d.test.ts`

**Interfaces:**
- Consumes: normalized `TargetTextContent` style fields from Task 1.
- Produces: real `TextGeometry` meshes with solid or vertex-colored gradient front material, styled side material, depth, bevel, and gloss.

- [ ] **Step 1: Write failing renderer tests**

Extend `tests/textObject3d.test.ts` to assert extra font options still produce `TextGeometry`, gradient mode enables vertex colors, side material uses `sideColor`, and depth/bevel/gloss change geometry/material parameters.

- [ ] **Step 2: Run failing renderer test**

Run: `npm test -- tests/textObject3d.test.ts`

Expected: FAIL because renderer only accepts one solid color and fixed geometry options.

- [ ] **Step 3: Implement renderer styling**

Map new font IDs to bundled Three JSON fonts, apply geometry depth/bevel from text style, compute gradient vertex colors by bounding box axis, and tune material roughness from gloss.

- [ ] **Step 4: Run renderer tests**

Run: `npm test -- tests/textObject3d.test.ts`

Expected: PASS.

### Task 3: Verification And Publish

**Files:**
- No new production files beyond Tasks 1 and 2.

**Interfaces:**
- Consumes: completed UI/model/renderer changes.
- Produces: pushed `main` commit that triggers GitHub Pages.

- [ ] **Step 1: Full verification**

Run: `npm test`

Expected: all Vitest files pass.

Run: `$env:GITHUB_PAGES='true'; npm run build`

Expected: TypeScript and Vite build complete with only existing bundle warnings.

- [ ] **Step 2: Browser verification**

Use Playwright CLI against `http://127.0.0.1:5182/#/targets` to add gradient text, verify row style metadata/delete button, and capture a preview screenshot showing styled 3D text.

- [ ] **Step 3: Commit and push**

Run:

```powershell
git add docs/superpowers/plans/2026-07-07-3d-text-styles.md src tests
git commit -m "Add PowerPoint-style text options"
git push origin main
```

- [ ] **Step 4: Watch Pages deploy**

Run: `gh run watch <run-id> --exit-status`

Expected: GitHub Pages deploy finishes with conclusion `success`.

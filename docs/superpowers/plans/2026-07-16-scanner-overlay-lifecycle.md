# Scanner Overlay Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the marker scanner guide inside the Scan camera stage and fully remove it, together with the active camera session, whenever Scan is stopped or exited.

**Architecture:** Disable MindAR's document-level loading, scanning, and error overlays at construction time. Add a small application-owned scanner-stage module that creates the in-stage guide, toggles it from marker visibility, and restores the idle placeholder. Integrate that module with the existing abort/version-based route lifecycle in `src/main.ts`.

**Tech Stack:** TypeScript 6, Vite 8, Vitest 4, happy-dom, Three.js 0.150, vendored MindAR runtime.

## Global Constraints

- Do not edit files under `src/vendor/mind-ar`.
- Do not change marker compilation, recognition thresholds, target matching, route names, scan-link authentication, or floor-placement behavior.
- The guide must be a descendant of `#ar-stage`, must be `aria-hidden="true"`, and must never be appended directly to `document.body`.
- Leaving Scan, switching to floor placement, restarting, failing, or aborting must not leave or duplicate scanner UI.
- Existing request-version and `AbortController` checks remain authoritative for stale asynchronous work.
- Every production behavior change must be preceded by a focused failing test.

---

### Task 1: Disable MindAR's global overlays

**Files:**
- Modify: `src/ar/mindarRuntime.ts`
- Test: `tests/mindarRuntime.test.ts`

**Interfaces:**
- Consumes: the existing `MindARThreeConstructor` and `startMarkerAR(container, hooks)` API.
- Produces: a `MindARThree` construction call with `uiLoading`, `uiScanning`, and `uiError` set to `"no"`; no public runtime API changes.

- [ ] **Step 1: Extend the fake runtime to capture constructor options**

In `tests/mindarRuntime.test.ts`, add `constructorOptions` to `runtimeMocks`, capture the options in `FakeMindARThree`, and clear them in `beforeEach`:

```ts
const runtimeMocks = vi.hoisted(() => ({
  cloudflareFactory: vi.fn(),
  compileMarkerTargets: vi.fn(),
  constructorOptions: [] as Array<Record<string, unknown>>,
  instances: [] as unknown[],
  markerDispose: vi.fn(),
  markerUpdate: vi.fn(),
  mindarStart: vi.fn(),
  mindarStop: vi.fn(),
  render: vi.fn(),
}));

constructor(options: Record<string, unknown>) {
  runtimeMocks.constructorOptions.push(options);
  runtimeMocks.instances.push(this);
}

beforeEach(() => {
  runtimeMocks.cloudflareFactory.mockReset();
  runtimeMocks.compileMarkerTargets.mockReset();
  runtimeMocks.markerDispose.mockReset();
  runtimeMocks.markerUpdate.mockReset();
  runtimeMocks.mindarStart.mockReset().mockResolvedValue(undefined);
  runtimeMocks.mindarStop.mockReset();
  runtimeMocks.render.mockReset();
  runtimeMocks.constructorOptions.length = 0;
  runtimeMocks.instances.length = 0;
});
```

- [ ] **Step 2: Write the failing built-in-UI test**

Add this test to the `startMarkerAR` describe block:

```ts
it('disables MindAR body-level loading, scanning, and error overlays', async () => {
  const container = document.createElement('div');
  runtimeMocks.compileMarkerTargets.mockResolvedValue(createCompiledTargets());

  const session = await startMarkerAR(container, {
    targets: [createCloudflareRuntimeTarget()],
  });

  expect(runtimeMocks.constructorOptions).toHaveLength(1);
  expect(runtimeMocks.constructorOptions[0]).toMatchObject({
    container,
    imageTargetSrc: 'blob:compiled-targets',
    uiLoading: 'no',
    uiScanning: 'no',
    uiError: 'no',
  });

  session.stop();
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
npx vitest run tests/mindarRuntime.test.ts
```

Expected: FAIL because the constructor options do not contain `uiLoading`, `uiScanning`, or `uiError`.

- [ ] **Step 4: Add supported UI options to the runtime constructor type**

Update `MindARThreeConstructor` in `src/ar/mindarRuntime.ts`:

```ts
export type MindARThreeConstructor = new (options: {
  container: HTMLElement;
  imageTargetSrc: string;
  filterMinCF?: number;
  filterBeta?: number;
  uiLoading?: 'yes' | 'no' | string;
  uiScanning?: 'yes' | 'no' | string;
  uiError?: 'yes' | 'no' | string;
}) => MindARThreeInstance;
```

- [ ] **Step 5: Disable the three built-in overlays**

Add the options to the `new MindARThree` call:

```ts
const instance = new MindARThree({
  container,
  imageTargetSrc: compiled.imageTargetSrc,
  filterMinCF: 0.001,
  filterBeta: 0.01,
  uiLoading: 'no',
  uiScanning: 'no',
  uiError: 'no',
});
```

- [ ] **Step 6: Run the focused runtime tests and verify GREEN**

Run:

```bash
npx vitest run tests/mindarRuntime.test.ts
```

Expected: all tests in `tests/mindarRuntime.test.ts` PASS.

- [ ] **Step 7: Commit the runtime boundary change**

```bash
git add src/ar/mindarRuntime.ts tests/mindarRuntime.test.ts
git commit -m "fix: disable global MindAR overlays"
```

---

### Task 2: Add an application-owned scanner stage

**Files:**
- Create: `src/ui/scannerStage.ts`
- Create: `tests/scannerStage.test.ts`
- Modify: `src/ar/cameraLayers.ts`
- Modify: `tests/cameraLayers.test.ts`
- Modify: `src/style.css`

**Interfaces:**
- Produces:
  - `prepareScannerStage(stage: HTMLElement): HTMLElement`
  - `setScannerGuideVisible(stage: HTMLElement, visible: boolean): void`
  - `resetScannerStage(stage: HTMLElement): void`
- The guide uses `[data-scanner-guide]`, `.scanner-guide`, `.scanner-guide-frame`, and `.scanner-guide-line`.

- [ ] **Step 1: Write failing scanner-stage structure tests**

Create `tests/scannerStage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  prepareScannerStage,
  resetScannerStage,
  setScannerGuideVisible,
} from '../src/ui/scannerStage';

describe('scanner stage', () => {
  it('creates one decorative scanner guide inside the camera stage', () => {
    const stage = document.createElement('div');
    stage.innerHTML = '<div class="stage-idle"><span>Scan target</span></div>';

    const guide = prepareScannerStage(stage);
    prepareScannerStage(stage);

    expect(stage.querySelectorAll('[data-scanner-guide]')).toHaveLength(1);
    expect(stage.firstElementChild).toBe(stage.querySelector('[data-scanner-guide]'));
    expect(guide.getAttribute('aria-hidden')).toBe('true');
    expect(guide.querySelector('.scanner-guide-frame')).toBeTruthy();
    expect(guide.querySelector('.scanner-guide-line')).toBeTruthy();
  });

  it('hides the guide while a target is visible and shows it while scanning', () => {
    const stage = document.createElement('div');
    prepareScannerStage(stage);

    setScannerGuideVisible(stage, false);
    expect(stage.querySelector<HTMLElement>('[data-scanner-guide]')?.hidden).toBe(true);

    setScannerGuideVisible(stage, true);
    expect(stage.querySelector<HTMLElement>('[data-scanner-guide]')?.hidden).toBe(false);
  });

  it('restores the idle placeholder and removes active scanner content', () => {
    const stage = document.createElement('div');
    prepareScannerStage(stage);
    stage.append(document.createElement('video'), document.createElement('canvas'));

    resetScannerStage(stage);

    expect(stage.querySelector('[data-scanner-guide]')).toBeNull();
    expect(stage.querySelector('video')).toBeNull();
    expect(stage.querySelector('canvas')).toBeNull();
    expect(stage.querySelector('.stage-idle')?.textContent).toBe('Scan target');
  });
});
```

- [ ] **Step 2: Run the scanner-stage test and verify RED**

Run:

```bash
npx vitest run tests/scannerStage.test.ts
```

Expected: FAIL because `src/ui/scannerStage.ts` does not exist.

- [ ] **Step 3: Implement the scanner-stage helpers**

Create `src/ui/scannerStage.ts`:

```ts
const scannerGuideSelector = '[data-scanner-guide]';

export function prepareScannerStage(stage: HTMLElement): HTMLElement {
  const guide = document.createElement('div');
  guide.className = 'scanner-guide';
  guide.dataset.scannerGuide = '';
  guide.setAttribute('aria-hidden', 'true');

  const frame = document.createElement('span');
  frame.className = 'scanner-guide-frame';

  const line = document.createElement('span');
  line.className = 'scanner-guide-line';

  frame.append(line);
  guide.append(frame);
  stage.replaceChildren(guide);
  return guide;
}

export function setScannerGuideVisible(stage: HTMLElement, visible: boolean): void {
  const guide = stage.querySelector<HTMLElement>(scannerGuideSelector);
  if (guide) {
    guide.hidden = !visible;
  }
}

export function resetScannerStage(stage: HTMLElement): void {
  const idle = document.createElement('div');
  idle.className = 'stage-idle';

  const label = document.createElement('span');
  label.textContent = 'Scan target';

  idle.append(label);
  stage.replaceChildren(idle);
}
```

- [ ] **Step 4: Run scanner-stage tests and verify GREEN**

Run:

```bash
npx vitest run tests/scannerStage.test.ts
```

Expected: all scanner-stage tests PASS.

- [ ] **Step 5: Write the failing camera-layer ordering assertion**

Extend `tests/cameraLayers.test.ts`:

```ts
const scannerGuide = document.createElement('div');
scannerGuide.dataset.scannerGuide = '';

stage.append(webglCanvas, cssRenderer, scannerGuide, video);

normalizeMindARCameraLayers(stage);

expect(cssRenderer.style.zIndex).toBe('2');
expect(scannerGuide.style.zIndex).toBe('3');
```

- [ ] **Step 6: Run the camera-layer test and verify RED**

Run:

```bash
npx vitest run tests/cameraLayers.test.ts
```

Expected: FAIL because the scanner guide currently receives z-index `2`.

- [ ] **Step 7: Keep the scanner guide above camera renderer layers**

Update the renderer-layer loop in `src/ar/cameraLayers.ts`:

```ts
for (const layer of rendererLayers) {
  layer.style.zIndex = layer.hasAttribute('data-scanner-guide') ? '3' : '2';
  layer.style.pointerEvents = 'none';
}
```

- [ ] **Step 8: Add scanner guide styles**

Add the following near the existing `.stage-idle` scanner styles in `src/style.css`:

```css
.scanner-guide {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.scanner-guide[hidden] {
  display: none;
}

.scanner-guide-frame {
  position: absolute;
  inset: 9% 7%;
  overflow: hidden;
  opacity: 0.88;
  background:
    linear-gradient(#ffffff 0 0) left top / 38px 4px no-repeat,
    linear-gradient(#ffffff 0 0) left top / 4px 38px no-repeat,
    linear-gradient(#ffffff 0 0) right top / 38px 4px no-repeat,
    linear-gradient(#ffffff 0 0) right top / 4px 38px no-repeat,
    linear-gradient(#ffffff 0 0) left bottom / 38px 4px no-repeat,
    linear-gradient(#ffffff 0 0) left bottom / 4px 38px no-repeat,
    linear-gradient(#ffffff 0 0) right bottom / 38px 4px no-repeat,
    linear-gradient(#ffffff 0 0) right bottom / 4px 38px no-repeat;
  filter: drop-shadow(0 2px 8px rgba(2, 7, 11, 0.28));
}

.scanner-guide-line {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 4px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 12px rgba(94, 234, 212, 0.72);
  animation: scanner-guide-sweep 2s ease-in-out infinite;
}

@keyframes scanner-guide-sweep {
  0%,
  100% {
    top: 0;
  }

  50% {
    top: calc(100% - 4px);
  }
}
```

Inside the existing `@media (prefers-reduced-motion: reduce)` block, add:

```css
.scanner-guide-line {
  top: 50%;
  animation: none;
}
```

- [ ] **Step 9: Run focused stage and layer tests**

Run:

```bash
npx vitest run tests/scannerStage.test.ts tests/cameraLayers.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 10: Commit the app-owned stage component**

```bash
git add src/ui/scannerStage.ts src/ar/cameraLayers.ts src/style.css tests/scannerStage.test.ts tests/cameraLayers.test.ts
git commit -m "feat: add in-stage scanner guide"
```

---

### Task 3: Integrate scanner UI with marker and route lifecycle

**Files:**
- Modify: `src/main.ts`
- Modify: `tests/targetSpecificScanIntegration.test.ts`

**Interfaces:**
- Consumes the Task 2 functions:
  - `prepareScannerStage(stage)`
  - `setScannerGuideVisible(stage, visible)`
  - `resetScannerStage(stage)`
- Retains the existing `startCurrentArSession()`, `stopActiveArSession()`, route version, and abort-controller interfaces.

- [ ] **Step 1: Write failing integration assertions for stage ownership and visibility**

Add a generic Scan test:

```ts
it('owns one scanner guide inside the camera stage and toggles it from aggregate marker visibility', async () => {
  window.history.replaceState(null, '', '#/scan');

  await import('../src/main');
  required<HTMLButtonElement>('#start-ar').click();
  await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 1);

  const stage = required('#ar-stage');
  const guide = required<HTMLElement>('#ar-stage [data-scanner-guide]');
  const options = markerArMocks.startMarkerAR.mock.calls[0][1] as {
    targets: Array<{ marker: { id: string; label: string; targetIndex: number } }>;
    onMarkerVisibility(event: {
      marker: { id: string; label: string; targetIndex: number };
      visible: boolean;
    }): void;
  };

  expect(stage.querySelectorAll('[data-scanner-guide]')).toHaveLength(1);
  expect(guide.parentElement).toBe(stage);
  expect([...document.body.children]).not.toContain(guide);
  expect(guide.hidden).toBe(false);

  options.onMarkerVisibility({ marker: options.targets[0].marker, visible: true });
  options.onMarkerVisibility({ marker: options.targets[1].marker, visible: false });
  expect(guide.hidden).toBe(true);

  options.onMarkerVisibility({ marker: options.targets[0].marker, visible: false });
  expect(guide.hidden).toBe(false);
});
```

- [ ] **Step 2: Add failing cleanup and restart assertions**

Extend the existing generic departure test after navigation:

```ts
const stage = required('#ar-stage');
expect(stage.querySelector('[data-scanner-guide]')).toBeNull();
expect(stage.querySelector('.stage-idle')?.textContent).toBe('Scan target');
expect(document.querySelectorAll('[data-scanner-guide]')).toHaveLength(0);
```

Add a restart test:

```ts
it('does not duplicate the scanner guide when the camera restarts', async () => {
  window.history.replaceState(null, '', '#/scan');

  await import('../src/main');
  const start = required<HTMLButtonElement>('#start-ar');
  start.click();
  await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 1);

  start.click();
  await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 2);

  expect(required('#ar-stage').querySelectorAll('[data-scanner-guide]')).toHaveLength(1);
  expect(markerArMocks.sessionStop).toHaveBeenCalledTimes(1);
});
```

Add a pending-departure test:

```ts
it('removes the guide while startup is pending and stops the late session', async () => {
  const markerStart = deferred<{ stop(): void }>();
  const lateStop = vi.fn();
  markerArMocks.startMarkerAR.mockReturnValueOnce(markerStart.promise);
  window.history.replaceState(null, '', '#/scan');

  await import('../src/main');
  required<HTMLButtonElement>('#start-ar').click();
  await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 1);

  window.location.hash = '#/';
  await waitFor(() => required('[data-app-shell]').getAttribute('data-active-page') === 'home');

  expect(required('#ar-stage').querySelector('[data-scanner-guide]')).toBeNull();
  expect(required('#ar-stage').querySelector('.stage-idle')).toBeTruthy();

  markerStart.resolve({ stop: lateStop });
  await waitFor(() => lateStop.mock.calls.length === 1);
  expect(required('#ar-stage').querySelector('[data-scanner-guide]')).toBeNull();
});
```

Extend the existing `leaves a manual Start camera retry when automatic startup is blocked` test:

```ts
expect(required('#ar-stage').querySelector('[data-scanner-guide]')).toBeNull();
expect(required('#ar-stage').querySelector('.stage-idle')?.textContent).toBe('Scan target');
```

- [ ] **Step 3: Add failing floor-transition assertions**

In the existing `Place on floor` test, add:

```ts
expect(required('#ar-stage').querySelector('[data-scanner-guide]')).toBeNull();
expect(required('#ar-stage').querySelector('.stage-idle')).toBeTruthy();
```

In the existing `Back to image scan` test, after the second marker start, add:

```ts
expect(required('#ar-stage').querySelectorAll('[data-scanner-guide]')).toHaveLength(1);
```

- [ ] **Step 4: Run integration tests and verify RED**

Run:

```bash
npx vitest run tests/targetSpecificScanIntegration.test.ts
```

Expected: FAIL because `src/main.ts` clears the stage but does not create or toggle an app-owned guide or restore the idle placeholder.

- [ ] **Step 5: Import the scanner-stage lifecycle helpers**

Add this import to `src/main.ts`:

```ts
import {
  prepareScannerStage,
  resetScannerStage,
  setScannerGuideVisible,
} from './ui/scannerStage';
```

- [ ] **Step 6: Prepare one guide per marker start and aggregate marker visibility**

In `startCurrentArSession()`, create a set scoped to the current start and replace `stage.replaceChildren()`:

```ts
const visibleMarkerIds = new Set<string>();
// existing start setup
session?.stop();
session = undefined;
prepareScannerStage(stage);
```

Replace the marker visibility hook with:

```ts
onMarkerVisibility: ({ marker, visible }) => {
  if (!isCurrentStart()) {
    return;
  }
  if (visible) {
    visibleMarkerIds.add(marker.id);
  } else {
    visibleMarkerIds.delete(marker.id);
  }
  setScannerGuideVisible(stage, visibleMarkerIds.size === 0);
  status.textContent = visible ? `${marker.label} active` : `${marker.label} lost`;
},
```

- [ ] **Step 7: Restore idle UI on current startup failure**

In the non-abort error branch of `startCurrentArSession()`, before publishing the message, add:

```ts
resetScannerStage(stage);
```

Do not reset the stage in stale or aborted catch branches because a newer start or navigation cleanup owns the current stage.

- [ ] **Step 8: Make stop cleanup restore the idle stage**

Replace `stage.replaceChildren()` in `stopActiveArSession()` with:

```ts
resetScannerStage(stage);
```

- [ ] **Step 9: Reuse authoritative stop cleanup when entering floor mode**

In the `floorToggle` click handler, replace:

```ts
setScanSessionState('idle');
invalidateMarkerStart();
session?.stop();
session = undefined;
```

with:

```ts
stopActiveArSession();
```

This keeps marker camera, abort, session state, and scanner guide cleanup in one path while preserving the focused target and prepared floor controller.

- [ ] **Step 10: Run integration tests and verify GREEN**

Run:

```bash
npx vitest run tests/targetSpecificScanIntegration.test.ts
```

Expected: all target-specific scan integration tests PASS.

- [ ] **Step 11: Run all scanner-focused tests**

Run:

```bash
npx vitest run tests/mindarRuntime.test.ts tests/scannerStage.test.ts tests/cameraLayers.test.ts tests/targetSpecificScanIntegration.test.ts
```

Expected: all focused tests PASS with no unhandled errors.

- [ ] **Step 12: Commit lifecycle integration**

```bash
git add src/main.ts tests/targetSpecificScanIntegration.test.ts
git commit -m "fix: scope scanner UI to Scan lifecycle"
```

---

### Task 4: Verify the complete fix

**Files:**
- Verify only; modify production or tests only if a verification failure reveals a scanner-lifecycle defect.

**Interfaces:**
- Consumes the completed runtime, scanner-stage, and route lifecycle behavior from Tasks 1-3.
- Produces evidence that the full application remains buildable and scanner UI does not escape its stage.

- [ ] **Step 1: Run the complete test suite**

Run:

```bash
npm test
```

Expected: all Vitest files and tests PASS.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite finish successfully and create `dist`.

- [ ] **Step 3: Run the GitHub Pages base-path build**

Run:

```bash
npx vite build --base=/Mark-AR/
```

Expected: Vite finishes successfully with assets rooted under `/Mark-AR/`.

- [ ] **Step 4: Inspect the mobile Scan route in a real browser**

Start the Vite server, open a 390-by-844 viewport, and verify:

1. generic Scan initially shows the idle placeholder and no `[data-scanner-guide]`;
2. after camera startup begins, one guide is visible entirely within the rounded camera stage;
3. Home navigation removes the guide and shows no white scanner frame over Home;
4. returning to Scan shows the idle placeholder;
5. repeating start/leave does not create duplicate body-level MindAR overlays.

- [ ] **Step 5: Review the final diff**

Run:

```bash
git diff --check
git status --short
git log -4 --oneline
```

Expected: no whitespace errors; only intentional source/test changes or known user-owned untracked directories remain; scanner implementation commits are visible.

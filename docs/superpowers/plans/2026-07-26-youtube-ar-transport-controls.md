# YouTube AR Transport Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add accessible 3D play/pause and 10-second seek buttons above active YouTube videos in both marker and floor AR.

**Architecture:** Build the DOM transport bar as a focused, independently tested module, then mount it inside the existing CSS3D video wrapper owned by `YouTubePlayerManager`. Extend the YouTube adapter with seek/time methods and an event-driven player-state callback so custom and native iframe controls remain synchronized. Both AR modes inherit the feature because they already share the manager.

**Tech Stack:** TypeScript 6, Three.js CSS3DRenderer, YouTube IFrame Player API, Vitest, happy-dom, Vite CSS.

## Global Constraints

- Rewind and forward seek exactly 10 seconds.
- The three-button bar is centered above the video and follows its 3D position, rotation, and scale.
- Controls remain in AR and never open fullscreen.
- The same implementation must work in marker and floor AR.
- Control pointer/touch events must never select, move, scale, or reposition floor content.
- Keep YouTube's native iframe controls enabled.
- Player-state synchronization must be event-driven; do not add timers or polling.
- Preserve thumbnail activation, error recovery, target persistence, and existing cleanup behavior.
- Do not add progress, time, volume, speed, captions, fullscreen, or playback-position persistence.

## File Structure

- Create `src/ar/youtubeTransportControls.ts`: owns control DOM, button commands, seek clamping, state labels, accessibility, listener cleanup.
- Create `tests/youtubeTransportControls.test.ts`: unit tests the real DOM controls against a small in-memory player double.
- Modify `src/ar/youtubePlayerManager.ts`: extends the player boundary, mounts/cleans controls, and forwards YouTube state events.
- Modify `tests/youtubePlayerManager.test.ts`: verifies manager integration, readiness visibility, state forwarding, and lifecycle.
- Modify `tests/floorPlacementRuntime.test.ts`: updates typed player doubles and protects the shared floor flow.
- Modify `tests/mindarRuntime.test.ts`: verifies a nested transport button is excluded from marker activation.
- Create `tests/youtubePlayerStyles.test.ts`: verifies layout, touch target, focus, and spatial styling contracts.
- Modify `src/style.css`: styles the CSS3D wrapper and transport bar.

---

### Task 1: Standalone transport-control behavior

**Files:**
- Create: `src/ar/youtubeTransportControls.ts`
- Create: `tests/youtubeTransportControls.test.ts`

**Interfaces:**
- Consumes:

```ts
export type YouTubeTransportPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
};
```

- Produces:

```ts
export type YouTubeTransportControls = {
  element: HTMLElement;
  bindPlayer(player: YouTubeTransportPlayer): void;
  setPlayerState(state: number): void;
  dispose(): void;
};

export function createYouTubeTransportControls(): YouTubeTransportControls;
```

- [ ] **Step 1: Write failing DOM tests for structure and play/pause behavior**

Create `tests/youtubeTransportControls.test.ts` with literal, user-visible expectations:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  createYouTubeTransportControls,
  type YouTubeTransportPlayer,
} from '../src/ar/youtubeTransportControls';

function createPlayer(
  input: { currentTime?: number; duration?: number } = {},
): YouTubeTransportPlayer {
  return {
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    seekTo: vi.fn(),
    getCurrentTime: vi.fn(() => input.currentTime ?? 0),
    getDuration: vi.fn(() => input.duration ?? 120),
  };
}

describe('YouTube transport controls', () => {
  it('renders rewind, play, and forward buttons in accessible order', () => {
    const controls = createYouTubeTransportControls();
    const buttons = [...controls.element.querySelectorAll('button')];

    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Rewind 10 seconds',
      'Play video',
      'Forward 10 seconds',
    ]);
    expect(controls.element.hidden).toBe(true);
  });

  it('plays from a paused state and pauses from a playing state', () => {
    const controls = createYouTubeTransportControls();
    const player = createPlayer();
    controls.bindPlayer(player);
    const toggle = controls.element.querySelector<HTMLButtonElement>(
      '[data-youtube-action="toggle"]',
    )!;

    toggle.click();
    expect(player.playVideo).toHaveBeenCalledOnce();

    controls.setPlayerState(1);
    expect(toggle.textContent).toBe('Pause');
    expect(toggle.getAttribute('aria-label')).toBe('Pause video');
    toggle.click();
    expect(player.pauseVideo).toHaveBeenCalledOnce();

    controls.setPlayerState(2);
    expect(toggle.textContent).toBe('Play');
    expect(toggle.getAttribute('aria-label')).toBe('Play video');
  });

  it('retains the stable toggle label while buffering', () => {
    const controls = createYouTubeTransportControls();
    controls.bindPlayer(createPlayer());
    controls.setPlayerState(1);
    controls.setPlayerState(3);
    expect(controls.element.querySelector('[data-youtube-action="toggle"]')?.textContent)
      .toBe('Pause');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
npm test -- tests/youtubeTransportControls.test.ts
```

Expected: FAIL because `src/ar/youtubeTransportControls.ts` does not exist.

- [ ] **Step 3: Implement the minimal control DOM and state mapping**

Create `src/ar/youtubeTransportControls.ts` with:

```ts
export type YouTubeTransportPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
};

export type YouTubeTransportControls = {
  element: HTMLElement;
  bindPlayer(player: YouTubeTransportPlayer): void;
  setPlayerState(state: number): void;
  dispose(): void;
};

const PLAYING = 1;
const BUFFERING = 3;

export function createYouTubeTransportControls(): YouTubeTransportControls {
  const element = document.createElement('div');
  element.className = 'youtube-transport-controls';
  element.hidden = true;
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', 'YouTube playback controls');

  const rewind = createButton('rewind', '↶ 10', 'Rewind 10 seconds');
  const toggle = createButton('toggle', 'Play', 'Play video');
  const forward = createButton('forward', '10 ↷', 'Forward 10 seconds');
  element.append(rewind, toggle, forward);

  let player: YouTubeTransportPlayer | undefined;
  let playing = false;

  const onToggle = (event: Event) => {
    event.stopPropagation();
    if (!player) return;
    if (playing) player.pauseVideo();
    else player.playVideo();
  };

  toggle.addEventListener('click', onToggle);

  return {
    element,
    bindPlayer(nextPlayer) {
      player = nextPlayer;
      element.hidden = false;
    },
    setPlayerState(state) {
      if (state === BUFFERING) return;
      playing = state === PLAYING;
      toggle.textContent = playing ? 'Pause' : 'Play';
      toggle.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
    },
    dispose() {
      toggle.removeEventListener('click', onToggle);
      player = undefined;
      element.remove();
    },
  };
}

function createButton(action: string, text: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.youtubeAction = action;
  button.textContent = text;
  button.setAttribute('aria-label', label);
  return button;
}
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```powershell
npm test -- tests/youtubeTransportControls.test.ts
```

Expected: all three tests PASS.

- [ ] **Step 5: Add failing seek-boundary and cleanup tests**

Append tests using hand-derived targets:

```ts
it.each([
  { currentTime: 42, duration: 120, action: 'rewind', expected: 32 },
  { currentTime: 4, duration: 120, action: 'rewind', expected: 0 },
  { currentTime: 42, duration: 120, action: 'forward', expected: 52 },
  { currentTime: 116, duration: 120, action: 'forward', expected: 120 },
  { currentTime: Number.NaN, duration: 120, action: 'forward', expected: 10 },
  { currentTime: 42, duration: Number.NaN, action: 'forward', expected: 52 },
])(
  'seeks $action safely from $currentTime with duration $duration',
  ({ currentTime, duration, action, expected }) => {
    const controls = createYouTubeTransportControls();
    const player = createPlayer({ currentTime, duration });
    controls.bindPlayer(player);

    controls.element.querySelector<HTMLButtonElement>(
      `[data-youtube-action="${action}"]`,
    )!.click();

    expect(player.seekTo).toHaveBeenCalledWith(expected, true);
  },
);

it('removes its DOM and disables commands when disposed', () => {
  const controls = createYouTubeTransportControls();
  const player = createPlayer();
  const parent = document.createElement('div');
  parent.append(controls.element);
  const playButton = controls.element.querySelector<HTMLButtonElement>(
    '[data-youtube-action="toggle"]',
  )!;
  controls.bindPlayer(player);

  controls.dispose();
  playButton.click();

  expect(parent.children).toHaveLength(0);
  expect(player.playVideo).not.toHaveBeenCalled();
});

it('keeps two active control bars bound to their own players', () => {
  const first = createYouTubeTransportControls();
  const second = createYouTubeTransportControls();
  const firstPlayer = createPlayer({ currentTime: 40 });
  const secondPlayer = createPlayer({ currentTime: 80 });
  first.bindPlayer(firstPlayer);
  second.bindPlayer(secondPlayer);

  first.element.querySelector<HTMLButtonElement>(
    '[data-youtube-action="rewind"]',
  )!.click();

  expect(firstPlayer.seekTo).toHaveBeenCalledWith(30, true);
  expect(secondPlayer.seekTo).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: Run the focused test and confirm RED for invalid negative time**

Run:

```powershell
npm test -- tests/youtubeTransportControls.test.ts
```

Expected: the seek cases and independent-player test FAIL because rewind and
forward are not wired yet. The cleanup test should already PASS.

- [ ] **Step 7: Make only the boundary and cleanup corrections needed for GREEN**

Add the seek listeners beside `onToggle`:

```ts
const onRewind = (event: Event) => {
  event.stopPropagation();
  if (!player) return;
  player.seekTo(Math.max(0, finiteOrZero(player.getCurrentTime()) - 10), true);
};
const onForward = (event: Event) => {
  event.stopPropagation();
  if (!player) return;
  const currentTime = finiteOrZero(player.getCurrentTime());
  const duration = player.getDuration();
  const target = Number.isFinite(duration) && duration > 0
    ? Math.min(duration, currentTime + 10)
    : currentTime + 10;
  player.seekTo(target, true);
};

rewind.addEventListener('click', onRewind);
forward.addEventListener('click', onForward);
```

Remove those listeners in `dispose()` before clearing the player:

```ts
rewind.removeEventListener('click', onRewind);
toggle.removeEventListener('click', onToggle);
forward.removeEventListener('click', onForward);
```

Add the single normalization helper:

```ts
function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
```

- [ ] **Step 8: Run the control tests and commit**

Run:

```powershell
npm test -- tests/youtubeTransportControls.test.ts
git add src/ar/youtubeTransportControls.ts tests/youtubeTransportControls.test.ts
git commit -m "feat: add YouTube transport controls"
```

Expected: focused suite PASS and commit succeeds.

---

### Task 2: Integrate controls with the shared CSS3D player manager

**Files:**
- Modify: `src/ar/youtubePlayerManager.ts`
- Modify: `tests/youtubePlayerManager.test.ts`
- Modify: `tests/floorPlacementRuntime.test.ts`

**Interfaces:**
- Consumes:

```ts
createYouTubeTransportControls(): YouTubeTransportControls;
YouTubeTransportControls.bindPlayer(player): void;
YouTubeTransportControls.setPlayerState(state): void;
YouTubeTransportControls.dispose(): void;
```

- Produces:

```ts
export type YouTubePlayerPort = YouTubeTransportPlayer & {
  destroy(): void;
};

type YouTubePlayerStateHandler = (state: number) => void;

createPlayer(
  element: HTMLElement,
  youtube: TargetYouTubeContent,
  onStateChange: YouTubePlayerStateHandler,
): Promise<YouTubePlayerPort>;
```

- [ ] **Step 1: Extend existing test player doubles without changing behavior**

In `tests/youtubePlayerManager.test.ts` and the two explicit `YouTubePlayerPort` objects in `tests/floorPlacementRuntime.test.ts`, add:

```ts
seekTo: vi.fn(),
getCurrentTime: vi.fn(() => 0),
getDuration: vi.fn(() => 120),
```

For no-op inline objects, use:

```ts
seekTo() {},
getCurrentTime() { return 0; },
getDuration() { return 120; },
```

Run:

```powershell
npm test -- tests/youtubePlayerManager.test.ts tests/floorPlacementRuntime.test.ts
```

Expected: PASS; this is a type-double preparation step with no production behavior change.

- [ ] **Step 2: Write failing manager integration tests**

Add tests to `tests/youtubePlayerManager.test.ts` that capture the third `createPlayer` argument:

```ts
it('shows transport controls after readiness and syncs native player state', async () => {
  const container = document.createElement('div');
  const player = createPlayerDouble();
  let onStateChange: ((state: number) => void) | undefined;
  const manager = createManager({
    createPlayer: async (_host, _youtube, stateHandler) => {
      onStateChange = stateHandler;
      return player.port;
    },
    hitTest: (_pointer, _camera, surfaces) => surfaces[0],
  }, container);
  manager.register('marker-1', createSurface());
  manager.setMarkerVisible('marker-1', true);

  const activation = manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera());
  const controls = container.querySelector<HTMLElement>('.youtube-transport-controls');
  expect(controls).not.toBeNull();
  expect(controls?.hidden).toBe(true);

  expect(await activation).toBe('activated');
  expect(controls?.hidden).toBe(false);
  onStateChange?.(1);
  expect(controls?.querySelector('[data-youtube-action="toggle"]')?.textContent)
    .toBe('Pause');
  onStateChange?.(2);
  expect(controls?.querySelector('[data-youtube-action="toggle"]')?.textContent)
    .toBe('Play');
  manager.dispose();
});

it('removes the complete transport bar when the marker is lost', async () => {
  const container = document.createElement('div');
  const manager = createManager({
    createPlayer: async () => createPlayerDouble().port,
    hitTest: (_pointer, _camera, surfaces) => surfaces[0],
  }, container);
  manager.register('marker-1', createSurface());
  manager.setMarkerVisible('marker-1', true);
  await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera());

  manager.setMarkerVisible('marker-1', false);

  expect(container.querySelector('.youtube-transport-controls')).toBeNull();
  manager.dispose();
});
```

In the existing player-creation failure test, add:

```ts
expect(container.querySelector('.youtube-transport-controls')).toBeNull();
```

This protects cleanup when initialization rejects.

Add a `createPlayerDouble()` test utility that returns a complete real-shape port:

```ts
function createPlayerDouble() {
  return {
    port: {
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      seekTo: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      getDuration: vi.fn(() => 120),
      destroy: vi.fn(),
    } satisfies YouTubePlayerPort,
  };
}
```

- [ ] **Step 3: Run manager tests and confirm RED**

Run:

```powershell
npm test -- tests/youtubePlayerManager.test.ts
```

Expected: FAIL because no `.youtube-transport-controls` is mounted and `createPlayer` has no state callback.

- [ ] **Step 4: Mount and own controls in `YouTubePlayerManager`**

In `src/ar/youtubePlayerManager.ts`:

```ts
import {
  createYouTubeTransportControls,
  type YouTubeTransportControls,
  type YouTubeTransportPlayer,
} from './youtubeTransportControls';

export type YouTubePlayerPort = YouTubeTransportPlayer & {
  destroy(): void;
};

type YouTubePlayerStateHandler = (state: number) => void;
```

Extend `ActivePlayer`:

```ts
type ActivePlayer = {
  surface: RegisteredSurface;
  player: YouTubePlayerPort;
  cssObject: CssObjectPort;
  wrapper: HTMLElement;
  controls: YouTubeTransportControls;
};
```

Extend the dependency signature:

```ts
createPlayer?: (
  element: HTMLElement,
  youtube: TargetYouTubeContent,
  onStateChange: YouTubePlayerStateHandler,
) => Promise<YouTubePlayerPort>;
```

During activation, before appending the host:

```ts
const controls = createYouTubeTransportControls();
wrapper.append(controls.element, host);
```

Create the player with a guarded callback:

```ts
const player = await this.createPlayer(host, surface.youtube, (state) => {
  const active = this.activePlayers.get(surface.objectId);
  if (active?.controls === controls) {
    controls.setPlayerState(state);
  }
});
```

On stale creation, failure, and `deactivate`, call `controls.dispose()`. On successful creation, store `controls`, call `controls.bindPlayer(player)`, then `player.playVideo()`.

- [ ] **Step 5: Forward official YouTube state changes**

Extend `YouTubeApi`:

```ts
events: {
  onReady(event: { target: YouTubePlayerPort }): void;
  onStateChange(event: { data: number }): void;
  onError(event: { data: number }): void;
};
```

Update the adapter signature and events:

```ts
async function createYouTubePlayer(
  element: HTMLElement,
  youtube: TargetYouTubeContent,
  onStateChange: YouTubePlayerStateHandler,
): Promise<YouTubePlayerPort> {
  const api = await loadYouTubeApi();
  return new Promise<YouTubePlayerPort>((resolve, reject) => {
    new api.Player(element, {
      videoId: youtube.videoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        playsinline: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (event) => resolve(event.target),
        onStateChange: (event) => onStateChange(event.data),
        onError: (event) => reject(new Error(youtubeErrorMessage(event.data))),
      },
    });
  });
}
```

- [ ] **Step 6: Run focused manager and floor tests and confirm GREEN**

Run:

```powershell
npm test -- tests/youtubePlayerManager.test.ts tests/floorPlacementRuntime.test.ts
```

Expected: both suites PASS.

- [ ] **Step 7: Commit the shared manager integration**

```powershell
git add src/ar/youtubePlayerManager.ts tests/youtubePlayerManager.test.ts tests/floorPlacementRuntime.test.ts
git commit -m "feat: mount transport controls in AR players"
```

---

### Task 3: Spatial styling and interaction regressions

**Files:**
- Create: `tests/youtubePlayerStyles.test.ts`
- Modify: `src/style.css`
- Modify: `tests/mindarRuntime.test.ts`
- Verify: `tests/floorGestureController.test.ts`

**Interfaces:**
- Consumes:

```html
<div class="youtube-css3d-player">
  <div class="youtube-transport-controls" role="group">
    <button data-youtube-action="rewind">↶ 10</button>
    <button data-youtube-action="toggle">Play</button>
    <button data-youtube-action="forward">10 ↷</button>
  </div>
  <div></div>
</div>
```

- Produces: CSS contract for an above-video 3D-looking bar with 44px controls and a visible focus ring.

- [ ] **Step 1: Write failing style contract tests**

Create `tests/youtubePlayerStyles.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

function cssRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm')
    .exec(css)?.groups?.body ?? '';
}

describe('YouTube AR transport styles', () => {
  it('places the spatial transport bar above the video', () => {
    const wrapper = cssRule('.youtube-css3d-player');
    const controls = cssRule('.youtube-transport-controls');

    expect(wrapper).toContain('position: relative');
    expect(controls).toContain('position: absolute');
    expect(controls).toContain('bottom: calc(100% + 14px)');
    expect(controls).toContain('left: 50%');
    expect(controls).toContain('transform: translateX(-50%)');
    expect(controls).toContain('display: flex');
    expect(controls).toContain('pointer-events: auto');
  });

  it('gives the 3D buttons mobile touch targets and visible keyboard focus', () => {
    const button = cssRule('.youtube-transport-controls button');
    const focus = cssRule('.youtube-transport-controls button:focus-visible');

    expect(button).toContain('min-width: 44px');
    expect(button).toContain('min-height: 44px');
    expect(button).toContain('box-shadow:');
    expect(focus).toContain('outline: 3px solid');
  });
});
```

- [ ] **Step 2: Run the style test and confirm RED**

Run:

```powershell
npm test -- tests/youtubePlayerStyles.test.ts
```

Expected: FAIL because the selectors are not styled.

- [ ] **Step 3: Add scoped spatial styles**

Add to the AR/scanner section of `src/style.css`:

```css
.youtube-css3d-player {
  position: relative;
  overflow: visible;
}

.youtube-transport-controls {
  position: absolute;
  bottom: calc(100% + 14px);
  left: 50%;
  z-index: 2;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border: 1px solid rgb(90 224 208 / 80%);
  border-radius: 14px;
  background: rgb(5 25 28 / 92%);
  box-shadow: 0 12px 24px rgb(0 0 0 / 45%);
  transform: translateX(-50%);
  pointer-events: auto;
}

.youtube-transport-controls[hidden] {
  display: none;
}

.youtube-transport-controls button {
  min-width: 44px;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid rgb(154 255 239 / 85%);
  border-radius: 10px;
  color: #f4fffd;
  background: linear-gradient(180deg, #174b4d 0%, #0b3033 100%);
  box-shadow:
    0 5px 0 #041b1d,
    0 9px 16px rgb(0 0 0 / 42%);
  font: 700 16px/1 system-ui, sans-serif;
  cursor: pointer;
  touch-action: manipulation;
}

.youtube-transport-controls button:active {
  box-shadow:
    0 2px 0 #041b1d,
    0 5px 10px rgb(0 0 0 / 38%);
  transform: translateY(3px);
}

.youtube-transport-controls button:focus-visible {
  outline: 3px solid #ffe08a;
  outline-offset: 3px;
}
```

- [ ] **Step 4: Strengthen marker interaction coverage**

Change the existing test in `tests/mindarRuntime.test.ts` to place the real descendant shape under the excluded wrapper:

```ts
const player = document.createElement('div');
player.className = 'youtube-css3d-player';
const control = player.appendChild(document.createElement('button'));
container.append(player);

control.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
```

Keep the existing assertion:

```ts
expect(runtimeMocks.managerActivate).not.toHaveBeenCalled();
```

The existing `tests/floorGestureController.test.ts` descendant test already covers touchstart, touchmove, and touchend inside `.youtube-css3d-player`; do not duplicate it.

- [ ] **Step 5: Run spatial and interaction tests and confirm GREEN**

Run:

```powershell
npm test -- tests/youtubePlayerStyles.test.ts tests/mindarRuntime.test.ts tests/floorGestureController.test.ts
```

Expected: all three suites PASS.

- [ ] **Step 6: Commit styles and regressions**

```powershell
git add src/style.css tests/youtubePlayerStyles.test.ts tests/mindarRuntime.test.ts
git commit -m "style: add spatial YouTube player controls"
```

---

### Task 4: Full verification and browser acceptance

**Files:**
- Verify only; fix failures in the smallest owning file with a new failing regression test before production changes.

**Interfaces:**
- Consumes the completed shared manager, control module, and CSS.
- Produces a verified branch ready for review/integration.

- [ ] **Step 1: Run the entire automated suite**

```powershell
npm test
```

Expected: every Vitest test PASS with no unhandled errors.

- [ ] **Step 2: Run type-checking and the production build**

```powershell
npm run build
```

Expected: TypeScript and Vite build PASS. Existing chunk-size warnings are informational; no new errors are allowed.

- [ ] **Step 3: Run whitespace and worktree checks**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only intentional feature files are modified.

- [ ] **Step 4: Start the local app for browser verification**

```powershell
npm run dev -- --host 127.0.0.1
```

Use the `browser:control-in-app-browser` skill to open the reported localhost URL.

- [ ] **Step 5: Verify the control UI in a real browser**

With an existing saved target containing a YouTube object:

1. Open marker AR and activate the YouTube thumbnail.
2. Confirm the three controls appear above the player and not over it.
3. Confirm Play/Pause updates the center label.
4. Confirm rewind and forward request 10-second seeks.
5. Confirm controls remain inline and no fullscreen player opens.
6. Open floor AR, place the experience, activate the same video, and repeat.
7. Tap each transport button without long-press selection; confirm the object does not move or select.
8. Stop each AR session and confirm the controls disappear.

If camera permissions or marker visibility prevent real media activation in automation, use the manager integration fixture to render the real CSS3D wrapper with a deterministic local player port, then verify control placement and click routing. Report the physical camera limitation explicitly rather than claiming it was tested.

- [ ] **Step 6: Review the final diff against the acceptance criteria**

```powershell
git diff 2cc1915996be2c27810db3562eb4701433e77c7b...HEAD --stat
git log --oneline 2cc1915996be2c27810db3562eb4701433e77c7b..HEAD
```

Confirm:

- both AR modes use the same manager path;
- 10-second seeking is clamped safely;
- state labels are driven by YouTube events;
- the bar inherits the video CSS3D transform;
- cleanup owns player, wrapper, listeners, and controls;
- no persistence or Studio code changed.

- [ ] **Step 7: Commit any test-only verification corrections**

If Step 1–6 required no corrections, do not create an empty commit. Otherwise:

```powershell
git add -u
git commit -m "test: cover YouTube AR transport integration"
```

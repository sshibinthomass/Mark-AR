# Responsive Navigation and UI System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Mark-AR page and AR mode explicit, consistent navigation and a unified responsive visual system, including an always-available floor-mode return control.

**Architecture:** Keep the existing hash router and single rendered application shell. Add semantic navigation/page-heading markup, a small responsive layout coordinator that moves the existing DOM nodes at the mobile breakpoint, and a dedicated floor-overlay return action wired to the current focused scan. Consolidate visual behavior in `src/style.css` through shared tokens and component variants while leaving all AR scene, persistence, and backend behavior unchanged.

**Tech Stack:** TypeScript 6, Vite 8, Vitest 4 with happy-dom, existing vanilla HTML/CSS, Three.js/MindAR/WebXR runtimes unchanged.

## Global Constraints

- Preserve the teal-and-gold technical AR studio identity.
- Keep route names and the exact `#/scan/<scan_id>` format unchanged.
- Do not add a UI framework, router, remote font, or backend dependency.
- Do not change Worker APIs, authentication semantics, target data, scene transforms, animation, or persistence.
- Use explicit destinations rather than browser-history assumptions.
- Keep controls at least 44 by 44 pixels on mobile.
- Keep one DOM instance for every interactive control; do not duplicate controls to achieve responsive layouts.
- Respect `prefers-reduced-motion` and device safe areas.
- Follow test-driven development: write each regression test, run it and observe the expected failure, then implement the smallest passing change.

---

## File Structure

### New files

- `src/ui/responsiveLayout.ts` — owns breakpoint-driven DOM ordering for Home, Scan, Targets, and Account.
- `tests/responsiveLayout.test.ts` — verifies mobile and desktop DOM order and media-query updates.
- `tests/responsiveNavigationStyles.test.ts` — verifies the mobile bottom navigation, safe-area clearance, immersive hiding, and compact page-heading rules.
- `tests/uiSystemStyles.test.ts` — verifies shared tokens, button variants, sizing, Home card columns, focus, and reduced-motion rules.

### Modified files

- `src/ui/appShell.ts` — renders four global destinations, route icons, standardized page headings, layout-region markers, and the floor return button.
- `src/ui/pageRouter.ts` — applies page visibility plus scroll/focus effects.
- `src/ui/floorPlacementUi.ts` — switches between the floor return button and the external floor-entry control and hides the external scanner strip in floor mode.
- `src/main.ts` — initializes responsive layout, tracks scan-session presentation state, and wires the floor return button to the existing same-target recovery path.
- `src/style.css` — defines the shared visual tokens and responsive desktop/mobile layouts.
- `tests/appShell.test.ts` — verifies shell, heading, layout-region, and floor-return markup.
- `tests/pageRouter.test.ts` — verifies route effects in addition to visibility and active links.
- `tests/floorPlacementUi.test.ts` — verifies all floor states expose a dedicated return control.
- `tests/floorPlacementStyles.test.ts` — verifies safe-area positioning and focus for the return control.
- `tests/targetSpecificScanIntegration.test.ts` — verifies floor entry and return use separate controls and marker-session presentation state is cleaned up.
- `tests/savedTargetEditingIntegration.test.ts` — verifies the mobile save strip becomes sticky only when a saved target or new target image is being edited.
- `tests/targetPreviewMobileStyles.test.ts` — updates the breakpoint expectations to the unified mobile system where needed.

---

### Task 1: Semantic Global Navigation and Route Orientation

**Files:**

- Modify: `tests/appShell.test.ts`
- Modify: `tests/pageRouter.test.ts`
- Modify: `src/ui/appShell.ts:43-535`
- Modify: `src/ui/pageRouter.ts:1-36`

**Interfaces:**

- Produces: `data-page-heading` on the active page title.
- Produces: `data-route-link="home|scan|targets|account"` for all four global destinations.
- Produces: `RouteActivationEffects` with `scrollToTop()` and `focusHeading(heading)`.
- Preserves: `activateAccessibleRoute(root, requestedRoute, authState)` and `activateRoute(root, route)` compatibility through optional effects.

- [ ] **Step 1: Write failing shell tests for four destinations and explicit page headings**

Update the opening route assertion in `tests/appShell.test.ts`:

```ts
expect(
  [...container.querySelectorAll<HTMLAnchorElement>('.route-tabs a')].map((link) => ({
    route: link.dataset.routeLink,
    href: link.getAttribute('href'),
    text: link.textContent?.trim(),
    hasIcon: Boolean(link.querySelector('.route-icon')),
  })),
).toEqual([
  { route: 'home', href: '#/', text: 'Home', hasIcon: true },
  { route: 'scan', href: '#/scan', text: 'Scan', hasIcon: true },
  { route: 'targets', href: '#/account', text: 'Targets', hasIcon: true },
  { route: 'account', href: '#/account', text: 'Sign in', hasIcon: true },
]);

expect(
  [...container.querySelectorAll<HTMLElement>('[data-page-heading]')].map((heading) => ({
    id: heading.id,
    text: heading.textContent?.trim(),
    tabIndex: heading.tabIndex,
  })),
).toEqual([
  { id: 'home-page-title', text: 'Marker AR studio', tabIndex: -1 },
  { id: 'scan-page-title', text: 'Scan target', tabIndex: -1 },
  { id: 'targets-page-title', text: 'Image targets', tabIndex: -1 },
  { id: 'account-page-title', text: 'Account', tabIndex: -1 },
]);

expect(
  [...container.querySelectorAll<HTMLAnchorElement>('.page-home-link')].map((link) => ({
    href: link.getAttribute('href'),
    text: link.textContent?.trim(),
  })),
).toEqual([
  { href: '#/', text: 'Home' },
  { href: '#/', text: 'Home' },
  { href: '#/', text: 'Home' },
]);
```

- [ ] **Step 2: Write failing router tests for scroll and heading focus**

Add to `tests/pageRouter.test.ts`:

```ts
it('scrolls to the page start and focuses the active page heading', () => {
  const root = document.createElement('main');
  root.innerHTML = `
    <section data-page="home">
      <h1 data-page-heading tabindex="-1">Home</h1>
    </section>
    <section data-page="scan" hidden>
      <h2 data-page-heading tabindex="-1">Scan target</h2>
    </section>
  `;
  const scrollToTop = vi.fn();
  const focusHeading = vi.fn();

  activateRoute(root, 'scan', { scrollToTop, focusHeading });

  const scanHeading = root.querySelector<HTMLElement>('[data-page="scan"] [data-page-heading]');
  expect(scrollToTop).toHaveBeenCalledTimes(1);
  expect(focusHeading).toHaveBeenCalledWith(scanHeading);
});
```

Add `vi` to the Vitest import.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
npm.cmd test -- tests/appShell.test.ts tests/pageRouter.test.ts
```

Expected: failures showing the missing Home route item, missing icons/headings, `Back` rather than `Home`, and the third `activateRoute` argument not producing effects.

- [ ] **Step 4: Render semantic route icons and standardized page headings**

In `src/ui/appShell.ts`, render Home in the route list and attach one icon plus one label to every route:

```ts
const routeIconPaths: Record<AppRoute, string> = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9 21v-7h6v7"/>',
  scan: '<path d="M4 8V4h4"/><path d="M16 4h4v4"/><path d="M20 16v4h-4"/><path d="M8 20H4v-4"/><path d="M7 12h10"/>',
  targets: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 15 3-3 2 2 3-4 2 3"/>',
  account: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
};

function renderRouteIcon(route: AppRoute): string {
  return `
    <svg class="route-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      ${routeIconPaths[route]}
    </svg>
  `;
}
```

Change the navigation block to:

```ts
<nav class="shell-nav" aria-label="Marker AR pages">
  <a class="brand-link" href="${hrefForRoute('home')}">Marker AR studio</a>
  <div class="route-tabs">
    ${renderRouteLink('home', 'Home')}
    ${renderRouteLink('scan', 'Scan')}
    ${renderRouteLink('targets', 'Targets')}
    ${renderRouteLink('account', '<span data-auth-account-label>Sign in</span>')}
  </div>
</nav>
```

Use this label wrapper in `renderRouteLink`:

```ts
function renderRouteLabel(route: AppRoute, label: string): string {
  return `${renderRouteIcon(route)}<span class="route-label">${label}</span>`;
}
```

Keep the existing protected Targets attributes, but render `renderRouteLabel(route, label)` inside every route anchor.

Give the Home title route focus metadata:

```html
<h1 id="home-page-title" data-page-heading tabindex="-1">Marker AR studio</h1>
```

Change the page-heading calls to pass a route:

```ts
${renderPageHeader('scan', 'Scan target', 'Use saved cloud image targets to anchor placed objects in AR.')}
${renderPageHeader('targets', 'Image targets', 'Upload a scan image, place models above it, and save the pairing to Cloudflare.')}
${renderPageHeader('account', 'Account', 'Sign in to create and manage cloud image targets.')}
```

Implement:

```ts
function renderPageHeader(route: Exclude<AppRoute, 'home'>, title: string, text: string): string {
  return `
    <header class="page-header">
      <a class="page-home-link action-control action-control--quiet" href="${hrefForRoute('home')}">
        <span aria-hidden="true">←</span>
        <span>Home</span>
      </a>
      <div class="page-heading-copy">
        <p class="eyebrow">Marker Web AR</p>
        <h2 id="${route}-page-title" data-page-heading tabindex="-1">${title}</h2>
        <p>${text}</p>
      </div>
    </header>
  `;
}
```

- [ ] **Step 5: Add injectable route activation effects**

Replace `src/ui/pageRouter.ts` with:

```ts
import type { AppRoute } from './pageRoutes';
import { resolveAccessibleRoute, type AuthUiState } from './authUi';

export type AccessibleRouteResult = {
  activeRoute: AppRoute;
  blocked: boolean;
};

export type RouteActivationEffects = {
  scrollToTop(): void;
  focusHeading(heading: HTMLElement): void;
};

export function activateAccessibleRoute(
  root: HTMLElement,
  requestedRoute: AppRoute,
  authState: AuthUiState,
  effects?: RouteActivationEffects,
): AccessibleRouteResult {
  const activeRoute = resolveAccessibleRoute(requestedRoute, authState);
  activateRoute(root, activeRoute, effects);
  return {
    activeRoute,
    blocked: activeRoute !== requestedRoute,
  };
}

export function activateRoute(
  root: HTMLElement,
  route: AppRoute,
  effects = browserRouteEffects(root),
): void {
  root.dataset.activePage = route;
  let activePage: HTMLElement | undefined;

  root.querySelectorAll<HTMLElement>('[data-page]').forEach((page) => {
    page.hidden = page.dataset.page !== route;
    if (!page.hidden) {
      activePage = page;
    }
  });

  root.querySelectorAll<HTMLElement>('[data-route-link]').forEach((link) => {
    if (link.dataset.routeLink === route) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  effects.scrollToTop();
  const heading = activePage?.querySelector<HTMLElement>('[data-page-heading]');
  if (heading) {
    effects.focusHeading(heading);
  }
}

function browserRouteEffects(root: HTMLElement): RouteActivationEffects {
  const view = root.ownerDocument.defaultView;
  return {
    scrollToTop() {
      view?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
    },
    focusHeading(heading) {
      heading.focus({ preventScroll: true });
    },
  };
}
```

- [ ] **Step 6: Run focused and route/auth tests and verify GREEN**

Run:

```powershell
npm.cmd test -- tests/appShell.test.ts tests/pageRouter.test.ts tests/authNavigation.test.ts tests/authUi.test.ts
```

Expected: all selected test files pass.

- [ ] **Step 7: Commit**

```powershell
git add src/ui/appShell.ts src/ui/pageRouter.ts tests/appShell.test.ts tests/pageRouter.test.ts
git commit -m "feat: standardize app navigation and page headings"
```

---

### Task 2: Responsive DOM Order Coordinator

**Files:**

- Create: `tests/responsiveLayout.test.ts`
- Create: `src/ui/responsiveLayout.ts`
- Modify: `src/ui/appShell.ts`
- Modify: `src/main.ts:150-155`

**Interfaces:**

- Produces: `applyResponsiveLayout(root: HTMLElement, mobile: boolean): void`.
- Produces: `setupResponsiveLayout(root: HTMLElement, mediaQuery?: MediaQueryList): { dispose(): void }`.
- Consumes layout roles:
  - `landing-copy`, `landing-flow`, `landing-preview`, `mode-picker`
  - `scanner-stage`, `scanner-controls`
  - `target-preview`, `target-inspector`
  - `auth-access`, `auth-controls`

- [ ] **Step 1: Write failing tests for desktop and mobile DOM order**

Create `tests/responsiveLayout.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { applyResponsiveLayout, setupResponsiveLayout } from '../src/ui/responsiveLayout';

describe('responsive layout coordinator', () => {
  it('puts task controls before large supporting surfaces on mobile', () => {
    const root = renderFixture();

    applyResponsiveLayout(root, true);

    expect(layoutOrder(root, '.landing-inner')).toEqual([
      'landing-copy',
      'mode-picker',
      'landing-flow',
      'landing-preview',
    ]);
    expect(layoutOrder(root, '.scanner-panel')).toEqual([
      'scanner-controls',
      'scanner-stage',
    ]);
    expect(layoutOrder(root, '.target-workspace')).toEqual([
      'target-inspector',
      'target-preview',
    ]);
    expect(layoutOrder(root, '.auth-layout')).toEqual([
      'auth-controls',
      'auth-access',
    ]);
  });

  it('restores the desktop workspace order', () => {
    const root = renderFixture();
    applyResponsiveLayout(root, true);

    applyResponsiveLayout(root, false);

    expect(layoutOrder(root, '.landing-inner')).toEqual([
      'landing-copy',
      'landing-flow',
      'landing-preview',
      'mode-picker',
    ]);
    expect(layoutOrder(root, '.scanner-panel')).toEqual([
      'scanner-stage',
      'scanner-controls',
    ]);
    expect(layoutOrder(root, '.target-workspace')).toEqual([
      'target-preview',
      'target-inspector',
    ]);
    expect(layoutOrder(root, '.auth-layout')).toEqual([
      'auth-access',
      'auth-controls',
    ]);
  });

  it('updates layout when the media query changes and removes its listener on dispose', () => {
    const root = renderFixture();
    const media = fakeMediaQuery(false);

    const coordinator = setupResponsiveLayout(root, media);
    expect(layoutOrder(root, '.scanner-panel')).toEqual(['scanner-stage', 'scanner-controls']);

    media.setMatches(true);
    expect(layoutOrder(root, '.scanner-panel')).toEqual(['scanner-controls', 'scanner-stage']);

    coordinator.dispose();
    media.setMatches(false);
    expect(layoutOrder(root, '.scanner-panel')).toEqual(['scanner-controls', 'scanner-stage']);
  });
});

function layoutOrder(root: ParentNode, selector: string): string[] {
  return [...root.querySelector(selector)!.children]
    .map((element) => (element as HTMLElement).dataset.layoutRole!)
    .filter(Boolean);
}

function renderFixture(): HTMLElement {
  const root = document.createElement('main');
  root.innerHTML = `
    <div class="landing-inner">
      <div data-layout-role="landing-copy"></div>
      <div data-layout-role="landing-flow"></div>
      <div data-layout-role="landing-preview"></div>
      <div data-layout-role="mode-picker"></div>
    </div>
    <div class="scanner-panel">
      <div data-layout-role="scanner-stage"></div>
      <div data-layout-role="scanner-controls"></div>
    </div>
    <div class="target-workspace">
      <div data-layout-role="target-preview"></div>
      <div data-layout-role="target-inspector"></div>
    </div>
    <div class="auth-layout">
      <div data-layout-role="auth-access"></div>
      <div data-layout-role="auth-controls"></div>
    </div>
  `;
  return root;
}

function fakeMediaQuery(initial: boolean): MediaQueryList & { setMatches(value: boolean): void } {
  let matches = initial;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  return {
    media: '(max-width: 760px)',
    get matches() {
      return matches;
    },
    onchange: null,
    addEventListener: vi.fn((_type, listener) => listeners.add(listener as (event: MediaQueryListEvent) => void)),
    removeEventListener: vi.fn((_type, listener) => listeners.delete(listener as (event: MediaQueryListEvent) => void)),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    setMatches(value: boolean) {
      matches = value;
      const event = { matches, media: this.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  } as unknown as MediaQueryList & { setMatches(value: boolean): void };
}
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd test -- tests/responsiveLayout.test.ts
```

Expected: import failure because `src/ui/responsiveLayout.ts` does not exist.

- [ ] **Step 3: Add layout roles and separate the Home workflow from the copy block**

In `src/ui/appShell.ts`:

- Add `data-layout-role="landing-copy"` to `.landing-copy`.
- Move `.landing-flow` out of `.landing-copy` so it is a direct child of `.landing-inner`, and add `data-layout-role="landing-flow"`.
- Add `data-layout-role="landing-preview"` to `.landing-preview`.
- Add `data-layout-role="mode-picker"` to `.mode-picker`.
- Add `data-layout-role="scanner-stage"` to `.scanner-stage-stack`.
- Add `data-layout-role="scanner-controls"` to `.scanner-controls`.
- Add `data-layout-role="target-preview"` to `.target-preview-shell`.
- Add `data-layout-role="target-inspector"` to `.target-inspector-card`.
- Add `data-layout-role="auth-access"` to `.auth-access-card`.
- Add `data-layout-role="auth-controls"` to `.auth-control-card`.

Keep the default rendered order desktop-first:

```html
<div class="landing-inner">
  <div class="landing-copy" data-layout-role="landing-copy">...</div>
  <div class="landing-flow" data-layout-role="landing-flow">...</div>
  <div class="landing-preview" data-layout-role="landing-preview">...</div>
  <div class="mode-picker" data-layout-role="mode-picker">...</div>
</div>
```

- [ ] **Step 4: Implement the responsive coordinator**

Create `src/ui/responsiveLayout.ts`:

```ts
const MOBILE_QUERY = '(max-width: 760px)';

export function applyResponsiveLayout(root: HTMLElement, mobile: boolean): void {
  arrange(root, '.landing-inner', mobile
    ? ['landing-copy', 'mode-picker', 'landing-flow', 'landing-preview']
    : ['landing-copy', 'landing-flow', 'landing-preview', 'mode-picker']);
  arrange(root, '.scanner-panel', mobile
    ? ['scanner-controls', 'scanner-stage']
    : ['scanner-stage', 'scanner-controls']);
  arrange(root, '.target-workspace', mobile
    ? ['target-inspector', 'target-preview']
    : ['target-preview', 'target-inspector']);
  arrange(root, '.auth-layout', mobile
    ? ['auth-controls', 'auth-access']
    : ['auth-access', 'auth-controls']);
  root.dataset.layoutViewport = mobile ? 'mobile' : 'desktop';
}

export function setupResponsiveLayout(
  root: HTMLElement,
  mediaQuery = window.matchMedia(MOBILE_QUERY),
): { dispose(): void } {
  const update = () => applyResponsiveLayout(root, mediaQuery.matches);
  mediaQuery.addEventListener('change', update);
  update();
  return {
    dispose() {
      mediaQuery.removeEventListener('change', update);
    },
  };
}

function arrange(root: HTMLElement, containerSelector: string, roles: string[]): void {
  const container = root.querySelector<HTMLElement>(containerSelector);
  if (!container) {
    return;
  }
  for (const role of roles) {
    const node = root.querySelector<HTMLElement>(`[data-layout-role="${role}"]`);
    if (node) {
      container.append(node);
    }
  }
}
```

- [ ] **Step 5: Initialize the coordinator once**

In `src/main.ts`, import and initialize immediately after rendering the shell:

```ts
import { setupResponsiveLayout } from './ui/responsiveLayout';

app.innerHTML = renderAppShell();
const shell = queryRequired<HTMLElement>('[data-app-shell]');
setupResponsiveLayout(shell);
```

Move the existing `shell` query above consumers so it is declared only once.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
npm.cmd test -- tests/responsiveLayout.test.ts tests/appShell.test.ts
```

Expected: both test files pass.

- [ ] **Step 7: Commit**

```powershell
git add src/ui/responsiveLayout.ts src/ui/appShell.ts src/main.ts tests/responsiveLayout.test.ts tests/appShell.test.ts
git commit -m "feat: prioritize mobile task layouts"
```

---

### Task 3: Dedicated Floor Return and Immersive Scan State

**Files:**

- Modify: `tests/floorPlacementUi.test.ts`
- Modify: `tests/targetSpecificScanIntegration.test.ts`
- Modify: `src/ui/appShell.ts:95-129`
- Modify: `src/ui/floorPlacementUi.ts`
- Modify: `src/main.ts:150-390, 1059-1162`

**Interfaces:**

- Produces: `#floor-ar-back` with stable copy `Back to image scan`.
- Produces: `data-scan-session="idle|starting|active"` on `[data-app-shell]`.
- Preserves: `returnToFocusedMarkerScan()` as the single same-target recovery path.
- Changes: `#floor-ar-toggle` is entry-only and is hidden in every `floor-*` UI state.

- [ ] **Step 1: Write failing floor UI state assertions**

In `tests/floorPlacementUi.test.ts`, add the return button and scanner strip assertions:

```ts
const back = required<HTMLButtonElement>(root, '#floor-ar-back');
const scannerControls = required<HTMLElement>(root, '.scanner-controls');

expect(back.hidden).toBe(!floorVisible);
expect(back.textContent?.trim()).toBe('Back to image scan');
expect(toggle.hidden).toBe(state.state === 'hidden' || floorVisible);
expect(toggle.textContent).toBe('Place on floor');
expect(scannerControls.hidden).toBe(floorVisible);
```

Add this fixture element as the first child of `#floor-ar-overlay`:

```html
<button id="floor-ar-back" type="button" hidden>Back to image scan</button>
```

- [ ] **Step 2: Update integration tests to require separate entry and return controls**

In `tests/targetSpecificScanIntegration.test.ts`, change the floor-entry test ending to:

```ts
expect(required<HTMLButtonElement>('#floor-ar-toggle').hidden).toBe(true);
expect(required<HTMLButtonElement>('#floor-ar-back')).toMatchObject({
  hidden: false,
  textContent: 'Back to image scan',
});
expect(required<HTMLElement>('.scanner-controls').hidden).toBe(true);
```

Replace floor return clicks:

```ts
required<HTMLButtonElement>('#floor-ar-back').click();
```

Apply that replacement to the return action in these existing tests:

- `stops floor AR and restarts MindAR with the same focused target when Scan image is clicked` — rename it to end with `when Back to image scan is clicked`;
- `ignores a re-entrant Scan image click while floor stop is pending` — rename it to use `Back to image scan`;
- `ignores late floor hooks after returning to marker mode`.

Replace recovery assertions that expected `#floor-ar-toggle` to read `Scan image` with:

```ts
expect(required<HTMLButtonElement>('#floor-ar-back')).toMatchObject({
  hidden: false,
  disabled: false,
  textContent: 'Back to image scan',
});
```

Add a marker-session presentation test:

```ts
it('tracks marker startup for immersive mobile navigation and clears it on departure', async () => {
  const markerStart = deferred<{ stop(): void }>();
  markerArMocks.startMarkerAR.mockReturnValueOnce(markerStart.promise);
  cloudImageTargetMocks.getImageTargetForScan.mockResolvedValue(scanTarget);

  await import('../src/main');
  await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 1);
  expect(required('[data-app-shell]').getAttribute('data-scan-session')).toBe('starting');

  markerStart.resolve({ stop: markerArMocks.sessionStop });
  await waitFor(() => required('[data-app-shell]').getAttribute('data-scan-session') === 'active');

  window.location.hash = '#/';
  await waitFor(() => required('[data-app-shell]').getAttribute('data-scan-session') === 'idle');
});
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
npm.cmd test -- tests/floorPlacementUi.test.ts tests/targetSpecificScanIntegration.test.ts
```

Expected: failures for missing `#floor-ar-back`, toggle visibility/copy, scanner-strip visibility, and missing `data-scan-session`.

- [ ] **Step 4: Render the floor return action inside the overlay**

In `src/ui/appShell.ts`, add before the gesture surface:

```html
<button
  id="floor-ar-back"
  class="floor-ar-back action-control action-control--inverse"
  type="button"
  hidden
>
  <span aria-hidden="true">←</span>
  <span>Back to image scan</span>
</button>
```

- [ ] **Step 5: Apply floor UI state to the new control and external strip**

In `src/ui/floorPlacementUi.ts`, query:

```ts
const back = required<HTMLButtonElement>(root, '#floor-ar-back');
const scannerControls = required<HTMLElement>(root, '.scanner-controls');
```

Replace the toggle and strip state:

```ts
back.hidden = !floorVisible;
back.disabled = !floorVisible;
toggle.hidden = state.state === 'hidden' || floorVisible;
toggle.disabled = state.state === 'preparing' || state.state === 'unsupported';
toggle.textContent = 'Place on floor';
scannerControls.hidden = floorVisible;
```

Keep floor status, Place, Reset, rotation, and Restart behavior unchanged.

- [ ] **Step 6: Wire the return action and make the toggle entry-only**

In `src/main.ts`, query:

```ts
const floorBack = queryRequired<HTMLButtonElement>('#floor-ar-back');
```

Change the existing toggle handler guard:

```ts
floorToggle.addEventListener('click', () => {
  if (
    returningToMarker
    || activeSharedLinkMode === 'floor'
    || !floorController
    || !focusedScanTarget
  ) {
    return;
  }

  activeSharedLinkMode = 'floor';
  invalidateMarkerStart();
  session?.stop();
  session = undefined;
  setFloorPlacementUi({
    state: 'floor-scanning',
    message: 'Move your phone until the floor ring appears.',
  });
  launchFocusedFloorPlacement(floorController);
});

floorBack.addEventListener('click', () => {
  void returnToFocusedMarkerScan();
});
```

- [ ] **Step 7: Track marker-session presentation state**

Initialize after shell creation:

```ts
setScanSessionState('idle');
```

Add:

```ts
type ScanSessionState = 'idle' | 'starting' | 'active';

function setScanSessionState(state: ScanSessionState): void {
  shell.dataset.scanSession = state;
}
```

In `startCurrentArSession()`:

```ts
setScanSessionState('starting');
```

After accepting the current `startedSession`:

```ts
session = startedSession;
setScanSessionState('active');
```

In the current-start error path:

```ts
setScanSessionState('idle');
```

In `stopActiveArSession()`:

```ts
setScanSessionState('idle');
```

When switching from marker to floor, set the marker presentation to idle before applying floor state:

```ts
setScanSessionState('idle');
```

- [ ] **Step 8: Run focused tests and verify GREEN**

Run:

```powershell
npm.cmd test -- tests/floorPlacementUi.test.ts tests/targetSpecificScanIntegration.test.ts tests/appShell.test.ts
```

Expected: all selected test files pass, including stale-start, session-end, error, and exact-target return cases.

- [ ] **Step 9: Commit**

```powershell
git add src/ui/appShell.ts src/ui/floorPlacementUi.ts src/main.ts tests/floorPlacementUi.test.ts tests/targetSpecificScanIntegration.test.ts tests/appShell.test.ts
git commit -m "fix: add a persistent floor mode return action"
```

---

### Task 4: Shared Visual Tokens and Desktop Composition

**Files:**

- Create: `tests/uiSystemStyles.test.ts`
- Modify: `tests/appShell.test.ts`
- Modify: `tests/floorPlacementStyles.test.ts`
- Modify: `src/ui/appShell.ts`
- Modify: `src/style.css:1-2148`

**Interfaces:**

- Produces CSS tokens:
  - `--radius-control`, `--radius-card`, `--control-height`
  - `--space-1` through `--space-8`
  - `--shadow-card`, `--shadow-float`
  - `--display`, `--sans`, `--utility`
- Produces variants:
  - `.action-control--primary`
  - `.action-control--secondary`
  - `.action-control--quiet`
  - `.action-control--danger`
  - `.action-control--inverse`
- Preserves existing element IDs and functional selectors.

- [ ] **Step 1: Write failing tests for tokens, control variants, and desktop Home**

Create `tests/uiSystemStyles.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

function cssRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm').exec(css)?.groups?.body ?? '';
}

describe('shared UI system styles', () => {
  it('defines the shared palette, typography, spacing, shape, and control tokens', () => {
    const root = cssRule(':root');

    expect(root).toContain('--ink: #102326');
    expect(root).toContain('--paper: #f4fbfa');
    expect(root).toContain('--teal-dark: #0f766e');
    expect(root).toContain('--teal: #5eead4');
    expect(root).toContain('--gold: #fbbf24');
    expect(root).toContain('--danger: #b91c1c');
    expect(root).toContain('--radius-control: 8px');
    expect(root).toContain('--radius-card: 12px');
    expect(root).toContain('--control-height: 44px');
    expect(root).toContain('--display:');
    expect(root).toContain('--utility:');
  });

  it('provides coherent action variants and a shared focus ring', () => {
    expect(cssRule('.action-control')).toContain('min-height: var(--control-height)');
    expect(cssRule('.action-control--primary')).toContain('background: var(--teal)');
    expect(cssRule('.action-control--secondary')).toContain('border-color: var(--line-strong)');
    expect(cssRule('.action-control--quiet')).toContain('background: transparent');
    expect(cssRule('.action-control--danger')).toContain('color: var(--danger)');
    expect(cssRule('.action-control--inverse')).toContain('color: #ffffff');
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid/m);
  });

  it('uses three equal Home destination columns on desktop', () => {
    expect(cssRule('.mode-picker')).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
  });

  it('aligns the Home copy, workflow, preview, and mode cards to named desktop areas', () => {
    const landing = cssRule('.landing-inner');

    expect(landing).toContain('grid-template-areas:');
    expect(cssRule('.landing-copy')).toContain('grid-area: copy');
    expect(cssRule('.landing-flow')).toContain('grid-area: flow');
    expect(cssRule('.landing-preview')).toContain('grid-area: preview');
    expect(cssRule('.mode-picker')).toContain('grid-area: modes');
  });
});
```

Update `tests/floorPlacementStyles.test.ts` to expect:

```ts
const floorBack = cssRule('.floor-ar-back');
expect(floorBack).toContain('top: max(14px, env(safe-area-inset-top))');
expect(floorBack).toContain('left: 14px');
expect(floorBack).toContain('min-height: 44px');
expect(css).toMatch(
  /\.floor-ar-back:focus-visible,\s*\.floor-ar-controls button:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--gold\)/m,
);
```

Add to `tests/appShell.test.ts`:

```ts
expect(container.querySelector('#start-ar')?.classList.contains('action-control--primary')).toBe(true);
expect(container.querySelector('#floor-ar-toggle')?.classList.contains('action-control--secondary')).toBe(true);
expect(container.querySelector('#floor-ar-back')?.classList.contains('action-control--inverse')).toBe(true);
expect(container.querySelector('#save-image-target')?.classList.contains('action-control--primary')).toBe(true);
expect(container.querySelector('#refresh-image-targets')?.classList.contains('action-control--secondary')).toBe(true);
expect(container.querySelector('#worker-login')?.classList.contains('action-control--primary')).toBe(true);
```

- [ ] **Step 2: Run style tests and verify RED**

Run:

```powershell
npm.cmd test -- tests/uiSystemStyles.test.ts tests/floorPlacementStyles.test.ts
```

Expected: failures for missing tokens, variants, assigned action classes, named Home areas, three-column mode grid, and floor-back styles.

- [ ] **Step 3: Add shared tokens**

Extend `:root` in `src/style.css`:

```css
:root {
  --ink: #102326;
  --muted: rgba(16, 35, 38, 0.7);
  --soft: rgba(16, 35, 38, 0.52);
  --paper: #f4fbfa;
  --panel: rgba(255, 255, 255, 0.84);
  --panel-strong: rgba(255, 255, 255, 0.96);
  --line: rgba(15, 118, 110, 0.16);
  --line-strong: rgba(15, 118, 110, 0.3);
  --teal: #5eead4;
  --teal-dark: #0f766e;
  --gold: #fbbf24;
  --danger: #b91c1c;
  --radius-control: 8px;
  --radius-card: 12px;
  --control-height: 44px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --shadow-card: 0 16px 42px rgba(15, 118, 110, 0.12);
  --shadow-float: 0 22px 70px rgba(15, 118, 110, 0.16);
  --display: "Arial Black", "Segoe UI Black", "Segoe UI", sans-serif;
  --sans: "Segoe UI Variable Text", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  --utility: "Cascadia Mono", "SFMono-Regular", Consolas, monospace;
}
```

Set `h1`, `.page-header h2`, and prominent card headings to `font-family: var(--display)`. Keep body/form/navigation text on `var(--sans)` and technical status labels on `var(--utility)`.

- [ ] **Step 4: Consolidate action control styling**

Add:

```css
.action-control {
  min-height: var(--control-height);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  padding: 9px 13px;
  font: 850 14px/1.2 var(--sans);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  text-decoration: none;
}

.action-control--primary {
  color: #031b18;
  background: var(--teal);
  box-shadow: var(--shadow-card);
}

.action-control--secondary {
  border-color: var(--line-strong);
  color: var(--ink);
  background: var(--panel-strong);
}

.action-control--quiet {
  border-color: transparent;
  color: var(--muted);
  background: transparent;
  box-shadow: none;
}

.action-control--danger {
  border-color: rgba(185, 28, 28, 0.28);
  color: var(--danger);
  background: rgba(254, 226, 226, 0.9);
}

.action-control--inverse {
  border-color: rgba(94, 234, 212, 0.34);
  color: #ffffff;
  background: rgba(2, 7, 11, 0.78);
  box-shadow: none;
}

button,
.primary-link {
  min-height: var(--control-height);
  border-radius: var(--radius-control);
}

button.primary,
#start-ar,
#worker-login,
.primary-link {
  color: #031b18;
  background: var(--teal);
  box-shadow: var(--shadow-card);
}

button:disabled,
[aria-disabled="true"] {
  cursor: not-allowed;
  opacity: 0.58;
}

[aria-busy="true"] button:disabled {
  cursor: progress;
}
```

Apply these complete class attributes in `src/ui/appShell.ts`:

```html
<button id="start-ar" class="action-control action-control--primary" type="button">Start AR</button>
<button id="floor-ar-toggle" class="action-control action-control--secondary" type="button" hidden>Place on floor</button>
<button id="save-image-target" class="action-control action-control--primary" type="button">Save target</button>
<button id="new-image-target" class="action-control action-control--secondary" type="button" hidden>New target</button>
<button id="refresh-image-targets" class="action-control action-control--secondary" type="button">Refresh targets</button>
<button id="worker-login" class="action-control action-control--primary auth-primary-action" type="submit">
  <span data-auth-submit-label>Sign in</span>
</button>
```

Keep the existing ID selectors temporarily where dynamic components depend on them, but derive colors, radii, heights, and shadows from the shared tokens.

Remove compact overrides that reduce general interactive targets below the shared height:

```css
.target-page button,
.target-page .target-inspector-tabs button {
  min-height: var(--control-height);
}

.target-page .icon-delete-button {
  width: var(--control-height);
  min-width: var(--control-height);
  min-height: var(--control-height);
}
```

Keep `.target-model-card` exempt because it is a fixed square model-selection tile with its own accessible label and size token.

- [ ] **Step 5: Correct desktop composition and spacing**

Use:

```css
.landing-inner {
  display: grid;
  grid-template-areas:
    "copy preview"
    "flow preview"
    "modes modes";
  grid-template-columns: minmax(0, 1.12fr) minmax(290px, 0.88fr);
  gap: var(--space-6) clamp(24px, 4vw, 60px);
  align-items: center;
}

.landing-copy { grid-area: copy; }
.landing-flow { grid-area: flow; }
.landing-preview { grid-area: preview; }

.mode-picker {
  grid-area: modes;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}

.shell-nav,
.scanner-panel,
.tool-card,
.mode-card,
.landing-preview,
.auth-access-card {
  border-radius: var(--radius-card);
}

.page-header {
  align-items: start;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.page-heading-copy {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}
```

Update standard content and workspace outer widths only through `.page` and `.target-page`, preserving 1040 and 1180 pixels respectively.

- [ ] **Step 6: Style the floor return control**

Add:

```css
.floor-ar-back {
  position: absolute;
  top: max(14px, env(safe-area-inset-top));
  left: 14px;
  z-index: 2;
  min-height: 44px;
  pointer-events: auto;
  backdrop-filter: blur(12px);
}

.floor-ar-back:focus-visible,
.floor-ar-controls button:focus-visible {
  outline: 3px solid var(--gold);
  outline-offset: 2px;
}
```

Keep the gesture surface below the return control and the bottom tray through their z-index values.

- [ ] **Step 7: Run style and affected component tests and verify GREEN**

Run:

```powershell
npm.cmd test -- tests/uiSystemStyles.test.ts tests/floorPlacementStyles.test.ts tests/appShell.test.ts tests/targetPreviewDesktopStyles.test.ts
```

Expected: all selected test files pass.

- [ ] **Step 8: Commit**

```powershell
git add src/style.css src/ui/appShell.ts tests/uiSystemStyles.test.ts tests/floorPlacementStyles.test.ts tests/appShell.test.ts
git commit -m "style: unify the desktop studio interface"
```

---

### Task 5: Mobile Bottom Navigation and Responsive Workspaces

**Files:**

- Create: `tests/responsiveNavigationStyles.test.ts`
- Modify: `tests/targetPreviewMobileStyles.test.ts`
- Modify: `tests/savedTargetEditingIntegration.test.ts`
- Modify: `src/ui/appShell.ts:131`
- Modify: `src/main.ts:543-553, 2240-2310`
- Modify: `src/style.css:2090-2410`

**Interfaces:**

- Consumes: `data-layout-viewport="mobile|desktop"` from Task 2.
- Consumes: `data-active-page`, `data-ar-mode`, and `data-scan-session` from existing routing and Task 3.
- Produces: fixed four-item mobile route bar and safe-area content clearance.
- Produces: compact mobile page headings and task-first Scan, Targets, Account, and Home layouts.

- [ ] **Step 1: Write failing mobile shell and immersive-state style tests**

Create `tests/responsiveNavigationStyles.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

function mediaBlock(query: string): string {
  const start = css.indexOf(`@media ${query}`);
  if (start < 0) return '';
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(open + 1, index);
  }
  return '';
}

function cssRule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm').exec(source)?.groups?.body ?? '';
}

describe('responsive navigation styles', () => {
  const mobile = mediaBlock('(max-width: 760px)');

  it('uses a compact brand bar and fixed four-item bottom navigation', () => {
    expect(cssRule(mobile, '.shell-nav')).toContain('min-height: 52px');
    expect(cssRule(mobile, '.route-tabs')).toContain('position: fixed');
    expect(cssRule(mobile, '.route-tabs')).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
    expect(cssRule(mobile, '.route-tabs')).toContain('bottom: 0');
    expect(cssRule(mobile, '.app-shell')).toContain('env(safe-area-inset-bottom)');
    expect(cssRule(mobile, '.route-tabs a')).toContain('min-height: 56px');
  });

  it('hides global navigation during marker startup and floor mode', () => {
    expect(mobile).toContain('[data-active-page="scan"][data-scan-session="starting"] .route-tabs');
    expect(mobile).toContain('[data-active-page="scan"][data-scan-session="active"] .route-tabs');
    expect(mobile).toContain('[data-ar-mode="floor"] .route-tabs');
    expect(mobile).toContain('display: none');
  });

  it('keeps page Home controls compact instead of full width', () => {
    const homeLink = cssRule(mobile, '.page-home-link');
    expect(homeLink).toContain('width: fit-content');
    expect(homeLink).toContain('min-height: 44px');
  });

  it('uses task-first mobile sizing for the camera, preview, and account form', () => {
    expect(cssRule(mobile, '.scanner-controls')).toContain('border-radius: var(--radius-card)');
    expect(cssRule(mobile, '.ar-stage')).toContain('min-height: min(58svh, 520px)');
    expect(cssRule(mobile, '.target-preview-stage')).toContain('height: clamp(300px, 48svh, 420px)');
    expect(cssRule(mobile, '.auth-control-card')).toContain('min-height: 0');
  });

  it('makes the save strip sticky only for an active target draft', () => {
    expect(mobile).toContain('[data-has-target-draft="true"] .target-save-strip');
    expect(cssRule(mobile, '[data-has-target-draft="true"] .target-save-strip')).toContain(
      'position: sticky',
    );
  });
});
```

In `tests/savedTargetEditingIntegration.test.ts`, extend the existing edit/new-mode assertions:

```ts
expect(document.querySelector('[data-page="targets"]')?.getAttribute('data-has-target-draft')).toBe('true');
```

after a saved target is loaded, and:

```ts
expect(document.querySelector('[data-page="targets"]')?.getAttribute('data-has-target-draft')).toBe('false');
```

after `#new-image-target` resets the editor.

- [ ] **Step 2: Run mobile style tests and verify RED**

Run:

```powershell
npm.cmd test -- tests/responsiveNavigationStyles.test.ts tests/targetPreviewMobileStyles.test.ts tests/savedTargetEditingIntegration.test.ts
```

Expected: failures because the navigation is still a two-row top bar, the 760-pixel mobile workspace rules are absent, and target draft state is not published.

- [ ] **Step 3: Replace the 900/760 mobile shell rules with one 760-pixel navigation system**

In `src/style.css`, keep the 900-pixel workspace collapse for tablets, but move shell navigation behavior to:

```css
@media (max-width: 760px) {
  html,
  body {
    max-width: 100%;
    overflow-x: clip;
  }

  .app-shell {
    width: 100%;
    padding:
      max(12px, env(safe-area-inset-top))
      12px
      calc(84px + env(safe-area-inset-bottom));
  }

  .shell-nav {
    top: max(8px, env(safe-area-inset-top));
    flex-direction: row;
    align-items: center;
    min-height: 52px;
    justify-content: center;
    padding: 6px 10px;
  }

  .brand-link {
    min-height: 40px;
    justify-content: center;
  }

  .route-tabs {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 40;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 2px;
    width: 100%;
    padding: 6px 8px max(6px, env(safe-area-inset-bottom));
    border-top: 1px solid var(--line-strong);
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 -14px 38px rgba(15, 118, 110, 0.14);
    backdrop-filter: blur(16px);
  }

  .route-tabs a {
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    min-height: 56px;
    padding: 6px 4px;
    border-radius: var(--radius-control);
    font-size: 11px;
  }

  .route-icon {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  [data-active-page="scan"][data-scan-session="starting"] .route-tabs,
  [data-active-page="scan"][data-scan-session="active"] .route-tabs,
  [data-ar-mode="floor"] .route-tabs {
    display: none;
  }
}
```

Delete the old `@media (max-width: 900px)` shell rules that set `.shell-nav` to a column and the old `@media (max-width: 620px)` rule that makes `.page-header` a single-column full-width Back bar. Keep the tablet workspace-collapse rules and compact phone preview/tool rules that do not conflict with the new shell.

- [ ] **Step 4: Add compact mobile headings and Home destination rows**

Within the same media block:

```css
.page {
  margin-top: var(--space-4);
}

.page-header {
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-3);
  align-items: start;
}

.page-home-link {
  width: fit-content;
  min-height: 44px;
  padding: 8px 10px;
}

.page-header h2,
.target-page .page-header h2 {
  font-size: clamp(30px, 10vw, 40px);
}

.landing-inner {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-areas: none;
  gap: var(--space-4);
}

.landing-copy,
.landing-flow,
.landing-preview,
.mode-picker {
  grid-area: auto;
}

.mode-picker {
  grid-template-columns: 1fr;
}

.mode-card {
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 4px 12px;
  min-height: 92px;
  align-items: center;
}

.mode-card > span {
  grid-row: 1 / span 2;
}

.mode-card > strong,
.mode-card > small {
  grid-column: 2;
}

.mode-card > em {
  grid-column: 3;
  grid-row: 1 / span 2;
}

.landing-preview {
  min-height: 180px;
}
```

- [ ] **Step 5: Add task-first Scan, Targets, and Account sizing**

Within the 760-pixel block:

```css
.scanner-panel {
  display: grid;
  gap: var(--space-3);
  overflow: visible;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.scanner-controls {
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  padding: var(--space-3);
  box-shadow: var(--shadow-card);
}

.scanner-stage-stack {
  overflow: hidden;
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-float);
}

.ar-stage {
  min-height: min(58svh, 520px);
  aspect-ratio: 3 / 4;
}

.target-workspace {
  grid-template-columns: 1fr;
  gap: var(--space-3);
}

.target-inspector-card {
  height: auto;
  max-height: none;
}

[data-has-target-draft="true"] .target-save-strip {
  position: sticky;
  bottom: calc(72px + env(safe-area-inset-bottom));
  z-index: 8;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: var(--shadow-card);
}

.target-preview-stage {
  height: clamp(300px, 48svh, 420px);
}

.target-inspector-tabs button,
.target-page button {
  min-height: 44px;
}

.auth-control-card {
  min-height: 0;
}

.auth-access-card {
  min-height: 300px;
}
```

When `.route-tabs` is hidden for immersive Scan, let the sticky target strip rule remain irrelevant because the active route is not Targets.

- [ ] **Step 6: Publish target draft state for the sticky save strip**

In `src/main.ts`, query the page once:

```ts
const targetPage = queryRequired<HTMLElement>('[data-page="targets"]');
```

Initialize the markup in `src/ui/appShell.ts`:

```html
<section
  class="page target-page"
  data-page="targets"
  data-has-target-draft="false"
  hidden
  aria-label="Cloud image targets"
>
```

At the end of `syncTargetSaveMode()`:

```ts
targetPage.dataset.hasTargetDraft = String(Boolean(editingTarget || targetImagePayload));
```

Call `syncTargetSaveMode()` after a new file payload is captured:

```ts
targetImagePayload = await imageFileToCapturedImage(file);
syncTargetSaveMode();
```

The existing calls in `loadSavedImageTarget()` and `resetImageTargetEditor()` then cover edit and reset transitions.

- [ ] **Step 7: Update the existing target preview mobile test**

In `tests/targetPreviewMobileStyles.test.ts`, read the `(max-width: 760px)` block for workspace dimensions and retain the `(max-width: 620px)` assertions only for the denser transform-toolbar/model-rail adjustments:

```ts
const mobileWorkspace = mediaBlock('(max-width: 760px)');
const compactPhone = mediaBlock('(max-width: 620px)');

expect(cssRule(mobileWorkspace, '.target-preview-stage')).toContain(
  'height: clamp(300px, 48svh, 420px)',
);
expect(cssRule(compactPhone, '.target-preview-controls')).toContain('position: static');
```

- [ ] **Step 8: Extend reduced-motion coverage**

In the existing reduced-motion block:

```css
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  .mode-card,
  .route-tabs a,
  .floor-ar-back,
  .floor-ar-controls,
  button {
    animation: none;
    transition: none;
  }
}
```

- [ ] **Step 9: Run responsive style and layout tests and verify GREEN**

Run:

```powershell
npm.cmd test -- tests/responsiveNavigationStyles.test.ts tests/responsiveLayout.test.ts tests/targetPreviewMobileStyles.test.ts tests/savedTargetEditingIntegration.test.ts tests/uiSystemStyles.test.ts tests/floorPlacementStyles.test.ts
```

Expected: all selected test files pass.

- [ ] **Step 10: Commit**

```powershell
git add src/ui/appShell.ts src/main.ts src/style.css tests/responsiveNavigationStyles.test.ts tests/targetPreviewMobileStyles.test.ts tests/savedTargetEditingIntegration.test.ts
git commit -m "style: add task-first mobile navigation"
```

---

### Task 6: Full Regression and Rendered Navigation Verification

**Files:**

- Modify only if verification exposes a regression:
  - `src/ui/appShell.ts`
  - `src/ui/pageRouter.ts`
  - `src/ui/responsiveLayout.ts`
  - `src/ui/floorPlacementUi.ts`
  - `src/main.ts`
  - `src/style.css`
  - their focused test files

**Interfaces:**

- Verifies all earlier task interfaces together.
- Produces no new runtime API.

- [ ] **Step 1: Run every focused navigation/UI test**

Run:

```powershell
npm.cmd test -- tests/appShell.test.ts tests/pageRoutes.test.ts tests/pageRouter.test.ts tests/authNavigation.test.ts tests/authUi.test.ts tests/responsiveLayout.test.ts tests/floorPlacementUi.test.ts tests/floorPlacementStyles.test.ts tests/targetSpecificScanIntegration.test.ts tests/uiSystemStyles.test.ts tests/responsiveNavigationStyles.test.ts tests/targetPreviewDesktopStyles.test.ts tests/targetPreviewMobileStyles.test.ts
```

Expected: all selected files pass with zero failed tests.

- [ ] **Step 2: Run the full test suite**

Run:

```powershell
npm.cmd test
```

Expected: all Vitest files and tests pass.

- [ ] **Step 3: Run the normal production build**

Run:

```powershell
npm.cmd run build
```

Expected: TypeScript and Vite complete with exit code 0.

- [ ] **Step 4: Run the GitHub Pages build**

Run:

```powershell
$env:GITHUB_PAGES = 'true'
npm.cmd run build
Remove-Item Env:GITHUB_PAGES
```

Expected: build exits 0 and Vite reports the `/Mark-AR/` base build without unresolved assets.

- [ ] **Step 5: Launch the local app for rendered checks**

Run:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Use the available browser-control surface or installed Chrome headless/CDP to inspect:

- `#/`
- `#/scan`
- `#/account`
- an injected authenticated `#/targets` page state
- injected `floor-scanning`, `floor-ready`, `floor-placed`, `floor-ended`, and `floor-error` states

Check at:

- 1440 by 1000
- 1024 by 768
- 768 by 1024
- 390 by 844
- 320 by 700

- [ ] **Step 6: Verify route and interaction behavior**

For each rendered viewport:

- Home, Scan, Targets, and Account are understandable and reachable.
- The active route is visually and semantically selected.
- Home links from Scan, Targets, and Account go to `#/`.
- Signed-out Targets routes to Account and retains its locked explanation.
- Scan status/action controls precede the stage on mobile.
- Targets setup/save precede the preview on mobile.
- Account form precedes the security explanation on mobile.
- No document has horizontal overflow.
- Keyboard Tab reaches controls in visible order.
- Focus rings are visible on route links, Home links, forms, tabs, scanner actions, and the floor return action.

- [ ] **Step 7: Verify the floor return in every state**

Inject or reach each floor state and confirm:

- `Back to image scan` stays at the top-left safe area.
- The placement tray never covers it.
- The external scanner strip and global mobile route bar are hidden.
- The return action remains enabled after session end and runtime error.
- Selecting it calls the existing same-target marker restart path.

On physical Android Chrome/WebXR hardware when available, repeat floor scanning, placement, reset, session end, and return. If hardware is unavailable, report that limitation explicitly rather than claiming the physical smoke test passed.

- [ ] **Step 8: Review the final diff against the approved specification**

Run:

```powershell
git diff --check 4b12674..HEAD
git status --short
```

Confirm:

- no unrelated files are modified;
- `.codex-remote-attachments/` and `.playwright-cli/` remain untracked and untouched;
- no route, API, scene, persistence, or authentication semantics changed;
- every acceptance criterion maps to a passing test or rendered check.

- [ ] **Step 9: Commit any verification-only corrections**

If verification required code corrections, repeat the affected RED/GREEN cycle and commit:

```powershell
git add src/ui/appShell.ts src/ui/pageRouter.ts src/ui/responsiveLayout.ts src/ui/floorPlacementUi.ts src/main.ts src/style.css tests/appShell.test.ts tests/pageRouter.test.ts tests/responsiveLayout.test.ts tests/floorPlacementUi.test.ts tests/floorPlacementStyles.test.ts tests/targetSpecificScanIntegration.test.ts tests/uiSystemStyles.test.ts tests/responsiveNavigationStyles.test.ts tests/targetPreviewDesktopStyles.test.ts tests/targetPreviewMobileStyles.test.ts
git commit -m "fix: resolve responsive navigation regressions"
```

If no corrections were needed, do not create an empty commit.

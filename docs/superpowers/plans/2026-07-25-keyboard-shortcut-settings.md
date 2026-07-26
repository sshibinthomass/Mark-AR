# Keyboard Shortcut Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only keyboard shortcut Settings page that is visible and accessible only to signed-in users.

**Architecture:** A typed immutable catalog in `src/app` is the single source of truth for shortcut copy, while a focused renderer in `src/ui` turns that catalog into semantic HTML. Existing hash routing and authentication navigation protect the new route, and the application shell owns its authenticated-only tab and page container.

**Tech Stack:** TypeScript, Vite, Vitest with jsdom, semantic HTML, existing Arvenilo CSS tokens.

## Global Constraints

- The feature is documentation and navigation only; do not add shortcut remapping, configurable increments, profiles, or preference persistence.
- Display only shortcuts already implemented in AnchorAR Studio.
- The Settings tab and route are available only while authentication state is `signed-in`.
- A blocked direct `#/settings` request must restore after a valid saved session or successful sign-in.
- Unknown hashes must continue to resolve to Home.
- Preserve existing Home, Scan, Studio, and Account behavior.
- Keep unrelated untracked workspace files untouched.

---

## File Structure

- Create `src/app/keyboardShortcuts.ts`: immutable shortcut types and catalog.
- Create `src/ui/keyboardSettings.ts`: semantic Settings-page HTML renderer.
- Create `tests/keyboardSettings.test.ts`: catalog completeness and renderer accessibility.
- Modify `src/ui/pageRoutes.ts`: add the `settings` route.
- Modify `src/ui/authUi.ts`: protect Settings and toggle its navigation tab.
- Modify `src/ui/appShell.ts`: add the Settings tab and page.
- Modify `src/main.ts`: redirect Settings to Account on logout.
- Modify `src/styles/arvenilo-redesign.css`: Settings cards, shortcut rows, `<kbd>` presentation, and responsive layout.
- Modify `tests/pageRoutes.test.ts`: Settings hash parsing and generation.
- Modify `tests/authUi.test.ts`: Settings route guard and authenticated-only tab visibility.
- Modify `tests/authNavigation.test.ts`: blocked Settings restoration.
- Modify `tests/pageRouter.test.ts`: Settings page activation and blocking.
- Modify `tests/appShell.test.ts`: route-tab order and Settings markup.
- Modify `tests/responsiveNavigationStyles.test.ts`: five-tab mobile navigation and single-column Settings cards.
- Modify `tests/targetSpecificScanIntegration.test.ts`: logout redirect from Settings.

---

### Task 1: Typed Shortcut Catalog and Semantic Renderer

**Files:**

- Create: `src/app/keyboardShortcuts.ts`
- Create: `src/ui/keyboardSettings.ts`
- Create: `tests/keyboardSettings.test.ts`

**Interfaces:**

- Produces: `ShortcutSectionId`, `KeyboardShortcut`, `KeyboardShortcutSection`, and `keyboardShortcutSections`.
- Produces: `renderKeyboardSettings(sections?: readonly KeyboardShortcutSection[]): string`.
- Consumes: only static application-owned strings; no API or browser state.

- [ ] **Step 1: Write the failing catalog and renderer tests**

Create `tests/keyboardSettings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { keyboardShortcutSections } from '../src/app/keyboardShortcuts';
import { renderKeyboardSettings } from '../src/ui/keyboardSettings';

describe('keyboard shortcut Settings', () => {
  it('catalogs every currently implemented shortcut and no proposed actions', () => {
    expect(keyboardShortcutSections.map((section) => section.id)).toEqual([
      'object-movement',
      'transform-tools',
      'camera-views',
    ]);
    expect(keyboardShortcutSections.flatMap((section) => (
      section.shortcuts.map(({ action, keys }) => ({ action, keys: [...keys] }))
    ))).toEqual([
      { action: 'Move selected objects left', keys: ['Arrow Left'] },
      { action: 'Move selected objects right', keys: ['Arrow Right'] },
      { action: 'Move selected objects forward', keys: ['Arrow Up'] },
      { action: 'Move selected objects backward', keys: ['Arrow Down'] },
      { action: 'Raise selected objects', keys: ['Page Up'] },
      { action: 'Lower selected objects', keys: ['Page Down'] },
      { action: 'Remove selected objects', keys: ['Delete'] },
      { action: 'Activate Move', keys: ['W', 'G'] },
      { action: 'Activate Rotate', keys: ['E'] },
      { action: 'Activate Scale', keys: ['R', 'S'] },
      { action: 'Finish the interaction and return to Move', keys: ['Escape', 'Enter'] },
      { action: 'Front view', keys: ['1'] },
      { action: 'Right view', keys: ['3'] },
      { action: 'Top view', keys: ['7'] },
      { action: 'Home view', keys: ['0', 'F'] },
    ]);
    expect(JSON.stringify(keyboardShortcutSections)).not.toMatch(
      /undo|redo|duplicate|hide|lock|play animation/i,
    );
  });

  it('renders sectioned semantic lists, key labels, and scope guidance', () => {
    const container = document.createElement('div');
    container.innerHTML = renderKeyboardSettings();

    expect(container.querySelectorAll('.keyboard-shortcut-card')).toHaveLength(3);
    expect(container.querySelectorAll('.keyboard-shortcut-row')).toHaveLength(15);
    expect([...container.querySelectorAll('kbd')].map((key) => key.textContent)).toEqual([
      'Arrow Left', 'Arrow Right', 'Arrow Up', 'Arrow Down', 'Page Up', 'Page Down', 'Delete',
      'W', 'G', 'E', 'R', 'S', 'Escape', 'Enter', '1', '3', '7', '0', 'F',
    ]);
    expect(container.querySelector('.keyboard-settings-intro')?.textContent).toContain(
      'selection shortcuts work across Studio',
    );
    expect(container.textContent).toContain('Not while typing or editing a form');
    expect(container.textContent).toContain('3D preview focus required');
    expect(container.querySelectorAll('.keyboard-shortcut-list')).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npx vitest run tests/keyboardSettings.test.ts
```

Expected: FAIL because `src/app/keyboardShortcuts.ts` and `src/ui/keyboardSettings.ts` do not exist.

- [ ] **Step 3: Add the immutable shortcut catalog**

Create `src/app/keyboardShortcuts.ts`:

```ts
export type ShortcutSectionId = 'object-movement' | 'transform-tools' | 'camera-views';

export type KeyboardShortcut = Readonly<{
  action: string;
  keys: readonly string[];
  scope: string;
}>;

export type KeyboardShortcutSection = Readonly<{
  id: ShortcutSectionId;
  label: string;
  description: string;
  shortcuts: readonly KeyboardShortcut[];
}>;

const studioSelectionScope = 'Selection required. Not while typing or editing a form.';
const previewScope = '3D preview focus required.';

export const keyboardShortcutSections: readonly KeyboardShortcutSection[] = [
  {
    id: 'object-movement',
    label: 'Object movement',
    description: 'Move or remove the current Studio selection.',
    shortcuts: [
      { action: 'Move selected objects left', keys: ['Arrow Left'], scope: studioSelectionScope },
      { action: 'Move selected objects right', keys: ['Arrow Right'], scope: studioSelectionScope },
      { action: 'Move selected objects forward', keys: ['Arrow Up'], scope: studioSelectionScope },
      { action: 'Move selected objects backward', keys: ['Arrow Down'], scope: studioSelectionScope },
      { action: 'Raise selected objects', keys: ['Page Up'], scope: studioSelectionScope },
      { action: 'Lower selected objects', keys: ['Page Down'], scope: studioSelectionScope },
      { action: 'Remove selected objects', keys: ['Delete'], scope: studioSelectionScope },
    ],
  },
  {
    id: 'transform-tools',
    label: 'Transform tools',
    description: 'Switch tools or finish the current direct interaction.',
    shortcuts: [
      { action: 'Activate Move', keys: ['W', 'G'], scope: previewScope },
      { action: 'Activate Rotate', keys: ['E'], scope: previewScope },
      { action: 'Activate Scale', keys: ['R', 'S'], scope: previewScope },
      {
        action: 'Finish the interaction and return to Move',
        keys: ['Escape', 'Enter'],
        scope: previewScope,
      },
    ],
  },
  {
    id: 'camera-views',
    label: 'Camera views',
    description: 'Jump to a standard view of the target.',
    shortcuts: [
      { action: 'Front view', keys: ['1'], scope: previewScope },
      { action: 'Right view', keys: ['3'], scope: previewScope },
      { action: 'Top view', keys: ['7'], scope: previewScope },
      { action: 'Home view', keys: ['0', 'F'], scope: previewScope },
    ],
  },
] as const;
```

- [ ] **Step 4: Add the semantic renderer**

Create `src/ui/keyboardSettings.ts`:

```ts
import {
  keyboardShortcutSections,
  type KeyboardShortcutSection,
} from '../app/keyboardShortcuts';

export function renderKeyboardSettings(
  sections: readonly KeyboardShortcutSection[] = keyboardShortcutSections,
): string {
  return `
    <div class="keyboard-settings">
      <p class="keyboard-settings-intro">
        Studio-wide selection shortcuts work across Studio when an object is selected.
        Tool and camera shortcuts work while the 3D preview has focus.
      </p>
      <div class="keyboard-settings-grid">
        ${sections.map(renderSection).join('')}
      </div>
    </div>
  `;
}

function renderSection(section: KeyboardShortcutSection): string {
  const headingId = `keyboard-shortcuts-${section.id}`;
  return `
    <section class="keyboard-shortcut-card" aria-labelledby="${headingId}">
      <header>
        <p class="eyebrow">Keyboard</p>
        <h3 id="${headingId}">${section.label}</h3>
        <p>${section.description}</p>
      </header>
      <ul class="keyboard-shortcut-list">
        ${section.shortcuts.map((shortcut) => `
          <li class="keyboard-shortcut-row">
            <span class="keyboard-shortcut-keys" aria-label="${shortcut.keys.join(' or ')}">
              ${shortcut.keys.map((key) => `<kbd>${key}</kbd>`).join('<span aria-hidden="true">or</span>')}
            </span>
            <span class="keyboard-shortcut-copy">
              <strong>${shortcut.action}</strong>
              <small>${shortcut.scope}</small>
            </span>
          </li>
        `).join('')}
      </ul>
    </section>
  `;
}
```

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```powershell
npx vitest run tests/keyboardSettings.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 6: Commit the catalog and renderer**

```powershell
git add -- src/app/keyboardShortcuts.ts src/ui/keyboardSettings.ts tests/keyboardSettings.test.ts
git commit -m "feat: catalog keyboard shortcuts"
```

---

### Task 2: Authenticated Settings Route, Tab, and Page

**Files:**

- Modify: `src/ui/pageRoutes.ts`
- Modify: `src/ui/authUi.ts`
- Modify: `src/ui/appShell.ts`
- Modify: `tests/pageRoutes.test.ts`
- Modify: `tests/authUi.test.ts`
- Modify: `tests/authNavigation.test.ts`
- Modify: `tests/pageRouter.test.ts`
- Modify: `tests/appShell.test.ts`

**Interfaces:**

- Consumes: `renderKeyboardSettings(): string` from Task 1.
- Extends: `AppRoute` with `'settings'`.
- Produces: authenticated-only `[data-auth-settings]` tab immediately before Account.
- Preserves: `AuthNavigation` pending-route behavior without adding route-specific state.

- [ ] **Step 1: Write failing route and authentication tests**

Update `tests/pageRoutes.test.ts` assertions to require:

```ts
expect(PAGE_ROUTES).toEqual(['home', 'scan', 'targets', 'settings', 'account']);
expect(routeFromHash('#/settings')).toBe('settings');
expect(hrefForRoute('settings')).toBe('#/settings');
expect(locationFromHash('#/settings/ignored')).toEqual({ route: 'settings' });
```

Extend the protected-route test in `tests/authUi.test.ts`:

```ts
expect(resolveAccessibleRoute('settings', signedOut)).toBe('account');
expect(resolveAccessibleRoute('settings', checking)).toBe('account');
expect(resolveAccessibleRoute('settings', signedIn)).toBe('settings');
```

Add this tab-visibility test to `tests/authUi.test.ts`:

```ts
it('shows the Settings tab only for signed-in users', () => {
  const root = document.createElement('div');
  root.innerHTML = renderAppShell();
  const settingsLink = root.querySelector<HTMLElement>('[data-auth-settings]');

  applyAuthUi(root, checking);
  expect(settingsLink?.hidden).toBe(true);
  applyAuthUi(root, signedOut);
  expect(settingsLink?.hidden).toBe(true);
  applyAuthUi(root, signedIn);
  expect(settingsLink?.hidden).toBe(false);
});
```

Add to `tests/authNavigation.test.ts`:

```ts
it('guards a direct Settings request and restores it after authentication', () => {
  const navigation = new AuthNavigation();
  const root = renderRouteFixture();

  expect(navigation.activate(root, 'settings', signedOut)).toEqual({
    activeRoute: 'account',
    blocked: true,
  });
  expect(navigation.takePending(signedOut)).toBeUndefined();
  expect(navigation.takePending(signedIn)).toBe('settings');
});
```

Add `<section data-page="settings" hidden></section>` to that test fixture.

Add signed-out and signed-in Settings cases to `tests/pageRouter.test.ts`:

```ts
it('blocks Settings while signed out and activates it while signed in', () => {
  const root = document.createElement('main');
  root.innerHTML = `
    <section data-page="settings" hidden><h2 data-page-heading tabindex="-1">Settings</h2></section>
    <section data-page="account"></section>
  `;

  expect(activateAccessibleRoute(root, 'settings', signedOut)).toEqual({
    activeRoute: 'account',
    blocked: true,
  });
  expect(activateAccessibleRoute(root, 'settings', signedIn)).toEqual({
    activeRoute: 'settings',
    blocked: false,
  });
  expect(root.dataset.activePage).toBe('settings');
});
```

- [ ] **Step 2: Write failing shell integration assertions**

Update `tests/appShell.test.ts` to expect the route tabs and pages in this order:

```ts
expect(
  [...container.querySelectorAll<HTMLAnchorElement>('.route-tabs a')].map((link) => ({
    route: link.dataset.routeLink,
    hidden: link.hidden,
  })),
).toEqual([
  { route: 'home', hidden: false },
  { route: 'scan', hidden: false },
  { route: 'targets', hidden: false },
  { route: 'settings', hidden: true },
  { route: 'account', hidden: false },
]);

expect(
  [...container.querySelectorAll<HTMLElement>('[data-page]')].map((page) => page.dataset.page),
).toEqual(['home', 'scan', 'targets', 'settings', 'account']);
expect(container.querySelector('#settings-page-title')?.textContent).toBe('Keyboard settings');
expect(container.querySelectorAll('[data-page="settings"] .keyboard-shortcut-row')).toHaveLength(15);
```

Also update the heading list to include:

```ts
{ id: 'settings-page-title', text: 'Keyboard settings', tabIndex: -1 }
```

immediately before the Account heading.

- [ ] **Step 3: Run the focused tests to verify they fail**

Run:

```powershell
npx vitest run tests/pageRoutes.test.ts tests/authUi.test.ts tests/authNavigation.test.ts tests/pageRouter.test.ts tests/appShell.test.ts
```

Expected: FAIL because `settings` is not an `AppRoute` and the shell has no Settings tab or page.

- [ ] **Step 4: Add Settings to the route model and authentication boundary**

Change `PAGE_ROUTES` in `src/ui/pageRoutes.ts`:

```ts
export const PAGE_ROUTES = ['home', 'scan', 'targets', 'settings', 'account'] as const;
```

Update `resolveAccessibleRoute` and `applyAuthUi` in `src/ui/authUi.ts`:

```ts
export function resolveAccessibleRoute(route: AppRoute, state: AuthUiState): AppRoute {
  const protectedRoute = route === 'targets' || route === 'settings';
  return protectedRoute && !isAuthenticated(state) ? 'account' : route;
}
```

Inside `applyAuthUi`, after assigning `root.dataset.authState`, add:

```ts
root.querySelectorAll<HTMLElement>('[data-auth-settings]').forEach((link) => {
  link.hidden = !authenticated;
});
```

No `AuthNavigation` production change is needed: it already records any requested route when `activateAccessibleRoute` reports `blocked`.

- [ ] **Step 5: Add the authenticated-only tab and Settings page to the shell**

Import the renderer in `src/ui/appShell.ts`:

```ts
import { renderKeyboardSettings } from './keyboardSettings';
```

Add the settings icon to `routeIconPaths`:

```ts
settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1.03H3v-4h.05A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.05V3h4v.05a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.95 10H21v4h-.05A1.7 1.7 0 0 0 19.4 15Z"/>',
```

Insert the Settings link immediately before Account:

```ts
${renderRouteLink('settings', 'Settings')}
```

Make only that route link initially hidden:

```ts
function renderRouteLink(route: AppRoute, label: string): string {
  if (route === 'targets') {
    // Keep the existing protected Studio link implementation.
  }
  const authAttributes = route === 'settings' ? ' data-auth-settings hidden' : '';
  return `<a href="${hrefForRoute(route)}" data-route-link="${route}"${authAttributes}>${renderRouteLabel(route, label)}</a>`;
}
```

Insert this page section immediately before the Account page:

```ts
<section class="page settings-page" data-page="settings" hidden aria-label="Keyboard settings">
  ${renderPageHeader(
    'settings',
    'Keyboard settings',
    'A quick reference for the keyboard controls available in AnchorAR Studio.',
  )}
  ${renderKeyboardSettings()}
</section>
```

- [ ] **Step 6: Run the focused tests and verify they pass**

Run:

```powershell
npx vitest run tests/pageRoutes.test.ts tests/authUi.test.ts tests/authNavigation.test.ts tests/pageRouter.test.ts tests/appShell.test.ts tests/keyboardSettings.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit routing, authentication, and shell integration**

```powershell
git add -- src/ui/pageRoutes.ts src/ui/authUi.ts src/ui/appShell.ts tests/pageRoutes.test.ts tests/authUi.test.ts tests/authNavigation.test.ts tests/pageRouter.test.ts tests/appShell.test.ts
git commit -m "feat: add authenticated keyboard settings page"
```

---

### Task 3: Logout Redirect and Responsive Presentation

**Files:**

- Modify: `src/main.ts`
- Modify: `src/styles/arvenilo-redesign.css`
- Modify: `tests/targetSpecificScanIntegration.test.ts`
- Modify: `tests/responsiveNavigationStyles.test.ts`

**Interfaces:**

- Consumes: `[data-page="settings"]`, `.keyboard-settings-grid`, `.keyboard-shortcut-card`, and `.keyboard-shortcut-row` from Tasks 1 and 2.
- Preserves: existing session teardown and route activation.

- [ ] **Step 1: Add a failing logout integration test**

In `tests/targetSpecificScanIntegration.test.ts`, use its existing authenticated-session mocks and main-module setup, then add:

```ts
it('redirects to Account when a signed-in user logs out from Settings', async () => {
  authMocks.loadWorkerAuthToken.mockReturnValue('token-123');
  authMocks.getCurrentWebArUser.mockResolvedValue({
    email: 'viewer@example.com',
    role: 'user',
    status: 'active',
  });
  window.history.replaceState(null, '', '#/settings');

  await import('../src/main');
  await waitFor(() => required('[data-app-shell]').getAttribute('data-active-page') === 'settings');

  required<HTMLButtonElement>('#worker-logout').click();
  await waitFor(() => required('[data-app-shell]').getAttribute('data-active-page') === 'account');

  expect(window.location.hash).toBe('#/account');
  expect(required<HTMLElement>('[data-auth-settings]').hidden).toBe(true);
});
```

- [ ] **Step 2: Add failing responsive style assertions**

Update the existing mobile-navigation expectation in `tests/responsiveNavigationStyles.test.ts`:

```ts
expect(cssRule(mobile, '.route-tabs')).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))');
```

Add:

```ts
it('lays out Settings cards responsively and gives keys a visible affordance', () => {
  expect(cssRule(css, '.keyboard-settings-grid')).toContain('grid-template-columns');
  expect(cssRule(css, '.keyboard-shortcut-row')).toContain('display: grid');
  expect(cssRule(css, '.keyboard-shortcut-keys kbd')).toContain('border');
  expect(cssRule(mobile, '.keyboard-settings-grid')).toContain('grid-template-columns: 1fr');
  expect(cssRule(mobile, '.keyboard-shortcut-row')).toContain('grid-template-columns: 1fr');
});
```

- [ ] **Step 3: Run the focused tests to verify they fail**

Run:

```powershell
npx vitest run tests/targetSpecificScanIntegration.test.ts tests/responsiveNavigationStyles.test.ts
```

Expected: FAIL because logout does not redirect from Settings, mobile navigation still has four columns, and Settings styles do not exist.

- [ ] **Step 4: Redirect protected Settings on logout**

Change the logout guard in `src/main.ts`:

```ts
if (shell.dataset.activePage === 'targets' || shell.dataset.activePage === 'settings') {
  window.location.hash = hrefForRoute('account');
}
```

This keeps the existing token clearing, pending-route clearing, form reset, auth-state update, and cloud refresh behavior unchanged.

- [ ] **Step 5: Add desktop and mobile Settings styles**

Add to `src/styles/arvenilo-redesign.css` before its responsive blocks:

```css
.keyboard-settings {
  display: grid;
  gap: var(--space-6);
}

.keyboard-settings-intro {
  max-width: 68ch;
  color: var(--color-context-slate);
}

.keyboard-settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
  gap: var(--space-5);
  align-items: start;
}

.keyboard-shortcut-card {
  padding: var(--space-5);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-card);
  background: var(--color-interface-white);
  box-shadow: none;
}

.keyboard-shortcut-card h3,
.keyboard-shortcut-card p {
  margin: 0;
}

.keyboard-shortcut-card header {
  display: grid;
  gap: var(--space-2);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border-light);
}

.keyboard-shortcut-list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.keyboard-shortcut-row {
  display: grid;
  grid-template-columns: minmax(8.5rem, auto) 1fr;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--color-border-light);
}

.keyboard-shortcut-row:last-child {
  border-bottom: 0;
}

.keyboard-shortcut-keys,
.keyboard-shortcut-copy {
  display: flex;
  gap: var(--space-2);
}

.keyboard-shortcut-keys {
  align-items: center;
  flex-wrap: wrap;
}

.keyboard-shortcut-copy {
  flex-direction: column;
}

.keyboard-shortcut-copy small {
  color: var(--color-context-slate);
}

.keyboard-shortcut-keys kbd {
  min-width: 2rem;
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--color-border-dark);
  border-bottom-width: 3px;
  border-radius: var(--radius-control);
  background: var(--color-reality-mist);
  color: var(--color-spatial-ink);
  font: inherit;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
}
```

Inside the existing `@media (max-width: 767px)` block, change:

```css
.route-tabs {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}
```

and add:

```css
.keyboard-settings-grid,
.keyboard-shortcut-row {
  grid-template-columns: 1fr;
}

.keyboard-shortcut-card {
  padding: var(--space-4);
}
```

- [ ] **Step 6: Run focused Settings, routing, and presentation tests**

Run:

```powershell
npx vitest run tests/keyboardSettings.test.ts tests/pageRoutes.test.ts tests/authUi.test.ts tests/authNavigation.test.ts tests/pageRouter.test.ts tests/appShell.test.ts tests/responsiveNavigationStyles.test.ts tests/targetSpecificScanIntegration.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit logout and visual presentation**

```powershell
git add -- src/main.ts src/styles/arvenilo-redesign.css tests/targetSpecificScanIntegration.test.ts tests/responsiveNavigationStyles.test.ts
git commit -m "feat: finish keyboard settings experience"
```

---

### Task 4: Full Verification and Browser Check

**Files:**

- Verify only; change files only when a failing check exposes a Settings regression.

**Interfaces:**

- Verifies all deliverables from Tasks 1–3 together.

- [ ] **Step 1: Run the complete root test suite**

Run:

```powershell
npx vitest run --exclude=.worktrees/** --maxWorkers=4
```

Expected: all root-project test files and tests PASS.

- [ ] **Step 2: Run the production build**

Run:

```powershell
npm run build
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 3: Verify the authenticated-only browser flow**

With the existing local Vite app:

1. Open `http://127.0.0.1:5175/#/settings` while signed out and confirm Account is active and Settings is absent from navigation.
2. Sign in with an available local test account, or use the existing saved authenticated session if present.
3. Confirm Settings appears immediately before Account, opens `#/settings`, shows 15 shortcut rows in three cards, and the page heading receives focus.
4. Confirm the layout is readable at desktop and narrow mobile widths.
5. Sign out from Settings and confirm the route becomes `#/account` and the Settings tab disappears.

- [ ] **Step 4: Inspect the final diff**

Run:

```powershell
git diff --check
git status --short
git log --oneline -8
```

Expected: no whitespace errors; only intended tracked changes and the pre-existing unrelated untracked files remain.

- [ ] **Step 5: Request an independent code review**

Use `superpowers:requesting-code-review` against the branch diff. Address findings through `superpowers:receiving-code-review`, rerun the focused tests, full suite, and build, then make a separate fix commit if needed.

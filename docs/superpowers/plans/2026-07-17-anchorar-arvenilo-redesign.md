# AnchorAR by Arvenilo Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the complete visible Mark/Marker AR interface with the approved story-first **AnchorAR by Arvenilo** experience while preserving every existing route, editor, scanner, authentication, QR, and floor-placement behavior.

**Architecture:** Keep the framework-free Vite/TypeScript application and its existing DOM hooks. Add a small brand-asset helper, a focused homepage-section navigation controller, a canonical token/font stylesheet loaded before the legacy functional CSS, and an Arvenilo redesign stylesheet loaded after it. Recompose the shell and homepage in `appShell.ts`, then apply route-specific visual and copy changes without changing APIs, stored data, route values, or AR runtime code.

**Tech Stack:** TypeScript 6, Vite 8, Vitest with happy-dom, Three.js 0.150.1, vendored MindAR, WebXR, CSS, local WOFF2 fonts, approved PNG brand assets.

## Global Constraints

- The complete visible product name is **AnchorAR by Arvenilo**; **AnchorAR** is allowed only after the endorsement is established.
- The authenticated creation route is visibly named **AnchorAR Studio** while its route remains `#/targets`.
- Remove visible `Mark AR`, `Marker AR`, `Marker Web AR`, `Marker AR studio`, and unnecessary `Web-AR Worker`/`Cloudflare` implementation language.
- Do not rename package `mark-ar`, GitHub Pages base `/Mark-AR/`, hash routes, local-storage keys, API endpoints, or internal Cloudflare types.
- Preserve every existing element ID, `data-*` behavior hook, form name, live region, route value, and event binding used outside the changed markup.
- Use only approved handoff logo PNGs without recoloring, cropping, filtering, shadowing, glowing, or redrawing them.
- Use canonical UI values: Spatial Ink `#081D21`, Signal Mint `#5EEAD4`, Reality Mist `#F4FBFA`, Digital Violet `#7456F1`, Anchor Gold `#F4B942`, Context Slate `#4D6265`.
- Use Sora for display, Inter for text/UI, and IBM Plex Mono for utility/status labels, all from local handoff files.
- Anchor Gold marks one selected spatial focus and is never a normal CTA color.
- Minimum interactive target: 44 by 44 pixels. Focus ring: 3-pixel Signal Mint with 3-pixel offset. Target WCAG 2.2 AA.
- Responsive checkpoints: 320, 390, 768, 1024, 1440, and 1920 pixels.
- Respect `prefers-reduced-motion`; keep essential labels and controls outside canvas/camera content.
- Do not add a UI framework, CSS framework, remote font dependency, analytics service, backend change, or new product feature.

---

## File Structure

### New files

- `src/assets/fonts/sora-latin-wght-normal.woff2` — bundled Sora variable font.
- `src/assets/fonts/inter-latin-wght-normal.woff2` — bundled Inter variable roman font.
- `src/assets/fonts/inter-latin-wght-italic.woff2` — bundled Inter variable italic font.
- `src/assets/fonts/ibm-plex-mono-latin-400-normal.woff2` — bundled IBM Plex Mono regular font.
- `src/assets/fonts/ibm-plex-mono-latin-500-normal.woff2` — bundled IBM Plex Mono medium font.
- `src/assets/fonts/LICENSE-Sora.txt`, `LICENSE-Inter.txt`, `LICENSE-IBM-Plex-Mono.txt` — retained source licenses.
- `public/brand/anchorar/anchorar-mark.png` — approved compact AnchorAR mark.
- `public/brand/arvenilo/arvenilo-lockup.png` — approved corporate footer lockup.
- `src/styles/arvenilo-tokens.css` — `@font-face`, canonical color/type/space/radius/width/motion tokens, global focus and reduced-motion foundation.
- `src/styles/arvenilo-redesign.css` — all brand shell, homepage, route, component, state, and responsive overrides; loaded last so equal-specificity rules replace legacy presentation deterministically.
- `src/app/brandAssets.ts` — base-path-safe approved brand URLs.
- `src/ui/homeSectionNavigation.ts` — Product/Use cases links that route Home, then focus and scroll to the correct semantic section.
- `tests/arveniloBrandFoundation.test.ts` — metadata, font/license, asset, and token contract.
- `tests/brandAssets.test.ts` — base-path-safe asset URL contract.
- `tests/homeSectionNavigation.test.ts` — homepage section navigation behavior.
- `tests/arveniloRedesignStyles.test.ts` — brand, homepage, route, component, responsive, focus, and reduced-motion CSS contract.

### Modified files

- `index.html` — title, description, favicon, theme color.
- `src/main.ts` — CSS import order, section-navigation setup, and customer-facing studio/status copy.
- `src/ui/appShell.ts` — approved logo shell, story-first homepage, route headings, visible product terminology, preserved application hooks.
- `src/ui/responsiveLayout.ts` — 767-pixel breakpoint and removal of obsolete legacy-home reordering.
- `src/ui/authFormMode.ts` — AnchorAR account headings.
- `src/app/authMessages.ts` — AnchorAR Studio access and account messages.
- `tests/appShell.test.ts` — new shell/home/route structure and terminology.
- `tests/responsiveLayout.test.ts` — new homepage natural order and 767-pixel contract.
- `tests/authFormMode.test.ts`, `tests/authMessages.test.ts` — renamed customer-facing messages.
- `tests/uiSystemStyles.test.ts`, `tests/responsiveNavigationStyles.test.ts` — canonical stylesheet sources and new token/breakpoint expectations.
- `tests/targetQrIntegration.test.ts`, `tests/savedTargetEditingIntegration.test.ts` — renamed success messages where the visible backend name is removed.

---

### Task 1: Install Approved Assets, Metadata, and Canonical Tokens

**Files:**
- Create: `src/assets/fonts/*`
- Create: `public/brand/anchorar/anchorar-mark.png`
- Create: `public/brand/arvenilo/arvenilo-lockup.png`
- Create: `src/styles/arvenilo-tokens.css`
- Create: `tests/arveniloBrandFoundation.test.ts`
- Modify: `index.html:4-12`
- Modify: `src/main.ts:1`

**Interfaces:**
- Consumes: approved source files under `Arvenilo-Design-Handoff/03-Logos/Transparent-PNG/` and `04-Fonts/`.
- Produces: local font family names `Sora Variable`, `Inter Variable`, and `IBM Plex Mono`; CSS custom properties prefixed `--color-`, `--font-`, `--text-`, `--space-`, `--radius-`, `--content-`, and `--ease-`; public brand paths used by Task 2.

- [ ] **Step 1: Write the failing brand-foundation test**

```ts
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readOrEmpty = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';
const tokens = readOrEmpty('src/styles/arvenilo-tokens.css');
const html = readFileSync('index.html', 'utf8');

describe('Arvenilo brand foundation', () => {
  it('uses AnchorAR metadata and the approved compact mark', () => {
    expect(html).toContain('<title>AnchorAR by Arvenilo</title>');
    expect(html).toContain('Interactive web-based augmented reality experiences');
    expect(html).toContain('%BASE_URL%brand/anchorar/anchorar-mark.png');
    expect(html).not.toContain('<title>Mark AR</title>');
  });

  it('bundles the approved logos, fonts, and licenses', () => {
    [
      'public/brand/anchorar/anchorar-mark.png',
      'public/brand/arvenilo/arvenilo-lockup.png',
      'public/brand/qr/04-anchorar-platform-transparent-QR.png',
      'src/assets/fonts/sora-latin-wght-normal.woff2',
      'src/assets/fonts/inter-latin-wght-normal.woff2',
      'src/assets/fonts/inter-latin-wght-italic.woff2',
      'src/assets/fonts/ibm-plex-mono-latin-400-normal.woff2',
      'src/assets/fonts/ibm-plex-mono-latin-500-normal.woff2',
      'src/assets/fonts/LICENSE-Sora.txt',
      'src/assets/fonts/LICENSE-Inter.txt',
      'src/assets/fonts/LICENSE-IBM-Plex-Mono.txt',
    ].forEach((path) => expect(existsSync(path), path).toBe(true));
  });

  it('declares the canonical Arvenilo token contract', () => {
    expect(tokens).toContain('font-family: "Sora Variable"');
    expect(tokens).toContain('font-family: "Inter Variable"');
    expect(tokens).toContain('font-family: "IBM Plex Mono"');
    expect(tokens).toContain('--color-spatial-ink: #081d21');
    expect(tokens).toContain('--color-signal-mint: #5eead4');
    expect(tokens).toContain('--color-reality-mist: #f4fbfa');
    expect(tokens).toContain('--color-digital-violet: #7456f1');
    expect(tokens).toContain('--color-anchor-gold: #f4b942');
    expect(tokens).toContain('--radius-control: 10px');
    expect(tokens).toContain('--radius-card: 16px');
    expect(tokens).toContain('--radius-stage: 24px');
    expect(tokens).toContain('--content-max: 1600px');
  });
});
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run: `npx vitest run tests/arveniloBrandFoundation.test.ts`

Expected: FAIL assertions for missing token content/assets and legacy `Mark AR` metadata; the test process itself loads without a missing-file error.

- [ ] **Step 3: Copy the approved binary assets and licenses**

Run these exact PowerShell commands from the repository root:

```powershell
New-Item -ItemType Directory -Force 'src\assets\fonts', 'public\brand\anchorar', 'public\brand\arvenilo'
Copy-Item 'Arvenilo-Design-Handoff\04-Fonts\Sora\sora-latin-wght-normal.woff2' 'src\assets\fonts\sora-latin-wght-normal.woff2'
Copy-Item 'Arvenilo-Design-Handoff\04-Fonts\Inter\inter-latin-wght-normal.woff2' 'src\assets\fonts\inter-latin-wght-normal.woff2'
Copy-Item 'Arvenilo-Design-Handoff\04-Fonts\Inter\inter-latin-wght-italic.woff2' 'src\assets\fonts\inter-latin-wght-italic.woff2'
Copy-Item 'Arvenilo-Design-Handoff\04-Fonts\IBM-Plex-Mono\ibm-plex-mono-latin-400-normal.woff2' 'src\assets\fonts\ibm-plex-mono-latin-400-normal.woff2'
Copy-Item 'Arvenilo-Design-Handoff\04-Fonts\IBM-Plex-Mono\ibm-plex-mono-latin-500-normal.woff2' 'src\assets\fonts\ibm-plex-mono-latin-500-normal.woff2'
Copy-Item 'Arvenilo-Design-Handoff\04-Fonts\Sora\LICENSE.txt' 'src\assets\fonts\LICENSE-Sora.txt'
Copy-Item 'Arvenilo-Design-Handoff\04-Fonts\Inter\LICENSE.txt' 'src\assets\fonts\LICENSE-Inter.txt'
Copy-Item 'Arvenilo-Design-Handoff\04-Fonts\IBM-Plex-Mono\LICENSE.txt' 'src\assets\fonts\LICENSE-IBM-Plex-Mono.txt'
Copy-Item 'Arvenilo-Design-Handoff\03-Logos\Transparent-PNG\04-anchorar-platform-transparent-logo.png' 'public\brand\anchorar\anchorar-mark.png'
Copy-Item 'Arvenilo-Design-Handoff\03-Logos\Transparent-PNG\00-arvenilo-master-transparent.png' 'public\brand\arvenilo\arvenilo-lockup.png'
```

- [ ] **Step 4: Create the token and font stylesheet**

Create `src/styles/arvenilo-tokens.css` with the complete handoff foundation:

```css
@font-face { font-family: "Sora Variable"; src: url("../assets/fonts/sora-latin-wght-normal.woff2") format("woff2"); font-style: normal; font-weight: 100 800; font-display: swap; }
@font-face { font-family: "Inter Variable"; src: url("../assets/fonts/inter-latin-wght-normal.woff2") format("woff2"); font-style: normal; font-weight: 100 900; font-display: swap; }
@font-face { font-family: "Inter Variable"; src: url("../assets/fonts/inter-latin-wght-italic.woff2") format("woff2"); font-style: italic; font-weight: 100 900; font-display: swap; }
@font-face { font-family: "IBM Plex Mono"; src: url("../assets/fonts/ibm-plex-mono-latin-400-normal.woff2") format("woff2"); font-style: normal; font-weight: 400; font-display: swap; }
@font-face { font-family: "IBM Plex Mono"; src: url("../assets/fonts/ibm-plex-mono-latin-500-normal.woff2") format("woff2"); font-style: normal; font-weight: 500; font-display: swap; }

:root {
  color-scheme: light;
  --color-spatial-void: #020a0c;
  --color-spatial-ink: #081d21;
  --color-spatial-surface: #0d2a2e;
  --color-spatial-surface-raised: #12363a;
  --color-reality-mist: #f4fbfa;
  --color-interface-white: #ffffff;
  --color-signal-mint: #5eead4;
  --color-digital-violet: #7456f1;
  --color-anchor-gold: #f4b942;
  --color-context-slate: #4d6265;
  --color-mist-slate: #a8b9bb;
  --color-border-dark: #1d454a;
  --color-border-light: #c9dada;
  --color-mint-wash: #d8f8f2;
  --color-violet-wash: #e9e5ff;
  --color-gold-wash: #fff1cf;
  --color-error-dark: #b83e4b;
  --color-error-light: #ff9099;
  --font-display: "Sora Variable", "Sora", "Avenir Next", "Segoe UI", sans-serif;
  --font-text: "Inter Variable", "Inter", "Segoe UI Variable Text", "Segoe UI", sans-serif;
  --font-utility: "IBM Plex Mono", "Cascadia Mono", "SFMono-Regular", monospace;
  --text-display-xl: clamp(3.35rem, 6.7vw, 7.3rem);
  --text-display-lg: clamp(2.7rem, 5vw, 5.2rem);
  --text-heading-1: clamp(2.3rem, 4vw, 4rem);
  --text-heading-2: clamp(1.8rem, 3vw, 3rem);
  --text-heading-3: clamp(1.25rem, 2vw, 1.75rem);
  --text-body-lg: clamp(1.0625rem, 1.3vw, 1.25rem);
  --text-body: 1rem;
  --text-small: 0.875rem;
  --text-label: 0.75rem;
  --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem; --space-4: 1rem; --space-5: 1.5rem;
  --space-6: 2rem; --space-7: 3rem; --space-8: 4rem; --space-9: 6rem; --space-10: 8rem;
  --radius-control: 10px; --radius-card: 16px; --radius-stage: 24px; --radius-status: 999px;
  --content-reading: 720px; --content-standard: 1200px; --content-wide: 1440px; --content-max: 1600px;
  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --section-space: clamp(4.5rem, 8vw, 8rem);
}
```

- [ ] **Step 5: Update metadata and import order**

Set the head metadata to:

```html
<link rel="icon" type="image/png" href="%BASE_URL%brand/anchorar/anchorar-mark.png" />
<meta name="theme-color" content="#F4FBFA" />
<meta name="description" content="Interactive web-based augmented reality experiences created with AnchorAR by Arvenilo." />
<title>AnchorAR by Arvenilo</title>
```

Change the first CSS imports in `src/main.ts` to:

```ts
import './styles/arvenilo-tokens.css';
import './style.css';
import './styles/arvenilo-redesign.css';
```

Create an empty `src/styles/arvenilo-redesign.css`; Tasks 6 and 7 fill it after their tests fail.

- [ ] **Step 6: Run the focused test and commit**

Run: `npx vitest run tests/arveniloBrandFoundation.test.ts`

Expected: PASS, 3 tests.

Commit:

```powershell
git add index.html src/main.ts src/styles/arvenilo-tokens.css src/styles/arvenilo-redesign.css src/assets/fonts public/brand/anchorar public/brand/arvenilo tests/arveniloBrandFoundation.test.ts
git commit -m "feat: install AnchorAR brand foundation"
```

---

### Task 2: Add Base-Path-Safe Brand Assets and the Global Shell

**Files:**
- Create: `src/app/brandAssets.ts`
- Create: `tests/brandAssets.test.ts`
- Modify: `src/ui/appShell.ts:1-63, 517-567`
- Modify: `tests/appShell.test.ts:5-65, 327-328`

**Interfaces:**
- Consumes: public asset paths created in Task 1 and existing `hrefForRoute()`.
- Produces: `brandAssetUrls(baseUrl?: string): BrandAssetUrls`, `.shell-story-links`, `[data-home-section-link]`, approved logo markup, and route labels Home/Scan/Studio/Account.

- [ ] **Step 1: Write failing brand URL and shell tests**

```ts
import { describe, expect, it } from 'vitest';
import { brandAssetUrls } from '../src/app/brandAssets';

describe('brandAssetUrls', () => {
  it('keeps approved assets under the active deployment base', () => {
    expect(brandAssetUrls('/Mark-AR/')).toEqual({
      productLockup: '/Mark-AR/brand/qr/04-anchorar-platform-transparent-QR.png',
      productMark: '/Mark-AR/brand/anchorar/anchorar-mark.png',
      companyLockup: '/Mark-AR/brand/arvenilo/arvenilo-lockup.png',
    });
    expect(brandAssetUrls('/').productMark).toBe('/brand/anchorar/anchorar-mark.png');
  });
});
```

Add these assertions to `tests/appShell.test.ts`:

```ts
expect(container.querySelector<HTMLImageElement>('.brand-link img')).toMatchObject({
  alt: 'AnchorAR by Arvenilo',
});
expect(container.querySelector('.brand-link img')?.getAttribute('src')).toContain(
  'brand/qr/04-anchorar-platform-transparent-QR.png',
);
expect([...container.querySelectorAll('[data-home-section-link]')].map((link) => [
  link.textContent?.trim(),
  (link as HTMLElement).dataset.homeSectionLink,
])).toEqual([
  ['Product', 'product'],
  ['Use cases', 'use-cases'],
]);
expect([...container.querySelectorAll('.route-tabs a')].map((link) => link.textContent?.trim())).toEqual([
  'Home', 'Scan', 'Studio', 'Sign in',
]);
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npx vitest run tests/brandAssets.test.ts tests/appShell.test.ts`

Expected: FAIL because the helper, logo image, story links, and Studio label do not exist.

- [ ] **Step 3: Implement the asset helper**

```ts
export type BrandAssetUrls = {
  productLockup: string;
  productMark: string;
  companyLockup: string;
};

export function brandAssetUrls(baseUrl = import.meta.env.BASE_URL): BrandAssetUrls {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return {
    productLockup: `${base}brand/qr/04-anchorar-platform-transparent-QR.png`,
    productMark: `${base}brand/anchorar/anchorar-mark.png`,
    companyLockup: `${base}brand/arvenilo/arvenilo-lockup.png`,
  };
}
```

- [ ] **Step 4: Replace only the global navigation markup and route labels**

Import `brandAssetUrls`, create `const brandAssets = brandAssetUrls()`, and render this shell structure while retaining the existing pages below it:

```ts
<nav class="shell-nav" aria-label="AnchorAR pages">
  <a class="brand-link" href="${hrefForRoute('home')}" aria-label="AnchorAR by Arvenilo home">
    <img src="${brandAssets.productLockup}" alt="AnchorAR by Arvenilo" />
  </a>
  <div class="shell-nav-actions">
    <div class="shell-story-links" aria-label="Product information">
      <a href="${hrefForRoute('home')}" data-home-section-link="product">Product</a>
      <a href="${hrefForRoute('home')}" data-home-section-link="use-cases">Use cases</a>
    </div>
    <div class="route-tabs">
      ${renderRouteLink('home', 'Home')}
      ${renderRouteLink('scan', 'Scan')}
      ${renderRouteLink('targets', 'Studio')}
      ${renderRouteLink('account', '<span data-auth-account-label>Sign in</span>')}
    </div>
  </div>
</nav>
```

Keep Targets protected exactly as before; change only visible `Targets` labels to `Studio` and the protected-link accessible label to `Studio — sign in required`.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run tests/brandAssets.test.ts tests/appShell.test.ts tests/authNavigation.test.ts tests/pageRouter.test.ts`

Expected: PASS.

Commit:

```powershell
git add src/app/brandAssets.ts src/ui/appShell.ts tests/brandAssets.test.ts tests/appShell.test.ts
git commit -m "feat: add AnchorAR branded application shell"
```

---

### Task 3: Build the Story-First Homepage and Responsive DOM Order

**Files:**
- Modify: `src/ui/appShell.ts:10-100`
- Modify: `src/ui/responsiveLayout.ts:1-21`
- Modify: `tests/appShell.test.ts:23-82`
- Modify: `tests/responsiveLayout.test.ts:5-85`

**Interfaces:**
- Consumes: brand URLs and route links from Task 2.
- Produces: semantic sections `#product`, `#anchorar-proof`, `#anchorar-gateway`, `#use-cases`, `#capabilities`, `#trust`, and `#arvenilo`; preserves `.mode-picker` and its protected Studio link.

- [ ] **Step 1: Write failing homepage structure assertions**

```ts
expect([...container.querySelectorAll<HTMLElement>('.landing-page [data-home-section]')].map((section) => section.id)).toEqual([
  'product',
  'anchorar-proof',
  'anchorar-gateway',
  'use-cases',
  'capabilities',
  'trust',
  'arvenilo',
]);
expect(container.querySelector('#home-page-title')?.textContent).toBe('Interactive stories, anchored in reality.');
expect(container.querySelector('[data-product-status]')?.textContent).toContain('AVAILABLE NOW');
expect(container.querySelector('.story-hero-actions [href="#/targets"]')?.textContent).toContain('Create an experience');
expect(container.querySelector('.story-hero-actions [href="#/scan"]')?.textContent).toContain('Open scanner');
expect([...container.querySelectorAll('.proof-step strong')].map((node) => node.textContent)).toEqual(['Anchor', 'Compose', 'Share']);
expect([...container.querySelectorAll('.use-case-card h3')].map((node) => node.textContent)).toEqual([
  'Packaging and products', 'Retail visualization', 'Campaigns and events', 'Learning and storytelling',
]);
expect(container.querySelectorAll('[data-auth-protected]')).toHaveLength(3);
```

In `tests/responsiveLayout.test.ts`, remove legacy `.landing-inner` expectations and assert that Home is never reordered:

```ts
const before = [...root.querySelectorAll('[data-home-section]')];
applyResponsiveLayout(root, true);
expect([...root.querySelectorAll('[data-home-section]')]).toEqual(before);
expect(root.dataset.layoutViewport).toBe('mobile');
```

- [ ] **Step 2: Run the tests and verify the expected failure**

Run: `npx vitest run tests/appShell.test.ts tests/responsiveLayout.test.ts`

Expected: FAIL on the missing story sections and legacy landing layout expectations.

- [ ] **Step 3: Replace the legacy homepage with the approved section sequence**

Use these exact headings and action labels:

```html
<section id="product" class="story-hero" data-home-section tabindex="-1">
  <img class="story-hero-lockup" src="${brandAssets.productLockup}" alt="AnchorAR by Arvenilo" />
  <p class="eyebrow" data-product-status>AnchorAR by Arvenilo · Available now</p>
  <h1 id="home-page-title" data-page-heading tabindex="-1">Interactive stories, anchored in reality.</h1>
  <p class="story-hero-lede">Use an image, product, or place to open a web-based AR experience—no app required.</p>
  <div class="story-hero-actions">
    <a class="action-control action-control--primary" href="#/account" data-auth-protected data-auth-locked="true" data-unlocked-href="#/targets">Create an experience</a>
    <a class="action-control action-control--secondary" href="#/scan">Open scanner</a>
  </div>
</section>
```

Follow it with:

- `#anchorar-proof`: heading `From a physical signal to an immersive layer.`, a semantic ordered list with Anchor/Compose/Share descriptions, and an `aria-hidden` `.spatial-aperture-demo` containing `.aperture-frame`, `.aperture-object`, and `.aperture-signal`.
- `#anchorar-gateway`: heading `Start where you are.`, `.mode-picker`, and cards titled `Scan an experience`, `Create in AnchorAR Studio`, and `Access your account`.
- `#use-cases`: heading `Built for the moments people can already see.`, four use-case cards using the test titles.
- `#capabilities`: heading `One browser-based workflow.`, six real capability items from the approved spec.
- `#trust`: heading `The camera stays in your control.`, explicit camera permission and conditional WebXR support copy.
- `#arvenilo`: heading `Where Intelligence Meets Reality.`, the approved company lockup, and `AnchorAR is an Arvenilo product.`

Do not retain `.landing-flow`, `.landing-preview`, fake model status, or Cloudflare marketing copy.

- [ ] **Step 4: Update the responsive coordinator**

Set `MOBILE_QUERY` to `(max-width: 767px)`. Remove the `.landing-inner` `arrange()` call. Keep the scanner, target workspace, and account node movement unchanged so mobile DOM/focus order remains task-first.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run tests/appShell.test.ts tests/responsiveLayout.test.ts tests/responsiveNavigationStyles.test.ts`

Expected: app-shell and responsive-layout tests PASS; responsive-navigation may still fail until Task 6 updates its stylesheet source and breakpoint expectation, and that failure must be recorded rather than hidden.

Commit only after `tests/appShell.test.ts` and `tests/responsiveLayout.test.ts` pass:

```powershell
git add src/ui/appShell.ts src/ui/responsiveLayout.ts tests/appShell.test.ts tests/responsiveLayout.test.ts
git commit -m "feat: build story-first AnchorAR homepage"
```

---

### Task 4: Implement Product and Use-Case Section Navigation

**Files:**
- Create: `src/ui/homeSectionNavigation.ts`
- Create: `tests/homeSectionNavigation.test.ts`
- Modify: `src/main.ts:132-170, 860-905`

**Interfaces:**
- Consumes: `[data-home-section-link="product|use-cases"]`, the existing Home hash `#/`, and semantic section IDs from Task 3.
- Produces: `setupHomeSectionNavigation(root, effects?): { dispose(): void }`; no new hash routes.

- [ ] **Step 1: Write the failing controller tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { setupHomeSectionNavigation } from '../src/ui/homeSectionNavigation';

it('opens Home before revealing the requested section', () => {
  const root = fixture();
  const openHome = vi.fn();
  const reveal = vi.fn();
  const schedule = vi.fn((callback: () => void) => callback());
  const controller = setupHomeSectionNavigation(root, {
    isHome: () => false,
    openHome,
    schedule,
    reveal,
  });
  root.querySelector<HTMLAnchorElement>('[data-home-section-link="use-cases"]')!.click();
  expect(openHome).toHaveBeenCalledOnce();
  expect(reveal).toHaveBeenCalledWith(root.querySelector('#use-cases'));
  controller.dispose();
});

it('reveals immediately without replacing the current Home route', () => {
  const root = fixture();
  const openHome = vi.fn();
  const reveal = vi.fn();
  setupHomeSectionNavigation(root, {
    isHome: () => true,
    openHome,
    schedule: (callback) => callback(),
    reveal,
  });
  root.querySelector<HTMLAnchorElement>('[data-home-section-link="product"]')!.click();
  expect(openHome).not.toHaveBeenCalled();
  expect(reveal).toHaveBeenCalledWith(root.querySelector('#product'));
});

function fixture(): HTMLElement {
  const root = document.createElement('main');
  root.innerHTML = `
    <a href="#/" data-home-section-link="product">Product</a>
    <a href="#/" data-home-section-link="use-cases">Use cases</a>
    <section id="product" tabindex="-1"></section>
    <section id="use-cases" tabindex="-1"></section>
  `;
  return root;
}
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run tests/homeSectionNavigation.test.ts`

Expected: FAIL because `setupHomeSectionNavigation` does not exist.

- [ ] **Step 3: Implement the controller with injectable browser effects**

```ts
export type HomeSectionNavigationEffects = {
  isHome(): boolean;
  openHome(): void;
  schedule(callback: () => void): void;
  reveal(section: HTMLElement): void;
};

export function setupHomeSectionNavigation(
  root: HTMLElement,
  effects: HomeSectionNavigationEffects = browserEffects(root),
): { dispose(): void } {
  const listeners = [...root.querySelectorAll<HTMLAnchorElement>('[data-home-section-link]')].map((link) => {
    const onClick = (event: MouseEvent) => {
      event.preventDefault();
      const id = link.dataset.homeSectionLink;
      const section = id ? root.querySelector<HTMLElement>(`#${id}`) : null;
      if (!section) return;
      if (!effects.isHome()) effects.openHome();
      effects.schedule(() => effects.reveal(section));
    };
    link.addEventListener('click', onClick);
    return () => link.removeEventListener('click', onClick);
  });
  return { dispose: () => listeners.forEach((dispose) => dispose()) };
}

function browserEffects(root: HTMLElement): HomeSectionNavigationEffects {
  const view = root.ownerDocument.defaultView;
  return {
    isHome: () => root.dataset.activePage === 'home',
    openHome: () => {
      if (view) view.location.hash = '#/';
    },
    schedule: (callback) => {
      if (!view) {
        callback();
        return;
      }
      view.requestAnimationFrame(() => view.requestAnimationFrame(callback));
    },
    reveal: (section) => {
      const reducedMotion = view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      section.focus({ preventScroll: true });
      section.scrollIntoView?.({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
    },
  };
}
```

- [ ] **Step 4: Integrate once in `main.ts`**

After `app.innerHTML = renderAppShell()` and the shell query, call this once. The shell lives for the page lifetime, so there is no teardown registration:

```ts
setupHomeSectionNavigation(shell);
```

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run tests/homeSectionNavigation.test.ts tests/pageRoutes.test.ts tests/pageRouter.test.ts`

Expected: PASS.

Commit:

```powershell
git add src/ui/homeSectionNavigation.ts src/main.ts tests/homeSectionNavigation.test.ts
git commit -m "feat: navigate AnchorAR homepage sections"
```

---

### Task 5: Rename Product Routes, Account Copy, and User-Facing Status

**Files:**
- Modify: `src/ui/appShell.ts:101-567`
- Modify: `src/ui/authFormMode.ts:35`
- Modify: `src/app/authMessages.ts:5-13`
- Modify: `src/main.ts:1286, 1447, 2215-2240`
- Modify: `tests/appShell.test.ts`
- Modify: `tests/authFormMode.test.ts`
- Modify: `tests/authMessages.test.ts`
- Modify: `tests/targetQrIntegration.test.ts:320-362`
- Modify: `tests/savedTargetEditingIntegration.test.ts:271`

**Interfaces:**
- Consumes: all existing IDs, auth state transitions, target persistence responses, and route guards.
- Produces: stable visible vocabulary `Scan an experience`, `AnchorAR Studio`, `3D model`, `Saved to AnchorAR Studio`, and `Open AnchorAR Studio`.

- [ ] **Step 1: Change exact copy assertions first**

Update tests to require:

```ts
expect(pageHeadings).toEqual([
  { id: 'home-page-title', text: 'Interactive stories, anchored in reality.', tabIndex: -1 },
  { id: 'scan-page-title', text: 'Scan an experience', tabIndex: -1 },
  { id: 'targets-page-title', text: 'AnchorAR Studio', tabIndex: -1 },
  { id: 'account-page-title', text: 'Your account', tabIndex: -1 },
]);
expect(html).not.toMatch(/Marker AR|Marker Web AR|Web-AR Worker|Cloudflare ready/);
expect(container.querySelector('[data-auth-open-targets]')?.textContent).toContain('Open AnchorAR Studio');
```

Auth headings and messages become:

```ts
'Continue to AnchorAR'
'Create your AnchorAR account'
'Sign in with an approved account to use AnchorAR Studio.'
'Create an account for approval. You can open AnchorAR Studio after approval.'
'That email already has an AnchorAR account. Sign in instead, or use another email.'
```

Target persistence messages become `Target saved to AnchorAR Studio.` and `Target updated in AnchorAR Studio.`

- [ ] **Step 2: Run affected tests and verify they fail on old copy**

Run: `npx vitest run tests/appShell.test.ts tests/authFormMode.test.ts tests/authMessages.test.ts tests/targetQrIntegration.test.ts tests/savedTargetEditingIntegration.test.ts`

Expected: FAIL with old Marker/Worker/Cloudflare wording.

- [ ] **Step 3: Update only customer-facing strings**

Change route headings, helper text, ARIA labels, form headings, auth messages, saved-target statuses, model picker labels, and account actions to the asserted vocabulary. Retain internal type/function/module names such as `CloudflareModelOption`, `loadCloudflareModelOptions`, `cloudflareAsset`, and the storage key.

Use `3D model`, `model library`, or `saved experience` in customer copy. Keep a backend name only if a raw server error already supplies it and removing it would obscure diagnosis.

- [ ] **Step 4: Run focused tests and a visible-copy search**

Run:

```powershell
npx vitest run tests/appShell.test.ts tests/authFormMode.test.ts tests/authMessages.test.ts tests/targetQrIntegration.test.ts tests/savedTargetEditingIntegration.test.ts
rg -n -i 'Marker AR|Marker Web AR|Marker AR studio|Web-AR Worker|Cloudflare ready' index.html src -g '!src/vendor/**'
```

Expected: tests PASS; search returns no customer-facing legacy branding. Internal `Cloudflare*` code identifiers remain allowed.

- [ ] **Step 5: Commit**

```powershell
git add src/ui/appShell.ts src/ui/authFormMode.ts src/app/authMessages.ts src/main.ts tests/appShell.test.ts tests/authFormMode.test.ts tests/authMessages.test.ts tests/targetQrIntegration.test.ts tests/savedTargetEditingIntegration.test.ts
git commit -m "feat: rename product experience to AnchorAR"
```

---

### Task 6: Style the Global Shell and Story-First Homepage

**Files:**
- Modify: `src/styles/arvenilo-redesign.css`
- Create: `tests/arveniloRedesignStyles.test.ts`
- Modify: `tests/uiSystemStyles.test.ts`
- Modify: `tests/responsiveNavigationStyles.test.ts`

**Interfaces:**
- Consumes: Task 1 tokens and Task 3 semantic homepage classes.
- Produces: final global canvas, header, type hierarchy, actions, story hero, spatial proof, gateway, use cases, capability, trust, endorsement, desktop nav, mobile bottom nav, focus, and motion presentation.

- [ ] **Step 1: Write failing style-contract tests**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/arvenilo-redesign.css', 'utf8');

describe('AnchorAR redesign styles', () => {
  it('establishes the branded shell and editorial canvas', () => {
    expect(css).toContain('background: var(--color-reality-mist)');
    expect(css).toContain('font-family: var(--font-text)');
    expect(css).toMatch(/\.brand-link img\s*\{[^}]*object-fit:\s*contain/s);
    expect(css).toMatch(/\.shell-nav\s*\{[^}]*max-width:\s*var\(--content-max\)/s);
  });

  it('uses the approved story-first hierarchy', () => {
    expect(css).toMatch(/\.story-hero\s*\{[^}]*text-align:\s*center/s);
    expect(css).toMatch(/\.spatial-proof\s*\{[^}]*background:\s*var\(--color-spatial-ink\)/s);
    expect(css).toMatch(/\.aperture-signal\s*\{[^}]*border[^;]*var\(--color-anchor-gold\)/s);
    expect(css).toMatch(/\.mode-picker\s*\{[^}]*repeat\(3,/s);
  });

  it('uses mint for action and gold only for spatial focus', () => {
    expect(css).toMatch(/\.action-control--primary\s*\{[^}]*background:\s*var\(--color-signal-mint\)/s);
    expect(css).not.toMatch(/\.action-control--primary\s*\{[^}]*var\(--color-anchor-gold\)/s);
  });

  it('provides the 767px mobile shell and reduced motion', () => {
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*\.route-tabs\s*\{[\s\S]*position:\s*fixed/);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
```

Point `tests/uiSystemStyles.test.ts` at `arvenilo-tokens.css` for tokens and at the redesign stylesheet for component variants. Point `tests/responsiveNavigationStyles.test.ts` at the concatenated legacy plus redesign CSS and change its mobile query to `(max-width: 767px)`.

- [ ] **Step 2: Run the style tests and verify they fail**

Run: `npx vitest run tests/arveniloRedesignStyles.test.ts tests/uiSystemStyles.test.ts tests/responsiveNavigationStyles.test.ts`

Expected: FAIL because the redesign stylesheet is empty and old tests still inspect legacy values.

- [ ] **Step 3: Implement the branded global and homepage rules**

Add explicit rules for this selector inventory:

```css
html, body, .app-shell, .shell-nav, .brand-link, .brand-link img,
.shell-nav-actions, .shell-story-links, .shell-story-links a, .route-tabs,
.route-tabs a, .page, .landing-page, .story-hero, .story-hero-lockup,
.story-hero h1, .story-hero-lede, .story-hero-actions, .action-control,
.action-control--primary, .action-control--secondary, .action-control--quiet,
.action-control--inverse, .action-control--danger, .spatial-proof,
.spatial-proof-inner, .proof-steps, .proof-step, .spatial-aperture-demo,
.aperture-frame, .aperture-object, .aperture-signal, .product-gateway,
.mode-picker, .mode-card, .use-cases-section, .use-case-grid,
.use-case-card, .capability-section, .capability-grid, .capability-item,
.trust-section, .home-endorsement, .home-endorsement img
```

The exact presentation contract is:

- `body`: Reality Mist, Inter, no decorative gradient, Spatial Ink text.
- `.app-shell`: maximum 1600 pixels with 48/64-pixel desktop gutters.
- `.shell-nav`: solid white, one-pixel Light Border, 16-pixel radius, no backdrop blur, max width `var(--content-max)`.
- `.brand-link img`: width `clamp(150px, 15vw, 224px)`, height 42 pixels, `object-fit: contain`.
- `.story-hero`: centered, minimum `calc(100svh - 112px)`, maximum text width 920 pixels, section spacing from tokens.
- `.story-hero h1`: Sora 650, `var(--text-display-lg)`, maximum 12 characters-per-line equivalent (`max-width: 12ch`).
- `.spatial-proof`: Spatial Ink background, white text, 24-pixel radius, two-column desktop layout.
- `.proof-step`: meaningful left border and Mint active line; no floating glass card.
- `.spatial-aperture-demo`: Spatial Void, low-opacity calibration grid, one frame/object/gold signal point.
- `.mode-picker`: three equal columns; cards use white, 16-pixel radius, Light Border.
- use cases: four columns only while copy remains readable; capabilities: three columns; trust and endorsement: constrained split layouts.
- primary action: Signal Mint with Spatial Ink; secondary: white/transparent with Border Dark; danger: Error Dark.

At `max-width: 1023px`, collapse spatial proof and endorsement splits. At `max-width: 767px`, use 20-pixel gutters, hide `.shell-story-links`, show fixed four-item `.route-tabs`, make hero actions full width, stack all section grids, move outcome/action before spatial media, and reserve bottom safe-area padding. At `min-width: 1440px`, increase gutters without widening reading copy.

- [ ] **Step 4: Add focus and reduced-motion rules**

```css
:focus-visible { outline: 3px solid var(--color-signal-mint); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Run style tests and commit**

Run: `npx vitest run tests/arveniloRedesignStyles.test.ts tests/uiSystemStyles.test.ts tests/responsiveNavigationStyles.test.ts tests/appShell.test.ts`

Expected: PASS.

Commit:

```powershell
git add src/styles/arvenilo-redesign.css tests/arveniloRedesignStyles.test.ts tests/uiSystemStyles.test.ts tests/responsiveNavigationStyles.test.ts
git commit -m "feat: style AnchorAR story-first homepage"
```

---

### Task 7: Redesign Scan, Studio, Account, QR, and Shared Product States

**Files:**
- Modify: `src/styles/arvenilo-redesign.css`
- Modify: `tests/arveniloRedesignStyles.test.ts`
- Modify: `tests/scannerStageStyles.test.ts`
- Modify: `tests/targetInspectorStyles.test.ts`
- Modify: `tests/targetQrStyles.test.ts`
- Modify: `tests/responsiveNavigationStyles.test.ts`

**Interfaces:**
- Consumes: all existing route markup, IDs, state data attributes, and Task 6 component tokens.
- Produces: coherent Product Demonstration scan/studio stages, Editorial Light forms, explicit selected/error/loading states, and responsive route layouts.

- [ ] **Step 1: Add failing route and state style assertions**

```ts
expect(css).toMatch(/\[data-page="scan"\]\s+\.scanner-stage-stack\s*\{[^}]*border-radius:\s*var\(--radius-stage\)/s);
expect(css).toMatch(/\.target-preview-stage\s*\{[^}]*background:\s*var\(--color-spatial-void\)/s);
expect(css).toMatch(/\.target-inspector-tabs button\[aria-selected="true"\]\s*\{[^}]*var\(--color-signal-mint\)/s);
expect(css).toMatch(/\.target-model-card\[aria-selected="true"\]\s*\{[^}]*var\(--color-anchor-gold\)/s);
expect(css).toMatch(/\.auth-control-card\s*\{[^}]*background:\s*var\(--color-interface-white\)/s);
expect(css).toMatch(/\.target-qr-dialog\s*\{[^}]*background:\s*var\(--color-reality-mist\)/s);
expect(css).toMatch(/\[data-tone="error"\]\s*\{[^}]*var\(--color-error-dark\)/s);
```

- [ ] **Step 2: Run route style tests and verify they fail**

Run: `npx vitest run tests/arveniloRedesignStyles.test.ts tests/scannerStageStyles.test.ts tests/targetInspectorStyles.test.ts tests/targetQrStyles.test.ts`

Expected: FAIL on missing Arvenilo route overrides.

- [ ] **Step 3: Add the exact route selector groups**

Implement solid-surface overrides for:

```css
.page-header, .page-heading-copy, .page-home-link,
[data-page="scan"] .scanner-panel, [data-page="scan"] .scanner-stage-stack,
.ar-stage, .stage-idle, .scanner-guide-frame, .scanner-guide-line,
.scanner-controls, .scanner-actions, .floor-ar-overlay, .floor-ar-back,
.floor-ar-controls, .target-page, .target-workspace, .target-preview-shell,
.target-preview-stage, .target-preview-controls, .target-transform-toolbar,
.target-camera-view-controls, .target-camera-preset-row, .target-model-rail,
.target-model-card, .target-model-card[aria-selected="true"],
.target-inspector-card, .target-inspector-tabs, .target-inspector-tabs button,
.target-inspector-tabs button[aria-selected="true"], .target-inspector-panel,
.target-access-card, .target-save-strip, .saved-target-row,
.saved-target-row.is-active, .auth-layout, .auth-access-card,
.auth-control-card, .auth-mode-switch, .auth-mode-switch button[aria-pressed="true"],
.login-form input, .target-page input, .target-page select, .target-page textarea,
.target-qr-overlay, .target-qr-dialog, .target-qr-preview-shell,
.target-qr-actions, [data-tone="error"], .is-error
```

Required treatments:

- Scan and preview stages use Spatial Void, Dark Border, 24-pixel radius, white/Mist Slate text, and one Mint scanner line.
- Selected target/model focus uses Anchor Gold border plus visible selected text/icon; primary actions remain Mint.
- Studio desktop is a wide stage/inspector split; inspector is solid white with Light Border.
- Account form is white Editorial Light; trust panel is Spatial Ink without glass blur.
- Inputs use white, Light Border, 10-pixel radius, 44-pixel minimum height, and the shared focus ring.
- QR dialog uses Reality Mist, solid surfaces, one gold target detail, and no decorative radial gradients or glass blur.
- Error states use Error Dark on light and Error Light on dark with explicit message text.

At `max-width: 767px`, preserve the responsive coordinator's task-first DOM order, set stages to useful viewport-relative heights, keep the draft save strip above bottom navigation, make camera actions one-handed/full-width where needed, and retain safe-area offsets for the floor return control.

- [ ] **Step 4: Verify selected, loading, error, and reduced-motion states in tests**

Extend the style test to assert selectors for:

- `[aria-busy="true"]`, disabled controls, target/model loaders;
- `.saved-target-row.is-active`, selected inspector tab, selected transform tool;
- `.target-qr-error`, `.target-qr-share-status[data-tone="error"]`, `.is-error`;
- floor overlay, scanner active state, and reduced-motion animation removal.

- [ ] **Step 5: Run focused tests and commit**

Run: `npx vitest run tests/arveniloRedesignStyles.test.ts tests/scannerStageStyles.test.ts tests/targetInspectorStyles.test.ts tests/targetQrStyles.test.ts tests/floorPlacementStyles.test.ts tests/modelRailStyles.test.ts tests/targetPreviewMobileStyles.test.ts tests/targetPreviewDesktopStyles.test.ts`

Expected: PASS.

Commit:

```powershell
git add src/styles/arvenilo-redesign.css tests/arveniloRedesignStyles.test.ts tests/scannerStageStyles.test.ts tests/targetInspectorStyles.test.ts tests/targetQrStyles.test.ts tests/responsiveNavigationStyles.test.ts
git commit -m "feat: redesign AnchorAR product routes"
```

---

### Task 8: Full Regression, Responsive Browser Review, and Final Polish

**Files:**
- Modify only files with a reproduced test, build, accessibility, console, overflow, or visual defect.
- Add a regression assertion to the nearest existing test before every production-code bug fix.

**Interfaces:**
- Consumes: all prior tasks and existing application test suite.
- Produces: verified desktop/mobile redesign, normal build, GitHub Pages build, and browser captures in `output/playwright/`.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: all 67 existing test files plus new redesign tests PASS with zero failures.

- [ ] **Step 2: Run both production builds**

Run: `npm run build`

Expected: TypeScript and Vite complete with exit code 0.

Run:

```powershell
$env:GITHUB_PAGES = 'true'
npm run build
Remove-Item Env:GITHUB_PAGES
```

Expected: exit code 0 and generated asset URLs retain `/Mark-AR/` base behavior.

- [ ] **Step 3: Start a dedicated verification server**

Run: `npm run dev -- --host 127.0.0.1 --port 5194 --strictPort`

Expected: Vite reports `http://127.0.0.1:5194/`. Keep it running only for the browser review and stop that exact process afterward.

- [ ] **Step 4: Inspect routes at required viewports**

Using the bundled Playwright CLI wrapper, capture:

```powershell
$bash = 'C:\Program Files\Git\bin\bash.exe'
$pwcli = 'C:/Users/shibi/.codex/skills/playwright/scripts/playwright_cli.sh'

# 1440 × 1000
& $bash $pwcli -s=anchorar-final open http://127.0.0.1:5194
& $bash $pwcli -s=anchorar-final resize 1440 1000
& $bash $pwcli -s=anchorar-final screenshot --filename=output/playwright/anchorar-home-1440.png --full-page

# 390 × 844
& $bash $pwcli -s=anchorar-final resize 390 844
& $bash $pwcli -s=anchorar-final screenshot --filename=output/playwright/anchorar-home-390.png --full-page
```

Navigate and capture `#/scan`, `#/account`, and the protected Studio destination at both sizes. Also resize through 320, 768, 1024, and 1920 pixels and check for horizontal document overflow.

Expected visual result: story-first hierarchy, official logos on light surfaces, one dark proof moment, direct product access, readable task-first mobile order, consistent scan/studio/account components, and no legacy glassmorphism or decorative gradients.

- [ ] **Step 5: Inspect interaction and accessibility behavior**

Verify with snapshots and keyboard input:

- Product and Use cases links focus the correct Home sections from Home and from another route.
- Tab order follows visual order.
- Focus rings are visible on every action.
- Bottom navigation respects the safe area and hides only in active immersive states.
- No essential action is inside canvas/camera output.
- Reduced-motion emulation removes the spatial entrance and smooth scrolling.
- Console contains no new errors.

If a defect is found, write a failing Vitest regression where feasible, confirm it fails for the defect, implement the smallest correction, and rerun the focused test before continuing.

- [ ] **Step 6: Re-run fresh final verification**

Run:

```powershell
npm test
npm run build
$env:GITHUB_PAGES = 'true'
npm run build
Remove-Item Env:GITHUB_PAGES
git diff --check
git status --short
```

Expected: all tests pass, both builds exit 0, `git diff --check` is empty, and status contains only the intentional redesign files plus pre-existing unrelated untracked handoff/tool directories.

- [ ] **Step 7: Commit verified polish**

If Task 8 produced intentional fixes:

```powershell
git add -- index.html src/main.ts src/ui/appShell.ts src/ui/responsiveLayout.ts src/ui/authFormMode.ts src/ui/homeSectionNavigation.ts src/app/authMessages.ts src/app/brandAssets.ts src/styles/arvenilo-tokens.css src/styles/arvenilo-redesign.css src/assets/fonts public/brand/anchorar public/brand/arvenilo tests/appShell.test.ts tests/responsiveLayout.test.ts tests/authFormMode.test.ts tests/authMessages.test.ts tests/targetQrIntegration.test.ts tests/savedTargetEditingIntegration.test.ts tests/uiSystemStyles.test.ts tests/responsiveNavigationStyles.test.ts tests/scannerStageStyles.test.ts tests/targetInspectorStyles.test.ts tests/targetQrStyles.test.ts tests/arveniloBrandFoundation.test.ts tests/brandAssets.test.ts tests/homeSectionNavigation.test.ts tests/arveniloRedesignStyles.test.ts
git commit -m "fix: polish responsive AnchorAR redesign"
```

If no files changed during Task 8, do not create an empty commit.

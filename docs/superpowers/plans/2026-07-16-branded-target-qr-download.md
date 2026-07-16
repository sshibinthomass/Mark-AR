# Branded Target QR Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a branded, scan-safe PNG for every target URL, prompt once after initial target creation, and keep QR download available from every saved-target row.

**Architecture:** A focused QR module creates an error-correction-level `H` module grid, composites both supplied logos into a deterministic 1200×1200 RGBA image, and converts it to a PNG `Blob` in the browser. A standalone dialog component owns accessible first-creation presentation, while `main.ts` coordinates create-only opening, cached prompt artifacts, retry/cancellation, clipboard behavior, navigation, and permanent row downloads.

**Tech Stack:** TypeScript 6, Vite 8, Vitest 4, Happy DOM, `qrcode-generator` 2.0.4, test-only `jsqr` 1.4.0, Canvas 2D APIs, browser Blob/Object URL/download APIs.

## Global Constraints

- Encode the exact absolute `#/scan/<scan_id>` target URL.
- Use QR error-correction level `H` and a four-module quiet zone.
- Export a 1200×1200 white PNG with a QR region no larger than 900×900 near the top-left.
- Place `00-arvenilo-master-transparent-logo-QR.png` in a white center badge at approximately 16 percent of the QR width without covering finder patterns.
- Place `04-anchorar-platform-transparent-QR.png` entirely outside the QR quiet zone at the bottom-right.
- Open the animated prompt only after the first successful create operation; never open it after updates, loads, scans, or later saves.
- Keep `Download QR` available for every saved target with a `scanId`.
- Use the exact approved heading and instruction copy.
- Never let QR generation failure roll back or invalidate a successfully saved target.
- Respect `prefers-reduced-motion`.
- Keep GitHub Pages `/Mark-AR/` base-path asset loading working.
- Preserve unrelated untracked files and existing commits.

---

## File Structure

- Create `public/brand/qr/00-arvenilo-master-transparent-logo-QR.png`: tracked exact copy of the supplied center logo.
- Create `public/brand/qr/04-anchorar-platform-transparent-QR.png`: tracked exact copy of the supplied bottom-right platform logo.
- Create `src/app/targetQrCode.ts`: QR module-grid generation, deterministic RGBA composition, asset URL resolution, PNG conversion, safe filename creation, and browser download triggering.
- Create `tests/targetQrCode.test.ts`: dimensions, asset integrity, URL encoding, layout bounds, filename behavior, and `jsQR` decode proof.
- Create `src/ui/targetQrDialog.ts`: accessible modal lifecycle, state rendering, focus containment/restoration, keyboard behavior, and action callbacks.
- Create `tests/targetQrDialog.test.ts`: copy, loading/ready/error states, actions, focus, Tab wrapping, Escape, and reopen behavior.
- Modify `src/ui/savedTargetList.ts`: render the permanent `Download QR` action.
- Modify `tests/savedTargetList.test.ts`: callback and scan-ID gating coverage.
- Modify `src/main.ts`: create-only prompt orchestration, artifact generation/retry/cancellation, shared copy/download helpers, and row integration.
- Create `tests/targetQrIntegration.test.ts`: initial-create prompt, update suppression, prompt actions, row download, failures, and stale-result handling.
- Modify `src/style.css`: modal, preview, loading/error, action, responsive, and reduced-motion styling.
- Create `tests/targetQrStyles.test.ts`: modal layout and animation contract.
- Modify `package.json` and `package-lock.json`: add exact runtime/test dependencies.

---

### Task 1: Build and Decode the Branded QR Artifact

**Files:**
- Create: `public/brand/qr/00-arvenilo-master-transparent-logo-QR.png`
- Create: `public/brand/qr/04-anchorar-platform-transparent-QR.png`
- Create: `src/app/targetQrCode.ts`
- Create: `tests/targetQrCode.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `type RgbaImage = { width: number; height: number; data: Uint8ClampedArray }`.
- Produces: `type TargetQrArtifact = { blob: Blob; filename: string }`.
- Produces: `type TargetQrLayout` with `canvas`, `qr`, `centerBadge`, `centerLogo`, and `footerLogo` rectangles.
- Produces: `targetQrAssetUrls(baseUrl?: string): { centerLogoUrl: string; footerLogoUrl: string }`.
- Produces: `targetQrFilename(label: string, targetId: string): string`.
- Produces: `composeTargetQrPixels(scanUrl: string, centerLogo: RgbaImage, footerLogo: RgbaImage): RgbaImage & { layout: TargetQrLayout }`.
- Produces: `createTargetQrArtifact(input, deps?): Promise<TargetQrArtifact>`.
- Produces: `downloadTargetQrArtifact(artifact, deps?): void`.

- [ ] **Step 1: Install the exact encoder and test decoder**

Run:

```powershell
npm.cmd install qrcode-generator@2.0.4
npm.cmd install --save-dev jsqr@1.4.0
```

Expected: `package.json` contains `"qrcode-generator": "^2.0.4"` under dependencies and `"jsqr": "^1.4.0"` under devDependencies; `npm audit` output does not prevent installation.

- [ ] **Step 2: Copy the exact approved logos into tracked public assets**

Copy:

```text
D:/Arvenilo/arvenilo-site/Arvenilo-Brand-Package/04-Transparent-Logos/00-arvenilo-master-transparent-logo-QR.png
  -> public/brand/qr/00-arvenilo-master-transparent-logo-QR.png

D:/Arvenilo/arvenilo-site/Arvenilo-Brand-Package/04-Transparent-Logos/04-anchorar-platform-transparent-QR.png
  -> public/brand/qr/04-anchorar-platform-transparent-QR.png
```

Expected PNG dimensions:

```text
00 logo: 305×249
04 logo: 1558×283
```

- [ ] **Step 3: Write the failing QR composition tests**

Create `tests/targetQrCode.test.ts` with these core assertions:

```ts
import { readFileSync } from 'node:fs';
import jsQR from 'jsqr';
import { describe, expect, it, vi } from 'vitest';
import {
  composeTargetQrPixels,
  createTargetQrArtifact,
  downloadTargetQrArtifact,
  targetQrAssetUrls,
  targetQrFilename,
} from '../src/app/targetQrCode';

it('uses base-aware URLs for both exact logos', () => {
  expect(targetQrAssetUrls('/Mark-AR/')).toEqual({
    centerLogoUrl: '/Mark-AR/brand/qr/00-arvenilo-master-transparent-logo-QR.png',
    footerLogoUrl: '/Mark-AR/brand/qr/04-anchorar-platform-transparent-QR.png',
  });
});

it('keeps both tracked source assets at their approved dimensions', () => {
  expect(readPngSize('public/brand/qr/00-arvenilo-master-transparent-logo-QR.png')).toEqual([305, 249]);
  expect(readPngSize('public/brand/qr/04-anchorar-platform-transparent-QR.png')).toEqual([1558, 283]);
});

it('composes a branded 1200 square image that decodes to the exact scan URL', () => {
  const scanUrl = 'https://example.com/Mark-AR/#/scan/scan%20target';
  const image = composeTargetQrPixels(scanUrl, fakeLogo(305, 249), fakeLogo(1558, 283));
  const decoded = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });

  expect([image.width, image.height]).toEqual([1200, 1200]);
  expect(decoded?.data).toBe(scanUrl);
  expect(image.layout.centerLogo.width).toBeLessThanOrEqual(image.layout.qr.width * 0.16);
  expect(image.layout.footerLogo.y).toBeGreaterThan(
    image.layout.qr.y + image.layout.qr.height,
  );
});

it('creates safe AnchorAR filenames', () => {
  expect(targetQrFilename('Product Marker 01', 'target-1')).toBe('anchorar-product-marker-01-qr.png');
  expect(targetQrFilename('***', 'Target ABC')).toBe('anchorar-target-abc-qr.png');
});

it('builds a PNG artifact and triggers one revoked browser download', async () => {
  const blob = new Blob(['png'], { type: 'image/png' });
  const artifact = await createTargetQrArtifact(
    { scanUrl: 'https://example.com/#/scan/one', label: 'One', targetId: 'one' },
    {
      loadImage: vi.fn(async (url) => fakeLogo(url.includes('/00-') ? 305 : 1558, url.includes('/00-') ? 249 : 283)),
      encodePng: vi.fn(async () => blob),
      baseUrl: '/Mark-AR/',
    },
  );
  const click = vi.fn();
  const revokeObjectURL = vi.fn();

  downloadTargetQrArtifact(artifact, {
    createObjectURL: vi.fn(() => 'blob:qr'),
    revokeObjectURL,
    createAnchor: () => ({ href: '', download: '', click } as unknown as HTMLAnchorElement),
    scheduleCleanup: (cleanup) => cleanup(),
  });

  expect(artifact).toEqual({ blob, filename: 'anchorar-one-qr.png' });
  expect(click).toHaveBeenCalledOnce();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:qr');
});
```

Include helpers that read PNG width/height from bytes 16 and 20 and create an opaque teal synthetic logo with transparent margins.

- [ ] **Step 4: Run the focused test and confirm RED**

Run:

```powershell
npm.cmd test -- tests/targetQrCode.test.ts
```

Expected: FAIL because `src/app/targetQrCode.ts` does not exist.

- [ ] **Step 5: Implement the deterministic QR compositor**

Create `src/app/targetQrCode.ts` with:

```ts
import qrcode from 'qrcode-generator';

export type RgbaImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

type Rect = { x: number; y: number; width: number; height: number };

export type TargetQrLayout = {
  canvas: Rect;
  qr: Rect;
  centerBadge: Rect;
  centerLogo: Rect;
  footerLogo: Rect;
};

export type TargetQrArtifact = {
  blob: Blob;
  filename: string;
};

const CANVAS_SIZE = 1200;
const QR_REGION_SIZE = 900;
const QR_REGION_X = 48;
const QR_REGION_Y = 48;
const QUIET_MODULES = 4;

export function targetQrAssetUrls(baseUrl = import.meta.env.BASE_URL): {
  centerLogoUrl: string;
  footerLogoUrl: string;
} {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return {
    centerLogoUrl: `${base}brand/qr/00-arvenilo-master-transparent-logo-QR.png`,
    footerLogoUrl: `${base}brand/qr/04-anchorar-platform-transparent-QR.png`,
  };
}

export function targetQrFilename(label: string, targetId: string): string {
  const slug = slugPart(label) || slugPart(targetId) || 'target';
  return `anchorar-${slug}-qr.png`;
}

export function composeTargetQrPixels(
  scanUrl: string,
  centerLogo: RgbaImage,
  footerLogo: RgbaImage,
): RgbaImage & { layout: TargetQrLayout } {
  const qr = qrcode(0, 'H');
  qr.addData(scanUrl, 'Byte');
  qr.make();

  const modules = qr.getModuleCount();
  const cellSize = Math.floor(QR_REGION_SIZE / (modules + QUIET_MODULES * 2));
  const qrSize = cellSize * (modules + QUIET_MODULES * 2);
  const qrRect = {
    x: QR_REGION_X + Math.floor((QR_REGION_SIZE - qrSize) / 2),
    y: QR_REGION_Y + Math.floor((QR_REGION_SIZE - qrSize) / 2),
    width: qrSize,
    height: qrSize,
  };
  const image = solidImage(CANVAS_SIZE, CANVAS_SIZE, 255, 255, 255, 255);

  for (let row = 0; row < modules; row += 1) {
    for (let column = 0; column < modules; column += 1) {
      if (qr.isDark(row, column)) {
        fillRect(image, {
          x: qrRect.x + (column + QUIET_MODULES) * cellSize,
          y: qrRect.y + (row + QUIET_MODULES) * cellSize,
          width: cellSize,
          height: cellSize,
        }, 5, 27, 29, 255);
      }
    }
  }

  const centerLogoWidth = Math.floor(qrRect.width * 0.16);
  const centerLogoRect = fitRect(centerLogo, centerLogoWidth, centerLogoWidth, {
    centerX: qrRect.x + qrRect.width / 2,
    centerY: qrRect.y + qrRect.height / 2,
  });
  const centerBadge = expandRect(centerLogoRect, 18);
  fillRect(image, centerBadge, 255, 255, 255, 255);
  blendScaledImage(image, centerLogo, centerLogoRect);

  const footerLogoRect = fitBottomRight(footerLogo, 620, 150, 48, CANVAS_SIZE);
  blendScaledImage(image, footerLogo, footerLogoRect);

  return {
    ...image,
    layout: {
      canvas: { x: 0, y: 0, width: CANVAS_SIZE, height: CANVAS_SIZE },
      qr: qrRect,
      centerBadge,
      centerLogo: centerLogoRect,
      footerLogo: footerLogoRect,
    },
  };
}
```

Complete the file with bounded rectangle helpers, alpha blending, image loading through an offscreen canvas, PNG encoding through `canvas.toBlob`, injectable test dependencies, and scheduled object-URL revocation after the anchor click so the browser can begin the download first.

- [ ] **Step 6: Run the focused test and confirm GREEN**

Run:

```powershell
npm.cmd test -- tests/targetQrCode.test.ts
```

Expected: all QR helper tests PASS, including `jsQR` decoding the composed branded pixels to the exact URL.

- [ ] **Step 7: Commit the QR artifact unit**

Run:

```powershell
git add package.json package-lock.json public/brand/qr src/app/targetQrCode.ts tests/targetQrCode.test.ts
git commit -m "feat: generate branded target QR images"
```

Expected: one commit containing only dependencies, the two exact assets, QR code implementation, and focused tests.

---

### Task 2: Build the Accessible First-Creation QR Prompt

**Files:**
- Create: `src/ui/targetQrDialog.ts`
- Create: `tests/targetQrDialog.test.ts`
- Modify: `src/style.css`
- Create: `tests/targetQrStyles.test.ts`

**Interfaces:**
- Consumes: a preview object URL produced from `TargetQrArtifact.blob`.
- Produces: `type TargetQrDialogOpenInput = { targetLabel: string; scanUrl: string; scanHref: string; returnFocus?: HTMLElement }`.
- Produces: `type TargetQrDialogHandlers = { onDownload(): void; onCopy(scanUrl: string): void | Promise<void>; onOpenScanner(scanHref: string): void; onRetry(): void; onClose(): void }`.
- Produces: `type TargetQrDialog = { open(input): void; setLoading(): void; setReady(previewUrl: string): void; setError(message: string): void; close(): void; isOpen(): boolean; destroy(): void }`.
- Produces: `createTargetQrDialog(host, handlers): TargetQrDialog`.

- [ ] **Step 1: Write the failing dialog behavior tests**

Create `tests/targetQrDialog.test.ts` and assert:

```ts
const dialog = createTargetQrDialog(host, handlers);
saveButton.focus();
dialog.open({
  targetLabel: 'Product marker',
  scanUrl: 'https://example.com/Mark-AR/#/scan/scan-one',
  scanHref: '#/scan/scan-one',
  returnFocus: saveButton,
});

expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
expect(host.querySelector('[data-target-qr-heading]')?.textContent).toBe('Your AR experience is ready');
expect(host.textContent).toContain(
  'Share this QR code with your audience. Scan it to open the AR experience, allow camera access, then point the camera at the target image to reveal the content in augmented reality.',
);
expect(host.querySelector<HTMLButtonElement>('[data-target-qr-download]')?.disabled).toBe(true);

dialog.setReady('blob:preview');
expect(host.querySelector<HTMLImageElement>('[data-target-qr-preview]')?.src).toContain('blob:preview');
expect(host.querySelector<HTMLButtonElement>('[data-target-qr-download]')?.disabled).toBe(false);

host.querySelector<HTMLButtonElement>('[data-target-qr-download]')?.click();
host.querySelector<HTMLButtonElement>('[data-target-qr-copy]')?.click();
host.querySelector<HTMLButtonElement>('[data-target-qr-open]')?.click();
expect(handlers.onDownload).toHaveBeenCalledOnce();
expect(handlers.onCopy).toHaveBeenCalledWith('https://example.com/Mark-AR/#/scan/scan-one');
expect(handlers.onOpenScanner).toHaveBeenCalledWith('#/scan/scan-one');

dialog.setError('QR generation failed.');
expect(host.querySelector('[role="alert"]')?.textContent).toContain('QR generation failed.');
expect(host.querySelector('[data-target-qr-retry]')?.hasAttribute('hidden')).toBe(false);

host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
expect(dialog.isOpen()).toBe(false);
expect(document.activeElement).toBe(saveButton);
```

Add a Tab/Shift+Tab wrapping test and verify `destroy()` removes listeners and markup.

- [ ] **Step 2: Run the dialog tests and confirm RED**

Run:

```powershell
npm.cmd test -- tests/targetQrDialog.test.ts
```

Expected: FAIL because `targetQrDialog.ts` does not exist.

- [ ] **Step 3: Implement the dialog component**

Create a single overlay appended to `host`:

```ts
overlay.innerHTML = `
  <section class="target-qr-dialog" role="dialog" aria-modal="true"
    aria-labelledby="target-qr-heading" aria-describedby="target-qr-instructions">
    <div class="target-qr-dialog-copy">
      <p class="eyebrow">AnchorAR share link</p>
      <h2 id="target-qr-heading" data-target-qr-heading>Your AR experience is ready</h2>
      <p id="target-qr-instructions">
        Share this QR code with your audience. Scan it to open the AR experience,
        allow camera access, then point the camera at the target image to reveal
        the content in augmented reality.
      </p>
    </div>
    <div class="target-qr-preview-shell">
      <div class="target-qr-loading" data-target-qr-loading role="status">Preparing your QR code…</div>
      <img data-target-qr-preview alt="" hidden>
      <p class="target-qr-error" data-target-qr-error role="alert" hidden></p>
    </div>
    <code data-target-qr-url></code>
    <div class="target-qr-actions">
      <button class="action-control action-control--primary" type="button"
        data-target-qr-download disabled>Download QR</button>
      <button class="action-control action-control--secondary" type="button"
        data-target-qr-copy>Copy link</button>
      <button class="action-control action-control--secondary" type="button"
        data-target-qr-open>Open scanner</button>
      <button class="action-control action-control--secondary" type="button"
        data-target-qr-retry hidden>Try again</button>
      <button class="action-control action-control--quiet" type="button"
        data-target-qr-done>Done</button>
    </div>
  </section>
`;
```

Store the opener, focus the `Done` button after `open`, close on Escape and backdrop click, wrap Tab among enabled actions, and call `onClose` exactly once per open lifecycle.

- [ ] **Step 4: Add failing style-contract tests**

Create `tests/targetQrStyles.test.ts` and assert:

```ts
expect(cssRule('.target-qr-overlay')).toContain('position: fixed');
expect(cssRule('.target-qr-overlay')).toContain('z-index:');
expect(cssRule('.target-qr-dialog')).toContain('animation: target-qr-dialog-enter');
expect(cssRule('.target-qr-preview-shell')).toContain('aspect-ratio: 1 / 1');
expect(mediaBlock('(prefers-reduced-motion: reduce)')).toMatch(
  /\.target-qr-dialog\s*\{[^}]*animation:\s*none/m,
);
```

- [ ] **Step 5: Implement polished responsive dialog styles**

Add:

```css
.target-qr-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  overflow-y: auto;
  padding: 24px;
  background: rgba(3, 18, 20, 0.68);
  backdrop-filter: blur(12px);
}

.target-qr-dialog {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(280px, 1.1fr);
  gap: 24px;
  width: min(880px, 100%);
  border: 1px solid rgba(94, 234, 212, 0.34);
  border-radius: 20px;
  padding: 24px;
  background: linear-gradient(145deg, #f8fffd, #effcf9 58%, #fff8e7);
  box-shadow: 0 30px 100px rgba(2, 20, 22, 0.42);
  animation: target-qr-dialog-enter 220ms cubic-bezier(.2, .8, .2, 1) both;
}

@keyframes target-qr-dialog-enter {
  from { opacity: 0; transform: translateY(18px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

Style a centered preview, visible loading/error states, wrapped actions, mobile single-column layout, and `animation: none` under reduced motion.

- [ ] **Step 6: Run dialog and style tests**

Run:

```powershell
npm.cmd test -- tests/targetQrDialog.test.ts tests/targetQrStyles.test.ts
```

Expected: all dialog lifecycle, accessibility, animation, and reduced-motion tests PASS.

- [ ] **Step 7: Commit the prompt unit**

Run:

```powershell
git add src/ui/targetQrDialog.ts src/style.css tests/targetQrDialog.test.ts tests/targetQrStyles.test.ts
git commit -m "feat: add first-created target QR prompt"
```

---

### Task 3: Add Permanent Saved-Target QR Downloads

**Files:**
- Modify: `src/ui/savedTargetList.ts`
- Modify: `tests/savedTargetList.test.ts`
- Modify: `src/style.css`

**Interfaces:**
- Consumes: the existing target and absolute scan URL.
- Produces: `onDownloadQr?: (target: CloudImageTarget, url: string) => void | Promise<void>` on `SavedTargetListOptions`.
- Produces: one `[data-download-target-qr="<target id>"]` button only when `scanId` exists.

- [ ] **Step 1: Extend the failing saved-target list test**

Change the stable-link test to include:

```ts
const onDownloadQr = vi.fn();
renderSavedTargetList(container, {
  targets: [modelTarget, textTarget],
  currentUrl: 'https://example.com/Mark-AR/#/targets',
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onCopyLink,
  onDownloadQr,
});

const downloadQr = container.querySelector<HTMLButtonElement>(
  '[data-download-target-qr="target-model"]',
);
expect(downloadQr?.textContent).toBe('Download QR');
expect(container.querySelector('[data-download-target-qr="target-text"]')).toBeNull();

downloadQr?.click();
expect(onDownloadQr).toHaveBeenCalledWith(
  modelTarget,
  'https://example.com/Mark-AR/#/scan/scan-target-model',
);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
npm.cmd test -- tests/savedTargetList.test.ts
```

Expected: FAIL because the button and callback do not exist.

- [ ] **Step 3: Implement the permanent action**

In `src/ui/savedTargetList.ts`, create the button before Copy link:

```ts
const downloadButton = document.createElement('button');
downloadButton.type = 'button';
downloadButton.dataset.downloadTargetQr = target.id;
downloadButton.textContent = 'Download QR';
downloadButton.addEventListener('click', () => (
  void options.onDownloadQr?.(target, scanUrl)
));
actions.append(downloadButton, copyButton, openLink);
```

Allow `.saved-target-link-actions` to wrap so all three actions remain usable at narrow widths.

- [ ] **Step 4: Run the focused tests and confirm GREEN**

Run:

```powershell
npm.cmd test -- tests/savedTargetList.test.ts tests/targetQrStyles.test.ts
```

Expected: both files PASS.

- [ ] **Step 5: Commit the saved-row action**

Run:

```powershell
git add src/ui/savedTargetList.ts src/style.css tests/savedTargetList.test.ts
git commit -m "feat: keep target QR downloads available"
```

---

### Task 4: Integrate Create-Only Prompt, Retry, Copy, Navigation, and Downloads

**Files:**
- Modify: `src/main.ts`
- Create: `tests/targetQrIntegration.test.ts`

**Interfaces:**
- Consumes: `absoluteTargetScanUrl`, `hrefForTargetScan`, `createTargetQrArtifact`, `downloadTargetQrArtifact`, and `createTargetQrDialog`.
- Produces: `openCreatedTargetQrPrompt(target): Promise<void>`.
- Produces: `downloadQrForTarget(target, scanUrl): Promise<void>`.
- Produces: one active prompt request token and one cached prompt artifact/object URL.

- [ ] **Step 1: Write the failing create/update integration tests**

Create `tests/targetQrIntegration.test.ts` with real `targetQrDialog` and mocked QR generation. Set a signed-in session, two Cloudflare models, a captured image payload, and a newly created target with `scanId: 'scan-new'`.

Core create assertion:

```ts
await import('../src/main');
await chooseImageAndModel();
document.querySelector<HTMLButtonElement>('#save-image-target')?.click();

await waitFor(() => document.querySelector('[data-target-qr-overlay]')?.hasAttribute('hidden') === false);
expect(createTargetQrArtifact).toHaveBeenCalledWith(
  expect.objectContaining({
    scanUrl: 'https://example.com/Mark-AR/#/scan/scan-new',
    label: 'New marker',
    targetId: 'target-new',
  }),
);
expect(document.querySelector('[data-target-qr-heading]')?.textContent).toBe(
  'Your AR experience is ready',
);
```

Then close the prompt, save the same target through `updateImageTarget`, and assert the prompt remains closed and QR generation was not called again.

Add cases for:

- clicking prompt `Download QR` uses the cached artifact;
- clicking saved-row `Download QR` generates and downloads a fresh artifact;
- `Copy link` writes the exact absolute URL;
- `Open scanner` closes the prompt and sets `window.location.hash` to `#/scan/scan-new`;
- first generation rejection shows `Try again`, and retry succeeds;
- closing while generation is pending prevents stale preview rendering and does not create an object URL for the late result;
- successful creation with a following list-refresh failure still opens the prompt from the create response;
- update failure or create response without `scanId` never opens the prompt.

- [ ] **Step 2: Run the integration test and confirm RED**

Run:

```powershell
npm.cmd test -- tests/targetQrIntegration.test.ts
```

Expected: FAIL because `main.ts` does not create or coordinate the prompt.

- [ ] **Step 3: Instantiate and coordinate the QR dialog**

Add imports:

```ts
import {
  createTargetQrArtifact,
  downloadTargetQrArtifact,
  type TargetQrArtifact,
} from './app/targetQrCode';
import { createTargetQrDialog } from './ui/targetQrDialog';
import {
  absoluteTargetScanUrl,
  hrefForRoute,
  hrefForTargetScan,
  locationFromHash,
} from './ui/pageRoutes';
```

Maintain:

```ts
let targetQrPromptRequestVersion = 0;
let targetQrPromptTarget: CloudImageTarget | undefined;
let targetQrPromptArtifact: TargetQrArtifact | undefined;
let targetQrPromptPreviewUrl: string | undefined;
const targetQrDownloadJobs = new Map<string, Promise<void>>();
```

Create the dialog once. Its handlers:

- download the cached prompt artifact;
- copy the current absolute URL;
- close and navigate to the exact scanner hash;
- retry the current target;
- invalidate the request and revoke the current preview URL on close.

- [ ] **Step 4: Implement create-only opening and stale-result cleanup**

Implement:

```ts
async function openCreatedTargetQrPrompt(target: CloudImageTarget): Promise<void> {
  if (!target.scanId) {
    return;
  }

  const requestVersion = ++targetQrPromptRequestVersion;
  releaseTargetQrPromptPreview();
  targetQrPromptTarget = target;
  targetQrPromptArtifact = undefined;
  const scanUrl = absoluteTargetScanUrl(target.scanId, window.location.href);
  targetQrDialog.open({
    targetLabel: target.label,
    scanUrl,
    scanHref: hrefForTargetScan(target.scanId),
    returnFocus: saveImageTargetButton ?? undefined,
  });
  targetQrDialog.setLoading();

  try {
    const artifact = await createTargetQrArtifact({
      scanUrl,
      label: target.label,
      targetId: target.id,
    });
    if (requestVersion !== targetQrPromptRequestVersion || !targetQrDialog.isOpen()) {
      return;
    }
    targetQrPromptArtifact = artifact;
    targetQrPromptPreviewUrl = URL.createObjectURL(artifact.blob);
    targetQrDialog.setReady(targetQrPromptPreviewUrl);
  } catch (error) {
    if (requestVersion === targetQrPromptRequestVersion && targetQrDialog.isOpen()) {
      targetQrDialog.setError(errorMessage(error, 'Unable to prepare the QR code.'));
    }
  }
}
```

Call it only when `wasEditing === false`, after a verified create response. Call it with `savedTarget` in the refresh-failure branch and with `refreshedTarget` in the normal branch. Do not call it from the update path.

- [ ] **Step 5: Share copy and guarded download behavior**

Extract one `copyTargetScanUrl(scanUrl, successMessage)` helper for both prompt and saved rows.

Implement guarded saved-row downloads:

```ts
async function downloadQrForTarget(target: CloudImageTarget, scanUrl: string): Promise<void> {
  const existingJob = targetQrDownloadJobs.get(target.id);
  if (existingJob) {
    return existingJob;
  }
  const job = createTargetQrArtifact({
    scanUrl,
    label: target.label,
    targetId: target.id,
  })
    .then((artifact) => {
      downloadTargetQrArtifact(artifact);
      updateImageTargetStatus('QR code downloaded.', false);
    })
    .catch((error) => {
      updateImageTargetStatus(errorMessage(error, 'Unable to download QR code'), true);
    })
    .finally(() => {
      targetQrDownloadJobs.delete(target.id);
    });
  targetQrDownloadJobs.set(target.id, job);
  return job;
}
```

Pass `onDownloadQr: downloadQrForTarget` to `renderSavedTargetList`.

- [ ] **Step 6: Run the focused integration and related tests**

Run:

```powershell
npm.cmd test -- tests/targetQrIntegration.test.ts tests/targetQrDialog.test.ts tests/targetQrCode.test.ts tests/savedTargetList.test.ts tests/savedTargetEditingIntegration.test.ts
```

Expected: all files PASS; existing saved-target edits remain unchanged and never reopen the prompt.

- [ ] **Step 7: Commit the coordinator**

Run:

```powershell
git add src/main.ts tests/targetQrIntegration.test.ts
git commit -m "feat: prompt for QR after target creation"
```

---

### Task 5: Full Verification and Browser Smoke

**Files:**
- Verify all changed files; no planned source additions.

**Interfaces:**
- Consumes: the complete implementation.
- Produces: test, build, scan-decode, and browser-visible evidence.

- [ ] **Step 1: Run all focused QR tests**

Run:

```powershell
npm.cmd test -- tests/targetQrCode.test.ts tests/targetQrDialog.test.ts tests/targetQrStyles.test.ts tests/savedTargetList.test.ts tests/targetQrIntegration.test.ts
```

Expected: all focused files PASS.

- [ ] **Step 2: Run the complete test and build gates**

Run:

```powershell
npm.cmd test
npm.cmd run build
$env:GITHUB_PAGES='true'; npm.cmd run build; Remove-Item Env:GITHUB_PAGES
```

Expected: all Vitest files PASS; both builds exit `0`; Pages output uses `/Mark-AR/` asset URLs.

- [ ] **Step 3: Check source and asset scope**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only planned QR source/tests/assets/dependency files differ from the pre-existing untracked user files.

- [ ] **Step 4: Start the real app on an owned strict port**

Check listener ownership, then run:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

If occupied by another checkout, use `5174` or `5175`. Verify HTTP `200`, page title `Mark AR`, and the listener command line points to `D:\Github-Projects\Mark-AR`.

- [ ] **Step 5: Verify the actual branded artifact in Chromium**

In the running page, dynamically import `/src/app/targetQrCode.ts`, generate an artifact for:

```text
https://example.com/Mark-AR/#/scan/browser-smoke
```

Display its object URL in an image and verify:

- the `00` logo is centered inside the QR;
- the `04` logo is outside the QR at the bottom-right;
- the quiet zone is untouched;
- the PNG is 1200×1200;
- decoding returns the exact smoke URL.

- [ ] **Step 6: Verify the prompt visually and behaviorally**

Open the real dialog with the generated preview and confirm:

- entrance animation;
- exact heading and instruction copy;
- keyboard focus is inside the dialog;
- Download, Copy, Open scanner, and Done are visible;
- Escape closes and returns focus;
- a reduced-motion emulation removes the entrance animation;
- the layout remains usable at desktop and mobile viewport widths.

- [ ] **Step 7: Final verification commit**

If verification required no code changes, do not create an empty commit. If it uncovered and fixed a QR-only issue, rerun Steps 1–3 and commit the focused fix with:

```powershell
git add <only-the-fixed-QR-files>
git commit -m "fix: harden branded target QR downloads"
```

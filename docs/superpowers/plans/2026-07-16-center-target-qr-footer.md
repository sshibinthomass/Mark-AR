# Center Target QR Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Horizontally center the exterior AnchorAR footer wordmark beneath the complete generated QR square.

**Architecture:** Keep the existing 1200×1200 compositor and asset sizing unchanged. Replace the bottom-right rectangle fitter with a bottom-centered fitter whose center coordinate comes directly from the generated QR rectangle, and lock the relationship with a decoding regression test.

**Tech Stack:** TypeScript 6, Vitest 4, `qrcode-generator`, `jsqr`.

## Global Constraints

- Center against the complete generated QR square, including its four-module quiet zone.
- Keep the footer logo entirely outside and below the QR rectangle.
- Preserve the existing 620×150 maximum footer bounds and 48-pixel canvas bottom margin.
- Allow no more than half a pixel of center difference due to whole-pixel raster dimensions.
- Preserve exact URL encoding, error-correction level `H`, the center badge, canvas size, download behavior, and all supplied logo assets.
- Add no dependencies.

---

### Task 1: Center the footer wordmark and prove the QR remains valid

**Files:**
- Modify: `tests/targetQrCode.test.ts`
- Modify: `src/app/targetQrCode.ts`

**Interfaces:**
- Consumes: `composeTargetQrPixels(scanUrl, centerLogo, footerLogo)` and its existing `TargetQrLayout`.
- Produces: `TargetQrLayout.footerLogo` centered beneath `TargetQrLayout.qr` while preserving all existing output contracts.

- [ ] **Step 1: Write the failing alignment assertion**

Add these assertions to the existing composed-image test immediately after the footer-below-QR assertion:

```ts
const qrCenterX = image.layout.qr.x + image.layout.qr.width / 2;
const footerCenterX = image.layout.footerLogo.x + image.layout.footerLogo.width / 2;
expect(Math.abs(footerCenterX - qrCenterX)).toBeLessThanOrEqual(0.5);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm.cmd test -- tests/targetQrCode.test.ts
```

Expected: FAIL on the new horizontal-center assertion because the current helper anchors the footer to the canvas right edge.

- [ ] **Step 3: Implement the minimal centered rectangle calculation**

Replace the compositor call with:

```ts
const footerLogoRect = fitBottomCenteredRect(footerLogo, {
  maxWidth: 620,
  maxHeight: 150,
  centerX: qrRect.x + qrRect.width / 2,
  bottom: CANVAS_SIZE - 48,
});
```

Replace `fitBottomRightRect` with:

```ts
function fitBottomCenteredRect(
  image: RgbaImage,
  bounds: {
    maxWidth: number;
    maxHeight: number;
    centerX: number;
    bottom: number;
  },
): Rect {
  const size = fitSize(image, bounds.maxWidth, bounds.maxHeight);
  return {
    x: Math.round(bounds.centerX - size.width / 2),
    y: Math.round(bounds.bottom - size.height),
    ...size,
  };
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm.cmd test -- tests/targetQrCode.test.ts
```

Expected: PASS, including exact URL decoding and the new center-alignment assertion.

- [ ] **Step 5: Run regression verification**

Run:

```powershell
npm.cmd test
npm.cmd run build
$env:GITHUB_PAGES='true'; npm.cmd run build
```

Expected: the full suite passes and both production builds complete successfully.

- [ ] **Step 6: Commit the implementation**

```powershell
git add src/app/targetQrCode.ts tests/targetQrCode.test.ts
git commit -m "fix: center target QR footer logo"
```

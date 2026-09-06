import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { selectorBody, mediaBlock as sourceMediaBlock } from './cssSource';

const css = readFileSync('src/styles/arvenilo.css', 'utf8');
const brandedCss = readFileSync('src/styles/arvenilo.css', 'utf8');

function cssRule(selector: string, source = css): string {
  return selectorBody(selector, source);
}

function mediaSection(query: string, source = css): string {
  return sourceMediaBlock(query, source);
}

describe('floor placement styles', () => {
  it('pins a transparent floor canvas to the full camera stage', () => {
    const panel = cssRule('.scanner-panel');
    const stage = cssRule('.floor-ar-stage');
    const canvas = cssRule('.floor-ar-stage canvas');

    expect(panel).toContain('position: relative');
    expect(stage).toContain('position: relative');
    expect(stage).toContain('background: transparent');
    expect(canvas).toContain('position: absolute');
    expect(canvas).toContain('inset: 0');
    expect(canvas).toContain('width: 100%');
    expect(canvas).toContain('height: 100%');
    expect(canvas).toContain('background: transparent');
    expect(css.indexOf('.floor-ar-stage {')).toBeGreaterThan(css.indexOf('.ar-stage {'));
  });

  it('routes pointers through the overlay only to gestures and controls', () => {
    const stageStack = cssRule('.scanner-stage-stack');
    const overlay = cssRule('.floor-ar-overlay');
    const gestureSurface = cssRule('.floor-ar-gesture-surface');
    const controls = cssRule('.floor-ar-controls');
    const scannerControls = cssRule('.scanner-controls');

    expect(stageStack).toContain('position: relative');
    expect(stageStack).not.toContain('position: absolute');
    expect(overlay).toContain('position: absolute');
    expect(overlay).toMatch(/(?:^|\n)\s*inset:\s*0\s*;/);
    expect(overlay).not.toContain('72px');
    expect(overlay).toContain('z-index: 4');
    expect(overlay).toContain('pointer-events: none');
    expect(gestureSurface).toContain('position: absolute');
    expect(gestureSurface).toContain('inset: 0');
    expect(gestureSurface).toContain('pointer-events: auto');
    expect(gestureSurface).toContain('touch-action: none');
    expect(controls).toContain('pointer-events: auto');
    expect(scannerControls).toContain('position: relative');
    expect(scannerControls).toContain('z-index: 5');
  });

  it('keeps the taller mobile scanner controls outside the overlay containing block', () => {
    const stageStack = cssRule('.scanner-stage-stack');
    const overlay = cssRule('.floor-ar-overlay');
    const mobileScannerControls = cssRule('.scanner-controls', mediaSection('(max-width: 767px)'));

    expect(stageStack).toContain('position: relative');
    expect(overlay).toMatch(/(?:^|\n)\s*inset:\s*0\s*;/);
    expect(mobileScannerControls).toContain('flex-direction: column');
    expect(mobileScannerControls).not.toContain('position: absolute');
  });

  it('keeps the control tray safe-area aware and responsive', () => {
    const controls = cssRule('.floor-ar-controls');
    const scannerActions = cssRule('.scanner-actions');

    expect(controls).toContain('bottom: max(var(--space-4), env(safe-area-inset-bottom))');
    expect(controls).toContain('right: var(--space-4)');
    expect(controls).toContain('left: var(--space-4)');
    expect(controls).toContain('display: flex');
    expect(controls).toContain('flex-wrap: wrap');
    expect(scannerActions).toContain('display: flex');
    expect(scannerActions).toContain('flex-wrap: wrap');
  });

  it('provides 44px touch targets and a visible floor-control focus ring', () => {
    const floorBack = cssRule('.floor-ar-back');
    const floorButtons = cssRule('.floor-ar-controls button');
    const floorToggle = cssRule('#floor-ar-toggle');
    const rotation = cssRule('#floor-ar-rotation');

    expect(floorBack).toContain('top: max(var(--space-4), env(safe-area-inset-top))');
    expect(floorBack).toContain('left: var(--space-4)');
    expect(floorBack).toContain('min-height: var(--control-height)');
    expect(floorButtons).toContain('min-height: var(--control-height)');
    expect(floorToggle).toContain('min-height: var(--control-height)');
    expect(rotation).toContain('min-height: var(--control-height)');
    expect(css).toMatch(
      /\.floor-ar-back:focus-visible,\s*\.floor-ar-controls button:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--color-signal-mint\)/m,
    );
  });

  it('styles the selection toggle as a compact pressed control beside Done', () => {
    const selectionControls = cssRule('.floor-ar-selection-controls');
    const selectAll = cssRule('#floor-ar-select-all');
    const pressedSelectAll = cssRule('#floor-ar-select-all[aria-pressed="true"]');
    const selectionHint = cssRule('#floor-ar-selection-hint');
    const brandedSelectionHint = cssRule('#floor-ar-selection-hint', brandedCss);

    expect(selectionControls).toContain('display: flex');
    expect(selectionControls).toContain('gap: var(--space-2)');
    expect(selectionControls).toContain('align-items: center');
    expect(selectAll).toContain('min-height: var(--control-height)');
    expect(selectAll).toContain('padding: 0 var(--space-4)');
    expect(pressedSelectAll).toContain('background: var(--color-signal-mint)');
    expect(selectionHint).toContain('font-size: var(--text-label)');
    expect(brandedSelectionHint).toContain('color: var(--color-mist-slate)');
  });

  it('keeps selection controls compact at the existing mobile breakpoint', () => {
    const mobile = mediaSection('(max-width: 767px)');
    const selectionControls = cssRule('.floor-ar-selection-controls', mobile);
    const selectionButtons = cssRule('.floor-ar-selection-controls button', mobile);
    const selectionHint = cssRule('#floor-ar-selection-hint', mobile);

    expect(selectionControls).toContain('flex: 1 1 auto');
    expect(selectionButtons).toContain('flex: 0 1 auto');
    expect(selectionHint).toContain('flex-basis: 100%');
  });

  it('keeps the branded compact-button rule effective after the generic mobile button rule', () => {
    const brandedMobile = mediaSection('(max-width: 767px)', brandedCss);
    const genericButtonRule = brandedMobile.lastIndexOf('.floor-ar-controls button {');
    const compactButtonRule = brandedMobile.lastIndexOf('.floor-ar-selection-controls button {');

    expect(genericButtonRule).toBeGreaterThanOrEqual(0);
    expect(compactButtonRule).toBeGreaterThan(genericButtonRule);
    expect(cssRule('.floor-ar-selection-controls button', brandedMobile)).toContain(
      'flex: 0 1 auto',
    );
  });

  it('removes floor-control motion when reduced motion is requested', () => {
    const reducedMotionStart = css.indexOf('@media (prefers-reduced-motion: reduce)');
    const reducedMotion = reducedMotionStart >= 0 ? css.slice(reducedMotionStart) : '';

    expect(reducedMotion).toContain('.floor-ar-controls');
    expect(reducedMotion).toContain('animation: none');
    /* Transitions are cut for everything by one blanket rule rather than by
       re-listing each control. */
    expect(reducedMotion).toMatch(
      /\*,\s*\*::before,\s*\*::after\s*\{[^}]*transition-duration:\s*0\.01ms !important/s,
    );
  });
});

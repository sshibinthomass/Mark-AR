import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

function cssRule(selector: string, source = css): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm').exec(source)?.groups?.body ?? '';
}

function mediaSection(query: string): string {
  const start = css.indexOf(`@media ${query}`);
  if (start < 0) return '';
  const nextMedia = css.indexOf('@media ', start + 1);
  return css.slice(start, nextMedia < 0 ? css.length : nextMedia);
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
    const mobileScannerControls = cssRule('.scanner-controls', mediaSection('(max-width: 620px)'));

    expect(stageStack).toContain('position: relative');
    expect(overlay).toMatch(/(?:^|\n)\s*inset:\s*0\s*;/);
    expect(mobileScannerControls).toContain('flex-direction: column');
    expect(mobileScannerControls).not.toContain('position: absolute');
  });

  it('keeps the control tray safe-area aware and responsive', () => {
    const controls = cssRule('.floor-ar-controls');
    const scannerActions = cssRule('.scanner-actions');

    expect(controls).toContain('bottom: max(14px, env(safe-area-inset-bottom))');
    expect(controls).toContain('right: 14px');
    expect(controls).toContain('left: 14px');
    expect(controls).toContain('display: flex');
    expect(controls).toContain('flex-wrap: wrap');
    expect(scannerActions).toContain('display: flex');
    expect(scannerActions).toContain('flex-wrap: wrap');
  });

  it('provides 44px touch targets and a visible floor-control focus ring', () => {
    const floorButtons = cssRule('.floor-ar-controls button');
    const floorToggle = cssRule('#floor-ar-toggle');
    const rotation = cssRule('#floor-ar-rotation');

    expect(floorButtons).toContain('min-height: 44px');
    expect(floorToggle).toContain('min-height: 44px');
    expect(rotation).toContain('min-height: 44px');
    expect(css).toMatch(
      /\.floor-ar-controls button:focus-visible,\s*#floor-ar-toggle:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--gold\)/m,
    );
  });

  it('removes floor-control motion when reduced motion is requested', () => {
    const reducedMotionStart = css.indexOf('@media (prefers-reduced-motion: reduce)');
    const reducedMotion = reducedMotionStart >= 0 ? css.slice(reducedMotionStart) : '';

    expect(reducedMotion).toContain('.floor-ar-controls');
    expect(reducedMotion).toContain('#floor-ar-toggle');
    expect(reducedMotion).toContain('animation: none');
    expect(reducedMotion).toContain('transition: none');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { selectorBody } from './cssSource';

const css = readFileSync('src/styles/arvenilo.css', 'utf8');

function cssRule(selector: string): string {
  return selectorBody(selector, css);
}

describe('target model rail styles', () => {
  it('keeps thumbnail cards as square aligned tiles', () => {
    const rail = cssRule('.target-model-rail');
    const card = cssRule('.target-model-card');
    const thumb = cssRule('.target-model-thumb');
    const label = cssRule('.target-model-card-label');

    expect(rail).toContain('--target-model-card-size: 96px');
    expect(rail).toContain('justify-items: center');
    expect(rail).toContain('grid-auto-rows: var(--target-model-card-size)');
    expect(rail).not.toContain('scrollbar-gutter');
    expect(card).toContain('aspect-ratio: 1 / 1');
    expect(card).toContain('place-items: center');
    expect(card).toContain('overflow: hidden');
    expect(thumb).toContain('width: 100%');
    expect(thumb).toContain('aspect-ratio: 1 / 1');
    expect(label).toContain('position: absolute');
    expect(label).toContain('clip-path: inset(50%)');
  });

  it('sizes the tile from the rail variable and outranks the generic button rule', () => {
    const card = cssRule('.target-model-card');

    expect(card).toContain('width: var(--target-model-card-size)');
    expect(card).toContain('height: var(--target-model-card-size)');
    expect(card).toContain('padding: var(--space-2)');
    expect(card).toContain('font-size: var(--text-label)');
    /* A class outranks the bare `button` element rule, so the tile geometry
       needs no extra qualifier to hold. */
    expect(css.indexOf('.target-model-card {')).toBeGreaterThan(css.indexOf('button {'));
  });
});

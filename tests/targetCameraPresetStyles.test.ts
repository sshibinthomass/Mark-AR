import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { selectorBody, withoutMedia } from './cssSource';

const css = readFileSync('src/styles/arvenilo.css', 'utf8');

function cssRule(selector: string): string {
  return selectorBody(selector, css);
}

describe('target camera preset styles', () => {
  it('keeps camera preset buttons compact beside the camera view label', () => {
    const head = cssRule('.target-camera-view-head');
    const row = cssRule('.target-camera-preset-row');
    const baseRow = selectorBody('.target-camera-preset-row', withoutMedia(css));
    const button = cssRule('.target-page .target-camera-preset-row button');

    expect(head).toContain('display: flex');
    expect(head).toContain('align-items: center');
    expect(row).toContain('display: flex');
    expect(row).toContain('justify-content: flex-end');
    expect(baseRow).not.toContain('grid-template-columns');
    /* Presets stay compact but remain a full touch target. */
    expect(button).toContain('min-height: var(--control-height)');
    expect(button).toContain('border-radius: var(--radius-control)');
    expect(button).toContain('border: 1px solid var(--color-border-dark)');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { selectorBody } from './cssSource';

const css = readFileSync('src/styles/arvenilo.css', 'utf8');

function cssRule(source: string, selector: string): string {
  return selectorBody(selector, source);
}

describe('target preview desktop styles', () => {
  it('uses the available desktop preview header after removing orbit arrows', () => {
    const previewControls = cssRule(css, '.target-preview-controls');

    expect(previewControls).toContain('right: auto');
    expect(previewControls).toContain('width: calc(100% - var(--space-6))');
    expect(previewControls).not.toContain('520px');
    expect(previewControls).not.toContain('170px');
    expect(previewControls).toContain('grid-template-columns: max-content minmax(0, 1fr)');
  });
});

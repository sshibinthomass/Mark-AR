import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

function cssRule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm').exec(source)?.groups?.body ?? '';
}

describe('target preview desktop styles', () => {
  it('keeps the desktop camera controls clear of the orbit arrows', () => {
    const previewControls = cssRule(css, '.target-preview-controls');

    expect(previewControls).toContain('right: auto');
    expect(previewControls).toContain('width: min(520px, calc(100% - 170px))');
    expect(previewControls).toContain('grid-template-columns: max-content minmax(0, 1fr)');
  });
});

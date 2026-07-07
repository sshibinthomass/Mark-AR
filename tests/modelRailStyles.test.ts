import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

function cssRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm').exec(css)?.groups?.body ?? '';
}

describe('target model rail styles', () => {
  it('keeps thumbnail cards as square aligned tiles', () => {
    const card = cssRule('.target-model-card');
    const thumb = cssRule('.target-model-thumb');
    const label = cssRule('.target-model-card-label');

    expect(card).toContain('aspect-ratio: 1 / 1');
    expect(card).toContain('place-items: center');
    expect(card).toContain('overflow: hidden');
    expect(thumb).toContain('width: 100%');
    expect(thumb).toContain('aspect-ratio: 1 / 1');
    expect(label).toContain('position: absolute');
    expect(label).toContain('clip-path: inset(50%)');
  });
});

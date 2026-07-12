import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

function cssRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm').exec(css)?.groups?.body ?? '';
}

describe('target camera preset styles', () => {
  it('keeps camera preset buttons compact beside the camera view label', () => {
    const head = cssRule('.target-camera-view-head');
    const row = cssRule('.target-camera-preset-row');
    const button = cssRule('.target-page .target-camera-preset-row button');

    expect(head).toContain('display: flex');
    expect(head).toContain('align-items: center');
    expect(row).toContain('display: flex');
    expect(row).toContain('justify-content: flex-end');
    expect(row).not.toContain('grid-template-columns');
    expect(button).toContain('min-height: 20px');
    expect(button).toContain('padding: 2px 6px');
    expect(button).toContain('border-radius: 999px');
    expect(button).toContain('font-size: 9px');
  });
});

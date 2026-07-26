import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

function cssRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm')
    .exec(css)?.groups?.body ?? '';
}

describe('YouTube AR transport styles', () => {
  it('provides base offsets for the separate transport CSS3D element', () => {
    const controls = cssRule('.youtube-transport-controls');

    expect(controls).toContain('position: absolute');
    expect(controls).toContain('top: 0');
    expect(controls).toContain('left: 0');
    expect(controls).toContain('display: flex');
    expect(controls).toContain('pointer-events: auto');
    expect(controls).not.toContain('bottom:');
    expect(controls).not.toContain('transform:');
  });

  it('gives the 3D buttons mobile touch targets and visible keyboard focus', () => {
    const button = cssRule('.youtube-transport-controls button');
    const focus = cssRule('.youtube-transport-controls button:focus-visible');

    expect(button).toContain('min-width: 44px');
    expect(button).toContain('min-height: 44px');
    expect(button).toContain('box-shadow:');
    expect(focus).toContain('outline: 3px solid');
  });
});

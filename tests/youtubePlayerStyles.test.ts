import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

function cssRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm')
    .exec(css)?.groups?.body ?? '';
}

describe('YouTube AR transport styles', () => {
  it('places the spatial transport bar above the video', () => {
    const wrapper = cssRule('.youtube-css3d-player');
    const controls = cssRule('.youtube-transport-controls');

    expect(wrapper).toContain('position: relative');
    expect(controls).toContain('position: absolute');
    expect(controls).toContain('bottom: calc(100% + 14px)');
    expect(controls).toContain('left: 50%');
    expect(controls).toContain('transform: translateX(-50%)');
    expect(controls).toContain('display: flex');
    expect(controls).toContain('pointer-events: auto');
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

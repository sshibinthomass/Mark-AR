import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

function cssRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm')
    .exec(css)?.groups?.body ?? '';
}

describe('YouTube AR transport styles', () => {
  it('gives the CSS3D frame a stable hit box and counter-scales its inner controls', () => {
    const frame = cssRule('.youtube-css3d-controls-frame');
    const controls = cssRule('.youtube-transport-controls');

    expect(frame).toContain('position: absolute');
    expect(frame).toContain('width: 0.8888888888888888px');
    expect(frame).toContain('height: 0.2222222222222222px');
    expect(frame).toContain('pointer-events: auto');
    expect(controls).toContain('position: absolute');
    expect(controls).toContain('top: 0');
    expect(controls).toContain('left: 0');
    expect(controls).toContain('width: 240px');
    expect(controls).toContain('height: 60px');
    expect(controls).toContain('display: flex');
    expect(controls).toContain('pointer-events: auto');
    expect(controls).toContain('transform-origin: 0 0');
    expect(controls).toContain('transform: scale(0.003703703703703704)');
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

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

function cssRule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm').exec(source)?.groups?.body ?? '';
}

function mediaBlock(query: string): string {
  const start = css.lastIndexOf(`@media ${query}`);
  if (start < 0) {
    return '';
  }
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(open + 1, index);
  }
  return '';
}

describe('scanner stage styles', () => {
  it('keeps the decorative guide inside the camera stage above renderer layers', () => {
    const guide = cssRule(css, '.scanner-guide');

    expect(guide).toContain('position: absolute');
    expect(guide).toContain('inset: 0');
    expect(guide).toContain('z-index: 3');
    expect(guide).toContain('pointer-events: none');
    expect(cssRule(css, '.scanner-guide[hidden]')).toContain('display: none');
    expect(cssRule(css, '.scanner-guide-frame')).toContain('inset: 9% 7%');
    expect(cssRule(css, '.scanner-guide-line')).toContain('animation: scanner-guide-sweep');
  });

  it('stops the scan-line animation when reduced motion is requested', () => {
    const reducedMotion = mediaBlock('(prefers-reduced-motion: reduce)');
    const guideLine = cssRule(reducedMotion, '.scanner-guide-line');

    expect(guideLine).toContain('animation: none');
  });
});

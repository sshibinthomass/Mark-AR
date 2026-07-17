import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');
const redesignCss = readFileSync('src/styles/arvenilo-redesign.css', 'utf8');

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

  it('uses a solid Spatial Void stage with a single mint scanner line', () => {
    expect(cssRule(redesignCss, '[data-page="scan"] .scanner-stage-stack')).toContain(
      'border-radius: var(--radius-stage)',
    );
    expect(cssRule(redesignCss, '[data-page="scan"] .scanner-stage-stack')).toContain(
      'background: var(--color-spatial-void)',
    );
    expect(cssRule(redesignCss, '.scanner-guide-line')).toContain(
      'background: var(--color-signal-mint)',
    );
  });

  it('keeps active scanner and floor controls explicit on dark surfaces', () => {
    expect(cssRule(redesignCss, '[data-scan-session="active"] [data-page="scan"] .scanner-stage-stack'))
      .toContain('border-color: var(--color-signal-mint)');
    expect(cssRule(redesignCss, '.floor-ar-overlay')).toContain('background: transparent');
    expect(cssRule(redesignCss, '.floor-ar-controls')).toContain(
      'background: var(--color-spatial-surface)',
    );
    expect(cssRule(redesignCss, '.floor-ar-controls [data-tone="error"]')).toContain(
      'color: var(--color-error-light)',
    );
  });

  it('stops the scan-line animation when reduced motion is requested', () => {
    const reducedMotion = mediaBlock('(prefers-reduced-motion: reduce)');
    const guideLine = cssRule(reducedMotion, '.scanner-guide-line');

    expect(guideLine).toContain('animation: none');

    const redesignReducedMotion = mediaBlockFrom(redesignCss, '(prefers-reduced-motion: reduce)');
    expect(cssRule(redesignReducedMotion, '.scanner-guide-line')).toContain('animation: none');
  });
});

function mediaBlockFrom(source: string, query: string): string {
  const start = source.lastIndexOf(`@media ${query}`);
  if (start < 0) return '';
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  return '';
}

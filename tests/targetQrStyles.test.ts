import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

describe('target QR prompt styles', () => {
  it('uses a fixed, high-priority modal layer with a split desktop layout', () => {
    expect(cssRule('.target-qr-overlay')).toContain('position: fixed');
    expect(cssRule('.target-qr-overlay')).toContain('z-index: 100');
    expect(cssRule('.target-qr-overlay')).toContain('backdrop-filter: blur(12px)');
    expect(cssRule('.target-qr-dialog')).toContain(
      'grid-template-columns: minmax(260px, 0.9fr) minmax(280px, 1.1fr)',
    );
    expect(cssRule('.target-qr-dialog')).toContain('animation: target-qr-dialog-enter');
  });

  it('gives the QR a square scanner frame and wraps all actions', () => {
    expect(cssRule('.target-qr-preview-shell')).toContain('aspect-ratio: 1 / 1');
    expect(cssRule('.target-qr-preview-shell')).toContain('background:');
    expect(cssRule('.target-qr-actions')).toContain('flex-wrap: wrap');
    expect(cssRule('.target-qr-actions')).toContain('grid-column: 1 / -1');
  });

  it('switches to one column on small screens and removes motion when requested', () => {
    expect(mediaBlock('(max-width: 720px)')).toMatch(
      /\.target-qr-dialog\s*\{[^}]*grid-template-columns:\s*1fr/m,
    );
    const reducedMotion = mediaBlock('(prefers-reduced-motion: reduce)');
    expect(reducedMotion).toMatch(
      /\.target-qr-dialog\s*\{[^}]*animation:\s*none/m,
    );
    expect(reducedMotion).toMatch(
      /\.target-qr-loading::before\s*\{[^}]*animation:\s*none/m,
    );
  });
});

function cssRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm').exec(css)?.groups?.body ?? '';
}

function mediaBlock(query: string): string {
  const start = css.indexOf(`@media ${query}`);
  if (start < 0) {
    return '';
  }
  let depth = 0;
  let entered = false;
  for (let index = start; index < css.length; index += 1) {
    if (css[index] === '{') {
      depth += 1;
      entered = true;
    } else if (css[index] === '}') {
      depth -= 1;
      if (entered && depth === 0) {
        return css.slice(start, index + 1);
      }
    }
  }
  return '';
}

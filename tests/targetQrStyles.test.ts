import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');
const redesignCss = readFileSync('src/styles/arvenilo-redesign.css', 'utf8');

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
    expect(cssRule('.target-qr-share-status')).toContain('grid-column: 1 / -1');
  });

  it('replaces legacy glass and gradients with solid QR surfaces', () => {
    expect(cssRuleFrom(redesignCss, '.target-qr-overlay')).toContain('backdrop-filter: none');
    expect(cssRuleFrom(redesignCss, '.target-qr-dialog')).toContain(
      'background: var(--color-reality-mist)',
    );
    expect(cssRuleFrom(redesignCss, '.target-qr-dialog')).toContain('box-shadow: none');
    expect(cssRuleFrom(redesignCss, '.target-qr-preview-shell')).toContain(
      'background: var(--color-interface-white)',
    );
  });

  it('uses canonical QR typography and one meaningful Gold target detail', () => {
    const heading = cssRuleFrom(redesignCss, '.target-qr-dialog-copy h2');
    expect(heading).toContain('font-family: var(--font-display)');
    expect(heading).toContain('font-weight: 650');
    expect(cssRuleFrom(redesignCss, '.target-qr-target span')).toContain(
      'background: var(--color-anchor-gold)',
    );
    const decoration = cssRuleFrom(redesignCss, '.target-qr-dialog::before');
    expect(decoration).toContain('content: none');
    expect(decoration).toContain('display: none');
    expect(decoration).not.toContain('var(--color-anchor-gold)');
  });

  it('shows QR errors and busy sharing with explicit semantic colors', () => {
    expect(cssRuleFrom(redesignCss, '.target-qr-error')).toContain(
      'color: var(--color-error-dark)',
    );
    expect(cssRuleFrom(redesignCss, '.target-qr-share-status[data-tone="error"]')).toContain(
      'color: var(--color-error-dark)',
    );
    expect(cssRuleFrom(redesignCss, '.target-qr-actions [aria-busy="true"]')).toContain(
      'cursor: progress',
    );
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

    const redesignReducedMotion = mediaBlockFrom(redesignCss, '(prefers-reduced-motion: reduce)');
    expect(redesignReducedMotion).toMatch(
      /\.target-qr-dialog\s*\{[^}]*animation:\s*none/m,
    );
    expect(redesignReducedMotion).toMatch(
      /\.target-qr-loading::before,\s*\.target-model-card-loader::before,\s*\.target-preview-loader-spinner\s*\{[^}]*animation:\s*none/m,
    );
  });
});

function cssRuleFrom(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm').exec(source)?.groups?.body ?? '';
}

function mediaBlockFrom(source: string, query: string): string {
  const start = source.lastIndexOf(`@media ${query}`);
  if (start < 0) return '';
  let depth = 0;
  let entered = false;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
      entered = true;
    } else if (source[index] === '}') {
      depth -= 1;
      if (entered && depth === 0) return source.slice(start, index + 1);
    }
  }
  return '';
}

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

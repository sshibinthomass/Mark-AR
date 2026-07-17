import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokenCss = readFileSync('src/styles/arvenilo-tokens.css', 'utf8');
const componentCss = readFileSync('src/styles/arvenilo-redesign.css', 'utf8');

function cssRule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm').exec(source)?.groups?.body ?? '';
}

describe('shared UI system styles', () => {
  it('defines the shared palette, typography, spacing, shape, and control tokens', () => {
    const root = cssRule(tokenCss, ':root');

    expect(root).toContain('--color-spatial-ink: #081d21');
    expect(root).toContain('--color-reality-mist: #f4fbfa');
    expect(root).toContain('--color-signal-mint: #5eead4');
    expect(root).toContain('--color-digital-violet: #7456f1');
    expect(root).toContain('--color-anchor-gold: #f4b942');
    expect(root).toContain('--color-error-dark: #b83e4b');
    expect(root).toContain('--radius-control: 10px');
    expect(root).toContain('--radius-card: 16px');
    expect(root).toContain('--font-display:');
    expect(root).toContain('--font-utility:');
  });

  it('provides coherent action variants and a shared focus ring', () => {
    expect(cssRule(componentCss, '.action-control')).toContain('min-height: 44px');
    expect(cssRule(componentCss, '.action-control--primary')).toContain('background: var(--color-signal-mint)');
    expect(cssRule(componentCss, '.action-control--secondary')).toContain('border-color: var(--color-border-dark)');
    expect(cssRule(componentCss, '.action-control--quiet')).toContain('background: transparent');
    expect(cssRule(componentCss, '.action-control--danger')).toContain('color: var(--color-error-dark)');
    expect(cssRule(componentCss, '.action-control--inverse')).toContain('color: var(--color-interface-white)');
    expect(componentCss).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid/m);
    expect(cssRule(componentCss, '[data-page-heading]:focus')).toContain('outline: none');
  });

  it('uses three equal Home destination columns on desktop', () => {
    expect(cssRule(componentCss, '.mode-picker')).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
  });

  it('uses editorial Home grids with readable desktop column counts', () => {
    expect(cssRule(componentCss, '.spatial-proof-inner')).toContain('grid-template-columns:');
    expect(cssRule(componentCss, '.use-case-grid')).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
    expect(cssRule(componentCss, '.capability-grid')).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
  });
});

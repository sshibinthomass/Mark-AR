import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

function cssRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm').exec(css)?.groups?.body ?? '';
}

describe('shared UI system styles', () => {
  it('defines the shared palette, typography, spacing, shape, and control tokens', () => {
    const root = cssRule(':root');

    expect(root).toContain('--ink: #102326');
    expect(root).toContain('--paper: #f4fbfa');
    expect(root).toContain('--teal-dark: #0f766e');
    expect(root).toContain('--teal: #5eead4');
    expect(root).toContain('--gold: #fbbf24');
    expect(root).toContain('--danger: #b91c1c');
    expect(root).toContain('--radius-control: 8px');
    expect(root).toContain('--radius-card: 12px');
    expect(root).toContain('--control-height: 44px');
    expect(root).toContain('--display:');
    expect(root).toContain('--utility:');
  });

  it('provides coherent action variants and a shared focus ring', () => {
    expect(cssRule('.action-control')).toContain('min-height: var(--control-height)');
    expect(cssRule('.action-control--primary')).toContain('background: var(--teal)');
    expect(cssRule('.action-control--secondary')).toContain('border-color: var(--line-strong)');
    expect(cssRule('.action-control--quiet')).toContain('background: transparent');
    expect(cssRule('.action-control--danger')).toContain('color: var(--danger)');
    expect(cssRule('.action-control--inverse')).toContain('color: #ffffff');
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid/m);
  });

  it('uses three equal Home destination columns on desktop', () => {
    expect(cssRule('.mode-picker')).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
  });

  it('aligns the Home copy, workflow, preview, and mode cards to named desktop areas', () => {
    const landing = cssRule('.landing-inner');

    expect(landing).toContain('grid-template-areas:');
    expect(cssRule('.landing-copy')).toContain('grid-area: copy');
    expect(cssRule('.landing-flow')).toContain('grid-area: flow');
    expect(cssRule('.landing-preview')).toContain('grid-area: preview');
    expect(cssRule('.mode-picker')).toContain('grid-area: modes');
  });
});

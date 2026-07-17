import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/arvenilo-redesign.css', 'utf8');

describe('AnchorAR redesign styles', () => {
  it('establishes the branded shell and editorial canvas', () => {
    expect(css).toContain('background: var(--color-reality-mist)');
    expect(css).toContain('font-family: var(--font-text)');
    expect(css).toMatch(/\.brand-link img\s*\{[^}]*object-fit:\s*contain/s);
    expect(css).toMatch(/\.shell-nav\s*\{[^}]*max-width:\s*var\(--content-max\)/s);
  });

  it('uses the approved story-first hierarchy', () => {
    expect(css).toMatch(/\.story-hero\s*\{[^}]*text-align:\s*center/s);
    expect(css).toMatch(/\.spatial-proof\s*\{[^}]*background:\s*var\(--color-spatial-ink\)/s);
    expect(css).toMatch(/\.aperture-signal\s*\{[^}]*border[^;]*var\(--color-anchor-gold\)/s);
    expect(css).toMatch(/\.mode-picker\s*\{[^}]*repeat\(3,/s);
  });

  it('uses mint for action and gold only for spatial focus', () => {
    expect(css).toMatch(/\.action-control--primary\s*\{[^}]*background:\s*var\(--color-signal-mint\)/s);
    expect(css).not.toMatch(/\.action-control--primary\s*\{[^}]*var\(--color-anchor-gold\)/s);
  });

  it('provides the 767px mobile shell and reduced motion', () => {
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*\.route-tabs\s*\{[\s\S]*position:\s*fixed/);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

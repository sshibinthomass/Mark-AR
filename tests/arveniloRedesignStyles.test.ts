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

  it('defines the AnchorAR route surface contracts after legacy CSS', () => {
    expect(css).toMatch(/\[data-page="scan"\]\s+\.scanner-stage-stack\s*\{[^}]*border-radius:\s*var\(--radius-stage\)/s);
    expect(css).toMatch(/\.target-preview-stage\s*\{[^}]*background:\s*var\(--color-spatial-void\)/s);
    expect(css).toMatch(/\.target-inspector-tabs button\[aria-selected="true"\]\s*\{[^}]*var\(--color-signal-mint\)/s);
    expect(css).toMatch(/\.target-model-card\[aria-selected="true"\]\s*\{[^}]*var\(--color-anchor-gold\)/s);
    expect(css).toMatch(/\.auth-control-card\s*\{[^}]*background:\s*var\(--color-interface-white\)/s);
    expect(css).toMatch(/\.target-qr-dialog\s*\{[^}]*background:\s*var\(--color-reality-mist\)/s);
    expect(css).toMatch(/\[data-tone="error"\]\s*\{[^}]*var\(--color-error-dark\)/s);
  });

  it('makes busy, disabled, error, and loading states explicit', () => {
    expect(css).toMatch(/\[aria-busy="true"\]\s*\{[^}]*cursor:\s*progress/s);
    expect(css).toMatch(/button:disabled,\s*\[aria-disabled="true"\]\s*\{[^}]*cursor:\s*not-allowed/s);
    expect(css).toMatch(/\.target-preview-loader\s*\{[^}]*background:\s*var\(--color-spatial-surface\)/s);
    expect(css).toMatch(/\.target-model-card-loader\s*\{[^}]*color:\s*var\(--color-interface-white\)/s);
    expect(css).toMatch(/\.is-error\s*\{[^}]*color:\s*var\(--color-error-dark\)/s);
  });

  it('closes post-legacy route typography leaks with canonical families', () => {
    expect(css).toMatch(/\.auth-access-copy h3,\s*\.auth-card-head h3\s*\{[^}]*font-family:\s*var\(--font-display\);[^}]*font-weight:\s*650;[^}]*line-height:\s*1\.08;[^}]*letter-spacing:\s*-0\.035em/s);
    expect(css).toMatch(/\.target-qr-dialog-copy h2\s*\{[^}]*font-family:\s*var\(--font-display\);[^}]*font-weight:\s*650/s);
    expect(css).toMatch(/\.target-qr-dialog-copy > p:not\(\.eyebrow, \.target-qr-target\)\s*\{[^}]*font-family:\s*var\(--font-text\)/s);
    expect(css).toMatch(/\.page \.eyebrow,\s*\.status-label,\s*\.marker-index,[^}]*\{[^}]*font-family:\s*var\(--font-utility\);[^}]*font-weight:\s*500;[^}]*letter-spacing:\s*0\.08em/s);
  });

  it('restores exact Mint primary controls after legacy ID rules', () => {
    expect(css).toMatch(/#start-ar,\s*#worker-login,\s*#save-image-target,\s*#add-target-text,\s*button\.primary\s*\{[^}]*background:\s*var\(--color-signal-mint\);[^}]*box-shadow:\s*none/s);
  });

  it('overrides legacy protected-link decoration without introducing gold', () => {
    expect(css).toMatch(
      /\.mode-card\[data-auth-locked="true"\]\s*\{[^}]*border-style:\s*solid;[^}]*background:\s*var\(--color-interface-white\)/s,
    );
    expect(css).toMatch(
      /\.route-tabs a\[data-auth-locked="true"\]::after\s*\{[^}]*content:\s*none;[^}]*display:\s*none/s,
    );
  });

  it('keeps anchored Home sections clear of the desktop sticky header', () => {
    expect(css).toMatch(
      /\[data-home-section\]\s*\{[^}]*scroll-margin-top:\s*calc\(64px \+ var\(--space-6\)\)/s,
    );
  });

  it('provides the 767px mobile shell and reduced motion', () => {
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*\.route-tabs\s*\{[\s\S]*position:\s*fixed/);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mediaBlock, selectorBody, stripComments, withoutMedia } from './cssSource';

const css = readFileSync('src/styles/arvenilo.css', 'utf8');
const tokens = readFileSync('src/styles/arvenilo-tokens.css', 'utf8');

const rule = (selector: string) => selectorBody(selector, css);
const baseRule = (selector: string) => selectorBody(selector, withoutMedia(css));

describe('AnchorAR redesign styles', () => {
  it('establishes the branded shell on the dark ground', () => {
    expect(rule('html')).toContain('background: var(--surface-ground)');
    expect(rule('html')).toContain('color: var(--text-primary)');
    /* The body stays transparent so the point field behind it is the ground. */
    expect(rule('body')).toContain('background: transparent');
    expect(rule('body')).toContain('font-family: var(--font-text)');
    expect(rule('.brand-link img')).toContain('object-fit: contain');
    expect(baseRule('.shell-nav')).toContain('max-width: var(--content-max)');
  });

  it('paints the dark ground by default and treats light as an opt-in', () => {
    expect(tokens).toMatch(/:root\s*\{[^}]*--surface-ground:\s*var\(--color-spatial-void\)/s);
    expect(tokens).toMatch(
      /:root\[data-theme="light"\]\s*\{[^}]*--surface-ground:\s*var\(--color-reality-mist\)/s,
    );
    expect(tokens).toMatch(/:root\s*\{[^}]*color-scheme:\s*dark/s);
    expect(tokens).toMatch(/:root\[data-theme="light"\]\s*\{[^}]*color-scheme:\s*light/s);
  });

  it('routes every colour through a token so both themes come from one place', () => {
    const declarations = stripComments(css).replace(/#[\w-]+(?=[\s,{:.[])/g, '');
    expect(declarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(declarations).not.toMatch(/\brgba?\(/);
  });

  it('offers the three band surfaces as one depth ladder', () => {
    expect(rule('.light-section')).toContain('background: var(--surface-band-raised)');
    expect(rule('.dark-section')).toContain('background: var(--surface-band-recessed)');
    expect(rule('.future-section')).toContain('background: var(--surface-band-future)');
  });

  it('uses the approved story-first hierarchy', () => {
    expect(rule('.story-hero')).toContain('text-align: center');
    expect(baseRule('.spatial-proof')).toContain('background: var(--veil-ink)');
    expect(rule('.aperture-signal')).toMatch(/border[^;]*var\(--color-anchor-gold\)/);
    expect(baseRule('.mode-picker')).toMatch(/repeat\(3,/);
  });

  it('uses mint for action and gold only for spatial focus', () => {
    const primary = rule('.action-control--primary');
    expect(primary).toContain('background: var(--color-signal-mint)');
    expect(primary).not.toContain('var(--color-anchor-gold)');
    /* The mint primary covers the named product controls too. */
    expect(primary).toContain('color: var(--text-on-accent)');
    for (const id of ['#start-ar', '#worker-login', '#save-image-target', '#add-target-text']) {
      expect(rule(id), id).toContain('background: var(--color-signal-mint)');
    }
    expect(rule('button.primary')).toContain('box-shadow: none');
  });

  it('defines the AnchorAR route surface contracts', () => {
    expect(rule('[data-page="scan"] .scanner-stage-stack')).toContain(
      'border-radius: var(--radius-stage)',
    );
    expect(baseRule('.target-preview-stage')).toContain('background: var(--color-spatial-void)');
    expect(rule('.target-inspector-tabs button[aria-selected="true"]')).toContain(
      'var(--color-signal-mint)',
    );
    expect(rule('.target-model-card[aria-selected="true"]')).toContain('var(--color-anchor-gold)');
    expect(baseRule('.auth-control-card')).toContain('background: var(--surface-panel)');
    expect(baseRule('.target-qr-dialog')).toContain('background: var(--surface-band-raised)');
  });

  it('makes busy, disabled, error, and loading states explicit', () => {
    expect(rule('[aria-busy="true"]')).toContain('cursor: progress');
    expect(rule('button:disabled')).toContain('cursor: not-allowed');
    expect(rule('[aria-disabled="true"]')).toContain('cursor: not-allowed');
    expect(rule('.target-preview-loader')).toContain('background: var(--color-spatial-surface)');
    expect(rule('.target-model-card-loader')).toContain('color: var(--color-reality-mist)');
    /* Error tone follows the ground rather than being pinned to one red. */
    expect(rule('.is-error')).toContain('color: var(--status-error)');
    expect(rule('[data-tone="error"]')).toContain('color: var(--status-error)');
  });

  it('keeps canonical type families on every route', () => {
    expect(rule('.auth-access-copy h3')).toContain('font-family: var(--font-display)');
    expect(rule('.auth-card-head h3')).toContain('font-weight: 650');
    expect(rule('.target-qr-dialog-copy h2')).toContain('font-family: var(--font-display)');
    expect(rule('.target-qr-dialog-copy > p:not(.eyebrow, .target-qr-target)')).toContain(
      'font-family: var(--font-text)',
    );

    const eyebrow = rule('.eyebrow');
    expect(eyebrow).toContain('font-family: var(--font-utility)');
    expect(eyebrow).toContain('font-weight: 500');
    expect(eyebrow).toContain('letter-spacing: 0.08em');
    expect(rule('.marker-index')).toContain('font-family: var(--font-utility)');
    expect(rule('.status-label')).toContain('font-family: var(--font-utility)');
  });

  it('leaves protected links undecorated rather than marking them gold', () => {
    expect(rule('.mode-card[data-auth-locked="true"]')).toContain('border-style: solid');
    expect(rule('.mode-card[data-auth-locked="true"]')).not.toContain('anchor-gold');
    const marker = rule('.route-tabs a[data-auth-locked="true"]::after');
    expect(marker).toContain('content: none');
    expect(marker).toContain('display: none');
  });

  it('keeps anchored Home sections clear of the sticky header', () => {
    expect(baseRule('[data-home-section]')).toContain(
      'scroll-margin-top: calc(var(--header-height) + var(--space-6))',
    );
    expect(selectorBody('[data-home-section]', mediaBlock('(max-width: 767px)', css))).toContain(
      'env(safe-area-inset-top)',
    );
  });

  it('provides the 767px mobile shell and reduced motion', () => {
    const mobile = mediaBlock('(max-width: 767px)', css);
    expect(mobile).not.toBe('');
    expect(selectorBody('.route-tabs', mobile)).toContain('position: fixed');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

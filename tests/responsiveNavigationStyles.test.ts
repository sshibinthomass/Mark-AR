import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = [
  readFileSync('src/style.css', 'utf8'),
  readFileSync('src/styles/arvenilo-redesign.css', 'utf8'),
].join('\n');

function mediaBlock(query: string): string {
  const start = css.indexOf(`@media ${query}`);
  if (start < 0) return '';
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(open + 1, index);
  }
  return '';
}

function cssRule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm').exec(source)?.groups?.body ?? '';
}

describe('responsive navigation styles', () => {
  const mobile = mediaBlock('(max-width: 767px)');
  const compactAccount = mediaBlock('(max-width: 359px)');

  it('uses a compact brand bar and fixed four-item bottom navigation', () => {
    expect(cssRule(mobile, '.shell-nav')).toContain('min-height: 52px');
    expect(cssRule(mobile, '.shell-nav')).toContain('backdrop-filter: none');
    expect(cssRule(mobile, '.route-tabs')).toContain('position: fixed');
    expect(cssRule(mobile, '.route-tabs')).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
    expect(cssRule(mobile, '.route-tabs')).toContain('bottom: 0');
    expect(cssRule(mobile, '.app-shell')).toContain('env(safe-area-inset-bottom)');
    expect(cssRule(mobile, '.route-tabs a')).toContain('min-height: 56px');
    expect(cssRule(mobile, '.brand-link img')).toContain('width: 40px');
    expect(cssRule(mobile, '.brand-link img')).toContain('height: 40px');
  });

  it('restores the vertical Home gateway card flow after the legacy mobile rules', () => {
    const modeCard = cssRule(mobile, '.mode-card');

    expect(modeCard).toContain('grid-template-columns: 1fr');
    expect(modeCard).toContain('grid-template-rows: auto auto 1fr auto');
    expect(modeCard).toContain('gap: var(--space-3)');
    expect(modeCard).toContain('align-items: stretch');
    expect(mobile).toMatch(
      /\.mode-card > span,\s*\.mode-card > strong,\s*\.mode-card > small,\s*\.mode-card > em\s*\{[^}]*grid-column:\s*auto;[^}]*grid-row:\s*auto/s,
    );
  });

  it('keeps anchored Home sections clear of the safe-area-aware compact header', () => {
    expect(cssRule(mobile, '[data-home-section]')).toContain(
      'scroll-margin-top: calc(52px + var(--space-5) + env(safe-area-inset-top))',
    );
  });

  it('hides global navigation during marker startup and floor mode', () => {
    expect(mobile).toContain('[data-active-page="scan"][data-scan-session="starting"] .route-tabs');
    expect(mobile).toContain('[data-active-page="scan"][data-scan-session="active"] .route-tabs');
    expect(mobile).toContain('[data-ar-mode="floor"] .route-tabs');
    expect(mobile).toContain('display: none');
  });

  it('keeps a safe-area marker exit visible only for mobile marker sessions', () => {
    expect(cssRule(css, '.marker-session-exit')).toContain('display: none');
    expect(mobile).toContain(
      '[data-active-page="scan"][data-scan-session="starting"][data-ar-mode="marker"] .marker-session-exit',
    );
    expect(mobile).toContain(
      '[data-active-page="scan"][data-scan-session="active"][data-ar-mode="marker"] .marker-session-exit',
    );
    expect(mobile).toMatch(
      /\[data-active-page="scan"\]\[data-scan-session="starting"\]\[data-ar-mode="marker"\] \.marker-session-exit,\s*\[data-active-page="scan"\]\[data-scan-session="active"\]\[data-ar-mode="marker"\] \.marker-session-exit\s*\{[^}]*display:\s*inline-flex/s,
    );
    const exitRule = cssRule(mobile, '.marker-session-exit');
    expect(exitRule).toContain('position: fixed');
    expect(exitRule).toContain('min-width: 48px');
    expect(exitRule).toContain('min-height: 48px');
    expect(exitRule).toContain('env(safe-area-inset-top)');
    expect(exitRule).toContain('env(safe-area-inset-right)');
    expect(mobile).not.toContain('[data-ar-mode="floor"] .marker-session-exit');
  });

  it('keeps page Home controls compact instead of full width', () => {
    const homeLink = cssRule(mobile, '.page-home-link');
    expect(homeLink).toContain('width: fit-content');
    expect(homeLink).toContain('min-height: 44px');
  });

  it('uses task-first mobile sizing for the camera, preview, and account form', () => {
    expect(cssRule(mobile, '.scanner-controls')).toContain('border-radius: var(--radius-card)');
    expect(cssRule(mobile, '.ar-stage')).toContain('min-height: min(58svh, 520px)');
    expect(cssRule(mobile, '.target-preview-stage')).toContain('height: clamp(300px, 48svh, 420px)');
    expect(cssRule(mobile, '.auth-control-card')).toContain('min-height: 0');
    expect(cssRule(mobile, '.scanner-actions button')).toContain('width: 100%');
    expect(cssRule(mobile, '.floor-ar-back')).toContain('env(safe-area-inset-top)');
    expect(cssRule(mobile, '.auth-orbit')).toContain('display: none');
    expect(cssRule(mobile, '.auth-access-copy')).toContain('max-width: 100%');
  });

  it('compacts only the narrow Account stack while preserving full-size controls', () => {
    expect(compactAccount).not.toBe('');
    expect(cssRule(compactAccount, '[data-page="account"] .page-header')).toContain(
      'margin-bottom: var(--space-3)',
    );
    expect(cssRule(compactAccount, '[data-page="account"] .auth-control-card')).toContain(
      'padding: var(--space-4)',
    );
    expect(cssRule(compactAccount, '[data-page="account"] .auth-card-head')).toContain(
      'padding-bottom: var(--space-3)',
    );
    expect(cssRule(compactAccount, '[data-page="account"] .auth-form-shell')).toContain(
      'gap: var(--space-3)',
    );
    expect(cssRule(compactAccount, '[data-page="account"] .login-form input')).toContain(
      'min-height: 44px',
    );
    expect(cssRule(compactAccount, '[data-page="account"] #worker-login')).toContain(
      'min-height: 44px',
    );
  });

  it('makes the save strip sticky only for an active target draft', () => {
    expect(mobile).toContain('[data-has-target-draft="true"] .target-save-strip');
    expect(cssRule(mobile, '[data-has-target-draft="true"] .target-save-strip')).toContain(
      'position: sticky',
    );
    expect(cssRule(mobile, '[data-has-target-draft="true"] .target-save-strip')).toContain(
      'bottom: calc(72px + env(safe-area-inset-bottom))',
    );
  });
});

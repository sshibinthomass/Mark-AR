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

  it('uses a compact brand bar and fixed four-item bottom navigation', () => {
    expect(cssRule(mobile, '.shell-nav')).toContain('min-height: 52px');
    expect(cssRule(mobile, '.shell-nav')).toContain('backdrop-filter: none');
    expect(cssRule(mobile, '.route-tabs')).toContain('position: fixed');
    expect(cssRule(mobile, '.route-tabs')).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
    expect(cssRule(mobile, '.route-tabs')).toContain('bottom: 0');
    expect(cssRule(mobile, '.app-shell')).toContain('env(safe-area-inset-bottom)');
    expect(cssRule(mobile, '.route-tabs a')).toContain('min-height: 56px');
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

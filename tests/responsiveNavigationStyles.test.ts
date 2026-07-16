import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

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
  const mobile = mediaBlock('(max-width: 760px)');

  it('uses a compact brand bar and fixed four-item bottom navigation', () => {
    expect(cssRule(mobile, '.shell-nav')).toContain('min-height: 52px');
    expect(cssRule(mobile, '.route-tabs')).toContain('position: fixed');
    expect(cssRule(mobile, '.route-tabs')).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
    expect(cssRule(mobile, '.route-tabs')).toContain('bottom: 0');
    expect(cssRule(mobile, '.app-shell')).toContain('env(safe-area-inset-bottom)');
    expect(cssRule(mobile, '.route-tabs a')).toContain('min-height: 56px');
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
  });

  it('makes the save strip sticky only for an active target draft', () => {
    expect(mobile).toContain('[data-has-target-draft="true"] .target-save-strip');
    expect(cssRule(mobile, '[data-has-target-draft="true"] .target-save-strip')).toContain(
      'position: sticky',
    );
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/studio-shell.css', 'utf8');

// Anchors on a rule boundary so a selector is not matched inside a grouped selector list.
function cssRule(selector: string, source = css): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[{};/])\\s*${escaped}\\s*\\{(?<body>[^}]*)\\}`).exec(source)?.groups?.body ?? '';
}

function mediaBlock(query: string): string {
  const start = css.indexOf(`@media ${query}`);
  if (start === -1) {
    return '';
  }

  const openBrace = css.indexOf('{', start);
  let depth = 0;
  for (let index = openBrace; index < css.length; index += 1) {
    if (css[index] === '{') {
      depth += 1;
    }
    if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return css.slice(openBrace + 1, index);
      }
    }
  }

  return '';
}

describe('studio shell styles', () => {
  it('makes the studio route a fixed full-bleed shell instead of a document page', () => {
    const shell = cssRule('.app-shell[data-active-page="targets"]');
    const page = cssRule('.target-page');

    expect(shell).toContain('height: 100dvh');
    expect(shell).toContain('max-width: none');
    expect(shell).toContain('padding: 0');
    expect(shell).toContain('overflow: hidden');
    expect(shell).toContain('grid-template-rows: auto minmax(0, 1fr)');
    expect(page).toContain('max-width: none');
    expect(page).toContain('grid-template-rows: auto minmax(0, 1fr)');
  });

  it('collapses the page header into an editor topbar without the marketing copy', () => {
    const header = cssRule('.target-page .page-header');
    const heading = cssRule('.target-page .page-header h2');

    expect(header).toContain('min-height: var(--studio-topbar-height)');
    expect(header).toContain('margin: 0');
    expect(cssRule('.target-page .page-header .eyebrow,\n.target-page .page-heading-copy > p')).toContain(
      'display: none',
    );
    expect(heading).toContain('font-size: 15px');
    expect(heading).toContain('white-space: nowrap');
  });

  it('lets the canvas fill the workspace and keeps the dock at a fixed width', () => {
    const workspace = cssRule('.target-page .target-workspace');
    const stage = cssRule('.target-page .target-preview-stage');
    const dock = cssRule('.target-page .target-inspector-card');

    expect(workspace).toContain('grid-template-columns: minmax(0, 1fr) var(--studio-dock-width)');
    expect(workspace).toContain('gap: 0');
    expect(stage).toContain('height: 100%');
    expect(stage).not.toContain('clamp');
    expect(dock).toContain('height: 100%');
    expect(dock).toContain('overflow: hidden');
    expect(cssRule('.target-page .target-inspector-panels')).toContain('overflow-y: auto');
  });

  it('floats canvas overlays without stealing pointer events from the stage', () => {
    const overlay = cssRule('.target-page .target-preview-controls');
    const toolbar = cssRule('.target-page .target-transform-toolbar');
    const camera = cssRule('.target-page .target-camera-view-controls');

    expect(overlay).toContain('position: absolute');
    expect(overlay).toContain('inset: 0');
    expect(overlay).toContain('pointer-events: none');
    expect(toolbar).toContain('pointer-events: auto');
    expect(camera).toContain('pointer-events: auto');
    expect(camera).toContain('bottom: var(--space-3)');
  });

  it('keeps the camera sliders behind a disclosure', () => {
    expect(cssRule('.target-camera-view-controls[data-studio-hud="collapsed"] .target-camera-view-grid')).toContain(
      'display: none',
    );
  });

  it('gives the studio a compact control scale that grows for coarse pointers', () => {
    const tokens = cssRule(':root');
    const coarse = mediaBlock('(pointer: coarse)');

    expect(tokens).toContain('--studio-control-height: 32px');
    expect(tokens).toContain('--studio-control-small: 26px');
    expect(tokens).toContain('--studio-control-large: 38px');
    expect(cssRule(':root', coarse)).toContain('--studio-control-height: 44px');
    expect(cssRule('.target-page button')).toContain('min-height: var(--studio-control-height)');
    expect(cssRule('.target-page .target-inspector-tabs')).toContain(
      'grid-template-columns: repeat(3, minmax(0, 1fr))',
    );
  });

  it('draws its own disclosure marker because flex summaries drop the native one', () => {
    const marker = cssRule(
      '.target-page .transform-control-summary::before,\n.target-page .target-text-advanced summary::before',
    );

    expect(marker).toContain('content: ""');
    expect(marker).toContain('border-left: 5px solid currentColor');
    expect(
      cssRule('.target-page details[open] > .transform-control-summary::before,\n.target-page .target-text-advanced[open] > summary::before'),
    ).toContain('transform: rotate(90deg)');
  });

  it('only offers the dock collapse where the dock is a column', () => {
    const wide = mediaBlock('(min-width: 901px)');

    expect(cssRule('.target-page[data-studio-dock="collapsed"] .target-workspace', wide)).toContain(
      'grid-template-columns: minmax(0, 1fr)',
    );
    expect(cssRule('.target-page[data-studio-dock="collapsed"] .target-inspector-card', wide)).toContain(
      'display: none',
    );
    expect(cssRule('.studio-dock-toggle', mediaBlock('(max-width: 900px)'))).toContain('display: none');
  });

  it('pins the canvas to the top of the viewport once the editor stacks', () => {
    const stacked = mediaBlock('(max-width: 900px)');

    expect(cssRule('.target-page .target-preview-shell', stacked)).toContain('position: sticky');
    expect(cssRule('.target-page .target-preview-shell', stacked)).toContain('top: 0');
    expect(cssRule('.target-page .target-workspace', stacked)).toContain(
      'grid-template-columns: minmax(0, 1fr)',
    );
    expect(cssRule('.target-page .target-inspector-card', stacked)).toContain('overflow: visible');
  });

  it('keeps the phone camera bar to a single row and drops the redundant brand bar', () => {
    const phone = mediaBlock('(max-width: 767px)');

    // The bottom route tabs live inside the nav, so the bar collapses instead of hiding.
    expect(cssRule('.app-shell[data-active-page="targets"] .shell-nav', phone)).toContain('min-height: 0');
    expect(cssRule('.app-shell[data-active-page="targets"] .shell-nav', phone)).not.toContain('display: none');
    expect(
      cssRule('.app-shell[data-active-page="targets"] .brand-link,\n  .app-shell[data-active-page="targets"] .shell-story-links', phone),
    ).toContain('display: none');
    expect(cssRule('.target-page .target-camera-preset-row', phone)).toContain('display: flex');
    expect(cssRule('.target-page .target-camera-preset-row', phone)).toContain('overflow-x: auto');
    expect(cssRule('.target-page .target-camera-view-controls .eyebrow', phone)).toContain('display: none');
    expect(cssRule('.app-shell[data-active-page="targets"]', phone)).toContain(
      'padding-bottom: calc(76px + env(safe-area-inset-bottom))',
    );
  });
});

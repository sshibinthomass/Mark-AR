import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mediaBlock, selectorBody, withoutMedia } from './cssSource';

const css = readFileSync('src/styles/studio-shell.css', 'utf8');
const base = withoutMedia(css);

function rule(selector: string, source = base): string {
  return selectorBody(selector, source);
}

describe('studio shell styles', () => {
  it('makes the studio route a fixed full-bleed shell instead of a document page', () => {
    const shell = rule('.app-shell[data-active-page="targets"]');
    const page = rule('.target-page');

    expect(shell).toContain('height: 100dvh');
    expect(shell).toContain('max-width: none');
    expect(shell).toContain('padding: 0');
    expect(shell).toContain('overflow: hidden');
    expect(shell).toContain('grid-template-rows: auto minmax(0, 1fr)');
    expect(page).toContain('max-width: none');
    expect(page).toContain('grid-template-rows: auto minmax(0, 1fr)');
  });

  it('collapses the page header into an editor topbar without the marketing copy', () => {
    const header = rule('.target-page .page-header');
    const heading = rule('.target-page .page-header h2');

    expect(header).toContain('min-height: var(--studio-topbar-height)');
    expect(header).toContain('margin: 0');
    expect(rule('.target-page .page-heading-copy > p')).toContain('display: none');
    expect(rule('.target-page .page-header .eyebrow')).toContain('display: none');
    expect(heading).toContain('font-size: 15px');
    expect(heading).toContain('white-space: nowrap');
  });

  it('lets the canvas fill the workspace and keeps the dock at a fixed width', () => {
    const workspace = rule('.target-page .target-workspace');
    const stage = rule('.target-page .target-preview-stage');
    const dock = rule('.target-page .target-inspector-card');

    expect(workspace).toContain('grid-template-columns: minmax(0, 1fr) var(--studio-dock-width)');
    expect(workspace).toContain('gap: 0');
    expect(stage).toContain('height: 100%');
    expect(stage).not.toContain('clamp');
    expect(dock).toContain('height: 100%');
    expect(dock).toContain('overflow: hidden');
    expect(rule('.target-page .target-inspector-panels')).toContain('overflow-y: auto');
  });

  it('floats canvas overlays without stealing pointer events from the stage', () => {
    const overlay = rule('.target-page .target-preview-controls');

    expect(overlay).toContain('position: absolute');
    expect(overlay).toContain('inset: 0');
    expect(overlay).toContain('pointer-events: none');
    expect(rule('.target-page .target-transform-toolbar')).toContain('pointer-events: auto');
    expect(rule('.target-page .target-camera-view-controls')).toContain('pointer-events: auto');
    expect(rule('.target-page .target-camera-view-controls')).toContain('bottom: var(--space-3)');
  });

  it('keeps the camera sliders behind a disclosure', () => {
    expect(rule('.target-camera-view-controls[data-studio-hud="collapsed"] .target-camera-view-grid')).toContain(
      'display: none',
    );
  });

  it('gives the studio a compact control scale that grows for coarse pointers', () => {
    const tokens = rule(':root');

    expect(tokens).toContain('--studio-control-height: 32px');
    expect(tokens).toContain('--studio-control-small: 26px');
    expect(tokens).toContain('--studio-control-large: 38px');
    expect(rule(':root', mediaBlock('(pointer: coarse)', css))).toContain('--studio-control-height: 44px');
    expect(rule('.target-page button')).toContain('min-height: var(--studio-control-height)');
    expect(rule('.target-page .target-inspector-tabs')).toContain(
      'grid-template-columns: repeat(3, minmax(0, 1fr))',
    );
  });

  /*
    The design system is dark-first and splits its tokens: the raw palette never
    flips, the semantic layer does. Chrome docked to the page must read the
    semantic layer or it paints light slabs on the dark ground.
  */
  it('reads the semantic token layer for chrome docked to the page', () => {
    for (const selector of [
      '.target-page .page-header',
      '.target-page .target-inspector-card',
      '.app-shell[data-active-page="targets"] .shell-nav',
      '.target-page .transform-control-group',
    ]) {
      const body = rule(selector);
      expect(body, selector).not.toContain('var(--color-interface-white)');
      expect(body, selector).not.toContain('var(--color-border-light)');
    }

    expect(rule('.target-page .page-header')).toContain('background: var(--surface-chrome)');
    expect(rule('.target-page .target-inspector-card')).toContain('border-left: 1px solid var(--line-soft)');
  });

  /*
    Chrome drawn over the stage is the exception: the stage is void in both
    themes, so this chrome stays dark rather than following the semantic layer.
  */
  it('keeps chrome drawn over the 3D stage dark in both themes', () => {
    expect(rule('.target-page .target-transform-toolbar')).toContain('background: var(--studio-hud-surface)');
    expect(rule('.target-page .target-camera-view-controls')).toContain('background: var(--studio-hud-surface)');
    expect(rule('.studio-hud-toggle')).toContain('color: var(--color-reality-mist)');
    expect(rule('.target-stage-empty strong')).toContain('color: var(--color-reality-mist)');
    expect(rule('.target-stage-empty')).toContain('color: var(--color-mist-slate)');
  });

  it('draws its own disclosure marker because flex summaries drop the native one', () => {
    const marker = rule('.target-page .transform-control-summary::before');

    expect(marker).toContain('content: ""');
    expect(marker).toContain('border-left: 5px solid currentColor');
    expect(rule('.target-page details[open] > .transform-control-summary::before')).toContain(
      'transform: rotate(90deg)',
    );
  });

  it('only offers the dock collapse where the dock is a column', () => {
    const wide = mediaBlock('(min-width: 901px)', css);

    expect(rule('.target-page[data-studio-dock="collapsed"] .target-workspace', wide)).toContain(
      'grid-template-columns: minmax(0, 1fr)',
    );
    expect(rule('.target-page[data-studio-dock="collapsed"] .target-inspector-card', wide)).toContain(
      'display: none',
    );
    expect(rule('.studio-dock-toggle', mediaBlock('(max-width: 900px)', css))).toContain('display: none');
  });

  it('pins the canvas to the top of the viewport once the editor stacks', () => {
    const stacked = mediaBlock('(max-width: 900px)', css);

    expect(rule('.target-page .target-preview-shell', stacked)).toContain('position: sticky');
    expect(rule('.target-page .target-preview-shell', stacked)).toContain('top: 0');
    expect(rule('.target-page .target-workspace', stacked)).toContain(
      'grid-template-columns: minmax(0, 1fr)',
    );
    expect(rule('.target-page .target-inspector-card', stacked)).toContain('overflow: visible');
  });

  it('keeps the phone camera bar to a single row and drops the redundant brand bar', () => {
    const phone = mediaBlock('(max-width: 767px)', css);

    // The bottom route tabs live inside the nav, so the bar collapses instead of hiding.
    expect(rule('.app-shell[data-active-page="targets"] .shell-nav', phone)).toContain('min-height: 0');
    expect(rule('.app-shell[data-active-page="targets"] .shell-nav', phone)).not.toContain('display: none');
    expect(rule('.app-shell[data-active-page="targets"] .brand-link', phone)).toContain('display: none');
    expect(rule('.target-page .target-camera-preset-row', phone)).toContain('display: flex');
    expect(rule('.target-page .target-camera-preset-row', phone)).toContain('overflow-x: auto');
    expect(rule('.target-page .target-camera-view-controls .eyebrow', phone)).toContain('display: none');
    expect(rule('.app-shell[data-active-page="targets"]', phone)).toContain(
      'padding-bottom: calc(76px + env(safe-area-inset-bottom))',
    );
  });
});

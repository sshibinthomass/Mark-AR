import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { selectorBody, mediaBlock as sourceMediaBlock } from './cssSource';

const css = readFileSync('src/styles/arvenilo.css', 'utf8');
const redesignCss = readFileSync('src/styles/arvenilo.css', 'utf8');
const combinedCss = `${css}\n${redesignCss}`;

function cssRule(selector: string, source = css): string {
  return selectorBody(selector, source);
}

function lastCssRule(selector: string): string {
  return selectorBody(selector, combinedCss);
}

function mediaBlock(query: string): string {
  return sourceMediaBlock(query, css);
}

describe('target inspector styles', () => {
  it('allocates the remaining desktop card height to the scrollable inspector panel', () => {
    const card = cssRule('.target-inspector-card');
    const panels = cssRule('.target-inspector-panels');

    expect(card).toMatch(/(?:^|\r?\n)\s*height: calc\(100svh - 104px\);/);
    expect(card).toContain('grid-template-rows: auto auto minmax(0, 1fr)');
    expect(card).toContain('overflow: hidden');
    expect(panels).toContain('min-height: 0');
    expect(panels).toContain('overflow-y: auto');
  });

  it('packs active inspector content at the top instead of stretching its grid rows', () => {
    const panels = cssRule('.target-inspector-panels');

    expect(panels).toContain('align-content: start');
  });

  it('returns the inspector card to content height on narrow layouts', () => {
    const responsive = mediaBlock('(max-width: 1023px)');
    const card = cssRule('.target-inspector-card');
    const responsiveCard = cssRule('.target-inspector-card', responsive);

    expect(card).toMatch(/(?:^|\r?\n)\s*height: calc\(100svh - 104px\);/);
    expect(responsiveCard).toMatch(/(?:^|\r?\n)\s*height: auto;/);
    expect(responsiveCard).toContain('max-height: none');
    expect(responsiveCard).toContain('overflow: visible');
  });

  it('keeps tab buttons aligned at the shared touch-target height', () => {
    const buttonRuleIndex = css.indexOf('.target-page button');
    const tabOverrideIndex = css.indexOf('.target-page .target-inspector-tabs button');
    const tabOverride = cssRule('.target-page .target-inspector-tabs button');

    expect(tabOverrideIndex).toBeGreaterThan(buttonRuleIndex);
    expect(tabOverride).toContain('display: inline-flex');
    expect(tabOverride).toContain('align-items: center');
    expect(tabOverride).toContain('justify-content: center');
    expect(tabOverride).toContain('width: 100%');
    expect(tabOverride).toContain('min-width: 0');
    expect(tabOverride).toContain('min-height: var(--control-height)');
    expect(tabOverride).toContain('padding: 6px 5px');
    expect(tabOverride).toContain('font-size: var(--text-label)');
  });

  it('stacks target transform mode buttons vertically in the preview control row', () => {
    const previewControls = cssRule('.target-preview-controls');
    const transformToolbar = cssRule('.target-transform-toolbar');
    const transformToolbarButton = cssRule('.target-transform-toolbar button');

    expect(previewControls).toContain('align-items: stretch');
    expect(transformToolbar).toContain('flex-direction: column');
    expect(transformToolbar).toContain('align-self: stretch');
    expect(transformToolbar).toContain('align-items: stretch');
    expect(transformToolbarButton).toContain('flex: 1 1 0');
  });

  it('keeps target delete buttons icon-only at the shared touch-target size', () => {
    const deleteButton = cssRule('.target-page .icon-delete-button');
    const icon = cssRule('.trash-icon');

    expect(deleteButton).toContain('display: inline-grid');
    expect(deleteButton).toContain('place-items: center');
    expect(deleteButton).toContain('width: var(--control-height)');
    expect(deleteButton).toContain('min-width: var(--control-height)');
    expect(deleteButton).toContain('min-height: var(--control-height)');
    expect(deleteButton).toContain('padding: 0');
    expect(icon).toContain('width: 16px');
    expect(icon).toContain('height: 18px');
  });

  it('makes saved target content a full-width edit control with a visible active state', () => {
    const row = cssRule('.saved-target-row');
    const open = cssRule('.target-page .saved-target-open');
    const active = cssRule('.saved-target-row.is-active');
    const focus = cssRule('.target-page .saved-target-open:focus-visible');

    expect(row).toContain('grid-template-columns: minmax(0, 1fr) auto');
    expect(open).toContain('display: grid');
    expect(open).toContain('grid-template-columns: 56px minmax(0, 1fr)');
    expect(open).toContain('text-align: left');
    expect(active).toContain('border-color: var(--color-anchor-gold)');
    expect(focus).toContain('outline: 3px solid');
  });

  it('distinguishes selected systems from the selected spatial object', () => {
    expect(cssRule('.target-inspector-tabs button[aria-selected="true"]', redesignCss)).toContain(
      'background: var(--color-signal-mint)',
    );
    expect(cssRule('.target-transform-toolbar button[aria-pressed="true"]', redesignCss)).toContain(
      'border-color: var(--color-signal-mint)',
    );
    expect(cssRule('.target-model-card[aria-selected="true"]', redesignCss)).toContain(
      'border-color: var(--color-anchor-gold)',
    );
    expect(cssRule('.saved-target-row.is-active', redesignCss)).toContain(
      'border-color: var(--color-anchor-gold)',
    );
  });

  it('styles preview and model loading without translucent blur', () => {
    expect(cssRule('.target-preview-stage[aria-busy="true"]', redesignCss)).toContain(
      'cursor: progress',
    );
    expect(cssRule('.target-preview-loader', redesignCss)).not.toContain('backdrop-filter: blur');
    expect(cssRule('.target-model-card-loader', redesignCss)).toContain(
      'background: var(--color-spatial-surface-raised)',
    );
  });

  it('resets higher-specificity legacy inspector components to solid surfaces', () => {
    const button = lastCssRule('.target-page button');
    expect(button).toContain('background: var(--surface-panel)');
    expect(button).toContain('font-weight: 600');
    expect(button).toContain('box-shadow: none');
    expect(button).not.toContain('backdrop-filter: blur');

    const danger = lastCssRule('.target-page .icon-delete-button');
    expect(danger).toContain('border-color: var(--status-error)');
    expect(danger).toContain('background: var(--surface-panel)');
    expect(danger).toContain('box-shadow: none');
    expect(lastCssRule('.target-page .icon-delete-button:hover')).toContain(
      'background: var(--status-error)',
    );

    for (const selector of [
      '.target-object-group',
      '.target-object-group-summary',
      '.target-object-group-select',
      '.target-object-ungroup',
      '.animation-track-card',
      '.animation-track-empty',
      '.saved-target-link-actions button',
      '.saved-target-link-actions a',
    ]) {
      expect(lastCssRule(selector), selector).toMatch(/background:\s*var\(--surface-(?:panel|inset)\)/);
      expect(lastCssRule(selector), selector).toContain('box-shadow: none');
    }

    expect(lastCssRule('.target-page .animation-track-remove')).toContain(
      'color: var(--status-error)',
    );
    for (const axis of ['x', 'y', 'z']) {
      expect(lastCssRule(`.target-page [data-reset-axis="${axis}"]`)).toContain(
        'background: var(--surface-panel)',
      );
    }
  });

  it('adds persistent non-color selected indicators without absolute overlap', () => {
    const saved = cssRule('.saved-target-row.is-active .saved-target-open::after', redesignCss);
    expect(saved).toContain('content: "Selected"');
    expect(saved).toContain('grid-column: 2');
    expect(saved).not.toContain('position: absolute');

    const object = cssRule('.target-object-row[aria-selected="true"] .target-object-select::after', redesignCss);
    const group = cssRule('.target-object-group[aria-selected="true"] .target-object-group-select::after', redesignCss);
    expect(object).toContain('content: "✓ Selected"');
    expect(group).toContain('content: "✓ Selected"');
    expect(object).toContain('grid-column: 1 / -1');
    expect(group).toContain('grid-column: 1 / -1');
  });

  it('restores the qualified shared Mint focus ring', () => {
    for (const selector of [
      '.target-page .target-object-select:focus-visible',
      '.target-page .target-object-group-select:focus-visible',
      '.target-page .target-object-ungroup:focus-visible',
      '.target-page .saved-target-open:focus-visible',
    ]) {
      const rule = lastCssRule(selector);
      expect(rule, selector).toContain('outline: 3px solid var(--color-signal-mint)');
      expect(rule, selector).toContain('outline-offset: 3px');
    }
  });
});

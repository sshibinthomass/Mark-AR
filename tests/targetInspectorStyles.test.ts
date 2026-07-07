import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

function cssRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm').exec(css)?.groups?.body ?? '';
}

describe('target inspector styles', () => {
  it('keeps tab buttons aligned after the broad target button rule', () => {
    const buttonRuleIndex = css.indexOf('.target-page button');
    const tabOverrideIndex = css.indexOf('.target-page .target-inspector-tabs button');
    const tabOverride = cssRule('.target-page .target-inspector-tabs button');

    expect(tabOverrideIndex).toBeGreaterThan(buttonRuleIndex);
    expect(tabOverride).toContain('display: inline-flex');
    expect(tabOverride).toContain('align-items: center');
    expect(tabOverride).toContain('justify-content: center');
    expect(tabOverride).toContain('width: 100%');
    expect(tabOverride).toContain('min-width: 0');
    expect(tabOverride).toContain('min-height: 34px');
    expect(tabOverride).toContain('padding: 6px 5px');
    expect(tabOverride).toContain('font-size: 11px');
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
});

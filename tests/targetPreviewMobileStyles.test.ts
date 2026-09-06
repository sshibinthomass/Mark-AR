import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { selectorBody, mediaBlock as sourceMediaBlock } from './cssSource';

const css = readFileSync('src/styles/arvenilo.css', 'utf8');

function mediaBlock(query: string): string {
  return sourceMediaBlock(query, css);
}

function cssRule(source: string, selector: string): string {
  return selectorBody(selector, source);
}

describe('target preview mobile styles', () => {
  it('keeps target preview controls from covering the mobile canvas and model rail', () => {
    const mobileWorkspace = mediaBlock('(max-width: 767px)');
    const compactPhone = mediaBlock('(max-width: 767px)');
    const previewControls = cssRule(compactPhone, '.target-preview-controls');
    const transformToolbar = cssRule(compactPhone, '.target-transform-toolbar');

    expect(cssRule(mobileWorkspace, '.target-preview-stage')).toContain(
      'height: clamp(300px, 48svh, 420px)',
    );
    expect(previewControls).toContain('position: static');
    expect(previewControls).toContain('width: 100%');
    expect(previewControls).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(previewControls).toContain('margin-bottom: var(--space-2)');
    expect(transformToolbar).toContain('flex-direction: row');
    expect(transformToolbar).toContain('width: 100%');
    expect(compactPhone).not.toContain('.target-camera-gizmo');
  });
});

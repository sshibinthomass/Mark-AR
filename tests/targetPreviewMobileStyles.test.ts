import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

function mediaBlock(query: string): string {
  const start = css.indexOf(`@media ${query}`);
  if (start === -1) {
    return '';
  }

  const openBrace = css.indexOf('{', start);
  let depth = 0;
  for (let index = openBrace; index < css.length; index += 1) {
    const char = css[index];
    if (char === '{') {
      depth += 1;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return css.slice(openBrace + 1, index);
      }
    }
  }

  return '';
}

function cssRule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 'm').exec(source)?.groups?.body ?? '';
}

describe('target preview mobile styles', () => {
  it('keeps target preview controls from covering the mobile canvas and model rail', () => {
    const mobile = mediaBlock('(max-width: 620px)');
    const previewControls = cssRule(mobile, '.target-preview-controls');
    const transformToolbar = cssRule(mobile, '.target-transform-toolbar');
    const cameraGizmo = cssRule(mobile, '.target-camera-gizmo');

    expect(previewControls).toContain('position: static');
    expect(previewControls).toContain('width: 100%');
    expect(previewControls).toContain('grid-template-columns: 1fr');
    expect(previewControls).toContain('margin-bottom: 8px');
    expect(transformToolbar).toContain('flex-direction: row');
    expect(transformToolbar).toContain('width: 100%');
    expect(cameraGizmo).toContain('position: absolute');
    expect(cameraGizmo).toContain('top: auto');
    expect(cameraGizmo).toContain('bottom: calc(8px + 92px)');
    expect(cameraGizmo).toContain('right: 10px');
    expect(cameraGizmo).toContain('width: max-content');
    expect(cameraGizmo).toContain('height: max-content');
  });
});

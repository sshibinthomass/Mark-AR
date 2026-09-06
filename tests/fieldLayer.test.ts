import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isApertureObjectName, mountFieldLayer } from '../src/ui/fieldLayer';

let layer: { destroy: () => void } | null = null;

beforeEach(() => {
  document.body.innerHTML = `
    <div id="app">
      <div class="spatial-aperture-demo" data-aperture-stage data-aperture-mode="poster"></div>
    </div>
  `;
});

afterEach(() => {
  layer?.destroy();
  layer = null;
  document.body.innerHTML = '';
});

describe('field layer', () => {
  it('falls back to the poster where WebGL is unavailable', () => {
    /* happy-dom has no WebGL context, which is exactly the unsupported case. */
    layer = mountFieldLayer(document, 'home');

    const host = document.querySelector<HTMLElement>('.point-field');
    expect(host).not.toBeNull();
    expect(host?.dataset.fieldMode).toBe('poster');
    expect(host?.getAttribute('aria-hidden')).toBe('true');
  });

  it('tells the aperture section to show its flat poster in that case', () => {
    layer = mountFieldLayer(document, 'home');

    expect(
      document.querySelector<HTMLElement>('[data-aperture-stage]')?.dataset.apertureMode,
    ).toBe('poster');
  });

  it('mounts the layer behind the app rather than inside it', () => {
    layer = mountFieldLayer(document, 'home');

    expect(document.body.firstElementChild?.classList.contains('point-field')).toBe(true);
    expect(document.querySelector('#app .point-field')).toBeNull();
  });

  it('accepts route, theme, and object changes without a live scene', () => {
    layer = mountFieldLayer(document, 'home');
    const handle = layer as ReturnType<typeof mountFieldLayer>;

    expect(() => {
      handle.setRoute('targets');
      handle.setTheme('light');
      handle.setApertureObject('book');
    }).not.toThrow();
  });

  it('removes its host on destroy', () => {
    const handle = mountFieldLayer(document, 'home');
    expect(document.querySelector('.point-field')).not.toBeNull();

    handle.destroy();
    expect(document.querySelector('.point-field')).toBeNull();
  });

  it('recognises only the design system aperture objects', () => {
    for (const name of ['book', 'menu', 'card', 'ad', 'story']) {
      expect(isApertureObjectName(name), name).toBe(true);
    }

    expect(isApertureObjectName('sphere')).toBe(false);
    expect(isApertureObjectName('')).toBe(false);
  });
});

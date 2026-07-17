import { describe, expect, it, vi } from 'vitest';
import { applyResponsiveLayout, setupResponsiveLayout } from '../src/ui/responsiveLayout';

describe('responsive layout coordinator', () => {
  it('puts task controls before large supporting surfaces on mobile', () => {
    const root = renderFixture();
    const before = [...root.querySelectorAll('[data-home-section]')];

    applyResponsiveLayout(root, true);

    expect([...root.querySelectorAll('[data-home-section]')]).toEqual(before);
    expect(root.dataset.layoutViewport).toBe('mobile');
    expect(layoutOrder(root, '.scanner-panel')).toEqual([
      'scanner-controls',
      'scanner-stage',
    ]);
    expect(layoutOrder(root, '.target-workspace')).toEqual([
      'target-inspector',
      'target-preview',
    ]);
    expect(layoutOrder(root, '.auth-layout')).toEqual([
      'auth-controls',
      'auth-access',
    ]);
  });

  it('restores the desktop workspace order', () => {
    const root = renderFixture();
    applyResponsiveLayout(root, true);

    applyResponsiveLayout(root, false);

    expect(layoutOrder(root, '.scanner-panel')).toEqual([
      'scanner-stage',
      'scanner-controls',
    ]);
    expect(layoutOrder(root, '.target-workspace')).toEqual([
      'target-preview',
      'target-inspector',
    ]);
    expect(layoutOrder(root, '.auth-layout')).toEqual([
      'auth-access',
      'auth-controls',
    ]);
  });

  it('updates layout when the media query changes and removes its listener on dispose', () => {
    const root = renderFixture();
    const media = fakeMediaQuery(false);

    const coordinator = setupResponsiveLayout(root, media);
    expect(layoutOrder(root, '.scanner-panel')).toEqual(['scanner-stage', 'scanner-controls']);

    media.setMatches(true);
    expect(layoutOrder(root, '.scanner-panel')).toEqual(['scanner-controls', 'scanner-stage']);

    coordinator.dispose();
    media.setMatches(false);
    expect(layoutOrder(root, '.scanner-panel')).toEqual(['scanner-controls', 'scanner-stage']);
  });
});

function layoutOrder(root: ParentNode, selector: string): string[] {
  return [...root.querySelector(selector)!.children]
    .map((element) => (element as HTMLElement).dataset.layoutRole!)
    .filter(Boolean);
}

function renderFixture(): HTMLElement {
  const root = document.createElement('main');
  root.innerHTML = `
    <section class="landing-page">
      <section id="product" data-home-section></section>
      <section id="anchorar-proof" data-home-section></section>
      <section id="anchorar-gateway" data-home-section></section>
      <section id="use-cases" data-home-section></section>
      <section id="capabilities" data-home-section></section>
      <section id="trust" data-home-section></section>
      <section id="arvenilo" data-home-section></section>
    </section>
    <div class="scanner-panel">
      <div data-layout-role="scanner-stage"></div>
      <div data-layout-role="scanner-controls"></div>
    </div>
    <div class="target-workspace">
      <div data-layout-role="target-preview"></div>
      <div data-layout-role="target-inspector"></div>
    </div>
    <div class="auth-layout">
      <div data-layout-role="auth-access"></div>
      <div data-layout-role="auth-controls"></div>
    </div>
  `;
  return root;
}

function fakeMediaQuery(initial: boolean): MediaQueryList & { setMatches(value: boolean): void } {
  let matches = initial;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  return {
    media: '(max-width: 767px)',
    get matches() {
      return matches;
    },
    onchange: null,
    addEventListener: vi.fn((_type, listener) => listeners.add(listener as (event: MediaQueryListEvent) => void)),
    removeEventListener: vi.fn((_type, listener) => listeners.delete(listener as (event: MediaQueryListEvent) => void)),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    setMatches(value: boolean) {
      matches = value;
      const event = { matches, media: this.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  } as unknown as MediaQueryList & { setMatches(value: boolean): void };
}

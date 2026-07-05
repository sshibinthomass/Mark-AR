import { describe, expect, it } from 'vitest';
import { activateRoute } from '../src/ui/pageRouter';

describe('activateRoute', () => {
  it('shows one page and marks the matching navigation link active', () => {
    const root = document.createElement('main');
    root.innerHTML = `
      <a data-route-link="home" href="#/">Home</a>
      <a data-route-link="scan" href="#/scan">Scan</a>
      <section data-page="home"></section>
      <section data-page="scan" hidden></section>
      <section data-page="models" hidden></section>
    `;

    activateRoute(root, 'scan');

    expect(root.querySelector<HTMLElement>('[data-page="home"]')?.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-page="scan"]')?.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('[data-page="models"]')?.hidden).toBe(true);
    expect(root.querySelector('[data-route-link="home"]')?.getAttribute('aria-current')).toBeNull();
    expect(root.querySelector('[data-route-link="scan"]')?.getAttribute('aria-current')).toBe('page');
    expect(root.dataset.activePage).toBe('scan');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { activateAccessibleRoute, activateRoute } from '../src/ui/pageRouter';

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

  it('scrolls to the page start and focuses the active page heading', () => {
    const root = document.createElement('main');
    root.innerHTML = `
      <section data-page="home">
        <h1 data-page-heading tabindex="-1">Home</h1>
      </section>
      <section data-page="scan" hidden>
        <h2 data-page-heading tabindex="-1">Scan target</h2>
      </section>
    `;
    const scrollToTop = vi.fn();
    const focusHeading = vi.fn();

    activateRoute(root, 'scan', { scrollToTop, focusHeading });

    const scanHeading = root.querySelector<HTMLElement>('[data-page="scan"] [data-page-heading]');
    expect(scrollToTop).toHaveBeenCalledTimes(1);
    expect(focusHeading).toHaveBeenCalledWith(scanHeading);
  });

  it('activates Account and reports a block when a signed-out user requests Targets', () => {
    const root = document.createElement('main');
    root.innerHTML = `
      <a data-route-link="targets" href="#/targets">Targets</a>
      <a data-route-link="account" href="#/account">Account</a>
      <section data-page="targets"></section>
      <section data-page="account" hidden></section>
    `;

    const result = activateAccessibleRoute(root, 'targets', {
      status: 'signed-out',
      message: 'Sign in to use Image Targets.',
    });

    expect(result).toEqual({ activeRoute: 'account', blocked: true });
    expect(root.dataset.activePage).toBe('account');
    expect(root.querySelector<HTMLElement>('[data-page="targets"]')?.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-page="account"]')?.hidden).toBe(false);
  });

  it('activates Targets for a verified signed-in user', () => {
    const root = document.createElement('main');
    root.innerHTML = `
      <section data-page="targets" hidden></section>
      <section data-page="account"></section>
    `;

    const result = activateAccessibleRoute(root, 'targets', {
      status: 'signed-in',
      message: 'Image Targets unlocked.',
      email: 'artist@example.com',
    });

    expect(result).toEqual({ activeRoute: 'targets', blocked: false });
    expect(root.dataset.activePage).toBe('targets');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { setupHomeSectionNavigation } from '../src/ui/homeSectionNavigation';

describe('setupHomeSectionNavigation', () => {
  it('opens Home before revealing the requested section', () => {
    const root = fixture();
    const openHome = vi.fn();
    const reveal = vi.fn();
    const schedule = vi.fn((callback: () => void) => callback());
    const controller = setupHomeSectionNavigation(root, {
      isHome: () => false,
      openHome,
      schedule,
      reveal,
    });

    root.querySelector<HTMLAnchorElement>('[data-home-section-link="use-cases"]')!.click();

    expect(openHome).toHaveBeenCalledOnce();
    expect(reveal).toHaveBeenCalledWith(root.querySelector('#use-cases'));
    controller.dispose();
  });

  it('reveals immediately without replacing the current Home route', () => {
    const root = fixture();
    const openHome = vi.fn();
    const reveal = vi.fn();
    const controller = setupHomeSectionNavigation(root, {
      isHome: () => true,
      openHome,
      schedule: (callback) => callback(),
      reveal,
    });

    root.querySelector<HTMLAnchorElement>('[data-home-section-link="product"]')!.click();

    expect(openHome).not.toHaveBeenCalled();
    expect(reveal).toHaveBeenCalledWith(root.querySelector('#product'));
    controller.dispose();
  });

  it('does nothing for an unknown section ID', () => {
    const root = fixture();
    const link = document.createElement('a');
    link.dataset.homeSectionLink = 'unknown';
    root.append(link);
    const openHome = vi.fn();
    const reveal = vi.fn();
    const controller = setupHomeSectionNavigation(root, {
      isHome: () => false,
      openHome,
      schedule: (callback) => callback(),
      reveal,
    });

    expect(() => link.click()).not.toThrow();
    expect(openHome).not.toHaveBeenCalled();
    expect(reveal).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('does nothing when a section ID is missing', () => {
    const root = fixture();
    const openHome = vi.fn();
    const reveal = vi.fn();
    const controller = setupHomeSectionNavigation(root, {
      isHome: () => false,
      openHome,
      schedule: (callback) => callback(),
      reveal,
    });

    expect(() => root.querySelector<HTMLAnchorElement>('[data-home-section-link=""]')!.click()).not.toThrow();
    expect(openHome).not.toHaveBeenCalled();
    expect(reveal).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('removes listeners when disposed', () => {
    const root = fixture();
    const reveal = vi.fn();
    const controller = setupHomeSectionNavigation(root, {
      isHome: () => true,
      openHome: vi.fn(),
      schedule: (callback) => callback(),
      reveal,
    });

    controller.dispose();
    root.querySelector<HTMLAnchorElement>('[data-home-section-link="product"]')!.click();

    expect(reveal).not.toHaveBeenCalled();
  });
});

function fixture(): HTMLElement {
  const root = document.createElement('main');
  root.innerHTML = `
    <a href="#/" data-home-section-link="product">Product</a>
    <a href="#/" data-home-section-link="use-cases">Use cases</a>
    <a href="#/" data-home-section-link>Missing section</a>
    <section id="product" tabindex="-1"></section>
    <section id="use-cases" tabindex="-1"></section>
  `;
  return root;
}

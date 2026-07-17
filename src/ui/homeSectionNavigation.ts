export type HomeSectionNavigationEffects = {
  isHome(): boolean;
  openHome(): void;
  schedule(callback: () => void): void;
  reveal(section: HTMLElement): void;
};

export function setupHomeSectionNavigation(
  root: HTMLElement,
  effects: HomeSectionNavigationEffects = browserEffects(root),
): { dispose(): void } {
  const listeners = [...root.querySelectorAll<HTMLAnchorElement>('[data-home-section-link]')].map((link) => {
    const onClick = (event: MouseEvent) => {
      event.preventDefault();
      const id = link.dataset.homeSectionLink;
      const section = id ? root.querySelector<HTMLElement>(`#${id}`) : null;
      if (!section) return;
      if (!effects.isHome()) effects.openHome();
      effects.schedule(() => effects.reveal(section));
    };
    link.addEventListener('click', onClick);
    return () => link.removeEventListener('click', onClick);
  });

  return { dispose: () => listeners.forEach((dispose) => dispose()) };
}

function browserEffects(root: HTMLElement): HomeSectionNavigationEffects {
  const view = root.ownerDocument.defaultView;
  return {
    isHome: () => root.dataset.activePage === 'home',
    openHome: () => {
      if (view) view.location.hash = '#/';
    },
    schedule: (callback) => {
      if (!view) {
        callback();
        return;
      }
      view.requestAnimationFrame(() => view.requestAnimationFrame(callback));
    },
    reveal: (section) => {
      const reducedMotion = view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      section.focus({ preventScroll: true });
      section.scrollIntoView?.({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
    },
  };
}

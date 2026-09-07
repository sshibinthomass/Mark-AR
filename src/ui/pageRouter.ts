import type { AppRoute } from './pageRoutes';
import { resolveAccessibleRoute, type AuthUiState } from './authUi';

export type AccessibleRouteResult = {
  activeRoute: AppRoute;
  blocked: boolean;
};

/*
 * Each route names itself in the tab and in browser history. Without this the
 * document title stayed "AnchorAR by Arvenilo" everywhere, so back/forward
 * entries and bookmarks were indistinguishable.
 */
const ROUTE_TITLES: Record<AppRoute, string> = {
  home: 'AnchorAR by Arvenilo',
  scan: 'Scan an experience · AnchorAR',
  targets: 'AnchorAR Studio · AnchorAR',
  settings: 'Keyboard settings · AnchorAR',
  account: 'Your account · AnchorAR',
};

export function activateAccessibleRoute(
  root: HTMLElement,
  requestedRoute: AppRoute,
  authState: AuthUiState,
): AccessibleRouteResult {
  const activeRoute = resolveAccessibleRoute(requestedRoute, authState);
  activateRoute(root, activeRoute);
  return {
    activeRoute,
    blocked: activeRoute !== requestedRoute,
  };
}

export function activateRoute(root: HTMLElement, route: AppRoute): void {
  root.dataset.activePage = route;
  root.ownerDocument.title = ROUTE_TITLES[route];
  let activePage: HTMLElement | undefined;

  root.querySelectorAll<HTMLElement>('[data-page]').forEach((page) => {
    page.hidden = page.dataset.page !== route;
    if (!page.hidden) {
      activePage = page;
    }
  });

  root.querySelectorAll<HTMLElement>('[data-route-link]').forEach((link) => {
    if (link.dataset.routeLink === route) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  root.ownerDocument.defaultView?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
  /* The new page's heading takes focus so a screen reader announces the route. */
  activePage?.querySelector<HTMLElement>('[data-page-heading]')?.focus({ preventScroll: true });
}

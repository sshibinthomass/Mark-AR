import type { AppRoute } from './pageRoutes';
import { resolveAccessibleRoute, type AuthUiState } from './authUi';

export type AccessibleRouteResult = {
  activeRoute: AppRoute;
  blocked: boolean;
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

  root.querySelectorAll<HTMLElement>('[data-page]').forEach((page) => {
    page.hidden = page.dataset.page !== route;
  });

  root.querySelectorAll<HTMLElement>('[data-route-link]').forEach((link) => {
    if (link.dataset.routeLink === route) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

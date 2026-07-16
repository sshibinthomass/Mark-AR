import type { AppRoute } from './pageRoutes';
import { resolveAccessibleRoute, type AuthUiState } from './authUi';

export type AccessibleRouteResult = {
  activeRoute: AppRoute;
  blocked: boolean;
};

export type RouteActivationEffects = {
  scrollToTop(): void;
  focusHeading(heading: HTMLElement): void;
};

export function activateAccessibleRoute(
  root: HTMLElement,
  requestedRoute: AppRoute,
  authState: AuthUiState,
  effects?: RouteActivationEffects,
): AccessibleRouteResult {
  const activeRoute = resolveAccessibleRoute(requestedRoute, authState);
  activateRoute(root, activeRoute, effects);
  return {
    activeRoute,
    blocked: activeRoute !== requestedRoute,
  };
}

export function activateRoute(
  root: HTMLElement,
  route: AppRoute,
  effects: RouteActivationEffects = browserRouteEffects(root),
): void {
  root.dataset.activePage = route;
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

  effects.scrollToTop();
  const heading = activePage?.querySelector<HTMLElement>('[data-page-heading]');
  if (heading) {
    effects.focusHeading(heading);
  }
}

function browserRouteEffects(root: HTMLElement): RouteActivationEffects {
  const view = root.ownerDocument.defaultView;
  return {
    scrollToTop(): void {
      view?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
    },
    focusHeading(heading: HTMLElement): void {
      heading.focus({ preventScroll: true });
    },
  };
}

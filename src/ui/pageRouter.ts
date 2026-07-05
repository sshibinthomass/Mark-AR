import type { AppRoute } from './pageRoutes';

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

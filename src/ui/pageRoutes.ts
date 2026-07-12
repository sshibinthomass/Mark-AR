export const PAGE_ROUTES = ['home', 'scan', 'targets', 'account'] as const;

export type AppRoute = (typeof PAGE_ROUTES)[number];

export const DEFAULT_APP_ROUTE: AppRoute = 'home';

export function normalizeRoute(value: string): AppRoute {
  const route = value.trim().replace(/^#/, '').replace(/^\//, '') || DEFAULT_APP_ROUTE;
  return isAppRoute(route) ? route : DEFAULT_APP_ROUTE;
}

export function routeFromHash(hash: string): AppRoute {
  return normalizeRoute(hash);
}

export function hrefForRoute(route: AppRoute): string {
  return route === DEFAULT_APP_ROUTE ? '#/' : `#/${route}`;
}

function isAppRoute(value: string): value is AppRoute {
  return PAGE_ROUTES.includes(value as AppRoute);
}

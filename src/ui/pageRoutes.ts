export const PAGE_ROUTES = ['home', 'scan', 'targets', 'account'] as const;

export type AppRoute = (typeof PAGE_ROUTES)[number];

export type AppLocation = {
  route: AppRoute;
  scanId?: string;
};

export const DEFAULT_APP_ROUTE: AppRoute = 'home';

export function normalizeRoute(value: string): AppRoute {
  const route = value.trim().replace(/^#/, '').replace(/^\//, '').split('/')[0] || DEFAULT_APP_ROUTE;
  return isAppRoute(route) ? route : DEFAULT_APP_ROUTE;
}

export function routeFromHash(hash: string): AppRoute {
  return locationFromHash(hash).route;
}

export function locationFromHash(hash: string): AppLocation {
  const path = hash.trim().replace(/^#/, '').replace(/^\//, '');
  const [routePart = '', encodedScanId = ''] = path.split('/');
  const route = normalizeRoute(routePart);
  if (route !== 'scan' || !encodedScanId) {
    return { route };
  }
  try {
    const scanId = decodeURIComponent(encodedScanId).trim();
    return scanId ? { route, scanId } : { route };
  } catch {
    return { route };
  }
}

export function hrefForRoute(route: AppRoute): string {
  return route === DEFAULT_APP_ROUTE ? '#/' : `#/${route}`;
}

export function hrefForTargetScan(scanId: string): string {
  return `#/scan/${encodeURIComponent(scanId.trim())}`;
}

export function absoluteTargetScanUrl(scanId: string, currentUrl: string): string {
  const url = new URL(currentUrl);
  url.hash = hrefForTargetScan(scanId).slice(1);
  return url.href;
}

function isAppRoute(value: string): value is AppRoute {
  return PAGE_ROUTES.includes(value as AppRoute);
}

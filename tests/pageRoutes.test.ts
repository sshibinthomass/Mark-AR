import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APP_ROUTE,
  PAGE_ROUTES,
  hrefForRoute,
  hrefForTargetScan,
  absoluteTargetScanUrl,
  locationFromHash,
  normalizeRoute,
  routeFromHash,
} from '../src/ui/pageRoutes';

describe('page route helpers', () => {
  it('normalizes known routes and falls back to home for unknown routes', () => {
    expect(PAGE_ROUTES).toEqual(['home', 'scan', 'targets', 'account']);
    expect(PAGE_ROUTES).toContain('targets');
    expect(DEFAULT_APP_ROUTE).toBe('home');
    expect(normalizeRoute('scan')).toBe('scan');
    expect(normalizeRoute('')).toBe('home');
    expect(normalizeRoute('missing')).toBe('home');
  });

  it('reads and writes hash route links', () => {
    expect(routeFromHash('')).toBe('home');
    expect(routeFromHash('#/targets')).toBe('targets');
    expect(routeFromHash('#/bad-route')).toBe('home');
    expect(hrefForRoute('scan')).toBe('#/scan');
    expect(hrefForRoute('targets')).toBe('#/targets');
  });

  it('reads and writes one target-specific scan location', () => {
    expect(locationFromHash('#/scan/scan-abc')).toEqual({ route: 'scan', scanId: 'scan-abc' });
    expect(locationFromHash('#/scan/scan%20abc')).toEqual({ route: 'scan', scanId: 'scan abc' });
    expect(locationFromHash('#/scan/')).toEqual({ route: 'scan' });
    expect(locationFromHash('#/targets/ignored')).toEqual({ route: 'targets' });
    expect(hrefForTargetScan('scan abc')).toBe('#/scan/scan%20abc');
    expect(absoluteTargetScanUrl('scan abc', 'https://example.com/Mark-AR/#/targets')).toBe(
      'https://example.com/Mark-AR/#/scan/scan%20abc',
    );
  });
});

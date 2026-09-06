import { describe, expect, it } from 'vitest';
import {
  approach,
  clamp,
  detectFieldMode,
  fieldPixelRatio,
  fieldPointCount,
  fieldRunsOnRoute,
  fieldShapeForRoute,
  pointerTilt,
  scrollProgress,
} from '../src/scene/pointFieldModes';
import { PAGE_ROUTES } from '../src/ui/pageRoutes';

const capable = { reducedMotion: false, saveData: false, webglSupported: true };

describe('point field mode', () => {
  it('runs the interactive field only when nothing objects', () => {
    expect(detectFieldMode(capable)).toBe('interactive');
  });

  it('drops to the poster for every stated refusal', () => {
    expect(detectFieldMode({ ...capable, reducedMotion: true })).toBe('poster');
    expect(detectFieldMode({ ...capable, saveData: true })).toBe('poster');
    expect(detectFieldMode({ ...capable, webglSupported: false })).toBe('poster');
  });
});

describe('point field budgets', () => {
  it('spends far fewer points on phones than on desktops', () => {
    const phone = fieldPointCount(390, 3);
    const laptop = fieldPointCount(1440, 2);

    expect(phone).toBeLessThan(laptop);
    expect(phone).toBeLessThanOrEqual(1400);
    expect(laptop).toBeLessThanOrEqual(3200);
  });

  it('treats a dense display as a reason to draw fewer points', () => {
    expect(fieldPointCount(1440, 3)).toBeLessThan(fieldPointCount(1440, 1));
  });

  it('caps the render scale lower on phones than on desktops', () => {
    expect(fieldPixelRatio(3, 390)).toBe(1.5);
    expect(fieldPixelRatio(3, 1440)).toBe(2);
    /* Never below 1: a reported ratio under 1 would blur the field. */
    expect(fieldPixelRatio(0.5, 1440)).toBe(1);
  });
});

describe('point field route shapes', () => {
  it('gives every route a shape', () => {
    for (const route of PAGE_ROUTES) {
      expect(fieldShapeForRoute(route), route).toBeDefined();
      expect(fieldShapeForRoute(route).spread, route).toBeGreaterThan(0);
    }
  });

  it('shows the aperture on Home alone', () => {
    expect(fieldShapeForRoute('home').aperture).toBe(true);
    for (const route of PAGE_ROUTES.filter((name) => name !== 'home')) {
      expect(fieldShapeForRoute(route).aperture, route).toBe(false);
    }
  });

  it('stands down on the routes that own a WebGL canvas of their own', () => {
    expect(fieldRunsOnRoute('scan')).toBe(false);
    expect(fieldRunsOnRoute('targets')).toBe(false);
    expect(fieldRunsOnRoute('home')).toBe(true);
    expect(fieldRunsOnRoute('settings')).toBe(true);
    expect(fieldRunsOnRoute('account')).toBe(true);
  });
});

describe('point field motion', () => {
  it('keeps pointer parallax inside the 2-3 degree ceiling', () => {
    const ceiling = (2.5 * Math.PI) / 180;

    expect(pointerTilt(1, 1).y).toBeCloseTo(ceiling);
    expect(pointerTilt(-1, -1).x).toBeCloseTo(-ceiling);
    /* Input beyond the viewport must not push the camera further. */
    expect(pointerTilt(8, 8).y).toBeCloseTo(ceiling);
    expect(pointerTilt(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('reads scroll as progress through the document', () => {
    expect(scrollProgress(0, 3000, 1000)).toBe(0);
    expect(scrollProgress(1000, 3000, 1000)).toBeCloseTo(0.5);
    expect(scrollProgress(2000, 3000, 1000)).toBe(1);
    expect(scrollProgress(9000, 3000, 1000)).toBe(1);
  });

  it('reports no scroll progress when the page does not scroll', () => {
    expect(scrollProgress(0, 800, 1000)).toBe(0);
    expect(scrollProgress(0, 1000, 1000)).toBe(0);
  });

  it('eases toward a target at a rate independent of frame length', () => {
    const oneStep = approach(0, 1, 3, 0.2);
    let stepped = 0;
    for (let index = 0; index < 10; index += 1) {
      stepped = approach(stepped, 1, 3, 0.02);
    }

    expect(oneStep).toBeCloseTo(stepped, 5);
    expect(approach(0.5, 0.5, 3, 0.016)).toBe(0.5);
  });

  it('clamps to the given bounds', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
  });
});

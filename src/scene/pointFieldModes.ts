/**
 * Decisions the point field makes before it touches WebGL.
 *
 * Kept separate from the renderer so the capability gates, budgets, and morph
 * targets can be exercised without a GPU.
 */

import type { AppRoute } from '../ui/pageRoutes';

/**
 * `interactive` runs the WebGL layer. `poster` means the field must not run at
 * all -- the static gradient stands in and the flat aperture poster shows.
 */
export type FieldMode = 'interactive' | 'poster';

type FieldEnvironment = {
  reducedMotion: boolean;
  saveData: boolean;
  webglSupported: boolean;
};

/**
 * The 3D layer is progressive enhancement, so any one refusal is enough to drop
 * to the poster. Reduced motion and save-data are honoured as stated
 * preferences, not as hints to soften the animation.
 */
export function detectFieldMode(environment: FieldEnvironment): FieldMode {
  if (environment.reducedMotion || environment.saveData || !environment.webglSupported) {
    return 'poster';
  }

  return 'interactive';
}

export function readFieldEnvironment(view: Window = window): FieldEnvironment {
  const connection = (view.navigator as { connection?: { saveData?: boolean } } | undefined)
    ?.connection;

  return {
    reducedMotion: matches(view, '(prefers-reduced-motion: reduce)'),
    saveData: connection?.saveData === true,
    webglSupported: supportsWebgl(view),
  };
}

function matches(view: Window, query: string): boolean {
  try {
    return view.matchMedia?.(query).matches === true;
  } catch {
    return false;
  }
}

function supportsWebgl(view: Window): boolean {
  try {
    const canvas = view.document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') ?? canvas.getContext('webgl'),
    );
  } catch {
    return false;
  }
}

/**
 * Point budget. The mobile figure stays well inside the design system's
 * geometry budget so the field never competes with the AR camera for frames.
 */
export function fieldPointCount(viewportWidth: number, devicePixelRatio = 1): number {
  if (viewportWidth < 768) {
    return 1400;
  }

  if (viewportWidth < 1280 || devicePixelRatio > 2) {
    return 2400;
  }

  return 3200;
}

/** Retina phones render the field at a lower ratio rather than a lower count. */
export function fieldPixelRatio(devicePixelRatio: number, viewportWidth: number): number {
  const ceiling = viewportWidth < 768 ? 1.5 : 2;
  return Math.min(Math.max(devicePixelRatio, 1), ceiling);
}

export type FieldShape = {
  /** How far the cloud spreads from the axis. */
  spread: number;
  /** Rotation applied along depth, in radians across the full cloud. */
  twist: number;
  /** Idle drift speed multiplier. */
  drift: number;
  /** Whether the aperture object is part of the scene on this route. */
  aperture: boolean;
};

/**
 * Each route gets its own resting shape; the field eases between them rather
 * than cutting, so a route change reads as one continuous space.
 */
const ROUTE_SHAPES: Record<AppRoute, FieldShape> = {
  home: { spread: 1, twist: 0.55, drift: 1, aperture: true },
  scan: { spread: 0.72, twist: 0.2, drift: 0.5, aperture: false },
  targets: { spread: 0.66, twist: 0.14, drift: 0.4, aperture: false },
  settings: { spread: 0.85, twist: 0.9, drift: 0.65, aperture: false },
  account: { spread: 0.6, twist: 1.25, drift: 0.7, aperture: false },
};

export function fieldShapeForRoute(route: AppRoute): FieldShape {
  return ROUTE_SHAPES[route];
}

/**
 * Routes that own a WebGL canvas of their own -- the AR camera and the Studio
 * preview. The design system allows one primary canvas at a time, so the field
 * suspends rather than sharing the GPU with them.
 */
export function fieldRunsOnRoute(route: AppRoute): boolean {
  return route !== 'scan' && route !== 'targets';
}

/**
 * Pointer parallax, capped at the design system's 2-3 degree ceiling. Input is
 * the pointer position normalised to -1..1 across the viewport.
 */
export function pointerTilt(
  normalizedX: number,
  normalizedY: number,
  maxDegrees = 2.5,
): { x: number; y: number } {
  const limit = (maxDegrees * Math.PI) / 180;
  return {
    x: clamp(normalizedY, -1, 1) * limit,
    y: clamp(normalizedX, -1, 1) * limit,
  };
}

/** Scroll progress through the document, 0 at the top and 1 at the bottom. */
export function scrollProgress(scrollY: number, scrollHeight: number, viewportHeight: number): number {
  const travel = scrollHeight - viewportHeight;
  if (travel <= 0) {
    return 0;
  }

  return clamp(scrollY / travel, 0, 1);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Frame-rate independent easing toward a target. */
export function approach(current: number, target: number, rate: number, delta: number): number {
  const factor = 1 - Math.exp(-rate * delta);
  return current + (target - current) * factor;
}

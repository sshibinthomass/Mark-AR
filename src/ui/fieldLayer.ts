/**
 * Mounts the single background 3D layer and keeps it in step with the route,
 * the theme, and the aperture section.
 *
 * The Three.js scene is imported dynamically, so a visitor who never qualifies
 * for the interactive field -- reduced motion, save-data, or no WebGL -- never
 * downloads it.
 */

import {
  detectFieldMode,
  fieldRunsOnRoute,
  readFieldEnvironment,
  type FieldMode,
} from '../scene/pointFieldModes';
import type { ApertureObjectName, PointFieldHandle } from '../scene/pointField';
import type { AppRoute } from './pageRoutes';
import { currentTheme } from './theme';

export type FieldLayer = {
  mode: FieldMode;
  setRoute: (route: AppRoute) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setApertureObject: (name: ApertureObjectName) => void;
  destroy: () => void;
};

const APERTURE_OBJECT_NAMES: ApertureObjectName[] = ['book', 'menu', 'card', 'ad', 'story'];

export function isApertureObjectName(value: string): value is ApertureObjectName {
  return (APERTURE_OBJECT_NAMES as string[]).includes(value);
}

export function mountFieldLayer(
  doc: Document = document,
  initialRoute: AppRoute = 'home',
): FieldLayer {
  const host = doc.createElement('div');
  host.className = 'point-field';
  host.setAttribute('aria-hidden', 'true');

  const mode = detectFieldMode(readFieldEnvironment(doc.defaultView ?? window));
  host.dataset.fieldMode = mode;
  doc.body.prepend(host);

  const apertureStage = doc.querySelector<HTMLElement>('[data-aperture-stage]');
  if (apertureStage) {
    apertureStage.dataset.apertureMode = mode === 'interactive' ? 'live' : 'poster';
  }

  let handle: PointFieldHandle | null = null;
  let destroyed = false;
  let route = initialRoute;
  let apertureObject: ApertureObjectName = 'card';

  if (mode === 'interactive') {
    void import('../scene/pointField')
      .then(({ createPointField }) => {
        if (destroyed) {
          return;
        }

        handle = createPointField(host, route, currentTheme(doc));
        handle.setApertureTarget(apertureStage);
        handle.setApertureObject(apertureObject);
        handle.setActive(fieldRunsOnRoute(route));
      })
      .catch(() => {
        /* A failed scene load is not a failed page: fall back to the poster. */
        host.dataset.fieldMode = 'poster';
        if (apertureStage) {
          apertureStage.dataset.apertureMode = 'poster';
        }
      });
  }

  return {
    mode,
    setRoute(next) {
      route = next;
      handle?.setRoute(next);
      /* The AR camera and the Studio preview each own a WebGL canvas, and the
         design system allows one at a time, so the field stands down there. */
      handle?.setActive(fieldRunsOnRoute(next));
    },
    setTheme(theme) {
      handle?.setTheme(theme);
    },
    setApertureObject(name) {
      apertureObject = name;
      handle?.setApertureObject(name);
    },
    destroy() {
      destroyed = true;
      handle?.destroy();
      handle = null;
      host.remove();
    },
  };
}

/**
 * The persistent point field.
 *
 * One WebGL layer sits behind every route, morphs when the route changes, and
 * travels with scroll. The aperture engine lives in this same scene rather than
 * in a canvas of its own, so the site keeps a single 3D layer; the aperture
 * section only tells this layer where to draw and what object to show.
 *
 * Everything here is progressive enhancement. When `detectFieldMode` returns
 * `poster` the module is never loaded at all -- see `mountPointField`.
 */

import {
  AdditiveBlending,
  NormalBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  SphereGeometry,
  TorusGeometry,
  WebGLRenderer,
  BoxGeometry,
  MathUtils,
} from 'three';

import type { AppRoute } from '../ui/pageRoutes';
import {
  approach,
  fieldPixelRatio,
  fieldPointCount,
  fieldShapeForRoute,
  pointerTilt,
  scrollProgress,
  type FieldShape,
} from './pointFieldModes';

export type ApertureObjectName = 'book' | 'menu' | 'card' | 'ad' | 'story';

export type PointFieldHandle = {
  setRoute: (route: AppRoute) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setApertureTarget: (element: HTMLElement | null) => void;
  setApertureObject: (name: ApertureObjectName) => void;
  setActive: (active: boolean) => void;
  destroy: () => void;
};

/** Proportions for the object passing through the aperture, in aperture units. */
const APERTURE_OBJECTS: Record<ApertureObjectName, [number, number, number]> = {
  book: [0.46, 0.62, 0.1],
  menu: [0.38, 0.7, 0.04],
  card: [0.66, 0.42, 0.03],
  ad: [0.72, 0.5, 0.05],
  story: [0.4, 0.72, 0.06],
};

const CAMERA_FOV = 45;
const APERTURE_DEPTH = -2.2;

export function createPointField(
  canvasHost: HTMLElement,
  initialRoute: AppRoute,
  initialTheme: 'dark' | 'light',
): PointFieldHandle {
  const view = canvasHost.ownerDocument.defaultView ?? window;

  const renderer = new WebGLRenderer({ alpha: true, antialias: view.innerWidth >= 768 });
  renderer.setClearAlpha(0);
  canvasHost.append(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  /* One neutral key and one soft mint fill -- no rim, no flare. */
  const key = new DirectionalLight(0xffffff, 1.4);
  key.position.set(2.5, 3.5, 4);
  scene.add(key);

  const fill = new DirectionalLight(0x5eead4, 0.55);
  fill.position.set(-3, -1.5, 2);
  scene.add(fill);

  const fieldGroup = new Group();
  scene.add(fieldGroup);

  const points = createPoints(view.innerWidth, view.devicePixelRatio || 1);
  fieldGroup.add(points.mesh);

  const aperture = createAperture();
  scene.add(aperture.group);

  let theme = initialTheme;
  let shape = fieldShapeForRoute(initialRoute);
  let currentShape: FieldShape = { ...shape };
  let apertureTarget: HTMLElement | null = null;
  let active = true;
  let running = false;
  let frame = 0;
  let lastTime = 0;
  let elapsed = 0;

  const pointer = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0 };
  let scroll = 0;

  applyTheme(theme);

  /* -------------------------------------------------------------- events */

  const onPointerMove = (event: PointerEvent): void => {
    /* Coarse pointers get no parallax: a touch is a tap, not a hover. */
    if (event.pointerType !== 'mouse') {
      return;
    }

    pointer.x = (event.clientX / view.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / view.innerHeight) * 2 - 1;
  };

  const onScroll = (): void => {
    scroll = scrollProgress(
      view.scrollY,
      canvasHost.ownerDocument.documentElement.scrollHeight,
      view.innerHeight,
    );
  };

  const onResize = (): void => {
    resize();
  };

  const onVisibility = (): void => {
    sync();
  };

  view.addEventListener('pointermove', onPointerMove, { passive: true });
  view.addEventListener('scroll', onScroll, { passive: true });
  view.addEventListener('resize', onResize);
  canvasHost.ownerDocument.addEventListener('visibilitychange', onVisibility);

  resize();
  onScroll();
  sync();

  /* --------------------------------------------------------------- loop */

  function tick(time: number): void {
    frame = view.requestAnimationFrame(tick);

    const delta = lastTime === 0 ? 0.016 : Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    elapsed += delta * currentShape.drift;

    currentShape.spread = approach(currentShape.spread, shape.spread, 3, delta);
    currentShape.twist = approach(currentShape.twist, shape.twist, 3, delta);
    currentShape.drift = approach(currentShape.drift, shape.drift, 3, delta);

    const target = pointerTilt(pointer.x, pointer.y);
    tilt.x = approach(tilt.x, target.x, 4, delta);
    tilt.y = approach(tilt.y, target.y, 4, delta);

    fieldGroup.rotation.x = tilt.x + currentShape.twist * 0.12;
    fieldGroup.rotation.y = tilt.y + elapsed * 0.04;
    fieldGroup.rotation.z = currentShape.twist * 0.35;
    fieldGroup.scale.setScalar(currentShape.spread);
    /* Travelling with scroll rather than parallaxing it keeps the field
       continuous while the page moves through it. */
    fieldGroup.position.z = scroll * 3.4;
    fieldGroup.position.y = scroll * -0.6;

    points.material.opacity = 0.5 + Math.sin(elapsed * 0.6) * 0.06;

    updateAperture(delta);

    renderer.render(scene, camera);
  }

  function start(): void {
    if (running) {
      return;
    }

    running = true;
    lastTime = 0;
    frame = view.requestAnimationFrame(tick);
  }

  function stop(): void {
    if (!running) {
      return;
    }

    running = false;
    view.cancelAnimationFrame(frame);
  }

  /** Renders only while the tab is visible, the route allows it, and it is on. */
  function sync(): void {
    if (active && !canvasHost.ownerDocument.hidden) {
      renderer.domElement.style.visibility = '';
      start();
      return;
    }

    stop();

    /*
     * Stopping leaves the last drawn frame on the canvas, which would strand a
     * stale aperture over a route that asked the field to stand down. Hide the
     * surface and clear it so suspending is actually invisible.
     */
    if (!active) {
      renderer.domElement.style.visibility = 'hidden';
      renderer.clear();
    }
  }

  /* ----------------------------------------------------------- aperture */

  function updateAperture(delta: number): void {
    if (!apertureTarget || !shape.aperture) {
      aperture.group.visible = false;
      return;
    }

    const rect = apertureTarget.getBoundingClientRect();
    const onScreen = rect.bottom > 0 && rect.top < view.innerHeight && rect.width > 0;

    aperture.group.visible = onScreen;

    if (!onScreen) {
      return;
    }

    /* Map the section's rect into the scene so the object appears to sit
       inside the framed opening the CSS draws. */
    const distance = camera.position.z - APERTURE_DEPTH;
    const visibleHeight = 2 * Math.tan(MathUtils.degToRad(CAMERA_FOV) / 2) * distance;
    const visibleWidth = visibleHeight * camera.aspect;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    aperture.group.position.set(
      (centerX / view.innerWidth - 0.5) * visibleWidth,
      -(centerY / view.innerHeight - 0.5) * visibleHeight,
      APERTURE_DEPTH,
    );

    const size = (Math.min(rect.width, rect.height) / view.innerHeight) * visibleHeight;
    aperture.group.scale.setScalar(size * 0.42);

    aperture.group.rotation.x = tilt.x * 1.6;
    aperture.group.rotation.y = tilt.y * 1.6 + Math.sin(elapsed * 0.25) * 0.12;

    /* One object travels through the opening, then rests. */
    const travel = Math.sin(elapsed * 0.5) * 0.5;
    aperture.object.position.z = travel;
    aperture.object.rotation.y = approach(
      aperture.object.rotation.y,
      Math.sin(elapsed * 0.3) * 0.35,
      2,
      delta,
    );
    aperture.signal.position.z = 0.62 + travel * 0.2;
  }

  /* -------------------------------------------------------------- theme */

  function applyTheme(next: 'dark' | 'light'): void {
    theme = next;
    const onLight = theme === 'light';

    /* On the mist ground the points must darken to stay visible; the accent
       colours themselves never change between themes. */
    points.material.color = new Color(onLight ? 0x4d6265 : 0xa8b9bb);
    /* Additive lifts the points off the void; on the mist ground it would only
       wash them out, so they blend normally there. */
    points.material.blending = onLight ? NormalBlending : AdditiveBlending;
    points.material.opacity = onLight ? 0.34 : 0.56;
    points.material.needsUpdate = true;

    aperture.body.material.color = new Color(onLight ? 0x0d2a2e : 0x081d21);
    aperture.calibration.material.opacity = onLight ? 0.5 : 0.32;
    aperture.calibration.material.needsUpdate = true;
  }

  /* ------------------------------------------------------------- resize */

  function resize(): void {
    const width = view.innerWidth;
    const height = view.innerHeight;

    renderer.setPixelRatio(fieldPixelRatio(view.devicePixelRatio || 1, width));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  /* ------------------------------------------------------------ handle */

  return {
    setRoute(route) {
      shape = fieldShapeForRoute(route);
    },
    setTheme(next) {
      applyTheme(next);
    },
    setApertureTarget(element) {
      apertureTarget = element;
      if (!element) {
        aperture.group.visible = false;
      }
    },
    setApertureObject(name) {
      aperture.setObject(name);
    },
    setActive(next) {
      active = next;
      sync();
    },
    destroy() {
      stop();
      view.removeEventListener('pointermove', onPointerMove);
      view.removeEventListener('scroll', onScroll);
      view.removeEventListener('resize', onResize);
      canvasHost.ownerDocument.removeEventListener('visibilitychange', onVisibility);

      points.geometry.dispose();
      points.material.dispose();
      aperture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/* ------------------------------------------------------------- factories */

function createPoints(viewportWidth: number, devicePixelRatio: number): {
  mesh: Points;
  geometry: BufferGeometry;
  material: PointsMaterial;
} {
  const count = fieldPointCount(viewportWidth, devicePixelRatio);
  const positions = new Float32Array(count * 3);

  /*
   * A loose lattice rather than a dense particle cloud: the design system asks
   * for controlled depth, not sci-fi dust.
   */
  for (let index = 0; index < count; index += 1) {
    const radius = 2.2 + Math.random() * 5.4;
    const angle = Math.random() * Math.PI * 2;
    const depth = (Math.random() - 0.5) * 12;

    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = Math.sin(angle) * radius * 0.62;
    positions[index * 3 + 2] = depth;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));

  const material = new PointsMaterial({
    size: 0.028,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
  });

  return { mesh: new Points(geometry, material), geometry, material };
}

type ApertureParts = {
  group: Group;
  body: Mesh<TorusGeometry, MeshStandardMaterial>;
  plane: Mesh<PlaneGeometry, MeshStandardMaterial>;
  signal: Mesh<SphereGeometry, MeshStandardMaterial>;
  calibration: LineSegments<BufferGeometry, LineBasicMaterial>;
  object: Mesh<BoxGeometry, MeshStandardMaterial>;
  setObject: (name: ApertureObjectName) => void;
  dispose: () => void;
};

/**
 * The aperture engine: a matte ink outer structure with an open centre, a mint
 * reality plane behind it, one gold signal point, restrained calibration lines,
 * and a single object moving through the opening.
 */
function createAperture(): ApertureParts {
  const group = new Group();
  group.visible = false;

  const bodyGeometry = new TorusGeometry(1, 0.16, 16, 64);
  const body = new Mesh(
    bodyGeometry,
    new MeshStandardMaterial({ color: 0x081d21, metalness: 0.08, roughness: 0.72 }),
  );
  group.add(body);

  /* Satin, lightly translucent -- a spatial layer, not glass. */
  const planeGeometry = new PlaneGeometry(1.5, 1.5);
  const plane = new Mesh(
    planeGeometry,
    new MeshStandardMaterial({
      color: 0x5eead4,
      metalness: 0,
      roughness: 0.55,
      transparent: true,
      opacity: 0.16,
    }),
  );
  plane.position.z = -0.32;
  group.add(plane);

  const signalGeometry = new SphereGeometry(0.055, 16, 16);
  const signal = new Mesh(
    signalGeometry,
    new MeshStandardMaterial({
      color: 0xf4b942,
      emissive: 0xf4b942,
      emissiveIntensity: 1.6,
      roughness: 0.4,
    }),
  );
  signal.position.set(0, 0, 0.62);
  group.add(signal);

  const calibrationGeometry = new BufferGeometry();
  calibrationGeometry.setAttribute(
    'position',
    new BufferAttribute(
      new Float32Array([
        -1.5, 0, -0.3, -1.05, 0, -0.3,
        1.05, 0, -0.3, 1.5, 0, -0.3,
        0, 1.05, -0.3, 0, 1.5, -0.3,
        0, -1.5, -0.3, 0, -1.05, -0.3,
      ]),
      3,
    ),
  );
  const calibration = new LineSegments(
    calibrationGeometry,
    new LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.32 }),
  );
  group.add(calibration);

  const objectGeometry = new BoxGeometry(1, 1, 1);
  const object = new Mesh(
    objectGeometry,
    new MeshStandardMaterial({ color: 0x12363a, metalness: 0.05, roughness: 0.65 }),
  );
  group.add(object);

  const setObject = (name: ApertureObjectName): void => {
    const [width, height, depth] = APERTURE_OBJECTS[name];
    object.scale.set(width, height, depth);
  };

  setObject('card');

  return {
    group,
    body,
    plane,
    signal,
    calibration,
    object,
    setObject,
    dispose() {
      bodyGeometry.dispose();
      body.material.dispose();
      planeGeometry.dispose();
      plane.material.dispose();
      signalGeometry.dispose();
      signal.material.dispose();
      calibrationGeometry.dispose();
      calibration.material.dispose();
      objectGeometry.dispose();
      object.material.dispose();
    },
  };
}

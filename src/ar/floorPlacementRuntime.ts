import {
  Clock,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Plane,
  Raycaster,
  RingGeometry,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  sRGBEncoding,
  type Object3D,
} from 'three';
import { FloorGestureController, type Point2 } from '../interaction/floorGestureController';
import type { CloudflarePlacedAsset } from './cloudflareMarkerObject';
import { FloorHitTest } from './floorHitTest';
import { FloorSceneTransform } from './floorSceneTransform';
import {
  prepareFloorSessionLauncher,
  type FloorSessionLauncherPreparation,
} from './floorSessionLauncher';
import { createTargetSceneObject, type TargetSceneObject } from './targetSceneObject';

const SCANNING_STATUS = 'Move your phone until the floor ring appears.';
const READY_STATUS = 'Floor found. Tap Place.';
const ENDED_STATUS = 'Floor AR ended. Scan the image or place it again.';

export type FloorPlacementController = {
  launch(): Promise<void>;
  place(): boolean;
  setRotation(degrees: number): void;
  reset(): boolean;
  stop(): Promise<void>;
  dispose(): void;
};

export type FloorPlacementPreparation =
  | { supported: false; message: string }
  | { supported: true; controller: FloorPlacementController };

export type FloorPlacementHooks = {
  onSessionStart(): void;
  onSessionEnd(): void;
  onStatus(message: string): void;
  onPlacementReady(ready: boolean): void;
  onPlaced(): void;
};

export type FloorPlacementScene = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  reticle: Mesh;
  placementRoot: Group;
  dispose(): void;
};

export type FloorPlacementDependencies = {
  prepareSessionLauncher: typeof prepareFloorSessionLauncher;
  createScene(stage: HTMLElement): FloorPlacementScene;
  createTargetSceneObject: typeof createTargetSceneObject;
  createHitTest(reticle: Object3D): FloorHitTest;
  createGestureController(
    target: HTMLElement,
    handlers: ConstructorParameters<typeof FloorGestureController>[1],
  ): FloorGestureController;
  createClock(): Pick<Clock, 'getDelta'>;
};

type FloorPlacementOptions = {
  stage: HTMLElement;
  overlayRoot: HTMLElement;
  gestureSurface: HTMLElement;
  asset: CloudflarePlacedAsset;
  hooks: FloorPlacementHooks;
};

const DEFAULT_DEPENDENCIES: FloorPlacementDependencies = {
  prepareSessionLauncher: prepareFloorSessionLauncher,
  createScene: createDefaultFloorScene,
  createTargetSceneObject,
  createHitTest: (reticle) => new FloorHitTest(reticle),
  createGestureController: (target, handlers) => new FloorGestureController(target, handlers),
  createClock: () => new Clock(),
};

export async function prepareFloorPlacement(
  options: FloorPlacementOptions,
  dependencies: Partial<FloorPlacementDependencies> = {},
): Promise<FloorPlacementPreparation> {
  const resolvedDependencies = { ...DEFAULT_DEPENDENCIES, ...dependencies };
  const launcherPreparation = await resolvedDependencies.prepareSessionLauncher(options.overlayRoot);
  if (!launcherPreparation.supported) {
    return launcherPreparation;
  }

  const floorScene = resolvedDependencies.createScene(options.stage);
  const runtime = new FloorPlacementRuntime(
    options,
    launcherPreparation,
    floorScene,
    resolvedDependencies,
  );
  return { supported: true, controller: runtime };
}

class FloorPlacementRuntime implements FloorPlacementController {
  private readonly transform: FloorSceneTransform;
  private readonly hitTest: FloorHitTest;
  private readonly gestureController: FloorGestureController;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly dragPlane = new Plane(new Vector3(0, 1, 0));
  private readonly dragPoint = new Vector3();
  private readonly options: FloorPlacementOptions;
  private readonly launcherPreparation: Extract<
    FloorSessionLauncherPreparation,
    { supported: true }
  >;
  private readonly floorScene: FloorPlacementScene;
  private readonly dependencies: FloorPlacementDependencies;

  private launchGeneration = 0;
  private disposed = false;
  private activeSession: XRSession | null = null;
  private sessionEndListener: (() => void) | null = null;
  private sessionSelectListener: (() => void) | null = null;
  private sessionStarted = false;
  private targetScene: TargetSceneObject | null = null;
  private clock: Pick<Clock, 'getDelta'> | null = null;
  private targetReady = false;
  private currentHitValid = false;
  private lastPlacementReady: boolean | null = null;
  private gesturesConnected = false;
  private gestureDisconnectPerformed = false;

  constructor(
    options: FloorPlacementOptions,
    launcherPreparation: Extract<
      FloorSessionLauncherPreparation,
      { supported: true }
    >,
    floorScene: FloorPlacementScene,
    dependencies: FloorPlacementDependencies,
  ) {
    this.options = options;
    this.launcherPreparation = launcherPreparation;
    this.floorScene = floorScene;
    this.dependencies = dependencies;
    this.transform = new FloorSceneTransform(floorScene.placementRoot);
    this.hitTest = dependencies.createHitTest(floorScene.reticle);
    this.gestureController = dependencies.createGestureController(options.gestureSurface, {
      onTap: () => {
        this.place();
      },
      onDrag: (point) => {
        this.dragTo(point);
      },
      onPinch: (multiplier) => {
        this.transform.scaleBy(multiplier);
      },
    });
  }

  launch(): Promise<void> {
    try {
      const sessionPromise = this.launcherPreparation.launcher.start();
      const generation = ++this.launchGeneration;
      return this.completeLaunch(sessionPromise, generation);
    } catch (error) {
      this.options.hooks.onStatus(failureStatus('Floor AR could not start', error));
      return Promise.reject(error);
    }
  }

  place(): boolean {
    const matrix = this.hitTest.latestPoseMatrix;
    if (!this.targetReady || !this.currentHitValid || !matrix) {
      return false;
    }

    this.transform.placeAt(matrix);
    this.options.hooks.onPlaced();
    return true;
  }

  setRotation(degrees: number): void {
    this.transform.rotateTo(degrees);
  }

  reset(): boolean {
    const matrix = this.hitTest.latestPoseMatrix;
    if (!this.targetReady || !matrix) {
      return false;
    }

    this.transform.resetAt(matrix);
    return true;
  }

  stop(): Promise<void> {
    this.launchGeneration += 1;
    const session = this.activeSession;
    if (!session) {
      return Promise.resolve();
    }
    return this.closeActiveSession(session, true, false);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.launchGeneration += 1;
    const session = this.activeSession;
    if (session) {
      this.detachSessionListeners(session);
      this.activeSession = null;
      this.sessionStarted = false;
      void endSessionQuietly(session);
    }

    this.cleanupSessionResources(false);
    this.disconnectGestures();
    this.hitTest.dispose();
    this.floorScene.renderer.setAnimationLoop(null);
    this.floorScene.renderer.domElement.remove();
    this.floorScene.dispose();
  }

  private async completeLaunch(
    sessionPromise: Promise<XRSession>,
    generation: number,
  ): Promise<void> {
    let session: XRSession;
    try {
      session = await sessionPromise;
    } catch (error) {
      if (!this.isCurrent(generation)) {
        return;
      }
      this.options.hooks.onStatus(failureStatus('Floor AR could not start', error));
      throw error;
    }

    if (!this.isCurrent(generation)) {
      await endSessionQuietly(session);
      return;
    }

    if (this.activeSession && this.activeSession !== session) {
      await this.closeActiveSession(this.activeSession, true, false);
      if (!this.isCurrent(generation)) {
        await endSessionQuietly(session);
        return;
      }
    }

    await this.activateSession(session, generation);
  }

  private async activateSession(session: XRSession, generation: number): Promise<void> {
    this.activeSession = session;
    this.attachSessionListeners(session);
    this.hitTest.reset();
    this.floorScene.placementRoot.visible = false;
    this.currentHitValid = false;
    this.targetReady = false;
    this.lastPlacementReady = null;
    this.emitPlacementReady(false, false);

    this.floorScene.renderer.xr.setReferenceSpaceType('local');
    try {
      await this.floorScene.renderer.xr.setSession(session);
    } catch (error) {
      if (!this.isCurrent(generation) || this.activeSession !== session) {
        await this.closeOrEndStaleSession(session);
        return;
      }
      await this.failActiveSession(session, generation, 'Floor AR could not start', error);
      return;
    }

    if (!this.isCurrent(generation) || this.activeSession !== session) {
      await this.closeOrEndStaleSession(session);
      return;
    }

    this.sessionStarted = true;
    this.options.hooks.onSessionStart();

    let targetScene: TargetSceneObject;
    try {
      targetScene = this.dependencies.createTargetSceneObject(
        this.options.asset,
        { loadMode: 'strict' },
      );
    } catch (error) {
      await this.failActiveSession(session, generation, 'Floor scene failed to load', error);
      return;
    }

    this.targetScene = targetScene;
    this.floorScene.placementRoot.add(targetScene.group);
    this.clock = this.dependencies.createClock();
    this.connectGestures();
    this.options.hooks.onStatus(SCANNING_STATUS);
    this.floorScene.renderer.setAnimationLoop(this.onAnimationFrame);

    try {
      await targetScene.ready;
    } catch (error) {
      if (!this.isCurrent(generation) || this.activeSession !== session) {
        return;
      }
      await this.failActiveSession(session, generation, 'Floor scene failed to load', error);
      return;
    }

    if (!this.isCurrent(generation) || this.activeSession !== session) {
      return;
    }

    this.targetReady = true;
    this.updatePlacementReadiness();
  }

  private async failActiveSession(
    session: XRSession,
    generation: number,
    prefix: string,
    error: unknown,
  ): Promise<never> {
    await this.closeActiveSession(session, this.sessionStarted, false);
    if (this.isCurrent(generation)) {
      this.options.hooks.onStatus(failureStatus(prefix, error));
    }
    throw error;
  }

  private readonly onAnimationFrame: XRFrameRequestCallback = (_time, frame): void => {
    const session = this.activeSession;
    if (!session || this.disposed) {
      return;
    }

    const referenceSpace = this.floorScene.renderer.xr.getReferenceSpace();
    this.currentHitValid = referenceSpace
      ? this.hitTest.update(frame, session, referenceSpace)
      : false;
    this.updatePlacementReadiness();

    if (this.targetReady && this.targetScene && this.clock) {
      this.targetScene.update(this.clock.getDelta());
    }
    this.floorScene.renderer.render(this.floorScene.scene, this.floorScene.camera);
  };

  private updatePlacementReadiness(): void {
    this.emitPlacementReady(this.targetReady && this.currentHitValid);
  }

  private emitPlacementReady(ready: boolean, reportStatus = true): void {
    if (ready === this.lastPlacementReady) {
      return;
    }
    this.lastPlacementReady = ready;
    this.options.hooks.onPlacementReady(ready);
    if (reportStatus) {
      this.options.hooks.onStatus(ready ? READY_STATUS : SCANNING_STATUS);
    }
  }

  private dragTo(point: Point2): void {
    if (!this.floorScene.placementRoot.visible) {
      return;
    }

    const bounds = this.options.gestureSurface.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    this.pointer.set(
      ((point.x - bounds.left) / bounds.width) * 2 - 1,
      -((point.y - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.floorScene.camera);
    this.dragPlane.set(new Vector3(0, 1, 0), -this.floorScene.placementRoot.position.y);
    const intersection = this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPoint);
    if (intersection) {
      this.transform.moveTo(intersection);
    }
  }

  private attachSessionListeners(session: XRSession): void {
    this.sessionEndListener = () => {
      this.handleExternalSessionEnd(session);
    };
    this.sessionSelectListener = () => {
      this.place();
    };
    session.addEventListener('end', this.sessionEndListener);
    session.addEventListener('select', this.sessionSelectListener);
  }

  private detachSessionListeners(session: XRSession): void {
    if (this.sessionEndListener) {
      session.removeEventListener('end', this.sessionEndListener);
      this.sessionEndListener = null;
    }
    if (this.sessionSelectListener) {
      session.removeEventListener('select', this.sessionSelectListener);
      this.sessionSelectListener = null;
    }
  }

  private handleExternalSessionEnd(session: XRSession): void {
    if (this.activeSession !== session) {
      return;
    }

    const notifyEnd = this.sessionStarted;
    this.detachSessionListeners(session);
    this.activeSession = null;
    this.sessionStarted = false;
    this.cleanupSessionResources(true);
    if (notifyEnd) {
      this.options.hooks.onSessionEnd();
    }
    this.options.hooks.onStatus(ENDED_STATUS);
  }

  private async closeActiveSession(
    session: XRSession,
    notifyEnd: boolean,
    reportEnded: boolean,
  ): Promise<void> {
    if (this.activeSession !== session) {
      await endSessionQuietly(session);
      return;
    }

    const shouldNotify = notifyEnd && this.sessionStarted;
    this.detachSessionListeners(session);
    this.activeSession = null;
    this.sessionStarted = false;
    this.cleanupSessionResources(true);
    if (shouldNotify) {
      this.options.hooks.onSessionEnd();
    }
    if (reportEnded) {
      this.options.hooks.onStatus(ENDED_STATUS);
    }
    await endSessionQuietly(session);
  }

  private async closeOrEndStaleSession(session: XRSession): Promise<void> {
    if (this.activeSession === session) {
      await this.closeActiveSession(session, false, false);
      return;
    }
    await endSessionQuietly(session);
  }

  private cleanupSessionResources(resetHitTest: boolean): void {
    this.floorScene.renderer.setAnimationLoop(null);
    this.currentHitValid = false;
    this.targetReady = false;
    this.emitPlacementReady(false, false);
    if (resetHitTest) {
      this.hitTest.reset();
    }
    if (this.targetScene) {
      const targetScene = this.targetScene;
      this.targetScene = null;
      targetScene.group.removeFromParent();
      targetScene.dispose();
    }
    this.floorScene.placementRoot.clear();
    this.floorScene.placementRoot.visible = false;
    this.clock = null;
    this.disconnectGestures();
  }

  private connectGestures(): void {
    if (this.gesturesConnected) {
      return;
    }
    this.gestureController.connect();
    this.gesturesConnected = true;
  }

  private disconnectGestures(): void {
    if (!this.gesturesConnected && this.gestureDisconnectPerformed) {
      return;
    }
    this.gestureController.disconnect();
    this.gesturesConnected = false;
    this.gestureDisconnectPerformed = true;
  }

  private isCurrent(generation: number): boolean {
    return !this.disposed && generation === this.launchGeneration;
  }
}

function createDefaultFloorScene(stage: HTMLElement): FloorPlacementScene {
  const scene = new Scene();
  const camera = new PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    40,
  );
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.xr.enabled = true;
  renderer.outputEncoding = sRGBEncoding;
  const reticle = new Mesh(
    new RingGeometry(0.09, 0.105, 40).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.95 }),
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  const placementRoot = new Group();
  placementRoot.name = 'floor-placement-root';
  placementRoot.visible = false;
  scene.add(new HemisphereLight(0xffffff, 0xbfd6ff, 2.4), reticle, placementRoot);

  const resize = (): void => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  resize();
  window.addEventListener('resize', resize);
  stage.append(renderer.domElement);
  let disposed = false;

  return {
    renderer,
    scene,
    camera,
    reticle,
    placementRoot,
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      window.removeEventListener('resize', resize);
      renderer.setAnimationLoop(null);
      reticle.geometry.dispose();
      const material = reticle.material;
      if (Array.isArray(material)) {
        for (const entry of material) entry.dispose();
      } else {
        material.dispose();
      }
      renderer.domElement.remove();
      renderer.dispose();
      scene.clear();
    },
  };
}

async function endSessionQuietly(session: XRSession): Promise<void> {
  try {
    await session.end();
  } catch {
    // Cleanup remains complete even if the user agent already ended the session.
  }
}

function failureStatus(prefix: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return detail ? `${prefix}: ${detail}` : `${prefix}.`;
}

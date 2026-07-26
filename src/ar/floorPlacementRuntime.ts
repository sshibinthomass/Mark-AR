import {
  BoxHelper,
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
  type Camera,
  type Object3D,
} from 'three';
import { targetObjectLabel } from '../app/targetEditorObjects';
import {
  FloorGestureController,
  type FloorDragGesture,
  type Point2,
} from '../interaction/floorGestureController';
import type { CloudflarePlacedAsset } from './cloudflareMarkerObject';
import { FloorHitTest } from './floorHitTest';
import { FloorObjectTransform } from './floorObjectTransform';
import { FloorSceneTransform } from './floorSceneTransform';
import {
  prepareFloorSessionLauncher,
  type FloorSessionLauncherPreparation,
} from './floorSessionLauncher';
import {
  createTargetSceneObject,
  type TargetSceneObject,
  type TargetSceneSelectableObject,
} from './targetSceneObject';
import { YouTubePlayerManager } from './youtubePlayerManager';

const SCANNING_STATUS = 'Move your phone until the floor ring appears.';
const READY_STATUS = 'Floor found. Tap Place.';
const ENDED_STATUS = 'Floor AR ended. Scan the image or place it again.';

export type FloorPlacementController = {
  launch(): Promise<void>;
  place(): void;
  setRotation(degrees: number): void;
  setSelectAll(enabled: boolean): void;
  clearSelection(): void;
  reset(): void;
  stop(): Promise<void>;
  dispose(): Promise<void>;
};

export type FloorTransformSelectionState = {
  selectAll: boolean;
  active: boolean;
  objectId?: string;
  label?: string;
};

export type FloorSelectionOutline = {
  object: Object3D;
  update(): void;
  dispose(): void;
};

export type FloorPlacementPreparation =
  | { supported: false; message: string }
  | { supported: true; controller: FloorPlacementController };

export type FloorPlacementRuntimeHooks = {
  onSessionStart(): void;
  onSessionEnd(): void;
  onStatus(message: string): void;
  onYouTubeError(message: string): void;
  onYouTubeActivated(): void;
  onPlacementReady(ready: boolean): void;
  onPlaced(): void;
  onSelectionChange(state: FloorTransformSelectionState): void;
};

export type FloorPlacementHooks = FloorPlacementRuntimeHooks;

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
  createYouTubePlayerManager(
    container: HTMLElement,
    onPlaybackError: (message: string) => void,
  ): Pick<
    YouTubePlayerManager,
    'register' | 'setMarkerVisible' | 'activateFromPointer' | 'update' | 'resize' | 'dispose'
  >;
  createSelectionOutline(target: Object3D): FloorSelectionOutline;
};

type FloorPlacementOptions = {
  stage: HTMLElement;
  overlayRoot: HTMLElement;
  gestureSurface: HTMLElement;
  asset: CloudflarePlacedAsset;
  hooks: FloorPlacementRuntimeHooks;
};

type FloorSessionActivation = {
  session: XRSession;
  targetScene: TargetSceneObject;
};

type ActiveSelection =
  | { kind: 'all'; root: Group }
  | {
      kind: 'object';
      objectId: string;
      root: Group;
      contentRoot: Group;
      transform: FloorObjectTransform;
    };

type GestureSessionToken = {
  session: XRSession | null;
};

const DEFAULT_DEPENDENCIES: FloorPlacementDependencies = {
  prepareSessionLauncher: prepareFloorSessionLauncher,
  createScene: createDefaultFloorScene,
  createTargetSceneObject,
  createHitTest: (reticle) => new FloorHitTest(reticle),
  createGestureController: (target, handlers) => new FloorGestureController(target, handlers),
  createClock: () => new Clock(),
  createYouTubePlayerManager: (container, onPlaybackError) => new YouTubePlayerManager(container, {
    onPlaybackError,
  }),
  createSelectionOutline: createDefaultSelectionOutline,
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
  private gestureController: FloorGestureController;
  private gestureSessionToken: GestureSessionToken;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly dragPlane = new Plane(new Vector3(0, 1, 0));
  private readonly selectedWorldPosition = new Vector3();
  private readonly previousDragPoint = new Vector3();
  private readonly currentDragPoint = new Vector3();
  private readonly dragDelta = new Vector3();
  private readonly preventOverlayXRSelect = (event: Event): void => {
    event.preventDefault();
  };
  private readonly options: FloorPlacementOptions;
  private readonly launcherPreparation: Extract<
    FloorSessionLauncherPreparation,
    { supported: true }
  >;
  private readonly floorScene: FloorPlacementScene;
  private readonly dependencies: FloorPlacementDependencies;
  private readonly sessionEndPromises = new WeakMap<XRSession, Promise<void>>();
  private readonly pendingResolvedSessions = new Set<XRSession>();
  private readonly pendingXROwnerships = new Set<Promise<unknown>>();

  private launchGeneration = 0;
  private disposed = false;
  private disposePromise: Promise<void> | null = null;
  private activeSession: XRSession | null = null;
  private sessionEndListener: (() => void) | null = null;
  private sessionSelectListener: (() => void) | null = null;
  private sessionStarted = false;
  private targetScene: TargetSceneObject | null = null;
  private youtubeManager: Pick<
    YouTubePlayerManager,
    'register' | 'setMarkerVisible' | 'activateFromPointer' | 'update' | 'resize' | 'dispose'
  > | null = null;
  private currentRenderCamera: Camera | null = null;
  private clock: Pick<Clock, 'getDelta'> | null = null;
  private targetReady = false;
  private currentHitValid = false;
  private lastPlacementReady: boolean | null = null;
  private gesturesConnected = false;
  private gestureDisconnectPerformed = false;
  private selectAll = true;
  private activeSelection: ActiveSelection | null = null;
  private selectionOutline: FloorSelectionOutline | null = null;

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
    this.gestureSessionToken = { session: null };
    this.gestureController = this.createGestureController(this.gestureSessionToken);
  }

  launch(): Promise<void> {
    try {
      const sessionPromise = this.launcherPreparation.launcher.start();
      const generation = ++this.launchGeneration;
      const supersededSessionCleanup = this.supersedeSessions();
      const xrOwnership = this.trackXROwnership(
        this.acquireXROwnership(sessionPromise, generation, supersededSessionCleanup),
      );
      return this.completeLaunch(xrOwnership, generation);
    } catch (error) {
      const generation = ++this.launchGeneration;
      const supersededSessionCleanup = this.supersedeSessions();
      return this.trackXROwnership(
        this.rejectLaunchAfterCleanup(error, generation, supersededSessionCleanup),
      );
    }
  }

  place(): boolean {
    const matrix = this.hitTest.latestPoseMatrix;
    if (!this.targetReady || !this.currentHitValid || !matrix) {
      return false;
    }

    this.transform.placeAt(matrix);
    this.options.hooks.onPlaced();
    this.youtubeManager?.setMarkerVisible('floor-target', true);
    return true;
  }

  setRotation(degrees: number): void {
    this.transform.rotateTo(degrees);
  }

  setSelectAll(enabled: boolean): void {
    if (enabled === this.selectAll) {
      return;
    }

    this.clearActiveSelection(false);
    this.selectAll = enabled;
    this.emitSelectionChange();
  }

  clearSelection(): void {
    this.clearActiveSelection(true);
  }

  reset(): boolean {
    this.clearSelection();
    const matrix = this.hitTest.latestPoseMatrix;
    if (!this.targetReady || !matrix) {
      return false;
    }

    for (const selectable of this.targetScene?.selectableObjects ?? []) {
      selectable.interactionRoot.position.set(0, 0, 0);
      selectable.interactionRoot.quaternion.identity();
      selectable.interactionRoot.scale.set(1, 1, 1);
    }
    this.transform.resetAt(matrix);
    return true;
  }

  stop(): Promise<void> {
    this.launchGeneration += 1;
    const pendingXROwnerships = [...this.pendingXROwnerships];
    const pendingSessionCleanup = this.endPendingResolvedSessions();
    const session = this.activeSession;
    const activeSessionCleanup = session
      ? this.closeActiveSession(session, true, false)
      : Promise.resolve();
    const pendingXROwnershipCleanup = Promise.allSettled(pendingXROwnerships).then(
      () => undefined,
    );
    return Promise.all([
      pendingSessionCleanup,
      activeSessionCleanup,
      pendingXROwnershipCleanup,
    ]).then(() => undefined);
  }

  dispose(): Promise<void> {
    if (this.disposePromise) {
      return this.disposePromise;
    }

    this.disposed = true;
    this.launchGeneration += 1;
    const pendingXROwnerships = [...this.pendingXROwnerships];
    const pendingSessionCleanup = this.endPendingResolvedSessions();
    const session = this.activeSession;
    let activeSessionCleanup = Promise.resolve();
    if (session) {
      this.detachSessionListeners(session);
      this.activeSession = null;
      this.sessionStarted = false;
      activeSessionCleanup = this.endSessionOnce(session);
    }

    this.cleanupSessionResources(false);
    this.disconnectGestures();
    this.hitTest.dispose();
    this.floorScene.renderer.setAnimationLoop(null);
    this.floorScene.renderer.domElement.remove();
    this.floorScene.dispose();
    const pendingXROwnershipCleanup = Promise.allSettled(pendingXROwnerships).then(
      () => undefined,
    );
    this.disposePromise = Promise.all([
      pendingSessionCleanup,
      activeSessionCleanup,
      pendingXROwnershipCleanup,
    ]).then(() => undefined);
    return this.disposePromise;
  }

  private async acquireXROwnership(
    sessionPromise: Promise<XRSession>,
    generation: number,
    supersededSessionCleanup: Promise<void>,
  ): Promise<FloorSessionActivation | null> {
    let session: XRSession;
    try {
      session = await sessionPromise;
    } catch (error) {
      await supersededSessionCleanup;
      if (!this.isCurrent(generation)) {
        return null;
      }
      this.options.hooks.onStatus(failureStatus('Floor AR could not start', error));
      throw error;
    }

    if (!this.isCurrent(generation)) {
      await this.endSessionOnce(session);
      return null;
    }

    this.pendingResolvedSessions.add(session);
    await supersededSessionCleanup;
    this.pendingResolvedSessions.delete(session);

    if (!this.isCurrent(generation)) {
      await this.endSessionOnce(session);
      return null;
    }

    return this.activateSession(session, generation);
  }

  private async completeLaunch(
    xrOwnership: Promise<FloorSessionActivation | null>,
    generation: number,
  ): Promise<void> {
    const activation = await xrOwnership;
    if (!activation) {
      return;
    }

    const { session, targetScene } = activation;
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

  private async rejectLaunchAfterCleanup(
    error: unknown,
    generation: number,
    supersededSessionCleanup: Promise<void>,
  ): Promise<never> {
    await supersededSessionCleanup;
    if (this.isCurrent(generation)) {
      this.options.hooks.onStatus(failureStatus('Floor AR could not start', error));
    }
    throw error;
  }

  private trackXROwnership<T>(xrOwnership: Promise<T>): Promise<T> {
    this.pendingXROwnerships.add(xrOwnership);
    void xrOwnership.then(
      () => {
        this.pendingXROwnerships.delete(xrOwnership);
      },
      () => {
        this.pendingXROwnerships.delete(xrOwnership);
      },
    );
    return xrOwnership;
  }

  private supersedeSessions(): Promise<void> {
    const hasPendingResolvedSessions = this.pendingResolvedSessions.size > 0;
    const pendingSessionCleanup = this.endPendingResolvedSessions();
    const activeSessionCleanup = this.supersedeActiveSession();
    return hasPendingResolvedSessions
      ? Promise.all([pendingSessionCleanup, activeSessionCleanup]).then(() => undefined)
      : activeSessionCleanup;
  }

  private endPendingResolvedSessions(): Promise<void> {
    const sessions = [...this.pendingResolvedSessions];
    this.pendingResolvedSessions.clear();
    return Promise.all(sessions.map((session) => this.endSessionOnce(session))).then(
      () => undefined,
    );
  }

  private supersedeActiveSession(): Promise<void> {
    const session = this.activeSession;
    return session
      ? this.closeActiveSession(session, true, false)
      : Promise.resolve();
  }

  private async activateSession(
    session: XRSession,
    generation: number,
  ): Promise<FloorSessionActivation | null> {
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
        return null;
      }
      await this.failActiveSession(session, generation, 'Floor AR could not start', error);
      return null;
    }

    if (!this.isCurrent(generation) || this.activeSession !== session) {
      await this.closeOrEndStaleSession(session);
      return null;
    }

    this.resetSelectionForSession();
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
      return null;
    }

    this.targetScene = targetScene;
    this.floorScene.placementRoot.add(targetScene.group);
    if (targetScene.youtubeSurfaces.length > 0) {
      let sessionManager: FloorPlacementRuntime['youtubeManager'] = null;
      sessionManager = this.dependencies.createYouTubePlayerManager(
        this.options.overlayRoot,
        (message) => {
          if (this.activeSession === session && this.youtubeManager === sessionManager) {
            this.options.hooks.onYouTubeError(message);
          }
        },
      );
      this.youtubeManager = sessionManager;
      for (const surface of targetScene.youtubeSurfaces) {
        sessionManager.register('floor-target', surface);
      }
    }
    this.clock = this.dependencies.createClock();
    this.prepareGestureControllerForSession(session);
    this.connectGestures();
    this.options.hooks.onStatus(SCANNING_STATUS);
    this.floorScene.renderer.setAnimationLoop(this.onAnimationFrame);
    return { session, targetScene };
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
    this.selectionOutline?.update();
    const stageBounds = this.options.stage.getBoundingClientRect();
    this.youtubeManager?.resize(stageBounds.width, stageBounds.height);
    this.floorScene.renderer.render(this.floorScene.scene, this.floorScene.camera);
    this.currentRenderCamera = this.getCurrentXRCamera();
    this.youtubeManager?.update(this.currentRenderCamera);
  };

  private async activateYouTubeOrPlace(
    point: Point2,
    token: GestureSessionToken,
  ): Promise<void> {
    if (!this.isGestureSessionCurrent(token)) {
      return;
    }

    if (!this.floorScene.placementRoot.visible) {
      this.place();
      return;
    }

    const selection = this.activeSelection;
    if (selection) {
      const hitSelectedTarget = this.pointHitsSelection(point, selection);
      if (
        hitSelectedTarget === false
        && this.isGestureSessionCurrent(token)
        && this.activeSelection === selection
      ) {
        this.clearSelection();
      }
      return;
    }

    const manager = this.youtubeManager;
    if (!manager) {
      return;
    }
    const session = this.activeSession;
    if (!session) {
      return;
    }

    const bounds = this.options.gestureSurface.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    const renderCamera = this.getCurrentXRCamera();
    const result = await manager.activateFromPointer({
      x: ((point.x - bounds.left) / bounds.width) * 2 - 1,
      y: -((point.y - bounds.top) / bounds.height) * 2 + 1,
    }, renderCamera);
    if (
      !this.isGestureSessionCurrent(token)
      || this.activeSession !== session
      || this.youtubeManager !== manager
    ) {
      return;
    }
    if (result === 'activated') {
      this.options.hooks.onYouTubeActivated();
    }
  }

  private updatePlacementReadiness(): void {
    this.emitPlacementReady(this.targetReady && this.currentHitValid);
  }

  private getCurrentXRCamera(): Camera {
    const getCamera = this.floorScene.renderer.xr.getCamera as unknown as (
      baseCamera: PerspectiveCamera,
    ) => Camera;
    const camera = getCamera.call(this.floorScene.renderer.xr, this.floorScene.camera);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    return camera;
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

  private dragSelection(
    gesture: FloorDragGesture,
    token: GestureSessionToken,
  ): void {
    if (
      !this.isGestureSessionCurrent(token)
      || !this.floorScene.placementRoot.visible
    ) {
      return;
    }

    const selection = this.activeSelection;
    if (!selection) {
      return;
    }
    const bounds = this.options.gestureSurface.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    selection.root.updateWorldMatrix(true, false);
    selection.root.getWorldPosition(this.selectedWorldPosition);
    this.dragPlane.constant = -this.selectedWorldPosition.y;
    const camera = this.getCurrentXRCamera();
    if (
      !this.intersectDragPoint(gesture.previous, bounds, camera, this.previousDragPoint)
      || !this.intersectDragPoint(gesture.current, bounds, camera, this.currentDragPoint)
    ) {
      return;
    }

    this.dragDelta.subVectors(this.currentDragPoint, this.previousDragPoint);
    if (selection.kind === 'all') {
      this.transform.moveByWorldDelta(this.dragDelta);
    } else {
      selection.transform.moveByWorldDelta(this.dragDelta);
    }
  }

  private createGestureController(token: GestureSessionToken): FloorGestureController {
    return this.dependencies.createGestureController(this.options.gestureSurface, {
      isTransformActive: () => (
        this.isGestureSessionCurrent(token) && this.activeSelection !== null
      ),
      onTap: (point) => {
        void this.activateYouTubeOrPlace(point, token);
      },
      onLongPress: (point) => {
        this.selectFromLongPress(point, token);
      },
      onDrag: (gesture) => {
        this.dragSelection(gesture, token);
      },
      onPinch: (multiplier) => {
        this.scaleSelection(multiplier, token);
      },
    });
  }

  private prepareGestureControllerForSession(session: XRSession): void {
    if (
      this.gestureSessionToken.session !== null
      || this.gestureDisconnectPerformed
    ) {
      this.gestureSessionToken = { session: null };
      this.gestureController = this.createGestureController(this.gestureSessionToken);
      this.gestureDisconnectPerformed = false;
    }
    this.gestureSessionToken.session = session;
  }

  private isGestureSessionCurrent(token: GestureSessionToken): boolean {
    return (
      !this.disposed
      && token === this.gestureSessionToken
      && token.session !== null
      && this.activeSession === token.session
    );
  }

  private selectFromLongPress(point: Point2, token: GestureSessionToken): void {
    if (
      !this.isGestureSessionCurrent(token)
      || !this.floorScene.placementRoot.visible
    ) {
      return;
    }

    const selectable = this.closestSelectableAt(point);
    if (!selectable) {
      return;
    }

    if (this.selectAll) {
      this.activateSelection({
        kind: 'all',
        root: this.floorScene.placementRoot,
      });
      return;
    }

    this.activateSelection({
      kind: 'object',
      objectId: selectable.objectId,
      root: selectable.interactionRoot,
      contentRoot: selectable.contentRoot,
      transform: new FloorObjectTransform(selectable.interactionRoot),
    });
  }

  private scaleSelection(multiplier: number, token: GestureSessionToken): void {
    if (!this.isGestureSessionCurrent(token)) {
      return;
    }

    const selection = this.activeSelection;
    if (!selection) {
      return;
    }
    if (selection.kind === 'all') {
      this.transform.scaleBy(multiplier);
    } else {
      selection.transform.scaleBy(multiplier);
    }
  }

  private closestSelectableAt(point: Point2): TargetSceneSelectableObject | null {
    const targetScene = this.targetScene;
    if (!targetScene || !this.setRayFromScreenPoint(point)) {
      return null;
    }

    this.floorScene.scene.updateMatrixWorld(true);
    let closest: TargetSceneSelectableObject | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const selectable of targetScene.selectableObjects) {
      const intersection = this.raycaster.intersectObject(selectable.contentRoot, true)[0];
      if (intersection && intersection.distance < closestDistance) {
        closest = selectable;
        closestDistance = intersection.distance;
      }
    }
    return closest;
  }

  private pointHitsSelection(
    point: Point2,
    selection: ActiveSelection,
  ): boolean | null {
    if (!this.setRayFromScreenPoint(point)) {
      return null;
    }

    this.floorScene.scene.updateMatrixWorld(true);
    const target = selection.kind === 'all'
      ? selection.root
      : selection.contentRoot;
    return this.raycaster.intersectObject(target, true).length > 0;
  }

  private setRayFromScreenPoint(point: Point2): boolean {
    const bounds = this.options.gestureSurface.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return false;
    }

    this.pointer.set(
      ((point.x - bounds.left) / bounds.width) * 2 - 1,
      -((point.y - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.getCurrentXRCamera());
    return true;
  }

  private intersectDragPoint(
    point: Point2,
    bounds: DOMRect,
    camera: Camera,
    target: Vector3,
  ): boolean {
    this.pointer.set(
      ((point.x - bounds.left) / bounds.width) * 2 - 1,
      -((point.y - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, camera);
    return this.raycaster.ray.intersectPlane(this.dragPlane, target) !== null;
  }

  private activateSelection(selection: ActiveSelection): void {
    const outline = this.dependencies.createSelectionOutline(selection.root);
    this.clearActiveSelection(false);
    this.activeSelection = selection;
    this.selectionOutline = outline;
    this.floorScene.scene.add(outline.object);
    this.emitSelectionChange();
  }

  private clearActiveSelection(emitChange: boolean): void {
    const hadSelection = this.activeSelection !== null || this.selectionOutline !== null;
    this.activeSelection = null;
    if (this.selectionOutline) {
      const outline = this.selectionOutline;
      this.selectionOutline = null;
      outline.object.removeFromParent();
      outline.dispose();
    }
    if (emitChange && hadSelection) {
      this.emitSelectionChange();
    }
  }

  private resetSelectionForSession(): void {
    this.clearActiveSelection(false);
    this.selectAll = true;
    this.emitSelectionChange();
  }

  private emitSelectionChange(): void {
    const selection = this.activeSelection;
    if (!selection) {
      this.options.hooks.onSelectionChange({
        selectAll: this.selectAll,
        active: false,
      });
      return;
    }
    if (selection.kind === 'all') {
      this.options.hooks.onSelectionChange({
        selectAll: true,
        active: true,
        label: 'All objects',
      });
      return;
    }

    const state: FloorTransformSelectionState = {
      selectAll: false,
      active: true,
      objectId: selection.objectId,
    };
    const label = this.selectedObjectLabel(selection.objectId);
    if (label) {
      state.label = label;
    }
    this.options.hooks.onSelectionChange(state);
  }

  private selectedObjectLabel(objectId: string): string | undefined {
    const object = this.options.asset.objects?.find((candidate) => candidate.id === objectId);
    if (object) {
      return targetObjectLabel(object);
    }
    if (this.options.asset.model?.id === objectId) {
      return this.options.asset.model.label;
    }
    return undefined;
  }

  private attachSessionListeners(session: XRSession): void {
    this.sessionEndListener = () => {
      this.handleExternalSessionEnd(session);
    };
    this.sessionSelectListener = () => {
      if (!this.floorScene.placementRoot.visible) {
        this.place();
      }
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
    this.markSessionEnded(session);
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
      await this.endSessionOnce(session);
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
    await this.endSessionOnce(session);
  }

  private async closeOrEndStaleSession(session: XRSession): Promise<void> {
    if (this.activeSession === session) {
      await this.closeActiveSession(session, false, false);
      return;
    }
    await this.endSessionOnce(session);
  }

  private endSessionOnce(session: XRSession): Promise<void> {
    const existing = this.sessionEndPromises.get(session);
    if (existing) {
      return existing;
    }

    const ending = endSessionQuietly(session);
    this.sessionEndPromises.set(session, ending);
    return ending;
  }

  private markSessionEnded(session: XRSession): void {
    if (!this.sessionEndPromises.has(session)) {
      this.sessionEndPromises.set(session, Promise.resolve());
    }
  }

  private cleanupSessionResources(resetHitTest: boolean): void {
    this.clearActiveSelection(true);
    this.floorScene.renderer.setAnimationLoop(null);
    this.currentHitValid = false;
    this.targetReady = false;
    this.emitPlacementReady(false, false);
    if (resetHitTest) {
      this.hitTest.reset();
    }
    this.youtubeManager?.dispose();
    this.youtubeManager = null;
    this.currentRenderCamera = null;
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
    this.options.overlayRoot.addEventListener('beforexrselect', this.preventOverlayXRSelect);
    this.gestureController.connect();
    this.gesturesConnected = true;
    this.gestureDisconnectPerformed = false;
  }

  private disconnectGestures(): void {
    if (!this.gesturesConnected && this.gestureDisconnectPerformed) {
      return;
    }
    this.options.overlayRoot.removeEventListener('beforexrselect', this.preventOverlayXRSelect);
    this.gestureController.disconnect();
    this.gesturesConnected = false;
    this.gestureDisconnectPerformed = true;
  }

  private isCurrent(generation: number): boolean {
    return !this.disposed && generation === this.launchGeneration;
  }
}

function createDefaultSelectionOutline(target: Object3D): FloorSelectionOutline {
  const object = new BoxHelper(target, 0x5eead4);
  object.name = 'floor-transform-selection-outline';
  object.visible = true;
  let disposed = false;

  return {
    object,
    update() {
      if (!disposed) {
        object.update();
      }
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) {
        for (const entry of material) {
          entry.dispose();
        }
      } else {
        material.dispose();
      }
    },
  };
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

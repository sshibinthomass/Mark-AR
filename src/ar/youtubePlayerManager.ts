import {
  Raycaster,
  Scene,
  Vector2,
  type Camera,
  type Object3D,
} from 'three';
import {
  CSS3DObject,
  CSS3DRenderer,
} from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import type { TargetYouTubeContent } from '../app/targetMedia';
import type { InteractiveYouTubeSurface } from './targetSceneObject';
import {
  createYouTubeTransportControls,
  type YouTubeTransportControls,
  type YouTubeTransportPlayer,
} from './youtubeTransportControls';
import {
  createTransportProjectionSnapshot,
  pointInProjectedQuad,
  projectTransportRegion,
  selectProjectedTransportRegion,
  type ProjectedTransportRegion,
  type TransportProjectionSnapshot,
} from './youtubeTransportHitGeometry';

export type YouTubePlayerPort = YouTubeTransportPlayer & {
  destroy(): void;
};

type YouTubeActivationResult = 'activated' | 'missed' | 'failed';

type YouTubePlayerStateHandler = (state: number) => void;

type CssRendererPort = {
  domElement: HTMLElement;
  setSize(width: number, height: number): void;
  render(scene: Scene, camera: Camera): void;
};

type CssObjectPort = Object3D & { element: HTMLElement };

type RegisteredSurface = InteractiveYouTubeSurface & {
  markerId: string;
  markerVisible: boolean;
};

type PlayerActivationShell = {
  surface: RegisteredSurface;
  cssObject: CssObjectPort;
  controlsCssObject: CssObjectPort;
  wrapper: HTMLElement;
  controlsFrame: HTMLElement;
  controls: YouTubeTransportControls;
  generation: number;
  stackOrder: number;
  disposed: boolean;
};

type PendingActivation = PlayerActivationShell;

type ActivePlayer = PlayerActivationShell & {
  player: YouTubePlayerPort;
  transportRegion?: ProjectedTransportRegion<number, HTMLButtonElement>;
};

type TransportHit = {
  ownerObjectId: string;
  ownerGeneration: number;
  target: HTMLElement;
  button?: HTMLButtonElement;
};

type TransportGesture = {
  contained: boolean;
  origin?: TransportHit;
};

type NativePointerContact = {
  ownerObjectId: string;
  ownerGeneration: number;
  controls: HTMLElement;
  orphaned: boolean;
};

type TransportHitCandidate = {
  ownerObjectId: string;
  ownerGeneration: number;
  controls: HTMLElement;
  stackOrder: number;
};

type PendingLayerClick = {
  source: 'pointer' | 'mouse' | 'touch';
  contained: boolean;
  origin?: TransportHit;
  releasedOnOrigin: boolean;
  id?: number;
  pointerType?: string;
  clientX: number;
  clientY: number;
  completedAt: number;
};

const YOUTUBE_PLAYER_WIDTH_PX = 480;
const YOUTUBE_PLAYER_HEIGHT_PX = 270;
const YOUTUBE_CSS_PIXELS_PER_WORLD_UNIT = YOUTUBE_PLAYER_HEIGHT_PX;
const YOUTUBE_TRANSPORT_GAP_PX = 14;
const YOUTUBE_TRANSPORT_HEIGHT_PX = 60;
const COMPATIBILITY_MOUSE_WINDOW_MS = 750;
const COMPATIBILITY_MOUSE_COORDINATE_TOLERANCE_PX = 4;
const DUPLICATE_POINTER_TOUCH_COMPLETION_WINDOW_MS = 50;
const MAX_PENDING_LAYER_CLICKS = 8;
const YOUTUBE_TRANSPORT_Y_OFFSET_PX = (
  YOUTUBE_PLAYER_HEIGHT_PX / 2
  + YOUTUBE_TRANSPORT_GAP_PX
  + YOUTUBE_TRANSPORT_HEIGHT_PX / 2
);

type YouTubePlayerManagerDeps = {
  createCssRenderer?: () => CssRendererPort;
  createCssObject?: (element: HTMLElement) => CssObjectPort;
  createPlayer?: (
    element: HTMLElement,
    youtube: TargetYouTubeContent,
    onStateChange: YouTubePlayerStateHandler,
  ) => Promise<YouTubePlayerPort>;
  hitTest?: (
    pointer: { x: number; y: number },
    camera: Camera,
    surfaces: RegisteredSurface[],
  ) => RegisteredSurface | undefined;
  transportHitTest?: (
    point: { x: number; y: number },
    candidates: TransportHitCandidate[],
  ) => TransportHit | undefined;
  onPlaybackError?: (message: string) => void;
  scene?: Scene;
};

export class YouTubePlayerManager {
  private readonly container: HTMLElement;
  private readonly inputWindow: Window | null;
  private readonly renderer: CssRendererPort;
  private readonly scene: Scene;
  private readonly createCssObject: (element: HTMLElement) => CssObjectPort;
  private readonly createPlayer: (
    element: HTMLElement,
    youtube: TargetYouTubeContent,
    onStateChange: YouTubePlayerStateHandler,
  ) => Promise<YouTubePlayerPort>;
  private readonly hitTest: NonNullable<YouTubePlayerManagerDeps['hitTest']>;
  private readonly transportHitTest?: YouTubePlayerManagerDeps['transportHitTest'];
  private readonly onPlaybackError?: (message: string) => void;
  private readonly surfaces: RegisteredSurface[] = [];
  private readonly pendingActivations = new Map<string, PendingActivation>();
  private readonly activePlayers = new Map<string, ActivePlayer>();
  private readonly nativePointerContacts = new Map<number, NativePointerContact>();
  // Chrome can hit the renderer layer while omitting deeply scaled CSS3D descendants.
  private readonly layerPointerGestures = new Map<number, TransportGesture>();
  private readonly layerTouchGestures = new Map<number, TransportGesture>();
  private readonly pendingLayerClicks = new Map<string, PendingLayerClick>();
  private compatibilityLayerClick: PendingLayerClick | undefined;
  private routedMouse: TransportGesture | undefined;
  private transportProjectionSnapshot: TransportProjectionSnapshot | undefined;
  private nextActivationGeneration = 1;
  private nextPlayerStackOrder = 0;
  private nativePointerWindowBridgeConnected = false;
  private disposed = false;

  constructor(
    container: HTMLElement,
    deps: YouTubePlayerManagerDeps = {},
  ) {
    this.container = container;
    this.inputWindow = container.ownerDocument.defaultView;
    this.renderer = deps.createCssRenderer?.() ?? new CSS3DRenderer();
    this.scene = deps.scene ?? new Scene();
    this.createCssObject = deps.createCssObject ?? ((element) => new CSS3DObject(element));
    this.createPlayer = deps.createPlayer ?? createYouTubePlayer;
    this.hitTest = deps.hitTest ?? raycastYouTubeSurface;
    this.transportHitTest = deps.transportHitTest;
    this.onPlaybackError = deps.onPlaybackError;
    this.renderer.domElement.classList.add('youtube-css3d-layer');
    Object.assign(this.renderer.domElement.style, {
      position: 'absolute',
      inset: '0',
      overflow: 'hidden',
      pointerEvents: 'auto',
    });
    this.container.append(this.renderer.domElement);
    this.connectTransportInputRouter();
    this.resize(this.container.clientWidth, this.container.clientHeight);
  }

  register(markerId: string, surface: InteractiveYouTubeSurface): void {
    if (this.disposed) {
      return;
    }
    surface.mesh.visible = true;
    this.surfaces.push({ ...surface, markerId, markerVisible: false });
  }

  setMarkerVisible(markerId: string, visible: boolean): void {
    for (const surface of this.surfaces) {
      if (surface.markerId !== markerId) {
        continue;
      }
      surface.markerVisible = visible;
      if (!visible) {
        this.invalidatePendingActivation(surface.objectId);
        this.deactivate(surface.objectId, false);
        surface.mesh.visible = false;
      } else if (
        !this.pendingActivations.has(surface.objectId)
        && !this.activePlayers.has(surface.objectId)
      ) {
        surface.mesh.visible = true;
      }
    }
  }

  async activateFromPointer(
    pointer: { x: number; y: number },
    camera: Camera,
  ): Promise<YouTubeActivationResult> {
    if (this.disposed) {
      return 'missed';
    }
    const eligible = this.surfaces.filter((surface) => (
      surface.markerVisible
      && surface.mesh.visible
      && !this.pendingActivations.has(surface.objectId)
      && !this.activePlayers.has(surface.objectId)
    ));
    const surface = this.hitTest(pointer, camera, eligible);
    if (!surface) {
      return 'missed';
    }

    const wrapper = document.createElement('div');
    wrapper.dataset.youtubePlayerObject = surface.objectId;
    wrapper.className = 'youtube-css3d-player';
    Object.assign(wrapper.style, {
      width: `${YOUTUBE_PLAYER_WIDTH_PX}px`,
      height: `${YOUTUBE_PLAYER_HEIGHT_PX}px`,
      pointerEvents: 'auto',
      background: '#000',
    });
    const host = document.createElement('div');
    host.style.width = '100%';
    host.style.height = '100%';
    const generation = this.nextActivationGeneration;
    this.nextActivationGeneration += 1;
    const stackOrder = this.nextPlayerStackOrder;
    this.nextPlayerStackOrder += 1;
    const controls = createYouTubeTransportControls({
      onPointerContactStart: (pointerId) => {
        this.beginNativePointerContact(
          pointerId,
          surface.objectId,
          generation,
        );
      },
      onPointerContactEnd: (pointerId) => {
        this.endNativePointerContact(
          pointerId,
          surface.objectId,
          generation,
        );
      },
      onPointerContactAbandon: (pointerId) => {
        this.abandonNativePointerContact(
          pointerId,
          surface.objectId,
          generation,
        );
      },
    });
    const controlsFrame = document.createElement('div');
    controlsFrame.className = 'youtube-css3d-controls-frame';
    controlsFrame.append(controls.element);
    wrapper.append(host);
    this.renderer.domElement.append(wrapper, controlsFrame);
    const cssObject = this.createCssObject(wrapper);
    const controlsCssObject = this.createCssObject(controlsFrame);
    controlsCssObject.position.y = YOUTUBE_TRANSPORT_Y_OFFSET_PX;
    controlsCssObject.scale.setScalar(YOUTUBE_CSS_PIXELS_PER_WORLD_UNIT);
    cssObject.add(controlsCssObject);
    this.scene.add(cssObject);
    surface.mesh.visible = false;
    const pending: PendingActivation = {
      surface,
      cssObject,
      controlsCssObject,
      wrapper,
      controlsFrame,
      controls,
      generation,
      stackOrder,
      disposed: false,
    };
    this.pendingActivations.set(surface.objectId, pending);

    try {
      const player = await this.createPlayer(host, surface.youtube, (state) => {
        const active = this.activePlayers.get(surface.objectId);
        if (active?.generation === generation) {
          controls.setPlayerState(state);
        }
      });
      if (
        this.disposed
        || !surface.markerVisible
        || this.pendingActivations.get(surface.objectId) !== pending
      ) {
        player.pauseVideo();
        player.destroy();
        this.disposeActivationShell(pending);
        return 'missed';
      }
      this.pendingActivations.delete(surface.objectId);
      this.activePlayers.set(surface.objectId, {
        ...pending,
        player,
      });
      controls.bindPlayer(player);
      player.playVideo();
      delete this.container.dataset.youtubeError;
      return 'activated';
    } catch (error) {
      const ownsPendingActivation = (
        this.pendingActivations.get(surface.objectId) === pending
      );
      if (ownsPendingActivation) {
        this.pendingActivations.delete(surface.objectId);
      }
      this.disposeActivationShell(pending);
      if (
        this.disposed
        || !surface.markerVisible
        || !ownsPendingActivation
      ) {
        return 'missed';
      }
      surface.mesh.visible = surface.markerVisible;
      const message = error instanceof Error
        ? error.message
        : 'YouTube playback is unavailable.';
      this.container.dataset.youtubeError = message;
      this.onPlaybackError?.(message);
      return 'failed';
    }
  }

  update(camera: Camera): void {
    if (this.disposed) {
      return;
    }
    for (const active of this.activePlayers.values()) {
      active.surface.root.updateWorldMatrix(true, false);
      active.surface.root.matrixWorld.decompose(
        active.cssObject.position,
        active.cssObject.quaternion,
        active.cssObject.scale,
      );
      active.cssObject.scale.multiplyScalar(1 / YOUTUBE_CSS_PIXELS_PER_WORLD_UNIT);
    }
    this.scene.updateMatrixWorld(true);
    this.renderer.render(this.scene, camera);
    this.refreshTransportHitGeometry(camera);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(Math.max(1, width), Math.max(1, height));
    this.clearTransportHitGeometry();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.disconnectTransportInputRouter();
    for (const objectId of [...this.pendingActivations.keys()]) {
      this.invalidatePendingActivation(objectId);
    }
    for (const objectId of [...this.activePlayers.keys()]) {
      this.deactivate(objectId, false);
    }
    this.surfaces.length = 0;
    this.clearTransportHitGeometry();
    this.renderer.domElement.remove();
    delete this.container.dataset.youtubeError;
  }

  private connectTransportInputRouter(): void {
    const layer = this.renderer.domElement;
    this.container.addEventListener(
      'pointerdown',
      this.onNativePointerStartCapture,
      true,
    );
    this.container.addEventListener(
      'pointerup',
      this.onNativePointerCompletionCapture,
      true,
    );
    this.container.addEventListener(
      'pointercancel',
      this.onNativePointerCompletionCapture,
      true,
    );
    layer.addEventListener('pointerdown', this.onLayerPointerDown);
    layer.addEventListener('pointermove', this.onLayerPointerMove);
    layer.addEventListener('pointerup', this.onLayerPointerUp);
    layer.addEventListener('pointercancel', this.onLayerPointerCancel);
    layer.addEventListener('mousedown', this.onLayerMouseDown);
    layer.addEventListener('mousemove', this.onLayerMouseMove);
    layer.addEventListener('mouseup', this.onLayerMouseUp);
    layer.addEventListener('touchstart', this.onLayerTouchStart);
    layer.addEventListener('touchmove', this.onLayerTouchMove);
    layer.addEventListener('touchend', this.onLayerTouchEnd);
    layer.addEventListener('touchcancel', this.onLayerTouchCancel);
    layer.addEventListener('click', this.onLayerClick);
  }

  private disconnectTransportInputRouter(): void {
    const layer = this.renderer.domElement;
    this.clearNativePointerContacts();
    this.container.removeEventListener(
      'pointerdown',
      this.onNativePointerStartCapture,
      true,
    );
    this.container.removeEventListener(
      'pointerup',
      this.onNativePointerCompletionCapture,
      true,
    );
    this.container.removeEventListener(
      'pointercancel',
      this.onNativePointerCompletionCapture,
      true,
    );
    layer.removeEventListener('pointerdown', this.onLayerPointerDown);
    layer.removeEventListener('pointermove', this.onLayerPointerMove);
    layer.removeEventListener('pointerup', this.onLayerPointerUp);
    layer.removeEventListener('pointercancel', this.onLayerPointerCancel);
    layer.removeEventListener('mousedown', this.onLayerMouseDown);
    layer.removeEventListener('mousemove', this.onLayerMouseMove);
    layer.removeEventListener('mouseup', this.onLayerMouseUp);
    layer.removeEventListener('touchstart', this.onLayerTouchStart);
    layer.removeEventListener('touchmove', this.onLayerTouchMove);
    layer.removeEventListener('touchend', this.onLayerTouchEnd);
    layer.removeEventListener('touchcancel', this.onLayerTouchCancel);
    layer.removeEventListener('click', this.onLayerClick);
    this.layerPointerGestures.clear();
    this.layerTouchGestures.clear();
    this.clearCompletedLayerClicks();
    this.routedMouse = undefined;
  }

  private readonly onNativePointerStartCapture = (
    event: PointerEvent,
  ): void => {
    const contact = this.nativePointerContacts.get(event.pointerId);
    if (!contact?.orphaned) {
      return;
    }
    this.forgetNativePointerContact(event.pointerId);
  };

  private readonly onNativePointerCompletionCapture = (
    event: PointerEvent,
  ): void => {
    const contact = this.nativePointerContacts.get(event.pointerId);
    if (!contact) {
      return;
    }
    const active = this.activePlayers.get(contact.ownerObjectId);
    const reachesCurrentOwner = (
      !contact.orphaned
      && active?.generation === contact.ownerGeneration
      && event.target instanceof Node
      && contact.controls.contains(event.target)
    );
    if (reachesCurrentOwner) {
      return;
    }
    this.forgetNativePointerContact(event.pointerId);
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private readonly onLayerPointerDown = (event: PointerEvent): void => {
    if (isNativeTransportTarget(event.target)) {
      return;
    }
    this.routedMouse = undefined;
    if (
      this.layerPointerGestures.size === 0
      && this.layerTouchGestures.size === 0
    ) {
      this.clearCompletedLayerClicks();
    }
    const origin = this.transportHitAt(event.clientX, event.clientY);
    const gesture = createTransportGesture(origin);
    this.layerPointerGestures.set(event.pointerId, gesture);
    if (!gesture.contained) {
      return;
    }
    event.stopPropagation();
  };

  private readonly onLayerPointerMove = (event: PointerEvent): void => {
    if (this.layerPointerGestures.get(event.pointerId)?.contained) {
      event.stopPropagation();
    }
  };

  private readonly onLayerPointerUp = (event: PointerEvent): void => {
    const gesture = this.layerPointerGestures.get(event.pointerId);
    if (!gesture) {
      return;
    }
    this.layerPointerGestures.delete(event.pointerId);
    const releasedOnOrigin = this.releaseMatchesOrigin(
      gesture,
      event.clientX,
      event.clientY,
    );
    this.rememberCompletedLayerClick({
      source: 'pointer',
      id: event.pointerId,
      pointerType: event.pointerType,
      ...gesture,
      releasedOnOrigin,
      clientX: event.clientX,
      clientY: event.clientY,
      completedAt: event.timeStamp,
    });
    if (gesture.contained) {
      event.stopPropagation();
    }
  };

  private readonly onLayerPointerCancel = (event: PointerEvent): void => {
    if (!this.layerPointerGestures.has(event.pointerId)) {
      return;
    }
    const gesture = this.layerPointerGestures.get(event.pointerId);
    this.layerPointerGestures.delete(event.pointerId);
    this.forgetCompletedLayerClick('pointer', event.pointerId);
    if (gesture?.contained) {
      event.stopPropagation();
    }
  };

  private readonly onLayerMouseDown = (event: MouseEvent): void => {
    if (this.handleCompatibilityMouseEvent(event)) {
      return;
    }
    if (isNativeTransportTarget(event.target)) {
      return;
    }
    this.routedMouse = createTransportGesture(
      this.transportHitAt(event.clientX, event.clientY),
    );
    if (this.routedMouse.contained) {
      event.stopPropagation();
    }
  };

  private readonly onLayerMouseMove = (event: MouseEvent): void => {
    if (this.routedMouse !== undefined) {
      if (this.routedMouse.contained) {
        event.stopPropagation();
      }
      return;
    }
    this.handleCompatibilityMouseEvent(event);
  };

  private readonly onLayerMouseUp = (event: MouseEvent): void => {
    if (this.routedMouse !== undefined) {
      const gesture = this.routedMouse;
      this.routedMouse = undefined;
      this.rememberCompletedLayerClick({
        source: 'mouse',
        ...gesture,
        releasedOnOrigin: this.releaseMatchesOrigin(
          gesture,
          event.clientX,
          event.clientY,
        ),
        clientX: event.clientX,
        clientY: event.clientY,
        completedAt: event.timeStamp,
      });
      if (gesture.contained) {
        event.stopPropagation();
      }
      return;
    }
    this.handleCompatibilityMouseEvent(event);
  };

  private readonly onLayerTouchStart = (event: TouchEvent): void => {
    if (isNativeTransportTarget(event.target)) {
      return;
    }
    this.routedMouse = undefined;
    if (
      this.layerPointerGestures.size === 0
      && this.layerTouchGestures.size === 0
    ) {
      this.clearCompletedLayerClicks();
    }
    let contained = false;
    forEachTouch(event.changedTouches, (touch) => {
      const gesture = createTransportGesture(
        this.transportHitAt(touch.clientX, touch.clientY),
      );
      this.layerTouchGestures.set(touch.identifier, gesture);
      if (gesture.contained) {
        contained = true;
      }
    });
    if (contained) {
      event.stopPropagation();
    }
  };

  private readonly onLayerTouchMove = (event: TouchEvent): void => {
    if (touchListContainsRoutedTouch(event.changedTouches, this.layerTouchGestures)) {
      event.stopPropagation();
    }
  };

  private readonly onLayerTouchEnd = (event: TouchEvent): void => {
    let contained = false;
    forEachTouch(event.changedTouches, (touch) => {
      const gesture = this.layerTouchGestures.get(touch.identifier);
      if (!gesture) {
        return;
      }
      this.layerTouchGestures.delete(touch.identifier);
      this.rememberCompletedLayerClick({
        source: 'touch',
        id: touch.identifier,
        ...gesture,
        releasedOnOrigin: this.releaseMatchesOrigin(
          gesture,
          touch.clientX,
          touch.clientY,
        ),
        clientX: touch.clientX,
        clientY: touch.clientY,
        completedAt: event.timeStamp,
      });
      if (gesture.contained) {
        contained = true;
      }
    });
    if (contained) {
      event.stopPropagation();
    }
  };

  private readonly onLayerTouchCancel = (event: TouchEvent): void => {
    let contained = false;
    forEachTouch(event.changedTouches, (touch) => {
      const gesture = this.layerTouchGestures.get(touch.identifier);
      if (!gesture) {
        return;
      }
      this.layerTouchGestures.delete(touch.identifier);
      this.forgetCompletedLayerClick('touch', touch.identifier);
      if (gesture.contained) {
        contained = true;
      }
    });
    if (contained) {
      event.stopPropagation();
    }
  };

  private readonly onLayerClick = (event: MouseEvent): void => {
    if (isNativeTransportTarget(event.target)) {
      return;
    }
    const pendingClick = this.matchingCompletedLayerClick(event);
    if (pendingClick) {
      for (const [key, candidate] of this.pendingLayerClicks) {
        if (areDuplicatePointerTouchCompletions(pendingClick, candidate)) {
          this.pendingLayerClicks.delete(key);
        }
      }
    }
    this.compatibilityLayerClick = undefined;
    if (!pendingClick && !this.hasActivePointerOrTouchGesture()) {
      this.clearCompletedLayerClicks();
    }
    if (!pendingClick?.contained) {
      return;
    }
    event.stopPropagation();
    if (
      !pendingClick.releasedOnOrigin
      || !pendingClick.origin?.button
      || !this.isActiveTransportOrigin(pendingClick.origin)
    ) {
      return;
    }
    pendingClick.origin.button.focus({ preventScroll: true });
    pendingClick.origin.button.click();
  };

  private rememberCompletedLayerClick(pendingClick: PendingLayerClick): void {
    const key = completedLayerClickKey(pendingClick.source, pendingClick.id);
    this.forgetCompletedLayerClick(pendingClick.source, pendingClick.id);
    this.pendingLayerClicks.set(key, pendingClick);
    if (this.pendingLayerClicks.size > MAX_PENDING_LAYER_CLICKS) {
      const oldestKey = this.pendingLayerClicks.keys().next().value;
      if (oldestKey !== undefined) {
        this.pendingLayerClicks.delete(oldestKey);
      }
    }
  }

  private forgetCompletedLayerClick(
    source: PendingLayerClick['source'],
    id: number | undefined,
  ): void {
    const key = completedLayerClickKey(source, id);
    if (
      this.compatibilityLayerClick
      && completedLayerClickKey(
        this.compatibilityLayerClick.source,
        this.compatibilityLayerClick.id,
      ) === key
    ) {
      this.compatibilityLayerClick = undefined;
    }
    this.pendingLayerClicks.delete(key);
  }

  private matchingCompletedLayerClick(event: MouseEvent): PendingLayerClick | undefined {
    if (
      this.compatibilityLayerClick
      && completedLayerClickMatchesMouseEvent(this.compatibilityLayerClick, event)
    ) {
      return this.compatibilityLayerClick;
    }
    this.compatibilityLayerClick = undefined;
    let matchingEntry: [string, PendingLayerClick] | undefined;
    for (const entry of this.pendingLayerClicks) {
      const [key, pendingClick] = entry;
      if (event.timeStamp - pendingClick.completedAt > COMPATIBILITY_MOUSE_WINDOW_MS) {
        this.pendingLayerClicks.delete(key);
      } else if (
        completedLayerClickMatchesMouseEvent(pendingClick, event)
        && (!matchingEntry || pendingClick.completedAt >= matchingEntry[1].completedAt)
      ) {
        matchingEntry = entry;
      }
    }
    if (!matchingEntry) {
      return undefined;
    }
    const [matchingKey, matchingClick] = matchingEntry;
    this.pendingLayerClicks.delete(matchingKey);
    this.compatibilityLayerClick = matchingClick;
    return matchingClick;
  }

  private handleCompatibilityMouseEvent(event: MouseEvent): boolean {
    const compatibilityClick = this.matchingCompletedLayerClick(event);
    if (compatibilityClick) {
      if (compatibilityClick.contained) {
        event.stopPropagation();
      }
      return true;
    }
    if (!this.hasActivePointerOrTouchGesture()) {
      this.clearCompletedLayerClicks();
      return false;
    }
    if (this.hasRoutedPointerOrTouchGesture()) {
      event.stopPropagation();
    }
    return true;
  }

  private clearCompletedLayerClicks(): void {
    this.pendingLayerClicks.clear();
    this.compatibilityLayerClick = undefined;
  }

  private hasActivePointerOrTouchGesture(): boolean {
    return this.layerPointerGestures.size > 0
      || this.layerTouchGestures.size > 0;
  }

  private hasRoutedPointerOrTouchGesture(): boolean {
    return [...this.layerPointerGestures.values()].some((gesture) => gesture.contained)
      || [...this.layerTouchGestures.values()].some((gesture) => gesture.contained);
  }

  private releaseMatchesOrigin(
    gesture: TransportGesture,
    clientX: number,
    clientY: number,
  ): boolean {
    return gesture.origin !== undefined
      && sameTransportTarget(
        gesture.origin,
        this.transportHitAt(clientX, clientY),
      );
  }

  private isActiveTransportOrigin(origin: TransportHit): boolean {
    const active = this.activePlayers.get(origin.ownerObjectId);
    return active?.generation === origin.ownerGeneration
      && (
        origin.target === active.controls.element
        || active.controls.element.contains(origin.target)
      )
      && (!origin.button || !origin.button.disabled);
  }

  private beginNativePointerContact(
    pointerId: number,
    ownerObjectId: string,
    ownerGeneration: number,
  ): void {
    if (this.disposed) {
      return;
    }
    const active = this.activePlayers.get(ownerObjectId);
    if (active?.generation !== ownerGeneration) {
      return;
    }
    this.nativePointerContacts.set(pointerId, {
      ownerObjectId,
      ownerGeneration,
      controls: active.controls.element,
      orphaned: false,
    });
    this.syncNativePointerWindowBridge();
  }

  private endNativePointerContact(
    pointerId: number,
    ownerObjectId: string,
    ownerGeneration: number,
  ): void {
    const contact = this.nativePointerContacts.get(pointerId);
    if (
      contact?.ownerObjectId === ownerObjectId
      && contact.ownerGeneration === ownerGeneration
    ) {
      this.forgetNativePointerContact(pointerId);
    }
  }

  private abandonNativePointerContact(
    pointerId: number,
    ownerObjectId: string,
    ownerGeneration: number,
  ): void {
    if (this.disposed) {
      return;
    }
    const contact = this.nativePointerContacts.get(pointerId);
    if (
      contact?.ownerObjectId === ownerObjectId
      && contact.ownerGeneration === ownerGeneration
    ) {
      contact.orphaned = true;
      this.syncNativePointerWindowBridge();
    }
  }

  private forgetNativePointerContact(pointerId: number): void {
    if (!this.nativePointerContacts.delete(pointerId)) {
      return;
    }
    this.syncNativePointerWindowBridge();
  }

  private clearNativePointerContacts(): void {
    this.nativePointerContacts.clear();
    this.disconnectNativePointerWindowBridge();
  }

  private syncNativePointerWindowBridge(): void {
    const hasOrphan = [...this.nativePointerContacts.values()]
      .some((contact) => contact.orphaned);
    if (hasOrphan) {
      this.connectNativePointerWindowBridge();
    } else {
      this.disconnectNativePointerWindowBridge();
    }
  }

  private connectNativePointerWindowBridge(): void {
    if (
      this.nativePointerWindowBridgeConnected
      || !this.inputWindow
    ) {
      return;
    }
    this.inputWindow.addEventListener(
      'pointerdown',
      this.onNativePointerStartCapture,
      true,
    );
    this.inputWindow.addEventListener(
      'pointerup',
      this.onNativePointerCompletionCapture,
      true,
    );
    this.inputWindow.addEventListener(
      'pointercancel',
      this.onNativePointerCompletionCapture,
      true,
    );
    this.nativePointerWindowBridgeConnected = true;
  }

  private disconnectNativePointerWindowBridge(): void {
    if (
      !this.nativePointerWindowBridgeConnected
      || !this.inputWindow
    ) {
      return;
    }
    this.inputWindow.removeEventListener(
      'pointerdown',
      this.onNativePointerStartCapture,
      true,
    );
    this.inputWindow.removeEventListener(
      'pointerup',
      this.onNativePointerCompletionCapture,
      true,
    );
    this.inputWindow.removeEventListener(
      'pointercancel',
      this.onNativePointerCompletionCapture,
      true,
    );
    this.nativePointerWindowBridgeConnected = false;
  }

  private refreshTransportHitGeometry(camera: Camera): void {
    const viewportRect = this.renderer.domElement.getBoundingClientRect();
    if (viewportRect.width <= 0 || viewportRect.height <= 0) {
      this.clearTransportHitGeometry();
      return;
    }
    const snapshot = createTransportProjectionSnapshot(camera, {
      left: viewportRect.left,
      top: viewportRect.top,
      width: viewportRect.width,
      height: viewportRect.height,
    });
    this.transportProjectionSnapshot = snapshot;
    for (const active of this.activePlayers.values()) {
      if (active.controls.element.hidden) {
        active.transportRegion = undefined;
        continue;
      }
      const layout = measureTransportLayout(active.controls.element);
      active.transportRegion = layout
        ? projectTransportRegion({
            key: active.generation,
            matrixWorld: active.controlsCssObject.matrixWorld,
            snapshot,
            layout,
            paintOrder: active.stackOrder,
            cssPixelsPerWorldUnit: YOUTUBE_CSS_PIXELS_PER_WORLD_UNIT,
          })
        : undefined;
    }
  }

  private clearTransportHitGeometry(): void {
    this.transportProjectionSnapshot = undefined;
    for (const active of this.activePlayers.values()) {
      active.transportRegion = undefined;
    }
  }

  private transportHitAt(clientX: number, clientY: number): TransportHit | undefined {
    if (this.transportHitTest) {
      return this.transportHitTest(
        { x: clientX, y: clientY },
        [...this.activePlayers.values()]
          .filter((active) => !active.controls.element.hidden)
          .map((active) => ({
            ownerObjectId: active.surface.objectId,
            ownerGeneration: active.generation,
            controls: active.controls.element,
            stackOrder: active.stackOrder,
          })),
      );
    }
    const snapshot = this.transportProjectionSnapshot;
    if (!snapshot) {
      return undefined;
    }
    const playersByGeneration = new Map<number, ActivePlayer>();
    const regions: Array<ProjectedTransportRegion<number, HTMLButtonElement>> = [];
    for (const active of this.activePlayers.values()) {
      if (active.transportRegion && !active.controls.element.hidden) {
        playersByGeneration.set(active.generation, active);
        regions.push(active.transportRegion);
      }
    }
    const region = selectProjectedTransportRegion(
      { x: clientX, y: clientY },
      regions,
      snapshot,
    );
    if (!region) {
      return undefined;
    }
    const active = playersByGeneration.get(region.key);
    if (!active) {
      return undefined;
    }
    for (const projectedButton of [...region.buttons].reverse()) {
      if (
        !projectedButton.button.disabled
        && pointInProjectedQuad(
          { x: clientX, y: clientY },
          projectedButton.quad,
        )
      ) {
        return {
          ownerObjectId: active.surface.objectId,
          ownerGeneration: active.generation,
          target: projectedButton.button,
          button: projectedButton.button,
        };
      }
    }
    return {
      ownerObjectId: active.surface.objectId,
      ownerGeneration: active.generation,
      target: active.controls.element,
    };
  }

  private deactivate(objectId: string, showThumbnail: boolean): void {
    const active = this.activePlayers.get(objectId);
    if (!active) {
      return;
    }
    this.purgeTransportOwner(active.generation);
    active.player.pauseVideo();
    active.player.destroy();
    this.disposeActivationShell(active);
    active.surface.mesh.visible = showThumbnail && active.surface.markerVisible;
    this.activePlayers.delete(objectId);
  }

  private purgeTransportOwner(ownerGeneration: number): void {
    const purgeGesture = (gesture: TransportGesture): void => {
      if (gesture.origin?.ownerGeneration === ownerGeneration) {
        gesture.origin = undefined;
      }
    };
    for (const gesture of this.layerPointerGestures.values()) {
      purgeGesture(gesture);
    }
    for (const gesture of this.layerTouchGestures.values()) {
      purgeGesture(gesture);
    }
    if (this.routedMouse) {
      purgeGesture(this.routedMouse);
    }
    for (const pendingClick of this.pendingLayerClicks.values()) {
      if (pendingClick.origin?.ownerGeneration === ownerGeneration) {
        pendingClick.origin = undefined;
        pendingClick.releasedOnOrigin = false;
      }
    }
    if (
      this.compatibilityLayerClick?.origin?.ownerGeneration
      === ownerGeneration
    ) {
      this.compatibilityLayerClick.origin = undefined;
      this.compatibilityLayerClick.releasedOnOrigin = false;
    }
  }

  private invalidatePendingActivation(objectId: string): void {
    const pending = this.pendingActivations.get(objectId);
    if (!pending) {
      return;
    }
    this.pendingActivations.delete(objectId);
    this.disposeActivationShell(pending);
  }

  private disposeActivationShell(activation: PlayerActivationShell): void {
    if (activation.disposed) {
      return;
    }
    activation.disposed = true;
    activation.controls.dispose();
    activation.cssObject.remove(activation.controlsCssObject);
    this.scene.remove(activation.cssObject);
    activation.controlsFrame.remove();
    activation.wrapper.remove();
  }
}

function raycastYouTubeSurface(
  pointer: { x: number; y: number },
  camera: Camera,
  surfaces: RegisteredSurface[],
): RegisteredSurface | undefined {
  if (surfaces.length === 0) {
    return undefined;
  }
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(pointer.x, pointer.y), camera);
  const intersections = raycaster.intersectObjects(
    surfaces.map((surface) => surface.mesh),
    false,
  );
  const hit = intersections[0]?.object;
  return surfaces.find((surface) => surface.mesh === hit);
}

function isNativeTransportTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && target.closest('.youtube-transport-controls') !== null;
}

function completedLayerClickKey(
  source: PendingLayerClick['source'],
  id: number | undefined,
): string {
  return `${source}:${id ?? 'fallback'}`;
}

function completedLayerClickMatchesMouseEvent(
  pendingClick: PendingLayerClick,
  event: MouseEvent,
): boolean {
  const elapsed = event.timeStamp - pendingClick.completedAt;
  if (elapsed < 0 || elapsed > COMPATIBILITY_MOUSE_WINDOW_MS) {
    return false;
  }
  if (
    'pointerId' in event
    && typeof event.pointerId === 'number'
    && (
      pendingClick.source !== 'pointer'
      || event.pointerId !== pendingClick.id
    )
  ) {
    return false;
  }
  return Math.abs(event.clientX - pendingClick.clientX)
      <= COMPATIBILITY_MOUSE_COORDINATE_TOLERANCE_PX
    && Math.abs(event.clientY - pendingClick.clientY)
      <= COMPATIBILITY_MOUSE_COORDINATE_TOLERANCE_PX;
}

function areDuplicatePointerTouchCompletions(
  first: PendingLayerClick,
  second: PendingLayerClick,
): boolean {
  const pointerCompletion = first.source === 'pointer'
    ? first
    : second.source === 'pointer'
      ? second
      : undefined;
  return (
    (first.source === 'pointer' && second.source === 'touch')
    || (first.source === 'touch' && second.source === 'pointer')
  )
    && pointerCompletion?.pointerType === 'touch'
    && Math.abs(first.completedAt - second.completedAt)
      <= DUPLICATE_POINTER_TOUCH_COMPLETION_WINDOW_MS
    && Math.abs(first.clientX - second.clientX)
      <= COMPATIBILITY_MOUSE_COORDINATE_TOLERANCE_PX
    && Math.abs(first.clientY - second.clientY)
      <= COMPATIBILITY_MOUSE_COORDINATE_TOLERANCE_PX;
}

function createTransportGesture(
  origin: TransportHit | undefined,
): TransportGesture {
  return {
    contained: origin !== undefined,
    origin,
  };
}

function sameTransportTarget(
  first: TransportHit,
  second: TransportHit | undefined,
): boolean {
  return second !== undefined
    && first.ownerGeneration === second.ownerGeneration
    && first.target === second.target;
}

function measureTransportLayout(
  controls: HTMLElement,
) {
  const widthPx = controls.offsetWidth;
  const heightPx = controls.offsetHeight;
  if (widthPx <= 0 || heightPx <= 0) {
    return undefined;
  }
  return {
    widthPx,
    heightPx,
    buttons: [
      ...controls.querySelectorAll<HTMLButtonElement>('button'),
    ].map((button) => ({
      button,
      leftPx: button.offsetLeft,
      topPx: button.offsetTop,
      widthPx: button.offsetWidth,
      heightPx: button.offsetHeight,
    })),
  };
}

function forEachTouch(
  touches: TouchList,
  callback: (touch: Touch) => void,
): void {
  for (let index = 0; index < touches.length; index += 1) {
    callback(touches[index]);
  }
}

function touchListContainsRoutedTouch(
  touches: TouchList,
  touchGestures: Map<number, TransportGesture>,
): boolean {
  for (let index = 0; index < touches.length; index += 1) {
    if (touchGestures.get(touches[index].identifier)?.contained) {
      return true;
    }
  }
  return false;
}

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady(event: { target: YouTubePlayerPort }): void;
        onStateChange(event: { data: number }): void;
        onError(event: { data: number }): void;
      };
    },
  ) => YouTubePlayerPort;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | undefined;

async function createYouTubePlayer(
  element: HTMLElement,
  youtube: TargetYouTubeContent,
  onStateChange: YouTubePlayerStateHandler,
): Promise<YouTubePlayerPort> {
  const api = await loadYouTubeApi();
  return new Promise<YouTubePlayerPort>((resolve, reject) => {
    new api.Player(element, {
      videoId: youtube.videoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        playsinline: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (event) => resolve(event.target),
        onStateChange: (event) => onStateChange(event.data),
        onError: (event) => reject(new Error(youtubeErrorMessage(event.data))),
      },
    });
  });
}

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  youtubeApiPromise ??= new Promise<YouTubeApi>((resolve, reject) => {
    const existingReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      existingReady?.();
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        reject(new Error('YouTube player API did not initialize.'));
      }
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-youtube-iframe-api]');
    if (existing) {
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.dataset.youtubeIframeApi = '';
    script.addEventListener('error', () => reject(new Error('YouTube player API could not be loaded.')), {
      once: true,
    });
    document.head.append(script);
  });
  return youtubeApiPromise;
}

function youtubeErrorMessage(code: number): string {
  if (code === 100) {
    return 'This YouTube video is unavailable.';
  }
  if (code === 101 || code === 150) {
    return 'This YouTube video does not allow embedded playback.';
  }
  return 'YouTube playback could not start.';
}

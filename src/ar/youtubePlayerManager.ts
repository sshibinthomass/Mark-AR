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

export type YouTubePlayerPort = YouTubeTransportPlayer & {
  destroy(): void;
};

export type YouTubeActivationResult = 'activated' | 'missed' | 'failed';

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

type ActivePlayer = {
  surface: RegisteredSurface;
  player: YouTubePlayerPort;
  cssObject: CssObjectPort;
  controlsCssObject: CssObjectPort;
  wrapper: HTMLElement;
  controlsFrame: HTMLElement;
  controls: YouTubeTransportControls;
  stackOrder: number;
};

type TransportHit = {
  button?: HTMLButtonElement;
};

type PendingLayerClick = {
  source: 'pointer' | 'mouse' | 'touch';
  routed: boolean;
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
  onPlaybackError?: (message: string) => void;
  scene?: Scene;
};

export class YouTubePlayerManager {
  private readonly container: HTMLElement;
  private readonly renderer: CssRendererPort;
  private readonly scene: Scene;
  private readonly createCssObject: (element: HTMLElement) => CssObjectPort;
  private readonly createPlayer: (
    element: HTMLElement,
    youtube: TargetYouTubeContent,
    onStateChange: YouTubePlayerStateHandler,
  ) => Promise<YouTubePlayerPort>;
  private readonly hitTest: NonNullable<YouTubePlayerManagerDeps['hitTest']>;
  private readonly onPlaybackError?: (message: string) => void;
  private readonly surfaces: RegisteredSurface[] = [];
  private readonly activePlayers = new Map<string, ActivePlayer>();
  // Chrome can hit the renderer layer while omitting deeply scaled CSS3D descendants.
  private readonly layerPointerGestures = new Map<number, boolean>();
  private readonly layerTouchGestures = new Map<number, boolean>();
  private readonly pendingLayerClicks = new Map<string, PendingLayerClick>();
  private compatibilityLayerClick: PendingLayerClick | undefined;
  private routedMouse: boolean | undefined;
  private nextPlayerStackOrder = 0;
  private disposed = false;

  constructor(
    container: HTMLElement,
    deps: YouTubePlayerManagerDeps = {},
  ) {
    this.container = container;
    this.renderer = deps.createCssRenderer?.() ?? new CSS3DRenderer();
    this.scene = deps.scene ?? new Scene();
    this.createCssObject = deps.createCssObject ?? ((element) => new CSS3DObject(element));
    this.createPlayer = deps.createPlayer ?? createYouTubePlayer;
    this.hitTest = deps.hitTest ?? raycastYouTubeSurface;
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
        this.deactivate(surface.objectId, false);
        surface.mesh.visible = false;
      } else if (!this.activePlayers.has(surface.objectId)) {
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
    const controls = createYouTubeTransportControls();
    const controlsFrame = document.createElement('div');
    controlsFrame.className = 'youtube-css3d-controls-frame';
    controlsFrame.append(controls.element);
    wrapper.append(host);
    this.renderer.domElement.append(wrapper, controlsFrame);
    const cssObject = this.createCssObject(wrapper);
    const controlsCssObject = this.createCssObject(controlsFrame);
    const stackOrder = this.nextPlayerStackOrder;
    this.nextPlayerStackOrder += 1;
    controlsCssObject.position.y = YOUTUBE_TRANSPORT_Y_OFFSET_PX;
    controlsCssObject.scale.setScalar(YOUTUBE_CSS_PIXELS_PER_WORLD_UNIT);
    cssObject.add(controlsCssObject);
    this.scene.add(cssObject);
    surface.mesh.visible = false;

    try {
      const player = await this.createPlayer(host, surface.youtube, (state) => {
        const active = this.activePlayers.get(surface.objectId);
        if (active?.controls === controls) {
          controls.setPlayerState(state);
        }
      });
      if (this.disposed || !surface.markerVisible) {
        player.pauseVideo();
        player.destroy();
        controls.dispose();
        cssObject.remove(controlsCssObject);
        this.scene.remove(cssObject);
        controlsFrame.remove();
        wrapper.remove();
        return 'missed';
      }
      this.activePlayers.set(surface.objectId, {
        surface,
        player,
        cssObject,
        controlsCssObject,
        wrapper,
        controlsFrame,
        controls,
        stackOrder,
      });
      controls.bindPlayer(player);
      player.playVideo();
      delete this.container.dataset.youtubeError;
      return 'activated';
    } catch (error) {
      controls.dispose();
      cssObject.remove(controlsCssObject);
      this.scene.remove(cssObject);
      controlsFrame.remove();
      wrapper.remove();
      if (this.disposed || !surface.markerVisible) {
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
    this.renderer.render(this.scene, camera);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(Math.max(1, width), Math.max(1, height));
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disconnectTransportInputRouter();
    for (const objectId of [...this.activePlayers.keys()]) {
      this.deactivate(objectId, false);
    }
    this.disposed = true;
    this.surfaces.length = 0;
    this.renderer.domElement.remove();
    delete this.container.dataset.youtubeError;
  }

  private connectTransportInputRouter(): void {
    const layer = this.renderer.domElement;
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
    const routed = this.transportHitAt(event.clientX, event.clientY) !== undefined;
    this.layerPointerGestures.set(event.pointerId, routed);
    if (!routed) {
      return;
    }
    event.stopPropagation();
  };

  private readonly onLayerPointerMove = (event: PointerEvent): void => {
    if (this.layerPointerGestures.get(event.pointerId) === true) {
      event.stopPropagation();
    }
  };

  private readonly onLayerPointerUp = (event: PointerEvent): void => {
    if (!this.layerPointerGestures.has(event.pointerId)) {
      return;
    }
    const routed = this.layerPointerGestures.get(event.pointerId) === true;
    this.layerPointerGestures.delete(event.pointerId);
    this.rememberCompletedLayerClick({
      source: 'pointer',
      id: event.pointerId,
      pointerType: event.pointerType,
      routed,
      clientX: event.clientX,
      clientY: event.clientY,
      completedAt: event.timeStamp,
    });
    if (routed) {
      event.stopPropagation();
    }
  };

  private readonly onLayerPointerCancel = (event: PointerEvent): void => {
    if (!this.layerPointerGestures.has(event.pointerId)) {
      return;
    }
    const routed = this.layerPointerGestures.get(event.pointerId) === true;
    this.layerPointerGestures.delete(event.pointerId);
    this.forgetCompletedLayerClick('pointer', event.pointerId);
    if (routed) {
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
    const routed = this.transportHitAt(event.clientX, event.clientY) !== undefined;
    this.routedMouse = routed;
    if (routed) {
      event.stopPropagation();
    }
  };

  private readonly onLayerMouseMove = (event: MouseEvent): void => {
    if (this.routedMouse !== undefined) {
      if (this.routedMouse) {
        event.stopPropagation();
      }
      return;
    }
    this.handleCompatibilityMouseEvent(event);
  };

  private readonly onLayerMouseUp = (event: MouseEvent): void => {
    if (this.routedMouse !== undefined) {
      const routed = this.routedMouse;
      this.routedMouse = undefined;
      this.rememberCompletedLayerClick({
        source: 'mouse',
        routed,
        clientX: event.clientX,
        clientY: event.clientY,
        completedAt: event.timeStamp,
      });
      if (routed) {
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
    let routed = false;
    forEachTouch(event.changedTouches, (touch) => {
      const touchRouted = this.transportHitAt(touch.clientX, touch.clientY) !== undefined;
      this.layerTouchGestures.set(touch.identifier, touchRouted);
      if (touchRouted) {
        routed = true;
      }
    });
    if (routed) {
      event.stopPropagation();
    }
  };

  private readonly onLayerTouchMove = (event: TouchEvent): void => {
    if (touchListContainsRoutedTouch(event.changedTouches, this.layerTouchGestures)) {
      event.stopPropagation();
    }
  };

  private readonly onLayerTouchEnd = (event: TouchEvent): void => {
    let routed = false;
    forEachTouch(event.changedTouches, (touch) => {
      if (!this.layerTouchGestures.has(touch.identifier)) {
        return;
      }
      const touchRouted = this.layerTouchGestures.get(touch.identifier) === true;
      this.layerTouchGestures.delete(touch.identifier);
      this.rememberCompletedLayerClick({
        source: 'touch',
        id: touch.identifier,
        routed: touchRouted,
        clientX: touch.clientX,
        clientY: touch.clientY,
        completedAt: event.timeStamp,
      });
      if (touchRouted) {
        routed = true;
      }
    });
    if (routed) {
      event.stopPropagation();
    }
  };

  private readonly onLayerTouchCancel = (event: TouchEvent): void => {
    let routed = false;
    forEachTouch(event.changedTouches, (touch) => {
      if (!this.layerTouchGestures.has(touch.identifier)) {
        return;
      }
      const touchRouted = this.layerTouchGestures.get(touch.identifier) === true;
      this.layerTouchGestures.delete(touch.identifier);
      this.forgetCompletedLayerClick('touch', touch.identifier);
      if (touchRouted) {
        routed = true;
      }
    });
    if (routed) {
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
    if (!pendingClick?.routed) {
      return;
    }
    const hit = this.transportHitAt(event.clientX, event.clientY);
    event.stopPropagation();
    if (!hit?.button) {
      return;
    }
    hit.button.focus({ preventScroll: true });
    hit.button.click();
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
      if (compatibilityClick.routed) {
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
    return [...this.layerPointerGestures.values()].some(Boolean)
      || [...this.layerTouchGestures.values()].some(Boolean);
  }

  private transportHitAt(clientX: number, clientY: number): TransportHit | undefined {
    const players = [...this.activePlayers.values()]
      .sort((first, second) => second.stackOrder - first.stackOrder);
    for (const active of players) {
      if (active.controls.element.hidden) {
        continue;
      }
      const buttons = [
        ...active.controls.element.querySelectorAll<HTMLButtonElement>('button'),
      ].reverse();
      for (const button of buttons) {
        if (!button.disabled && rectContainsPoint(button.getBoundingClientRect(), clientX, clientY)) {
          return { button };
        }
      }
      if (rectContainsPoint(
        active.controls.element.getBoundingClientRect(),
        clientX,
        clientY,
      )) {
        return {};
      }
    }
    return undefined;
  }

  private deactivate(objectId: string, showThumbnail: boolean): void {
    const active = this.activePlayers.get(objectId);
    if (!active) {
      return;
    }
    active.player.pauseVideo();
    active.player.destroy();
    active.controls.dispose();
    active.cssObject.remove(active.controlsCssObject);
    this.scene.remove(active.cssObject);
    active.controlsFrame.remove();
    active.wrapper.remove();
    active.surface.mesh.visible = showThumbnail && active.surface.markerVisible;
    this.activePlayers.delete(objectId);
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

function rectContainsPoint(
  rect: DOMRect,
  clientX: number,
  clientY: number,
): boolean {
  return rect.width > 0
    && rect.height > 0
    && clientX >= rect.left
    && clientX <= rect.right
    && clientY >= rect.top
    && clientY <= rect.bottom;
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
  touchGestures: Map<number, boolean>,
): boolean {
  for (let index = 0; index < touches.length; index += 1) {
    if (touchGestures.get(touches[index].identifier) === true) {
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

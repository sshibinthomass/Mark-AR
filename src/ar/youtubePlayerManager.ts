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
};

type TransportHit = {
  button?: HTMLButtonElement;
};

type LayerClickGesture = {
  source: 'pointer' | 'mouse' | 'touch';
  routed: boolean;
  completed: boolean;
};

const YOUTUBE_PLAYER_WIDTH_PX = 480;
const YOUTUBE_PLAYER_HEIGHT_PX = 270;
const YOUTUBE_CSS_PIXELS_PER_WORLD_UNIT = YOUTUBE_PLAYER_HEIGHT_PX;
const YOUTUBE_TRANSPORT_GAP_PX = 14;
const YOUTUBE_TRANSPORT_HEIGHT_PX = 60;
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
  private readonly routedPointerIds = new Set<number>();
  private readonly routedTouchIds = new Set<number>();
  private layerClickGesture: LayerClickGesture | undefined;
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
    this.routedPointerIds.clear();
    this.routedTouchIds.clear();
    this.layerClickGesture = undefined;
  }

  private readonly onLayerPointerDown = (event: PointerEvent): void => {
    if (isNativeTransportTarget(event.target)) {
      return;
    }
    const routed = this.transportHitAt(event.clientX, event.clientY) !== undefined;
    this.layerClickGesture = { source: 'pointer', routed, completed: false };
    if (!routed) {
      return;
    }
    this.routedPointerIds.add(event.pointerId);
    event.stopPropagation();
  };

  private readonly onLayerPointerMove = (event: PointerEvent): void => {
    if (!this.routedPointerIds.has(event.pointerId)) {
      return;
    }
    event.stopPropagation();
  };

  private readonly onLayerPointerUp = (event: PointerEvent): void => {
    if (this.layerClickGesture?.source === 'pointer') {
      this.layerClickGesture.completed = true;
    }
    if (!this.routedPointerIds.delete(event.pointerId)) {
      return;
    }
    event.stopPropagation();
  };

  private readonly onLayerPointerCancel = (event: PointerEvent): void => {
    if (this.layerClickGesture?.source === 'pointer') {
      this.layerClickGesture.routed = false;
      this.layerClickGesture.completed = true;
    }
    if (!this.routedPointerIds.delete(event.pointerId)) {
      return;
    }
    event.stopPropagation();
  };

  private readonly onLayerMouseDown = (event: MouseEvent): void => {
    if (
      this.layerClickGesture?.source === 'pointer'
      || this.layerClickGesture?.source === 'touch'
    ) {
      if (this.layerClickGesture.routed) {
        event.stopPropagation();
      }
      return;
    }
    if (isNativeTransportTarget(event.target)) {
      return;
    }
    const routed = this.transportHitAt(event.clientX, event.clientY) !== undefined;
    this.layerClickGesture = { source: 'mouse', routed, completed: false };
    if (routed) {
      event.stopPropagation();
    }
  };

  private readonly onLayerMouseMove = (event: MouseEvent): void => {
    if (this.layerClickGesture?.routed) {
      event.stopPropagation();
    }
  };

  private readonly onLayerMouseUp = (event: MouseEvent): void => {
    if (!this.layerClickGesture) {
      return;
    }
    if (this.layerClickGesture.source === 'mouse') {
      this.layerClickGesture.completed = true;
    }
    if (this.layerClickGesture.routed) {
      event.stopPropagation();
    }
  };

  private readonly onLayerTouchStart = (event: TouchEvent): void => {
    if (isNativeTransportTarget(event.target)) {
      return;
    }
    let routed = false;
    forEachTouch(event.changedTouches, (touch) => {
      if (!this.transportHitAt(touch.clientX, touch.clientY)) {
        return;
      }
      this.routedTouchIds.add(touch.identifier);
      routed = true;
    });
    this.layerClickGesture = { source: 'touch', routed, completed: false };
    if (routed) {
      event.stopPropagation();
    }
  };

  private readonly onLayerTouchMove = (event: TouchEvent): void => {
    if (touchListContainsTrackedTouch(event.changedTouches, this.routedTouchIds)) {
      event.stopPropagation();
    }
  };

  private readonly onLayerTouchEnd = (event: TouchEvent): void => {
    if (this.layerClickGesture?.source === 'touch') {
      this.layerClickGesture.completed = true;
    }
    let routed = false;
    forEachTouch(event.changedTouches, (touch) => {
      if (this.routedTouchIds.delete(touch.identifier)) {
        routed = true;
      }
    });
    if (routed) {
      event.stopPropagation();
    }
  };

  private readonly onLayerTouchCancel = (event: TouchEvent): void => {
    if (this.layerClickGesture?.source === 'touch') {
      this.layerClickGesture.routed = false;
      this.layerClickGesture.completed = true;
    }
    let routed = false;
    forEachTouch(event.changedTouches, (touch) => {
      if (this.routedTouchIds.delete(touch.identifier)) {
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
    const gesture = this.layerClickGesture;
    this.layerClickGesture = undefined;
    if (!gesture?.routed || !gesture.completed) {
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

  private transportHitAt(clientX: number, clientY: number): TransportHit | undefined {
    const players = [...this.activePlayers.values()].reverse();
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

function touchListContainsTrackedTouch(
  touches: TouchList,
  trackedTouchIds: Set<number>,
): boolean {
  for (let index = 0; index < touches.length; index += 1) {
    if (trackedTouchIds.has(touches[index].identifier)) {
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

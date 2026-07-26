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

export type YouTubePlayerPort = {
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
};

export type YouTubeActivationResult = 'activated' | 'missed' | 'failed';

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
  wrapper: HTMLElement;
};

type YouTubePlayerManagerDeps = {
  createCssRenderer?: () => CssRendererPort;
  createCssObject?: (element: HTMLElement) => CssObjectPort;
  createPlayer?: (
    element: HTMLElement,
    youtube: TargetYouTubeContent,
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
  ) => Promise<YouTubePlayerPort>;
  private readonly hitTest: NonNullable<YouTubePlayerManagerDeps['hitTest']>;
  private readonly onPlaybackError?: (message: string) => void;
  private readonly surfaces: RegisteredSurface[] = [];
  private readonly activePlayers = new Map<string, ActivePlayer>();
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
      pointerEvents: 'none',
    });
    this.container.append(this.renderer.domElement);
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
      width: '480px',
      height: '270px',
      pointerEvents: 'auto',
      background: '#000',
    });
    const host = document.createElement('div');
    host.style.width = '100%';
    host.style.height = '100%';
    wrapper.append(host);
    this.renderer.domElement.append(wrapper);
    const cssObject = this.createCssObject(wrapper);
    this.scene.add(cssObject);
    surface.mesh.visible = false;

    try {
      const player = await this.createPlayer(host, surface.youtube);
      if (this.disposed || !surface.markerVisible) {
        player.pauseVideo();
        player.destroy();
        this.scene.remove(cssObject);
        wrapper.remove();
        return 'missed';
      }
      this.activePlayers.set(surface.objectId, {
        surface,
        player,
        cssObject,
        wrapper,
      });
      player.playVideo();
      delete this.container.dataset.youtubeError;
      return 'activated';
    } catch (error) {
      this.scene.remove(cssObject);
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
      active.cssObject.scale.multiplyScalar(1 / 270);
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
    for (const objectId of [...this.activePlayers.keys()]) {
      this.deactivate(objectId, false);
    }
    this.disposed = true;
    this.surfaces.length = 0;
    this.renderer.domElement.remove();
    delete this.container.dataset.youtubeError;
  }

  private deactivate(objectId: string, showThumbnail: boolean): void {
    const active = this.activePlayers.get(objectId);
    if (!active) {
      return;
    }
    active.player.pauseVideo();
    active.player.destroy();
    this.scene.remove(active.cssObject);
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

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady(event: { target: YouTubePlayerPort }): void;
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

import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  YouTubePlayerManager,
  type YouTubePlayerPort,
} from '../src/ar/youtubePlayerManager';

describe('YouTubePlayerManager', () => {
  it('activates a visible hit inline and restores the thumbnail after target loss', async () => {
    const container = document.createElement('div');
    const surface = createSurface();
    const playerState = { played: 0, paused: 0, destroyed: 0 };
    const player: YouTubePlayerPort = {
      playVideo: () => { playerState.played += 1; },
      pauseVideo: () => { playerState.paused += 1; },
      seekTo() {},
      getCurrentTime() { return 0; },
      getDuration() { return 120; },
      destroy: () => { playerState.destroyed += 1; },
    };
    const cssScene = new Scene();
    const manager = new YouTubePlayerManager(container, {
      createCssRenderer: () => ({
        domElement: document.createElement('div'),
        setSize: vi.fn(),
        render: vi.fn(),
      }),
      createCssObject: (element) => {
        const object = new Group() as Group & { element: HTMLElement };
        object.element = element;
        return object;
      },
      createPlayer: async () => player,
      hitTest: (_pointer, _camera, surfaces) => surfaces[0],
      scene: cssScene,
    });
    manager.register('marker-1', surface);
    manager.setMarkerVisible('marker-1', true);

    expect(await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera())).toBe('activated');
    expect(playerState.played).toBe(1);
    expect(surface.mesh.visible).toBe(false);
    expect(container.querySelector('[data-youtube-player-object="video-1"]')).toBeTruthy();

    manager.setMarkerVisible('marker-1', false);

    expect(playerState.paused).toBe(1);
    expect(playerState.destroyed).toBe(1);
    expect(container.querySelector('[data-youtube-player-object="video-1"]')).toBeNull();
    expect(surface.mesh.visible).toBe(false);

    manager.setMarkerVisible('marker-1', true);
    expect(surface.mesh.visible).toBe(true);
    manager.dispose();
  });

  it('shows transport controls after readiness and syncs native player state', async () => {
    const container = document.createElement('div');
    const player = createPlayerDouble();
    let onStateChange: ((state: number) => void) | undefined;
    const manager = createManager({
      createPlayer: async (_host, _youtube, stateHandler) => {
        onStateChange = stateHandler;
        return player.port;
      },
      hitTest: (_pointer, _camera, surfaces) => surfaces[0],
    }, container);
    manager.register('marker-1', createSurface());
    manager.setMarkerVisible('marker-1', true);

    const activation = manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera());
    const controls = container.querySelector<HTMLElement>('.youtube-transport-controls');
    expect(controls).not.toBeNull();
    expect(controls?.hidden).toBe(true);

    expect(await activation).toBe('activated');
    expect(controls?.hidden).toBe(false);
    onStateChange?.(1);
    expect(controls?.querySelector('[data-youtube-action="toggle"]')?.textContent)
      .toBe('Pause');
    onStateChange?.(2);
    expect(controls?.querySelector('[data-youtube-action="toggle"]')?.textContent)
      .toBe('Play');
    manager.dispose();
  });

  it('removes the complete transport bar when the marker is lost', async () => {
    const container = document.createElement('div');
    const manager = createManager({
      createPlayer: async () => createPlayerDouble().port,
      hitTest: (_pointer, _camera, surfaces) => surfaces[0],
    }, container);
    manager.register('marker-1', createSurface());
    manager.setMarkerVisible('marker-1', true);
    await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera());

    manager.setMarkerVisible('marker-1', false);

    expect(container.querySelector('.youtube-transport-controls')).toBeNull();
    manager.dispose();
  });

  it('ignores hidden surfaces and duplicate activation', async () => {
    const surface = createSurface();
    let createdPlayers = 0;
    const manager = new YouTubePlayerManager(document.createElement('div'), {
      createCssRenderer: () => ({
        domElement: document.createElement('div'),
        setSize: vi.fn(),
        render: vi.fn(),
      }),
      createCssObject: (element) => {
        const object = new Group() as Group & { element: HTMLElement };
        object.element = element;
        return object;
      },
      createPlayer: async () => {
        createdPlayers += 1;
        return {
          playVideo() {},
          pauseVideo() {},
          seekTo() {},
          getCurrentTime() { return 0; },
          getDuration() { return 120; },
          destroy() {},
        };
      },
      hitTest: (_pointer, _camera, surfaces) => surfaces[0],
    });
    manager.register('marker-1', surface);

    expect(await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera())).toBe('missed');
    manager.setMarkerVisible('marker-1', true);
    expect(await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera())).toBe('activated');
    expect(await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera())).toBe('missed');
    expect(createdPlayers).toBe(1);
    manager.dispose();
  });

  it('returns to the thumbnail when player creation fails and disposes idempotently', async () => {
    const container = document.createElement('div');
    const surface = createSurface();
    const manager = new YouTubePlayerManager(container, {
      createCssRenderer: () => ({
        domElement: document.createElement('div'),
        setSize: vi.fn(),
        render: vi.fn(),
      }),
      createCssObject: (element) => {
        const object = new Group() as Group & { element: HTMLElement };
        object.element = element;
        return object;
      },
      createPlayer: async () => {
        throw new Error('Embedding disabled');
      },
      hitTest: (_pointer, _camera, surfaces) => surfaces[0],
    });
    manager.register('marker-1', surface);
    manager.setMarkerVisible('marker-1', true);

    expect(await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera())).toBe('failed');
    expect(surface.mesh.visible).toBe(true);
    expect(container.dataset.youtubeError).toBe('Embedding disabled');
    expect(container.querySelector('.youtube-transport-controls')).toBeNull();

    manager.dispose();
    manager.dispose();
    expect(container.children).toHaveLength(0);
  });

  it('distinguishes a miss from failed player creation and reports the failure', async () => {
    const errorMessages: string[] = [];
    const manager = createManager({
      hitTest: (_pointer, _camera, surfaces) => surfaces[0],
      createPlayer: async () => { throw new Error('Embedding disabled'); },
      onPlaybackError: (message) => errorMessages.push(message),
    });
    manager.register('marker-1', createSurface());
    manager.setMarkerVisible('marker-1', true);

    expect(await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera()))
      .toBe('failed');
    expect(errorMessages).toEqual(['Embedding disabled']);
  });

  it('returns missed when no visible YouTube plane is hit', async () => {
    const manager = createManager({
      hitTest: () => undefined,
    });
    manager.register('marker-1', createSurface());
    manager.setMarkerVisible('marker-1', true);

    expect(await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera()))
      .toBe('missed');
  });

  it('does not report a rejected player creation after disposal', async () => {
    const creation = createDeferred<YouTubePlayerPort>();
    const errors: string[] = [];
    const container = document.createElement('div');
    const surface = createSurface();
    const manager = createManager({
      createPlayer: () => creation.promise,
      hitTest: (_pointer, _camera, surfaces) => surfaces[0],
      onPlaybackError: (message) => errors.push(message),
    }, container);
    manager.register('marker-1', surface);
    manager.setMarkerVisible('marker-1', true);

    const activation = manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera());
    manager.dispose();
    creation.reject(new Error('Embedding disabled'));

    expect(await activation).toBe('missed');
    expect(errors).toEqual([]);
    expect(surface.mesh.visible).toBe(false);
    expect(container.children).toHaveLength(0);
  });

  it('does not report a rejected player creation after marker loss', async () => {
    const creation = createDeferred<YouTubePlayerPort>();
    const errors: string[] = [];
    const container = document.createElement('div');
    const surface = createSurface();
    const manager = createManager({
      createPlayer: () => creation.promise,
      hitTest: (_pointer, _camera, surfaces) => surfaces[0],
      onPlaybackError: (message) => errors.push(message),
    }, container);
    manager.register('marker-1', surface);
    manager.setMarkerVisible('marker-1', true);

    const activation = manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera());
    manager.setMarkerVisible('marker-1', false);
    creation.reject(new Error('Embedding disabled'));

    expect(await activation).toBe('missed');
    expect(errors).toEqual([]);
    expect(surface.mesh.visible).toBe(false);
    expect(container.querySelector('[data-youtube-player-object="video-1"]')).toBeNull();
    manager.dispose();
  });
});

function createDeferred<T>() {
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  return { promise, reject };
}

function createPlayerDouble() {
  return {
    port: {
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      seekTo: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      getDuration: vi.fn(() => 120),
      destroy: vi.fn(),
    } satisfies YouTubePlayerPort,
  };
}

function createManager(
  overrides: ConstructorParameters<typeof YouTubePlayerManager>[1] = {},
  container = document.createElement('div'),
) {
  return new YouTubePlayerManager(container, {
    createCssRenderer: () => ({
      domElement: document.createElement('div'),
      setSize: vi.fn(),
      render: vi.fn(),
    }),
    createCssObject: (element) => {
      const object = new Group() as Group & { element: HTMLElement };
      object.element = element;
      return object;
    },
    createPlayer: async () => ({
      playVideo() {},
      pauseVideo() {},
      seekTo() {},
      getCurrentTime() { return 0; },
      getDuration() { return 120; },
      destroy() {},
    }),
    ...overrides,
  });
}

function createSurface() {
  const root = new Group();
  const mesh = new Mesh(new PlaneGeometry(16 / 9, 1), new MeshBasicMaterial());
  root.add(mesh);
  return {
    objectId: 'video-1',
    root,
    mesh,
    youtube: {
      videoId: 'M7lc1UVf-VE',
      url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      thumbnailUrl: 'https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg',
    },
  };
}

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
        return { playVideo() {}, pauseVideo() {}, destroy() {} };
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
});

function createManager(
  overrides: ConstructorParameters<typeof YouTubePlayerManager>[1] = {},
) {
  return new YouTubePlayerManager(document.createElement('div'), {
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

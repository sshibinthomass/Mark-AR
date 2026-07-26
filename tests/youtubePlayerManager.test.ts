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
  it('keeps the CSS3D renderer layer pointer-interactive for player controls', () => {
    const container = document.createElement('div');
    const rendererElement = document.createElement('div');
    const viewElement = rendererElement.appendChild(document.createElement('div'));
    viewElement.style.pointerEvents = 'none';
    const manager = new YouTubePlayerManager(container, {
      createCssRenderer: () => ({
        domElement: rendererElement,
        setSize: vi.fn(),
        render: vi.fn(),
      }),
    });

    expect(rendererElement.style.pointerEvents).toBe('auto');
    expect(viewElement.style.pointerEvents).toBe('none');

    manager.dispose();
  });

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

  it('counter-scales a separate controls frame above the video object', async () => {
    const container = document.createElement('div');
    const cssObjects: Array<Group & { element: HTMLElement }> = [];
    const manager = createManager({
      createCssObject: (element) => {
        const object = new Group() as Group & { element: HTMLElement };
        object.element = element;
        cssObjects.push(object);
        return object;
      },
      createPlayer: async () => createPlayerDouble().port,
      hitTest: (_pointer, _camera, surfaces) => surfaces[0],
    }, container);
    manager.register('marker-1', createSurface());
    manager.setMarkerVisible('marker-1', true);

    expect(await manager.activateFromPointer(
      { x: 0, y: 0 },
      new PerspectiveCamera(),
    )).toBe('activated');

    expect(cssObjects).toHaveLength(2);
    const videoObject = cssObjects.find((object) => (
      object.element.classList.contains('youtube-css3d-player')
    ));
    const controlsObject = cssObjects.find((object) => (
      object.element.classList.contains('youtube-css3d-controls-frame')
    ));
    const controls = controlsObject?.element.querySelector<HTMLElement>(
      '.youtube-transport-controls',
    );
    expect(videoObject).toBeDefined();
    expect(controlsObject).toBeDefined();
    expect(controls).not.toBeNull();
    expect(controlsObject?.parent).toBe(videoObject);
    expect(controlsObject?.position.y).toBe(179);
    expect(controlsObject?.position.y).toBeGreaterThan(0);
    expect(controlsObject?.scale.toArray()).toEqual([270, 270, 270]);
    expect(videoObject?.element.contains(controls!)).toBe(false);

    manager.dispose();
    expect(container.querySelector('.youtube-css3d-player')).toBeNull();
    expect(container.querySelector('.youtube-css3d-controls-frame')).toBeNull();
    expect(container.querySelector('.youtube-transport-controls')).toBeNull();
  });

  it('routes a renderer-layer click through the rendered button bounds exactly once', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const rendererElement = document.createElement('div');
    const player = createPlayerDouble();
    let onStateChange: ((state: number) => void) | undefined;
    const bubbledClicks = vi.fn();
    const bubbledMouseMoves = vi.fn();
    container.addEventListener('click', bubbledClicks);
    container.addEventListener('mousemove', bubbledMouseMoves);
    const manager = createManager({
      createCssRenderer: () => ({
        domElement: rendererElement,
        setSize: vi.fn(),
        render: vi.fn(),
      }),
      createPlayer: async (_host, _youtube, stateHandler) => {
        onStateChange = stateHandler;
        return player.port;
      },
      hitTest: (_pointer, _camera, surfaces) => surfaces[0],
    }, container);
    manager.register('marker-1', createSurface());
    manager.setMarkerVisible('marker-1', true);
    await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera());
    onStateChange?.(1);

    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-youtube-action="toggle"]',
    )!;
    mockClientRect(toggle, {
      left: 100,
      top: 40,
      width: 44,
      height: 44,
    });

    dispatchPointer(rendererElement, 'pointerdown', {
      pointerId: 5,
      clientX: 122,
      clientY: 62,
    });
    rendererElement.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: 122,
      clientY: 62,
    }));
    dispatchPointer(rendererElement, 'pointerup', {
      pointerId: 5,
      clientX: 122,
      clientY: 62,
    });
    rendererElement.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      clientX: 122,
      clientY: 62,
    }));
    rendererElement.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 122,
      clientY: 62,
    }));

    expect(player.port.pauseVideo).toHaveBeenCalledOnce();
    expect(bubbledClicks).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(toggle);

    rendererElement.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 120,
    }));
    expect(bubbledMouseMoves).toHaveBeenCalledOnce();

    rendererElement.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 122,
      clientY: 62,
    }));

    expect(player.port.pauseVideo).toHaveBeenCalledOnce();
    expect(bubbledClicks).toHaveBeenCalledOnce();

    rendererElement.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 120,
    }));

    expect(player.port.pauseVideo).toHaveBeenCalledOnce();
    expect(bubbledClicks).toHaveBeenCalledTimes(2);

    toggle.click();
    expect(player.port.pauseVideo).toHaveBeenCalledTimes(2);
    expect(bubbledClicks).toHaveBeenCalledTimes(2);
    manager.dispose();
    container.remove();
  });

  it.each(['pointer', 'mouse', 'touch'] as const)(
    'does not route an outside-start %s sequence that ends over a transport button',
    async (inputType) => {
      const container = document.createElement('div');
      const rendererElement = document.createElement('div');
      const player = createPlayerDouble();
      let onStateChange: ((state: number) => void) | undefined;
      const receivedEvents: string[] = [];
      const eventNames = inputType === 'pointer'
        ? [
            'pointerdown',
            'pointermove',
            'pointerup',
            'mousemove',
            'mousedown',
            'mouseup',
            'click',
          ]
        : inputType === 'mouse'
          ? ['mousedown', 'mousemove', 'mouseup', 'click']
          : [
              'touchstart',
              'touchmove',
              'touchend',
              'mousemove',
              'mousedown',
              'mouseup',
              'click',
            ];
      for (const eventName of eventNames) {
        container.addEventListener(eventName, () => receivedEvents.push(eventName));
      }
      const manager = createManager({
        createCssRenderer: () => ({
          domElement: rendererElement,
          setSize: vi.fn(),
          render: vi.fn(),
        }),
        createPlayer: async (_host, _youtube, stateHandler) => {
          onStateChange = stateHandler;
          return player.port;
        },
        hitTest: (_pointer, _camera, surfaces) => surfaces[0],
      }, container);
      manager.register('marker-1', createSurface());
      manager.setMarkerVisible('marker-1', true);
      await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera());
      onStateChange?.(1);

      const toggle = container.querySelector<HTMLButtonElement>(
        '[data-youtube-action="toggle"]',
      )!;
      mockClientRect(toggle, {
        left: 100,
        top: 40,
        width: 44,
        height: 44,
      });

      if (inputType === 'pointer') {
        dispatchPointer(rendererElement, 'pointerdown', {
          pointerId: 9,
          pointerType: 'touch',
          clientX: 20,
          clientY: 20,
        });
        dispatchPointer(rendererElement, 'pointermove', {
          pointerId: 9,
          pointerType: 'touch',
          clientX: 122,
          clientY: 62,
        });
        dispatchPointer(rendererElement, 'pointerup', {
          pointerId: 9,
          pointerType: 'touch',
          clientX: 122,
          clientY: 62,
        });
        rendererElement.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: 122,
          clientY: 62,
        }));
        rendererElement.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          clientX: 122,
          clientY: 62,
        }));
        rendererElement.dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX: 122,
          clientY: 62,
        }));
      } else if (inputType === 'mouse') {
        rendererElement.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          clientX: 20,
          clientY: 20,
        }));
        rendererElement.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: 122,
          clientY: 62,
        }));
        rendererElement.dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX: 122,
          clientY: 62,
        }));
      } else {
        dispatchTouch(rendererElement, 'touchstart', [{
          identifier: 13,
          clientX: 20,
          clientY: 20,
        }]);
        dispatchTouch(rendererElement, 'touchmove', [{
          identifier: 13,
          clientX: 122,
          clientY: 62,
        }]);
        dispatchTouch(rendererElement, 'touchend', [], [{
          identifier: 13,
          clientX: 122,
          clientY: 62,
        }]);
        rendererElement.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: 122,
          clientY: 62,
        }));
        rendererElement.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          clientX: 122,
          clientY: 62,
        }));
        rendererElement.dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX: 122,
          clientY: 62,
        }));
      }
      rendererElement.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 122,
        clientY: 62,
      }));

      expect(player.port.pauseVideo).not.toHaveBeenCalled();
      expect(receivedEvents).toEqual(eventNames);
      manager.dispose();
    },
  );

  it.each(['pointer', 'touch'] as const)(
    'clears a canceled %s gesture before a fallback-mouse click',
    async (inputType) => {
      const container = document.createElement('div');
      const rendererElement = document.createElement('div');
      const player = createPlayerDouble();
      let onStateChange: ((state: number) => void) | undefined;
      const manager = createManager({
        createCssRenderer: () => ({
          domElement: rendererElement,
          setSize: vi.fn(),
          render: vi.fn(),
        }),
        createPlayer: async (_host, _youtube, stateHandler) => {
          onStateChange = stateHandler;
          return player.port;
        },
        hitTest: (_pointer, _camera, surfaces) => surfaces[0],
      }, container);
      manager.register('marker-1', createSurface());
      manager.setMarkerVisible('marker-1', true);
      await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera());
      onStateChange?.(1);

      const toggle = container.querySelector<HTMLButtonElement>(
        '[data-youtube-action="toggle"]',
      )!;
      mockClientRect(toggle, {
        left: 100,
        top: 40,
        width: 44,
        height: 44,
      });

      if (inputType === 'pointer') {
        dispatchPointer(rendererElement, 'pointerdown', {
          pointerId: 14,
          clientX: 122,
          clientY: 62,
        });
        dispatchPointer(rendererElement, 'pointercancel', {
          pointerId: 14,
          clientX: 122,
          clientY: 62,
        });
      } else {
        dispatchTouch(rendererElement, 'touchstart', [{
          identifier: 14,
          clientX: 122,
          clientY: 62,
        }]);
        dispatchTouch(rendererElement, 'touchcancel', [], [{
          identifier: 14,
          clientX: 122,
          clientY: 62,
        }]);
      }
      for (const eventName of ['mousedown', 'mouseup', 'click']) {
        rendererElement.dispatchEvent(new MouseEvent(eventName, {
          bubbles: true,
          cancelable: true,
          clientX: 122,
          clientY: 62,
        }));
      }

      expect(player.port.pauseVideo).toHaveBeenCalledOnce();
      manager.dispose();
    },
  );

  it.each(['pointer', 'touch'] as const)(
    'does not let one %s contact complete another contact gesture',
    async (inputType) => {
      const container = document.createElement('div');
      const rendererElement = document.createElement('div');
      const player = createPlayerDouble();
      let onStateChange: ((state: number) => void) | undefined;
      const bubbledClicks = vi.fn();
      container.addEventListener('click', bubbledClicks);
      const manager = createManager({
        createCssRenderer: () => ({
          domElement: rendererElement,
          setSize: vi.fn(),
          render: vi.fn(),
        }),
        createPlayer: async (_host, _youtube, stateHandler) => {
          onStateChange = stateHandler;
          return player.port;
        },
        hitTest: (_pointer, _camera, surfaces) => surfaces[0],
      }, container);
      manager.register('marker-1', createSurface());
      manager.setMarkerVisible('marker-1', true);
      await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera());
      onStateChange?.(1);

      const toggle = container.querySelector<HTMLButtonElement>(
        '[data-youtube-action="toggle"]',
      )!;
      mockClientRect(toggle, {
        left: 100,
        top: 40,
        width: 44,
        height: 44,
      });

      const outsideContact = {
        identifier: 15,
        clientX: 20,
        clientY: 20,
      };
      const insideContact = {
        identifier: 16,
        clientX: 122,
        clientY: 62,
      };
      if (inputType === 'pointer') {
        dispatchPointer(rendererElement, 'pointerdown', {
          pointerId: outsideContact.identifier,
          clientX: outsideContact.clientX,
          clientY: outsideContact.clientY,
        });
        dispatchPointer(rendererElement, 'pointerdown', {
          pointerId: insideContact.identifier,
          clientX: insideContact.clientX,
          clientY: insideContact.clientY,
        });
        dispatchPointer(rendererElement, 'pointerup', {
          pointerId: outsideContact.identifier,
          clientX: 122,
          clientY: 62,
        });
      } else {
        dispatchTouch(rendererElement, 'touchstart', [outsideContact]);
        dispatchTouch(
          rendererElement,
          'touchstart',
          [outsideContact, insideContact],
          [insideContact],
        );
        dispatchTouch(rendererElement, 'touchend', [insideContact], [{
          ...outsideContact,
          clientX: 122,
          clientY: 62,
        }]);
      }
      rendererElement.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 122,
        clientY: 62,
      }));
      if (inputType === 'pointer') {
        dispatchPointer(rendererElement, 'pointercancel', {
          pointerId: insideContact.identifier,
          clientX: insideContact.clientX,
          clientY: insideContact.clientY,
        });
      } else {
        dispatchTouch(rendererElement, 'touchcancel', [], [insideContact]);
      }

      expect(player.port.pauseVideo).not.toHaveBeenCalled();
      expect(bubbledClicks).toHaveBeenCalledOnce();
      manager.dispose();
    },
  );

  it('routes overlapping bounds by activation order when readiness resolves out of order', async () => {
    const container = document.createElement('div');
    const rendererElement = document.createElement('div');
    const firstPlayer = createPlayerDouble();
    const secondPlayer = createPlayerDouble();
    const creations = [
      createDeferred<YouTubePlayerPort>(),
      createDeferred<YouTubePlayerPort>(),
    ];
    const stateHandlers: Array<(state: number) => void> = [];
    let playerIndex = 0;
    const manager = createManager({
      createCssRenderer: () => ({
        domElement: rendererElement,
        setSize: vi.fn(),
        render: vi.fn(),
      }),
      createPlayer: (_host, _youtube, stateHandler) => {
        stateHandlers.push(stateHandler);
        const creation = creations[playerIndex];
        playerIndex += 1;
        return creation.promise;
      },
      hitTest: (pointer, _camera, surfaces) => (
        surfaces.find((surface) => (
          surface.objectId === (pointer.x < 0 ? 'video-1' : 'video-2')
        ))
      ),
    }, container);
    manager.register('marker-1', createSurface('video-1'));
    manager.register('marker-2', createSurface('video-2'));
    manager.setMarkerVisible('marker-1', true);
    manager.setMarkerVisible('marker-2', true);
    const firstActivation = manager.activateFromPointer(
      { x: -1, y: 0 },
      new PerspectiveCamera(),
    );
    const secondActivation = manager.activateFromPointer(
      { x: 1, y: 0 },
      new PerspectiveCamera(),
    );
    creations[1].resolve(secondPlayer.port);
    expect(await secondActivation).toBe('activated');
    creations[0].resolve(firstPlayer.port);
    expect(await firstActivation).toBe('activated');
    stateHandlers.forEach((handler) => handler(1));

    const toggles = [
      ...container.querySelectorAll<HTMLButtonElement>(
        '[data-youtube-action="toggle"]',
      ),
    ];
    expect(toggles).toHaveLength(2);
    for (const toggle of toggles) {
      mockClientRect(toggle, {
        left: 100,
        top: 40,
        width: 44,
        height: 44,
      });
    }
    const frames = [
      ...rendererElement.querySelectorAll<HTMLElement>(
        '.youtube-css3d-controls-frame',
      ),
    ];
    expect(frames[1].contains(toggles[1])).toBe(true);

    dispatchPointer(rendererElement, 'pointerdown', {
      pointerId: 15,
      clientX: 122,
      clientY: 62,
    });
    dispatchPointer(rendererElement, 'pointerup', {
      pointerId: 15,
      clientX: 122,
      clientY: 62,
    });
    rendererElement.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 122,
      clientY: 62,
    }));

    expect(firstPlayer.port.pauseVideo).not.toHaveBeenCalled();
    expect(secondPlayer.port.pauseVideo).toHaveBeenCalledOnce();
    manager.dispose();
  });

  it('contains renderer-layer pointer and touch gestures that start on the transport bar', async () => {
    const container = document.createElement('div');
    const rendererElement = document.createElement('div');
    const receivedEvents: string[] = [];
    for (const eventName of [
      'pointerdown',
      'pointermove',
      'pointerup',
      'touchstart',
      'touchmove',
      'touchend',
      'click',
    ]) {
      container.addEventListener(eventName, () => receivedEvents.push(eventName));
    }
    const manager = createManager({
      createCssRenderer: () => ({
        domElement: rendererElement,
        setSize: vi.fn(),
        render: vi.fn(),
      }),
      createPlayer: async () => createPlayerDouble().port,
      hitTest: (_pointer, _camera, surfaces) => surfaces[0],
    }, container);
    manager.register('marker-1', createSurface());
    manager.setMarkerVisible('marker-1', true);
    await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera());

    const controls = container.querySelector<HTMLElement>('.youtube-transport-controls')!;
    mockClientRect(controls, {
      left: 80,
      top: 30,
      width: 240,
      height: 60,
    });

    dispatchPointer(rendererElement, 'pointerdown', {
      pointerId: 7,
      clientX: 90,
      clientY: 50,
    });
    dispatchPointer(rendererElement, 'pointermove', {
      pointerId: 7,
      clientX: 400,
      clientY: 200,
    });
    dispatchPointer(rendererElement, 'pointerup', {
      pointerId: 7,
      clientX: 400,
      clientY: 200,
    });
    dispatchTouch(rendererElement, 'touchstart', [{
      identifier: 11,
      clientX: 90,
      clientY: 50,
    }]);
    dispatchTouch(rendererElement, 'touchmove', [{
      identifier: 11,
      clientX: 400,
      clientY: 200,
    }]);
    dispatchTouch(rendererElement, 'touchend', [], [{
      identifier: 11,
      clientX: 400,
      clientY: 200,
    }]);
    rendererElement.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 90,
      clientY: 50,
    }));

    expect(receivedEvents).toEqual([]);
    manager.dispose();
  });

  it('removes layer gesture listeners and state when disposed mid-gesture', async () => {
    const container = document.createElement('div');
    const rendererElement = document.createElement('div');
    const player = createPlayerDouble();
    const manager = createManager({
      createCssRenderer: () => ({
        domElement: rendererElement,
        setSize: vi.fn(),
        render: vi.fn(),
      }),
      createPlayer: async () => player.port,
      hitTest: (_pointer, _camera, surfaces) => surfaces[0],
    }, container);
    manager.register('marker-1', createSurface());
    manager.setMarkerVisible('marker-1', true);
    await manager.activateFromPointer({ x: 0, y: 0 }, new PerspectiveCamera());

    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-youtube-action="toggle"]',
    )!;
    mockClientRect(toggle, {
      left: 100,
      top: 40,
      width: 44,
      height: 44,
    });
    dispatchPointer(rendererElement, 'pointerdown', {
      pointerId: 19,
      clientX: 122,
      clientY: 62,
    });

    manager.dispose();
    player.port.pauseVideo.mockClear();
    container.append(rendererElement);
    const receivedEvents: string[] = [];
    container.addEventListener('pointerup', () => receivedEvents.push('pointerup'));
    container.addEventListener('click', () => receivedEvents.push('click'));
    dispatchPointer(rendererElement, 'pointerup', {
      pointerId: 19,
      clientX: 122,
      clientY: 62,
    });
    rendererElement.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 122,
      clientY: 62,
    }));

    expect(receivedEvents).toEqual(['pointerup', 'click']);
    expect(player.port.pauseVideo).not.toHaveBeenCalled();
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
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
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

function createSurface(objectId = 'video-1') {
  const root = new Group();
  const mesh = new Mesh(new PlaneGeometry(16 / 9, 1), new MeshBasicMaterial());
  root.add(mesh);
  return {
    objectId,
    root,
    mesh,
    youtube: {
      videoId: 'M7lc1UVf-VE',
      url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      thumbnailUrl: 'https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg',
    },
  };
}

function mockClientRect(
  element: HTMLElement,
  rect: { left: number; top: number; width: number; height: number },
): void {
  element.getBoundingClientRect = vi.fn(() => ({
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width,
    height: rect.height,
    toJSON: () => ({}),
  }));
}

function dispatchPointer(
  target: HTMLElement,
  type: string,
  values: {
    pointerId: number;
    pointerType?: string;
    clientX: number;
    clientY: number;
  },
): void {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as Event & typeof values;
  Object.assign(event, values);
  target.dispatchEvent(event);
}

type TouchPoint = {
  identifier: number;
  clientX: number;
  clientY: number;
};

function dispatchTouch(
  target: HTMLElement,
  type: string,
  touches: TouchPoint[],
  changedTouches: TouchPoint[] = touches,
): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: touches });
  Object.defineProperty(event, 'changedTouches', { value: changedTouches });
  target.dispatchEvent(event);
}

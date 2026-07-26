import { afterEach, describe, expect, it, vi } from 'vitest';
import { FloorGestureController } from '../src/interaction/floorGestureController';

describe('FloorGestureController', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits one tap and no drag when movement stays below the threshold', () => {
    const { target, handlers, controller } = setupController();
    controller.connect();

    dispatchTouch(target, 'touchstart', [{ clientX: 10, clientY: 10 }]);
    dispatchTouch(target, 'touchmove', [{ clientX: 18, clientY: 16 }]);
    dispatchTouch(target, 'touchend', [], [{ clientX: 18, clientY: 16 }]);

    expect(handlers.onTap).toHaveBeenCalledOnce();
    expect(handlers.onTap).toHaveBeenCalledWith({ x: 18, y: 16 });
    expect(handlers.onDrag).not.toHaveBeenCalled();
  });

  it('emits neither tap nor drag when an unselected gesture reaches 12 pixels before long press', () => {
    vi.useFakeTimers();
    const { target, handlers, controller } = setupController();
    controller.connect();

    dispatchTouch(target, 'touchstart', [{ clientX: 0, clientY: 0 }]);
    dispatchTouch(target, 'touchmove', [{ clientX: 12, clientY: 0 }]);
    vi.advanceTimersByTime(450);
    dispatchTouch(target, 'touchend', [], [{ clientX: 12, clientY: 0 }]);

    expect(handlers.onTap).not.toHaveBeenCalled();
    expect(handlers.onLongPress).not.toHaveBeenCalled();
    expect(handlers.onDrag).not.toHaveBeenCalled();
  });

  it('emits one long press after an unmoved 450 millisecond hold', () => {
    vi.useFakeTimers();
    const { target, handlers, controller } = setupController();
    controller.connect();

    dispatchTouch(target, 'touchstart', [{ clientX: 5, clientY: 7 }]);
    vi.advanceTimersByTime(450);
    vi.advanceTimersByTime(450);

    expect(handlers.onLongPress).toHaveBeenCalledOnce();
    expect(handlers.onLongPress).toHaveBeenCalledWith({ x: 5, y: 7 });
    expect(handlers.onTap).not.toHaveBeenCalled();
  });

  it('emits point-pair drag deltas after a long press', () => {
    vi.useFakeTimers();
    const { target, handlers, controller } = setupController();
    controller.connect();

    dispatchTouch(target, 'touchstart', [{ clientX: 0, clientY: 0 }]);
    vi.advanceTimersByTime(450);
    dispatchTouch(target, 'touchmove', [{ clientX: 3, clientY: 4 }]);
    dispatchTouch(target, 'touchmove', [{ clientX: 8, clientY: 6 }]);

    expect(handlers.onDrag).toHaveBeenNthCalledWith(1, {
      previous: { x: 0, y: 0 },
      current: { x: 3, y: 4 },
    });
    expect(handlers.onDrag).toHaveBeenNthCalledWith(2, {
      previous: { x: 3, y: 4 },
      current: { x: 8, y: 6 },
    });
  });

  it('emits drag after reaching the threshold when a transform was already active', () => {
    const { target, handlers, controller } = setupController(true);
    controller.connect();

    dispatchTouch(target, 'touchstart', [{ clientX: 0, clientY: 0 }]);
    dispatchTouch(target, 'touchmove', [{ clientX: 5, clientY: 0 }]);
    dispatchTouch(target, 'touchmove', [{ clientX: 12, clientY: 0 }]);

    expect(handlers.onDrag).toHaveBeenCalledOnce();
    expect(handlers.onDrag).toHaveBeenCalledWith({
      previous: { x: 0, y: 0 },
      current: { x: 12, y: 0 },
    });
  });

  it('emits the two-finger distance ratio as a scale multiplier', () => {
    const { target, handlers, controller } = setupController();
    controller.connect();

    dispatchTouch(target, 'touchstart', [
      { clientX: 0, clientY: 0 },
      { clientX: 0, clientY: 10 },
    ]);
    dispatchTouch(target, 'touchmove', [
      { clientX: 0, clientY: 0 },
      { clientX: 0, clientY: 25 },
    ]);

    expect(handlers.onPinch).toHaveBeenCalledOnce();
    expect(handlers.onPinch).toHaveBeenCalledWith(2.5);
    expect(handlers.onTap).not.toHaveBeenCalled();
    expect(handlers.onDrag).not.toHaveBeenCalled();
  });

  it('clears a pending long-press timer on touch cancel and disconnect', () => {
    vi.useFakeTimers();
    const { target, handlers, controller } = setupController();
    controller.connect();

    dispatchTouch(target, 'touchstart', [{ clientX: 1, clientY: 2 }]);
    dispatchTouch(target, 'touchcancel', []);
    vi.advanceTimersByTime(450);

    dispatchTouch(target, 'touchstart', [{ clientX: 3, clientY: 4 }]);
    controller.disconnect();
    vi.advanceTimersByTime(450);

    expect(handlers.onLongPress).not.toHaveBeenCalled();
  });

  it('ignores events from inside the YouTube CSS3D player', () => {
    const { target, handlers, controller } = setupController();
    controller.connect();

    const player = document.createElement('div');
    player.className = 'youtube-css3d-player';
    const playerControl = player.appendChild(document.createElement('div'));
    target.appendChild(player);

    const start = dispatchTouch(playerControl, 'touchstart', [{ clientX: 1, clientY: 2 }]);
    const move = dispatchTouch(playerControl, 'touchmove', [{ clientX: 8, clientY: 9 }]);
    const end = dispatchTouch(playerControl, 'touchend', [], [{ clientX: 8, clientY: 9 }]);

    expect(start.defaultPrevented).toBe(false);
    expect(move.defaultPrevented).toBe(false);
    expect(end.defaultPrevented).toBe(false);
    expect(handlers.onTap).not.toHaveBeenCalled();
    expect(handlers.onLongPress).not.toHaveBeenCalled();
    expect(handlers.onDrag).not.toHaveBeenCalled();
    expect(handlers.onPinch).not.toHaveBeenCalled();
  });
});

function setupController(transformActive = false) {
  const target = document.createElement('div');
  const handlers = {
    isTransformActive: vi.fn(() => transformActive),
    onTap: vi.fn(),
    onLongPress: vi.fn(),
    onDrag: vi.fn(),
    onPinch: vi.fn(),
  };
  const controller = new FloorGestureController(target, handlers);
  return { target, handlers, controller };
}

type TouchPoint = {
  clientX: number;
  clientY: number;
};

function dispatchTouch(
  target: Element,
  type: string,
  touches: TouchPoint[],
  changedTouches: TouchPoint[] = touches,
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: touches });
  Object.defineProperty(event, 'changedTouches', { value: changedTouches });
  target.dispatchEvent(event);
  return event;
}

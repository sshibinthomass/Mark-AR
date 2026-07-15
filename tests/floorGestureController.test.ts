import { describe, expect, it, vi } from 'vitest';
import { FloorGestureController } from '../src/interaction/floorGestureController';

describe('FloorGestureController', () => {
  it('emits a tap when movement stays under 12 pixels', () => {
    const { target, handlers, controller } = setupController();
    controller.connect();

    const start = dispatchTouch(target, 'touchstart', [{ clientX: 10, clientY: 10 }]);
    const move = dispatchTouch(target, 'touchmove', [{ clientX: 18, clientY: 16 }]);
    const end = dispatchTouch(target, 'touchend', [], [{ clientX: 18, clientY: 16 }]);

    expect(handlers.onTap).toHaveBeenCalledOnce();
    expect(handlers.onTap).toHaveBeenCalledWith({ x: 18, y: 16 });
    expect(start.defaultPrevented).toBe(true);
    expect(move.defaultPrevented).toBe(true);
    expect(end.defaultPrevented).toBe(true);
  });

  it('emits drag for one-finger movement and does not tap at the 12-pixel boundary', () => {
    const { target, handlers, controller } = setupController();
    controller.connect();

    dispatchTouch(target, 'touchstart', [{ clientX: 0, clientY: 0 }]);
    dispatchTouch(target, 'touchmove', [{ clientX: 12, clientY: 0 }]);
    dispatchTouch(target, 'touchend', [], [{ clientX: 12, clientY: 0 }]);

    expect(handlers.onDrag).toHaveBeenCalledOnce();
    expect(handlers.onDrag).toHaveBeenCalledWith({ x: 12, y: 0 });
    expect(handlers.onTap).not.toHaveBeenCalled();
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

  it('ignores interactive controls and their descendants', () => {
    const { target, handlers, controller } = setupController();
    controller.connect();

    const roleButton = document.createElement('div');
    roleButton.setAttribute('role', 'button');
    const controls = [
      document.createElement('button'),
      document.createElement('a'),
      document.createElement('input'),
      document.createElement('select'),
      document.createElement('textarea'),
      roleButton,
    ];

    for (const control of controls) {
      const eventTarget = control instanceof HTMLInputElement
        || control instanceof HTMLSelectElement
        || control instanceof HTMLTextAreaElement
        ? control
        : control.appendChild(document.createElement('span'));
      target.replaceChildren(control);

      const start = dispatchTouch(eventTarget, 'touchstart', [{ clientX: 1, clientY: 2 }]);
      const move = dispatchTouch(eventTarget, 'touchmove', [{ clientX: 8, clientY: 9 }]);
      const end = dispatchTouch(eventTarget, 'touchend', [], [{ clientX: 8, clientY: 9 }]);

      expect(start.defaultPrevented).toBe(false);
      expect(move.defaultPrevented).toBe(false);
      expect(end.defaultPrevented).toBe(false);
    }

    expect(handlers.onTap).not.toHaveBeenCalled();
    expect(handlers.onDrag).not.toHaveBeenCalled();
    expect(handlers.onPinch).not.toHaveBeenCalled();
  });

  it('does not prevent inactive gestures and removes listeners on disconnect', () => {
    const { target, handlers, controller } = setupController();
    controller.connect();

    const inactiveMove = dispatchTouch(target, 'touchmove', [{ clientX: 2, clientY: 3 }]);
    expect(inactiveMove.defaultPrevented).toBe(false);

    controller.disconnect();
    const start = dispatchTouch(target, 'touchstart', [{ clientX: 4, clientY: 5 }]);
    dispatchTouch(target, 'touchend', [], [{ clientX: 4, clientY: 5 }]);

    expect(start.defaultPrevented).toBe(false);
    expect(handlers.onTap).not.toHaveBeenCalled();
    expect(handlers.onDrag).not.toHaveBeenCalled();
    expect(handlers.onPinch).not.toHaveBeenCalled();
  });
});

function setupController() {
  const target = document.createElement('div');
  const handlers = {
    onTap: vi.fn(),
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

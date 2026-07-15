export type Point2 = {
  x: number;
  y: number;
};

export type FloorGestureHandlers = {
  onTap(point: Point2): void;
  onDrag(point: Point2): void;
  onPinch(multiplier: number): void;
};

const TAP_MOVEMENT_THRESHOLD = 12;
const INTERACTIVE_TARGET_SELECTOR = 'button, a, input, select, textarea, [role="button"]';

export class FloorGestureController {
  private readonly target: HTMLElement;
  private readonly handlers: FloorGestureHandlers;
  private active = false;
  private startPoint: Point2 | null = null;
  private lastSinglePoint: Point2 | null = null;
  private lastPinchDistance: number | null = null;

  constructor(target: HTMLElement, handlers: FloorGestureHandlers) {
    this.target = target;
    this.handlers = handlers;
  }

  connect(): void {
    this.target.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.target.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.target.addEventListener('touchend', this.onTouchEnd, { passive: false });
    this.target.addEventListener('touchcancel', this.onTouchCancel, { passive: false });
  }

  disconnect(): void {
    this.target.removeEventListener('touchstart', this.onTouchStart);
    this.target.removeEventListener('touchmove', this.onTouchMove);
    this.target.removeEventListener('touchend', this.onTouchEnd);
    this.target.removeEventListener('touchcancel', this.onTouchCancel);
    this.reset();
  }

  private readonly onTouchStart = (event: TouchEvent): void => {
    if (isInteractiveTarget(event.target)) {
      this.reset();
      return;
    }

    event.preventDefault();
    this.active = true;

    if (event.touches.length === 1) {
      const point = touchToPoint(event.touches[0]);
      this.startPoint = point;
      this.lastSinglePoint = point;
      this.lastPinchDistance = null;
      return;
    }

    if (event.touches.length >= 2) {
      this.startPoint = null;
      this.lastSinglePoint = null;
      this.lastPinchDistance = distanceBetweenTouches(event.touches[0], event.touches[1]);
      return;
    }

    this.reset();
  };

  private readonly onTouchMove = (event: TouchEvent): void => {
    if (!this.active || isInteractiveTarget(event.target)) {
      return;
    }

    event.preventDefault();

    if (event.touches.length === 1) {
      const point = touchToPoint(event.touches[0]);
      this.lastSinglePoint = point;
      this.handlers.onDrag(point);
      return;
    }

    if (event.touches.length >= 2) {
      this.startPoint = null;
      this.lastSinglePoint = null;
      const distance = distanceBetweenTouches(event.touches[0], event.touches[1]);
      if (this.lastPinchDistance !== null && this.lastPinchDistance > 0) {
        this.handlers.onPinch(distance / this.lastPinchDistance);
      }
      this.lastPinchDistance = distance;
    }
  };

  private readonly onTouchEnd = (event: TouchEvent): void => {
    if (!this.active) {
      return;
    }

    if (isInteractiveTarget(event.target)) {
      this.reset();
      return;
    }

    event.preventDefault();
    if (event.touches.length > 0) {
      return;
    }

    if (this.startPoint && this.lastSinglePoint) {
      const releasedTouch = event.changedTouches[0];
      const endPoint = releasedTouch ? touchToPoint(releasedTouch) : this.lastSinglePoint;
      if (distanceBetweenPoints(this.startPoint, endPoint) < TAP_MOVEMENT_THRESHOLD) {
        this.handlers.onTap(endPoint);
      }
    }

    this.reset();
  };

  private readonly onTouchCancel = (event: TouchEvent): void => {
    if (!this.active) {
      return;
    }

    event.preventDefault();
    this.reset();
  };

  private reset(): void {
    this.active = false;
    this.startPoint = null;
    this.lastSinglePoint = null;
    this.lastPinchDistance = null;
  }
}

function touchToPoint(touch: Touch): Point2 {
  return {
    x: touch.clientX,
    y: touch.clientY,
  };
}

function distanceBetweenTouches(first: Touch, second: Touch): number {
  return distanceBetweenPoints(touchToPoint(first), touchToPoint(second));
}

function distanceBetweenPoints(first: Point2, second: Point2): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    ? target.closest(INTERACTIVE_TARGET_SELECTOR) !== null
    : false;
}

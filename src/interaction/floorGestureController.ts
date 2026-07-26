export type Point2 = {
  x: number;
  y: number;
};

export type FloorDragGesture = {
  previous: Point2;
  current: Point2;
};

export type FloorGestureHandlers = {
  isTransformActive(): boolean;
  onTap(point: Point2): void;
  onLongPress(point: Point2): void;
  onDrag(gesture: FloorDragGesture): void;
  onPinch(multiplier: number): void;
};

const MOVEMENT_THRESHOLD_PX = 12;
const LONG_PRESS_DELAY_MS = 450;
const INTERACTIVE_TARGET_SELECTOR = 'button, a, input, select, textarea, [role="button"], .youtube-css3d-player';

export class FloorGestureController {
  private readonly target: HTMLElement;
  private readonly handlers: FloorGestureHandlers;
  private active = false;
  private longPressTimer: ReturnType<typeof setTimeout> | undefined;
  private gestureStart: Point2 | undefined;
  private previousPoint: Point2 | undefined;
  private pendingPress = false;
  private longPressFired = false;
  private dragging = false;
  private lastPinchDistance: number | undefined;

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
      this.beginSingleTouch(touchToPoint(event.touches[0]));
      return;
    }

    if (event.touches.length >= 2) {
      this.clearPressState();
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
      this.handleSingleTouchMove(touchToPoint(event.touches[0]));
      return;
    }

    if (event.touches.length >= 2) {
      this.clearPressState();
      const distance = distanceBetweenTouches(event.touches[0], event.touches[1]);
      if (this.lastPinchDistance !== undefined && this.lastPinchDistance > 0) {
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

    const releasedTouch = event.changedTouches[0];
    const endPoint = releasedTouch ? touchToPoint(releasedTouch) : this.previousPoint;
    if (
      this.pendingPress
      && !this.longPressFired
      && this.gestureStart
      && endPoint
      && distanceBetweenPoints(this.gestureStart, endPoint) < MOVEMENT_THRESHOLD_PX
    ) {
      this.handlers.onTap(endPoint);
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

  private beginSingleTouch(point: Point2): void {
    this.clearPressState();
    this.gestureStart = point;
    this.previousPoint = point;
    this.pendingPress = true;
    this.dragging = this.handlers.isTransformActive();
    this.lastPinchDistance = undefined;
    this.longPressTimer = setTimeout(() => {
      if (!this.pendingPress || !this.gestureStart || this.longPressFired) {
        return;
      }

      this.pendingPress = false;
      this.longPressFired = true;
      this.dragging = true;
      this.longPressTimer = undefined;
      this.handlers.onLongPress(this.gestureStart);
    }, LONG_PRESS_DELAY_MS);
  }

  private handleSingleTouchMove(point: Point2): void {
    if (!this.gestureStart || !this.previousPoint) {
      return;
    }

    if (this.pendingPress) {
      if (distanceBetweenPoints(this.gestureStart, point) < MOVEMENT_THRESHOLD_PX) {
        return;
      }

      this.pendingPress = false;
      this.clearLongPressTimer();
    }

    if (!this.dragging) {
      return;
    }

    this.handlers.onDrag({ previous: this.previousPoint, current: point });
    this.previousPoint = point;
  }

  private clearPressState(): void {
    this.clearLongPressTimer();
    this.gestureStart = undefined;
    this.previousPoint = undefined;
    this.pendingPress = false;
    this.longPressFired = false;
    this.dragging = false;
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer !== undefined) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = undefined;
    }
  }

  private reset(): void {
    this.active = false;
    this.clearPressState();
    this.lastPinchDistance = undefined;
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

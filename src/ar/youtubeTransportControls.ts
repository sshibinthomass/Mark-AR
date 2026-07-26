export type YouTubeTransportPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
};

export type YouTubeTransportControls = {
  element: HTMLElement;
  bindPlayer(player: YouTubeTransportPlayer): void;
  setPlayerState(state: number): void;
  dispose(): void;
};

const PLAYING = 1;
const BUFFERING = 3;
const CAPTURED_CLICK_WINDOW_MS = 750;
const CAPTURED_CLICK_COORDINATE_TOLERANCE_PX = 4;
const MAX_INVALID_CAPTURED_CLICKS = 8;
const ROOT_INTERACTION_EVENTS = [
  'mousedown',
  'mousemove',
  'mouseup',
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
  'click',
] as const;

export function createYouTubeTransportControls(): YouTubeTransportControls {
  const element = document.createElement('div');
  element.className = 'youtube-transport-controls';
  element.hidden = true;
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', 'YouTube playback controls');

  const rewind = createButton('rewind', '↶ 10', 'Rewind 10 seconds');
  const toggle = createButton('toggle', 'Play', 'Play video');
  const forward = createButton('forward', '10 ↷', 'Forward 10 seconds');
  element.append(rewind, toggle, forward);

  let player: YouTubeTransportPlayer | undefined;
  let playing = false;
  const pointerContacts = new Map<number, {
    origin: HTMLElement;
    captureTarget: HTMLElement;
  }>();
  const invalidCapturedClicks = new Map<number, {
    origin: HTMLElement;
    clientX: number;
    clientY: number;
    completedAt: number;
  }>();

  const onToggle = (event: Event) => {
    event.stopPropagation();
    if (!player) return;
    if (playing) player.pauseVideo();
    else player.playVideo();
  };

  const onRewind = (event: Event) => {
    event.stopPropagation();
    if (!player) return;
    player.seekTo(Math.max(0, finiteOrZero(player.getCurrentTime()) - 10), true);
  };

  const onForward = (event: Event) => {
    event.stopPropagation();
    if (!player) return;
    const currentTime = finiteOrZero(player.getCurrentTime());
    const duration = player.getDuration();
    const target = Number.isFinite(duration) && duration > 0
      ? Math.min(duration, currentTime + 10)
      : currentTime + 10;
    player.seekTo(target, true);
  };

  const stopInteractionPropagation = (event: Event) => event.stopPropagation();
  const onPointerDown = (event: PointerEvent) => {
    event.stopPropagation();
    const origin = nativeTransportTarget(event.target, element) ?? element;
    const captureTarget = origin;
    invalidCapturedClicks.delete(event.pointerId);
    try {
      captureTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture can fail when the browser has already canceled the contact.
    }
    pointerContacts.set(event.pointerId, { origin, captureTarget });
  };
  const onPointerMove = (event: PointerEvent) => event.stopPropagation();
  const endPointerCapture = (event: PointerEvent) => {
    event.stopPropagation();
    const contact = pointerContacts.get(event.pointerId);
    pointerContacts.delete(event.pointerId);
    if (
      event.type === 'pointerup'
      && contact
      && nativeTransportTargetAtPoint(
        event.clientX,
        event.clientY,
        element,
      ) !== contact.origin
    ) {
      invalidCapturedClicks.set(event.pointerId, {
        origin: contact.origin,
        clientX: event.clientX,
        clientY: event.clientY,
        completedAt: event.timeStamp,
      });
      if (invalidCapturedClicks.size > MAX_INVALID_CAPTURED_CLICKS) {
        const oldestPointerId = invalidCapturedClicks.keys().next().value;
        if (oldestPointerId !== undefined) {
          invalidCapturedClicks.delete(oldestPointerId);
        }
      }
    }
    try {
      contact?.captureTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // A lost capture is already contained and needs no further cleanup.
    }
  };
  const suppressInvalidCapturedClick = (event: MouseEvent) => {
    const invalidClick = matchingInvalidCapturedClick(
      event,
      invalidCapturedClicks,
      element,
    );
    if (!invalidClick) {
      return;
    }
    invalidCapturedClicks.delete(invalidClick.pointerId);
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  rewind.addEventListener('click', onRewind);
  toggle.addEventListener('click', onToggle);
  forward.addEventListener('click', onForward);
  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', endPointerCapture);
  element.addEventListener('pointercancel', endPointerCapture);
  element.addEventListener('click', suppressInvalidCapturedClick, true);
  for (const eventName of ROOT_INTERACTION_EVENTS) {
    element.addEventListener(eventName, stopInteractionPropagation);
  }

  return {
    element,
    bindPlayer(nextPlayer) {
      player = nextPlayer;
      element.hidden = false;
    },
    setPlayerState(state) {
      if (state === BUFFERING) return;
      playing = state === PLAYING;
      toggle.textContent = playing ? 'Pause' : 'Play';
      toggle.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
    },
    dispose() {
      rewind.removeEventListener('click', onRewind);
      toggle.removeEventListener('click', onToggle);
      forward.removeEventListener('click', onForward);
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', endPointerCapture);
      element.removeEventListener('pointercancel', endPointerCapture);
      element.removeEventListener('click', suppressInvalidCapturedClick, true);
      for (const eventName of ROOT_INTERACTION_EVENTS) {
        element.removeEventListener(eventName, stopInteractionPropagation);
      }
      for (const [pointerId, contact] of pointerContacts) {
        try {
          contact.captureTarget.releasePointerCapture?.(pointerId);
        } catch {
          // The browser may release capture before disposal.
        }
      }
      pointerContacts.clear();
      invalidCapturedClicks.clear();
      player = undefined;
      element.remove();
    },
  };
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function createButton(action: string, text: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.youtubeAction = action;
  button.textContent = text;
  button.setAttribute('aria-label', label);
  return button;
}

function nativeTransportTarget(
  target: EventTarget | null,
  controls: HTMLElement,
): HTMLElement | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }
  const button = target.closest<HTMLButtonElement>('button');
  if (button && controls.contains(button)) {
    return button;
  }
  return target.closest('.youtube-transport-controls') === controls
    ? controls
    : undefined;
}

function nativeTransportTargetAtPoint(
  clientX: number,
  clientY: number,
  controls: HTMLElement,
): HTMLElement | undefined {
  return nativeTransportTarget(
    document.elementFromPoint(clientX, clientY),
    controls,
  );
}

function matchingInvalidCapturedClick(
  event: MouseEvent,
  invalidClicks: Map<number, {
    origin: HTMLElement;
    clientX: number;
    clientY: number;
    completedAt: number;
  }>,
  controls: HTMLElement,
): {
  pointerId: number;
} | undefined {
  const clickTarget = nativeTransportTarget(event.target, controls);
  const eventPointerId = 'pointerId' in event
    && typeof event.pointerId === 'number'
    ? event.pointerId
    : undefined;
  let matchingPointerId: number | undefined;
  let latestCompletion = -Infinity;
  for (const [pointerId, invalidClick] of invalidClicks) {
    const elapsed = event.timeStamp - invalidClick.completedAt;
    if (elapsed < 0 || elapsed > CAPTURED_CLICK_WINDOW_MS) {
      invalidClicks.delete(pointerId);
      continue;
    }
    if (
      eventPointerId !== undefined
      && eventPointerId !== pointerId
    ) {
      continue;
    }
    if (
      clickTarget === invalidClick.origin
      && Math.abs(event.clientX - invalidClick.clientX)
        <= CAPTURED_CLICK_COORDINATE_TOLERANCE_PX
      && Math.abs(event.clientY - invalidClick.clientY)
        <= CAPTURED_CLICK_COORDINATE_TOLERANCE_PX
      && invalidClick.completedAt >= latestCompletion
    ) {
      matchingPointerId = pointerId;
      latestCompletion = invalidClick.completedAt;
    }
  }
  return matchingPointerId === undefined
    ? undefined
    : { pointerId: matchingPointerId };
}

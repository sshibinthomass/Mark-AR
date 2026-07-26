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
const INTERACTION_EVENTS = ['pointerdown', 'pointerup', 'touchstart', 'touchmove', 'touchend'];

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

  rewind.addEventListener('click', onRewind);
  toggle.addEventListener('click', onToggle);
  forward.addEventListener('click', onForward);
  for (const button of [rewind, toggle, forward]) {
    for (const eventName of INTERACTION_EVENTS) {
      button.addEventListener(eventName, stopInteractionPropagation);
    }
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
      for (const button of [rewind, toggle, forward]) {
        for (const eventName of INTERACTION_EVENTS) {
          button.removeEventListener(eventName, stopInteractionPropagation);
        }
      }
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

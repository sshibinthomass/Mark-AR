import { describe, expect, it, vi } from 'vitest';
import {
  createYouTubeTransportControls,
  type YouTubeTransportPlayer,
} from '../src/ar/youtubeTransportControls';

function createPlayer(
  input: { currentTime?: number; duration?: number } = {},
): YouTubeTransportPlayer {
  return {
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    seekTo: vi.fn(),
    getCurrentTime: vi.fn(() => input.currentTime ?? 0),
    getDuration: vi.fn(() => input.duration ?? 120),
  };
}

describe('YouTube transport controls', () => {
  it('renders rewind, play, and forward buttons in accessible order', () => {
    const controls = createYouTubeTransportControls();
    const buttons = [...controls.element.querySelectorAll('button')];

    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Rewind 10 seconds',
      'Play video',
      'Forward 10 seconds',
    ]);
    expect(controls.element.hidden).toBe(true);
  });

  it('plays from a paused state and pauses from a playing state', () => {
    const controls = createYouTubeTransportControls();
    const player = createPlayer();
    controls.bindPlayer(player);
    const toggle = controls.element.querySelector<HTMLButtonElement>(
      '[data-youtube-action="toggle"]',
    )!;

    toggle.click();
    expect(player.playVideo).toHaveBeenCalledOnce();

    controls.setPlayerState(1);
    expect(toggle.textContent).toBe('Pause');
    expect(toggle.getAttribute('aria-label')).toBe('Pause video');
    toggle.click();
    expect(player.pauseVideo).toHaveBeenCalledOnce();

    controls.setPlayerState(2);
    expect(toggle.textContent).toBe('Play');
    expect(toggle.getAttribute('aria-label')).toBe('Play video');
  });

  it('retains the stable toggle label while buffering', () => {
    const controls = createYouTubeTransportControls();
    controls.bindPlayer(createPlayer());
    controls.setPlayerState(1);
    controls.setPlayerState(3);
    expect(controls.element.querySelector('[data-youtube-action="toggle"]')?.textContent)
      .toBe('Pause');
  });

  it.each([
    { currentTime: 42, duration: 120, action: 'rewind', expected: 32 },
    { currentTime: 4, duration: 120, action: 'rewind', expected: 0 },
    { currentTime: 42, duration: 120, action: 'forward', expected: 52 },
    { currentTime: 116, duration: 120, action: 'forward', expected: 120 },
    { currentTime: Number.NaN, duration: 120, action: 'forward', expected: 10 },
    { currentTime: 42, duration: Number.NaN, action: 'forward', expected: 52 },
  ])(
    'seeks $action safely from $currentTime with duration $duration',
    ({ currentTime, duration, action, expected }) => {
      const controls = createYouTubeTransportControls();
      const player = createPlayer({ currentTime, duration });
      controls.bindPlayer(player);

      controls.element.querySelector<HTMLButtonElement>(
        `[data-youtube-action="${action}"]`,
      )!.click();

      expect(player.seekTo).toHaveBeenCalledWith(expected, true);
    },
  );

  it('removes its DOM and disables commands when disposed', () => {
    const controls = createYouTubeTransportControls();
    const player = createPlayer();
    const parent = document.createElement('div');
    parent.append(controls.element);
    const playButton = controls.element.querySelector<HTMLButtonElement>(
      '[data-youtube-action="toggle"]',
    )!;
    controls.bindPlayer(player);

    controls.dispose();
    playButton.click();

    expect(parent.children).toHaveLength(0);
    expect(player.playVideo).not.toHaveBeenCalled();
  });

  it('keeps two active control bars bound to their own players', () => {
    const first = createYouTubeTransportControls();
    const second = createYouTubeTransportControls();
    const firstPlayer = createPlayer({ currentTime: 40 });
    const secondPlayer = createPlayer({ currentTime: 80 });
    first.bindPlayer(firstPlayer);
    second.bindPlayer(secondPlayer);

    first.element.querySelector<HTMLButtonElement>(
      '[data-youtube-action="rewind"]',
    )!.click();

    expect(firstPlayer.seekTo).toHaveBeenCalledWith(30, true);
    expect(secondPlayer.seekTo).not.toHaveBeenCalled();
  });
});

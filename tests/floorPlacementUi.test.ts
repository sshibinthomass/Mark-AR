import { describe, expect, it } from 'vitest';
import {
  applyFloorPlacementUi,
  type FloorPlacementUiState,
} from '../src/ui/floorPlacementUi';

const states: Array<{
  state: FloorPlacementUiState;
  message: string;
}> = [
  { state: { state: 'hidden' }, message: '' },
  {
    state: { state: 'preparing', message: 'Preparing floor placement...' },
    message: 'Preparing floor placement...',
  },
  {
    state: {
      state: 'unsupported',
      message: 'Floor placement needs Android Chrome with WebXR. Image scanning is still available.',
    },
    message: 'Floor placement needs Android Chrome with WebXR. Image scanning is still available.',
  },
  {
    state: { state: 'marker-ready', message: 'Floor placement is ready.' },
    message: 'Floor placement is ready.',
  },
  {
    state: { state: 'floor-scanning', message: 'Move your phone until the floor ring appears.' },
    message: 'Move your phone until the floor ring appears.',
  },
  {
    state: { state: 'floor-ready', message: 'Floor found. Tap Place.' },
    message: 'Floor found. Tap Place.',
  },
  {
    state: { state: 'floor-placed', message: 'Desk scene placed on the floor.' },
    message: 'Desk scene placed on the floor.',
  },
  {
    state: { state: 'floor-ended', message: 'Floor AR ended. Scan the image or place it again.' },
    message: 'Floor AR ended. Scan the image or place it again.',
  },
  {
    state: { state: 'floor-error', message: 'Floor scene failed to load: model unavailable' },
    message: 'Floor scene failed to load: model unavailable',
  },
];

describe('applyFloorPlacementUi', () => {
  it.each(states)('applies the $state.state state deterministically', ({ state, message }) => {
    const root = renderFloorUiFixture();
    const markerStage = required<HTMLElement>(root, '#ar-stage');
    const floorStage = required<HTMLElement>(root, '#floor-ar-stage');
    const floorOverlay = required<HTMLElement>(root, '#floor-ar-overlay');
    const markerStart = required<HTMLButtonElement>(root, '#start-ar');
    const toggle = required<HTMLButtonElement>(root, '#floor-ar-toggle');
    const back = required<HTMLButtonElement>(root, '#floor-ar-back');
    const place = required<HTMLButtonElement>(root, '#floor-ar-place');
    const reset = required<HTMLButtonElement>(root, '#floor-ar-reset');
    const restart = required<HTMLButtonElement>(root, '#floor-ar-restart');
    const rotation = required<HTMLInputElement>(root, '#floor-ar-rotation');
    const rotationControl = rotation.closest<HTMLLabelElement>('.floor-ar-rotation-control');
    const markerStatus = required<HTMLElement>(root, '#ar-status');
    const floorMessage = required<HTMLElement>(root, '#floor-ar-message');
    const floorStatus = required<HTMLElement>(root, '#floor-ar-status');
    const scannerControls = required<HTMLElement>(root, '.scanner-controls');

    applyFloorPlacementUi(root, state);

    const floorVisible = state.state.startsWith('floor-');
    const placed = state.state === 'floor-placed';
    const placeEnabled = state.state === 'floor-ready' || placed;
    const restartVisible = state.state === 'floor-ended' || state.state === 'floor-error';

    expect(markerStage.hidden).toBe(floorVisible);
    expect(markerStart.hidden).toBe(floorVisible);
    expect(floorStage.hidden).toBe(!floorVisible);
    expect(floorOverlay.hidden).toBe(!floorVisible);
    expect(back.hidden).toBe(!floorVisible);
    expect(back.disabled).toBe(!floorVisible);
    expect(back.textContent?.trim()).toBe('Back to image scan');
    expect(toggle.hidden).toBe(state.state === 'hidden' || floorVisible);
    expect(toggle.disabled).toBe(state.state === 'preparing' || state.state === 'unsupported');
    expect(toggle.textContent).toBe('Place on floor');
    expect(scannerControls.hidden).toBe(floorVisible);
    expect(place.hidden).toBe(!floorVisible);
    expect(place.disabled).toBe(!placeEnabled);
    expect(reset.hidden).toBe(!placed);
    expect(reset.disabled).toBe(!placed);
    expect(rotationControl?.hidden).toBe(!placed);
    expect(rotation.disabled).toBe(!placed);
    expect(restart.hidden).toBe(!restartVisible);
    expect(restart.disabled).toBe(!restartVisible);
    expect(floorMessage.textContent).toBe(floorVisible ? '' : message);
    expect(floorStatus.textContent).toBe(floorVisible ? message : '');
    expect(markerStatus.textContent).toBe('Camera waiting');
    expect(root.dataset.arMode).toBe(floorVisible ? 'floor' : 'marker');
    expect(root.getAttribute('aria-busy')).toBe(String(state.state === 'preparing'));
  });
});

function renderFloorUiFixture(): HTMLElement {
  const root = document.createElement('main');
  root.innerHTML = `
    <div class="scanner-panel">
      <div id="ar-stage"></div>
      <div id="floor-ar-stage" hidden></div>
      <div id="floor-ar-overlay" hidden>
        <button id="floor-ar-back" type="button" hidden>Back to image scan</button>
        <div id="floor-ar-gesture-surface"></div>
        <div class="floor-ar-controls">
          <p id="floor-ar-status" role="status">Preparing floor placement...</p>
          <button id="floor-ar-place" type="button" disabled>Place</button>
          <label class="floor-ar-rotation-control">
            <span>Rotate</span>
            <input id="floor-ar-rotation" type="range" min="-180" max="180" step="1" value="0">
          </label>
          <button id="floor-ar-reset" type="button">Reset</button>
          <button id="floor-ar-restart" type="button" hidden>Restart floor AR</button>
        </div>
      </div>
      <div class="scanner-controls" aria-live="polite">
        <div>
          <p id="ar-status">Camera waiting</p>
          <p id="floor-ar-message"></p>
        </div>
        <div class="scanner-actions">
          <button id="start-ar" type="button">Start AR</button>
          <button id="floor-ar-toggle" type="button" hidden>Place on floor</button>
        </div>
      </div>
    </div>
  `;
  return root;
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing fixture element: ${selector}`);
  return element;
}

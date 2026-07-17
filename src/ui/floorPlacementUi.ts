export type FloorPlacementUiState =
  | { state: 'hidden' }
  | { state: 'preparing'; message: string }
  | { state: 'unsupported'; message: string }
  | { state: 'marker-ready'; message: string }
  | { state: 'floor-scanning'; message: string }
  | { state: 'floor-ready'; message: string }
  | { state: 'floor-placed'; message: string }
  | { state: 'floor-ended'; message: string }
  | { state: 'floor-error'; message: string };

export function applyFloorPlacementUi(
  root: HTMLElement,
  state: FloorPlacementUiState,
): void {
  const markerStage = required<HTMLElement>(root, '#ar-stage');
  const floorStage = required<HTMLElement>(root, '#floor-ar-stage');
  const floorOverlay = required<HTMLElement>(root, '#floor-ar-overlay');
  const startMarkerButton = required<HTMLButtonElement>(root, '#start-ar');
  const toggle = required<HTMLButtonElement>(root, '#floor-ar-toggle');
  const back = required<HTMLButtonElement>(root, '#floor-ar-back');
  const place = required<HTMLButtonElement>(root, '#floor-ar-place');
  const reset = required<HTMLButtonElement>(root, '#floor-ar-reset');
  const restart = required<HTMLButtonElement>(root, '#floor-ar-restart');
  const rotation = required<HTMLInputElement>(root, '#floor-ar-rotation');
  const rotationControl = rotation.closest<HTMLLabelElement>('.floor-ar-rotation-control');
  const message = required<HTMLElement>(root, '#floor-ar-message');
  const floorStatus = required<HTMLElement>(root, '#floor-ar-status');
  const scannerControls = required<HTMLElement>(root, '.scanner-controls');

  if (!rotationControl) {
    throw new Error('Missing floor placement UI element: .floor-ar-rotation-control');
  }

  const floorVisible = state.state.startsWith('floor-');
  const floorPlaced = state.state === 'floor-placed';
  const placeEnabled = state.state === 'floor-ready' || floorPlaced;
  const restartVisible = state.state === 'floor-ended' || state.state === 'floor-error';
  const statusMessage = 'message' in state ? state.message : '';

  markerStage.hidden = floorVisible;
  startMarkerButton.hidden = floorVisible;
  floorStage.hidden = !floorVisible;
  floorOverlay.hidden = !floorVisible;

  back.hidden = !floorVisible;
  back.disabled = !floorVisible;
  toggle.hidden = state.state === 'hidden' || floorVisible;
  toggle.disabled = state.state === 'preparing' || state.state === 'unsupported';
  toggle.textContent = 'Place on floor';
  scannerControls.hidden = floorVisible;

  place.hidden = !floorVisible;
  place.disabled = !placeEnabled;
  reset.hidden = !floorPlaced;
  reset.disabled = !floorPlaced;
  rotationControl.hidden = !floorPlaced;
  rotation.disabled = !floorPlaced;
  restart.hidden = !restartVisible;
  restart.disabled = !restartVisible;

  message.textContent = floorVisible ? '' : statusMessage;
  floorStatus.textContent = floorVisible ? statusMessage : '';
  message.removeAttribute('data-tone');
  if (state.state === 'floor-error') {
    floorStatus.dataset.tone = 'error';
  } else {
    floorStatus.removeAttribute('data-tone');
  }
  root.dataset.arMode = floorVisible ? 'floor' : 'marker';
  root.setAttribute('aria-busy', String(state.state === 'preparing'));
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing floor placement UI element: ${selector}`);
  return element;
}

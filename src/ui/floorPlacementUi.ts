export type FloorPlacementUiState =
  | { state: 'hidden' }
  | { state: 'preparing'; message: string }
  | { state: 'unsupported'; message: string }
  | { state: 'marker-ready'; message: string }
  | { state: 'floor-scanning'; message: string }
  | { state: 'floor-ready'; message: string }
  | { state: 'floor-placed'; message: string }
  | { state: 'floor-playback-error'; message: string }
  | { state: 'floor-ended'; message: string }
  | { state: 'floor-error'; message: string };

export type FloorTransformSelectionUiState = {
  selectAll: boolean;
  active: boolean;
  label?: string;
};

export const DEFAULT_FLOOR_TRANSFORM_SELECTION_UI: FloorTransformSelectionUiState = {
  selectAll: true,
  active: false,
};

export function applyFloorPlacementUi(
  root: HTMLElement,
  state: FloorPlacementUiState,
  selection: FloorTransformSelectionUiState,
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
  const selectAll = required<HTMLButtonElement>(root, '#floor-ar-select-all');
  const selectionDone = required<HTMLButtonElement>(root, '#floor-ar-selection-done');
  const selectionHint = required<HTMLElement>(root, '#floor-ar-selection-hint');
  const message = required<HTMLElement>(root, '#floor-ar-message');
  const floorStatus = required<HTMLElement>(root, '#floor-ar-status');
  const scannerControls = required<HTMLElement>(root, '.scanner-controls');

  if (!rotationControl) {
    throw new Error('Missing floor placement UI element: .floor-ar-rotation-control');
  }

  const floorVisible = state.state.startsWith('floor-');
  const floorPlaced = state.state === 'floor-placed' || state.state === 'floor-playback-error';
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
  selectAll.hidden = !floorPlaced;
  selectAll.disabled = !floorPlaced;
  selectAll.setAttribute('aria-pressed', String(selection.selectAll));
  selectionDone.hidden = !floorPlaced || !selection.active;
  selectionDone.disabled = !floorPlaced || !selection.active;
  selectionHint.hidden = !floorPlaced;
  selectionHint.textContent = selection.active
    ? selection.label
      ? `${selection.label} selected. Drag to move or pinch to scale.`
      : 'Selected object. Drag to move or pinch to scale.'
    : 'Long press an object to move or scale it.';
  restart.hidden = !restartVisible;
  restart.disabled = !restartVisible;

  message.textContent = floorVisible ? '' : statusMessage;
  floorStatus.textContent = floorVisible ? statusMessage : '';
  message.removeAttribute('data-tone');
  if (state.state === 'floor-error' || state.state === 'floor-playback-error') {
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

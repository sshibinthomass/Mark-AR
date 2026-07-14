import {
  normalizeAnimation,
  type ImageTargetAnimation,
  type ImageTargetAnimationMotion,
  type ImageTargetAnimationProperty,
  type ImageTargetAnimationTrack,
} from '../app/imageTargetAnimation';

type AnimationTrackEditorOptions = {
  onChange: (animation: ImageTargetAnimation) => void;
};

export type AnimationTrackEditor = {
  render: (animation: ImageTargetAnimation) => void;
  addTrack: () => void;
  destroy: () => void;
};

const PROPERTY_OPTIONS: Array<{ value: ImageTargetAnimationProperty; label: string }> = [
  { value: 'positionX', label: 'Position X' },
  { value: 'positionY', label: 'Position Y' },
  { value: 'positionZ', label: 'Position Z' },
  { value: 'rotationX', label: 'Rotation X' },
  { value: 'rotationY', label: 'Rotation Y' },
  { value: 'rotationZ', label: 'Rotation Z' },
  { value: 'scale', label: 'Overall scale' },
];

const DEFAULT_TRACK: ImageTargetAnimationTrack = {
  property: 'positionY',
  motion: 'smooth',
  amount: 0.12,
  speed: 0.5,
  phase: 0,
};

export function createAnimationTrackEditor(
  container: HTMLElement,
  { onChange }: AnimationTrackEditorOptions,
): AnimationTrackEditor {
  let state = normalizeAnimation();

  const emitCustomState = (): void => {
    state = normalizeAnimation({ preset: 'custom', tracks: state.tracks });
    onChange(cloneAnimation(state));
  };

  const render = (animation: ImageTargetAnimation): void => {
    state = normalizeAnimation(animation);
    container.replaceChildren();
    if (state.tracks.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'animation-track-empty';
      empty.textContent = 'No motion yet. Choose a preset or add a motion track.';
      container.append(empty);
      return;
    }
    state.tracks.forEach((track, index) => container.append(createTrackCard(track, index)));
  };

  const handleInput = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.animationField) {
      return;
    }
    const index = trackIndexFromElement(input);
    const track = state.tracks[index];
    if (!track) {
      return;
    }
    const field = input.dataset.animationField as 'amount' | 'speed' | 'phase';
    track[field] = Number(input.value);
    emitCustomState();
    const output = input.closest('label')?.querySelector<HTMLOutputElement>(`[data-animation-value="${field}"]`);
    if (output) {
      output.textContent = formatTrackValue(field, track);
    }
  };

  const handleChange = (event: Event): void => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || !select.dataset.animationField) {
      return;
    }
    const index = trackIndexFromElement(select);
    const track = state.tracks[index];
    if (!track) {
      return;
    }
    if (select.dataset.animationField === 'property') {
      track.property = select.value as ImageTargetAnimationProperty;
      if (!track.property.startsWith('rotation') && track.motion === 'spin') {
        track.motion = 'smooth';
      }
      emitCustomState();
      render(state);
      return;
    }
    if (select.dataset.animationField === 'motion') {
      track.motion = select.value as ImageTargetAnimationMotion;
      emitCustomState();
    }
  };

  const handleClick = (event: Event): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-remove-animation-track]');
    if (!button) {
      return;
    }
    const index = trackIndexFromElement(button);
    state.tracks.splice(index, 1);
    emitCustomState();
    render(state);
  };

  container.addEventListener('input', handleInput);
  container.addEventListener('change', handleChange);
  container.addEventListener('click', handleClick);

  return {
    render,
    addTrack: () => {
      state = normalizeAnimation({ preset: 'custom', tracks: [...state.tracks, { ...DEFAULT_TRACK }] });
      emitCustomState();
      render(state);
    },
    destroy: () => {
      container.removeEventListener('input', handleInput);
      container.removeEventListener('change', handleChange);
      container.removeEventListener('click', handleClick);
      container.replaceChildren();
    },
  };
}

function createTrackCard(track: ImageTargetAnimationTrack, index: number): HTMLElement {
  const card = document.createElement('section');
  card.className = 'animation-track-card';
  card.dataset.animationTrack = String(index);

  const header = document.createElement('div');
  header.className = 'animation-track-header';
  const title = document.createElement('strong');
  title.textContent = `Motion ${index + 1}`;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'animation-track-remove';
  remove.dataset.removeAnimationTrack = '';
  remove.textContent = 'Remove';
  remove.setAttribute('aria-label', `Remove motion ${index + 1}`);
  header.append(title, remove);

  const grid = document.createElement('div');
  grid.className = 'animation-track-grid';
  grid.append(
    selectField('Property', 'property', PROPERTY_OPTIONS, track.property, index),
    selectField('Motion', 'motion', motionOptions(track.property), track.motion, index),
    rangeField('Amount', 'amount', amountBounds(track.property), track, index),
    rangeField('Speed', 'speed', { min: -4, max: 4, step: 0.05 }, track, index),
    rangeField('Phase', 'phase', { min: 0, max: 359, step: 1 }, track, index),
  );
  card.append(header, grid);
  return card;
}

function selectField<T extends string>(
  labelText: string,
  field: 'property' | 'motion',
  options: Array<{ value: T; label: string }>,
  value: T,
  index: number,
): HTMLLabelElement {
  const label = document.createElement('label');
  const text = document.createElement('span');
  text.textContent = labelText;
  const select = document.createElement('select');
  select.id = `animation-track-${index}-${field}`;
  select.dataset.animationField = field;
  options.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    select.append(option);
  });
  select.value = value;
  label.htmlFor = select.id;
  label.append(text, select);
  return label;
}

function rangeField(
  labelText: string,
  field: 'amount' | 'speed' | 'phase',
  bounds: { min: number; max: number; step: number },
  track: ImageTargetAnimationTrack,
  index: number,
): HTMLLabelElement {
  const label = document.createElement('label');
  const heading = document.createElement('span');
  heading.className = 'animation-track-label';
  const text = document.createElement('span');
  text.textContent = labelText;
  const output = document.createElement('output');
  output.dataset.animationValue = field;
  output.textContent = formatTrackValue(field, track);
  heading.append(text, output);

  const input = document.createElement('input');
  input.id = `animation-track-${index}-${field}`;
  input.type = 'range';
  input.min = String(bounds.min);
  input.max = String(bounds.max);
  input.step = String(bounds.step);
  input.value = String(track[field]);
  input.dataset.animationField = field;
  label.htmlFor = input.id;
  label.append(heading, input);
  return label;
}

function motionOptions(property: ImageTargetAnimationProperty): Array<{ value: ImageTargetAnimationMotion; label: string }> {
  const options: Array<{ value: ImageTargetAnimationMotion; label: string }> = [
    { value: 'smooth', label: 'Smooth' },
    { value: 'triangle', label: 'Triangle' },
  ];
  if (property.startsWith('rotation')) {
    options.push({ value: 'spin', label: 'Spin' });
  }
  return options;
}

function amountBounds(property: ImageTargetAnimationProperty): { min: number; max: number; step: number } {
  if (property.startsWith('position')) {
    return { min: -2, max: 2, step: 0.01 };
  }
  if (property.startsWith('rotation')) {
    return { min: -720, max: 720, step: 1 };
  }
  return { min: -0.9, max: 3, step: 0.01 };
}

function formatTrackValue(field: 'amount' | 'speed' | 'phase', track: ImageTargetAnimationTrack): string {
  const value = formatNumber(track[field]);
  if (field === 'speed') {
    return `${value} cycles/s`;
  }
  if (field === 'phase') {
    return `${value}°`;
  }
  if (track.property.startsWith('rotation')) {
    return `${value}°`;
  }
  if (track.property === 'scale') {
    return `${value}×`;
  }
  return `${value} units`;
}

function formatNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function trackIndexFromElement(element: Element): number {
  return Number(element.closest<HTMLElement>('[data-animation-track]')?.dataset.animationTrack ?? -1);
}

function cloneAnimation(animation: ImageTargetAnimation): ImageTargetAnimation {
  return { preset: animation.preset, tracks: animation.tracks.map((track) => ({ ...track })) };
}

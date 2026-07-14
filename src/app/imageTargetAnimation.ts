export type ImageTargetAnimationPreset =
  | 'none'
  | 'gentle-float'
  | 'turntable'
  | 'showcase'
  | 'sway'
  | 'pulse'
  | 'orbit'
  | 'bounce'
  | 'custom';

export type ImageTargetAnimationProperty =
  | 'positionX'
  | 'positionY'
  | 'positionZ'
  | 'rotationX'
  | 'rotationY'
  | 'rotationZ'
  | 'scale';

export type ImageTargetAnimationMotion = 'smooth' | 'triangle' | 'spin';

export type ImageTargetAnimationTrack = {
  property: ImageTargetAnimationProperty;
  motion: ImageTargetAnimationMotion;
  amount: number;
  speed: number;
  phase: number;
};

export type ImageTargetAnimation = {
  preset: ImageTargetAnimationPreset;
  tracks: ImageTargetAnimationTrack[];
};

export type ImageTargetAnimationFrame = {
  position: { x: number; y: number; z: number };
  rotationRadians: { x: number; y: number; z: number };
  scaleMultiplier: number;
};

type LegacyImageTargetAnimation = {
  spinAxis?: 'none' | 'x' | 'y' | 'z';
  spinSpeed?: number;
  bobHeight?: number;
  bobSpeed?: number;
};

type ImageTargetAnimationInput = Partial<ImageTargetAnimation> & LegacyImageTargetAnimation;

const PRESET_TRACKS: Record<Exclude<ImageTargetAnimationPreset, 'custom'>, readonly ImageTargetAnimationTrack[]> = {
  none: [],
  'gentle-float': [
    { property: 'positionY', motion: 'smooth', amount: 0.12, speed: 0.5, phase: 0 },
  ],
  turntable: [
    { property: 'rotationY', motion: 'spin', amount: 360, speed: 0.15, phase: 0 },
  ],
  showcase: [
    { property: 'rotationY', motion: 'spin', amount: 360, speed: 0.12, phase: 0 },
    { property: 'positionY', motion: 'smooth', amount: 0.08, speed: 0.5, phase: 0 },
  ],
  sway: [
    { property: 'rotationZ', motion: 'smooth', amount: 12, speed: 0.5, phase: 0 },
  ],
  pulse: [
    { property: 'scale', motion: 'smooth', amount: 0.12, speed: 0.75, phase: 0 },
  ],
  orbit: [
    { property: 'positionX', motion: 'smooth', amount: 0.18, speed: 0.3, phase: 0 },
    { property: 'positionZ', motion: 'smooth', amount: 0.18, speed: 0.3, phase: 90 },
  ],
  bounce: [
    { property: 'positionY', motion: 'triangle', amount: 0.18, speed: 0.65, phase: 0 },
  ],
};

export const DEFAULT_IMAGE_TARGET_ANIMATION: ImageTargetAnimation = {
  preset: 'none',
  tracks: [],
};

export function animationForPreset(preset: ImageTargetAnimationPreset): ImageTargetAnimation {
  if (preset === 'custom') {
    return { preset, tracks: [] };
  }
  return { preset, tracks: PRESET_TRACKS[preset].map(cloneTrack) };
}

export function normalizeAnimation(value: ImageTargetAnimationInput = {}): ImageTargetAnimation {
  if (!Array.isArray(value.tracks)) {
    const legacyTracks = legacyAnimationTracks(value);
    if (legacyTracks.length > 0) {
      return { preset: 'custom', tracks: legacyTracks };
    }
    if (isNamedPreset(value.preset)) {
      return animationForPreset(value.preset);
    }
    return animationForPreset('none');
  }

  const tracks = value.tracks
    .map(normalizeTrack)
    .filter((track): track is ImageTargetAnimationTrack => Boolean(track))
    .slice(0, 16);
  const preset = isAnimationPreset(value.preset) ? value.preset : tracks.length > 0 ? 'custom' : 'none';
  return { preset, tracks };
}

export function evaluateAnimationFrame(
  animation: ImageTargetAnimationInput,
  elapsedSeconds: number,
): ImageTargetAnimationFrame {
  const normalized = normalizeAnimation(animation);
  const frame: ImageTargetAnimationFrame = {
    position: { x: 0, y: 0, z: 0 },
    rotationRadians: { x: 0, y: 0, z: 0 },
    scaleMultiplier: 1,
  };

  for (const track of normalized.tracks) {
    const phaseRadians = degreesToRadians(track.phase);
    const value = track.motion === 'spin'
      ? degreesToRadians(track.amount * track.speed * elapsedSeconds + track.phase)
      : track.amount * waveValue(track.motion, track.speed, elapsedSeconds, phaseRadians);

    switch (track.property) {
      case 'positionX':
        frame.position.x += value;
        break;
      case 'positionY':
        frame.position.y += value;
        break;
      case 'positionZ':
        frame.position.z += value;
        break;
      case 'rotationX':
        frame.rotationRadians.x += track.motion === 'spin' ? value : degreesToRadians(value);
        break;
      case 'rotationY':
        frame.rotationRadians.y += track.motion === 'spin' ? value : degreesToRadians(value);
        break;
      case 'rotationZ':
        frame.rotationRadians.z += track.motion === 'spin' ? value : degreesToRadians(value);
        break;
      case 'scale':
        frame.scaleMultiplier += value;
        break;
    }
  }

  frame.scaleMultiplier = Math.max(0.05, frame.scaleMultiplier);
  return frame;
}

function legacyAnimationTracks(value: LegacyImageTargetAnimation): ImageTargetAnimationTrack[] {
  const tracks: ImageTargetAnimationTrack[] = [];
  const spinSpeed = finiteNumber(value.spinSpeed, 0);
  if (value.spinAxis && value.spinAxis !== 'none' && spinSpeed !== 0) {
    const axis = value.spinAxis.toUpperCase() as 'X' | 'Y' | 'Z';
    tracks.push({
      property: `rotation${axis}`,
      motion: 'spin',
      amount: 360,
      speed: spinSpeed / (2 * Math.PI),
      phase: 0,
    });
  }

  const bobHeight = finiteNumber(value.bobHeight, 0);
  const bobSpeed = finiteNumber(value.bobSpeed, 0);
  if (bobHeight !== 0 && bobSpeed !== 0) {
    tracks.push({
      property: 'positionY',
      motion: 'smooth',
      amount: clamp(bobHeight, -2, 2),
      speed: clamp(bobSpeed / (2 * Math.PI), -4, 4),
      phase: 0,
    });
  }
  return tracks;
}

function normalizeTrack(value: unknown): ImageTargetAnimationTrack | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as Partial<ImageTargetAnimationTrack>;
  if (!isAnimationProperty(candidate.property)) {
    return undefined;
  }
  const motion = isAnimationMotion(candidate.motion) ? candidate.motion : 'smooth';
  return {
    property: candidate.property,
    motion: motion === 'spin' && !candidate.property.startsWith('rotation') ? 'smooth' : motion,
    amount: normalizeAmount(candidate.property, candidate.amount),
    speed: clamp(finiteNumber(candidate.speed, 0), -4, 4),
    phase: normalizePhase(candidate.phase),
  };
}

function normalizeAmount(property: ImageTargetAnimationProperty, value: unknown): number {
  const amount = finiteNumber(value, 0);
  if (property.startsWith('position')) {
    return clamp(amount, -2, 2);
  }
  if (property.startsWith('rotation')) {
    return clamp(amount, -720, 720);
  }
  return clamp(amount, -0.9, 3);
}

function normalizePhase(value: unknown): number {
  const phase = finiteNumber(value, 0) % 360;
  return phase < 0 ? phase + 360 : phase;
}

function waveValue(
  motion: Exclude<ImageTargetAnimationMotion, 'spin'>,
  speed: number,
  elapsedSeconds: number,
  phaseRadians: number,
): number {
  const angle = 2 * Math.PI * speed * elapsedSeconds + phaseRadians;
  return motion === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(angle)) : Math.sin(angle);
}

function cloneTrack(track: ImageTargetAnimationTrack): ImageTargetAnimationTrack {
  return { ...track };
}

function isNamedPreset(value: unknown): value is Exclude<ImageTargetAnimationPreset, 'custom'> {
  return value === 'none' || value === 'gentle-float' || value === 'turntable'
    || value === 'showcase' || value === 'sway' || value === 'pulse'
    || value === 'orbit' || value === 'bounce';
}

function isAnimationPreset(value: unknown): value is ImageTargetAnimationPreset {
  return value === 'custom' || isNamedPreset(value);
}

function isAnimationProperty(value: unknown): value is ImageTargetAnimationProperty {
  return value === 'positionX' || value === 'positionY' || value === 'positionZ'
    || value === 'rotationX' || value === 'rotationY' || value === 'rotationZ'
    || value === 'scale';
}

function isAnimationMotion(value: unknown): value is ImageTargetAnimationMotion {
  return value === 'smooth' || value === 'triangle' || value === 'spin';
}

function finiteNumber(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

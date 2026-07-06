export type ImageTargetSpinAxis = 'none' | 'x' | 'y' | 'z';

export type ImageTargetAnimation = {
  spinAxis: ImageTargetSpinAxis;
  spinSpeed: number;
  bobHeight: number;
  bobSpeed: number;
};

export const DEFAULT_IMAGE_TARGET_ANIMATION: ImageTargetAnimation = {
  spinAxis: 'y',
  spinSpeed: 0,
  bobHeight: 0,
  bobSpeed: 0,
};

export function normalizeAnimation(value: Partial<ImageTargetAnimation> = {}): ImageTargetAnimation {
  return {
    spinAxis: normalizeSpinAxis(value.spinAxis),
    spinSpeed: clampNumber(value.spinSpeed, -6, 6, DEFAULT_IMAGE_TARGET_ANIMATION.spinSpeed),
    bobHeight: clampNumber(value.bobHeight, 0, 1, DEFAULT_IMAGE_TARGET_ANIMATION.bobHeight),
    bobSpeed: clampNumber(value.bobSpeed, 0, 8, DEFAULT_IMAGE_TARGET_ANIMATION.bobSpeed),
  };
}

function normalizeSpinAxis(value: unknown): ImageTargetSpinAxis {
  return value === 'none' || value === 'x' || value === 'y' || value === 'z'
    ? value
    : DEFAULT_IMAGE_TARGET_ANIMATION.spinAxis;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numberValue));
}

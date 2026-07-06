import { describe, expect, it } from 'vitest';
import { DEFAULT_IMAGE_TARGET_ANIMATION, normalizeAnimation } from '../src/app/imageTargetAnimation';

describe('image target animation helpers', () => {
  it('keeps animation off by default while defaulting the spin axis to Y', () => {
    expect(DEFAULT_IMAGE_TARGET_ANIMATION).toEqual({
      spinAxis: 'y',
      spinSpeed: 0,
      bobHeight: 0,
      bobSpeed: 0,
    });
    expect(normalizeAnimation()).toEqual(DEFAULT_IMAGE_TARGET_ANIMATION);
    expect(normalizeAnimation({ spinAxis: 'sideways' as never })).toEqual(DEFAULT_IMAGE_TARGET_ANIMATION);
  });
});

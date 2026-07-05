import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMAGE_TARGET_PLACEMENT,
  imageTargetDataUrl,
  normalizePlacement,
  validateTargetImagePayload,
} from '../src/app/imageTargetPayload';

describe('image target payload helpers', () => {
  it('normalizes placement values with safe defaults and bounds', () => {
    expect(normalizePlacement()).toEqual(DEFAULT_IMAGE_TARGET_PLACEMENT);
    expect(normalizePlacement({ scale: 99, offsetX: -5, offsetY: 5, height: -1 })).toEqual({
      scale: 5,
      offsetX: -1,
      offsetY: 1,
      height: 0,
    });
  });

  it('validates supported target images and creates data URLs', () => {
    expect(validateTargetImagePayload({ imageBase64: 'abc', imageMimeType: 'image/jpeg' })).toEqual(null);
    expect(imageTargetDataUrl({ imageBase64: 'abc', imageMimeType: 'image/jpeg' })).toBe('data:image/jpeg;base64,abc');
    expect(validateTargetImagePayload({ imageBase64: '', imageMimeType: 'image/jpeg' })).toBe('Choose a target image.');
    expect(validateTargetImagePayload({ imageBase64: 'abc', imageMimeType: 'image/gif' })).toBe(
      'Target image must be PNG, JPEG, or WebP.',
    );
  });

  it('rejects target images larger than 5 MB after base64 decoding', () => {
    const oversizedBase64 = 'A'.repeat(6_990_508);

    expect(validateTargetImagePayload({ imageBase64: oversizedBase64, imageMimeType: 'image/jpeg' })).toBe(
      'Target image must be 5 MB or smaller.',
    );
  });
});

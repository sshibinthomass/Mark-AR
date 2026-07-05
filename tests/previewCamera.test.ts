import { describe, expect, it } from 'vitest';
import { cameraViewForPreset, DEFAULT_PREVIEW_CAMERA_VIEW, isCameraPreset } from '../src/scene/previewCamera';

describe('preview camera presets', () => {
  it('maps camera gizmo presets to deterministic preview camera views', () => {
    expect(cameraViewForPreset('home')).toEqual(DEFAULT_PREVIEW_CAMERA_VIEW);
    expect(cameraViewForPreset('front')).toMatchObject({
      distance: DEFAULT_PREVIEW_CAMERA_VIEW.distance,
      yawDegrees: 0,
    });
    expect(cameraViewForPreset('right')).toMatchObject({
      distance: DEFAULT_PREVIEW_CAMERA_VIEW.distance,
      yawDegrees: 90,
    });

    const top = cameraViewForPreset('top');

    expect(top.height).toBeGreaterThan(DEFAULT_PREVIEW_CAMERA_VIEW.height);
    expect(top.distance).toBeLessThan(DEFAULT_PREVIEW_CAMERA_VIEW.distance);
  });

  it('recognizes supported camera preset ids from DOM buttons', () => {
    expect(isCameraPreset('top')).toBe(true);
    expect(isCameraPreset('front')).toBe(true);
    expect(isCameraPreset('right')).toBe(true);
    expect(isCameraPreset('home')).toBe(true);
    expect(isCameraPreset('sideways')).toBe(false);
  });
});

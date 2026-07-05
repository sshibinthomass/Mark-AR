import { describe, expect, it } from 'vitest';
import {
  cameraViewForDrag,
  cameraViewForPreset,
  DEFAULT_PREVIEW_CAMERA_VIEW,
  isCameraPreset,
} from '../src/scene/previewCamera';

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

  it('orbits and raises the camera from gizmo drag movement', () => {
    expect(cameraViewForDrag(DEFAULT_PREVIEW_CAMERA_VIEW, { deltaX: 100, deltaY: -40 })).toMatchObject({
      distance: DEFAULT_PREVIEW_CAMERA_VIEW.distance,
      yawDegrees: 45,
      height: 1.5,
      targetHeight: DEFAULT_PREVIEW_CAMERA_VIEW.targetHeight,
    });
  });

  it('keeps dragged camera values inside preview slider limits', () => {
    expect(cameraViewForDrag(DEFAULT_PREVIEW_CAMERA_VIEW, { deltaX: 800, deltaY: -800 })).toMatchObject({
      yawDegrees: 0,
      height: 3,
    });
    expect(cameraViewForDrag(DEFAULT_PREVIEW_CAMERA_VIEW, { deltaX: -500, deltaY: 300 })).toMatchObject({
      yawDegrees: 135,
      height: 0.1,
    });
  });
});

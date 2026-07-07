import { describe, expect, it } from 'vitest';
import {
  cameraViewForNudge,
  cameraViewForPan,
  cameraViewForPinchZoom,
  cameraViewForDrag,
  cameraViewForPreset,
  cameraViewForZoom,
  DEFAULT_PREVIEW_CAMERA_VIEW,
  isCameraNudgeDirection,
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

  it('nudges the visible preview one step for every arrow click', () => {
    const once = cameraViewForNudge(DEFAULT_PREVIEW_CAMERA_VIEW, 'left');
    const twice = cameraViewForNudge(once, 'left');
    const up = cameraViewForNudge(DEFAULT_PREVIEW_CAMERA_VIEW, 'up');
    const down = cameraViewForNudge(up, 'down');

    expect(once.targetX).toBeGreaterThan(DEFAULT_PREVIEW_CAMERA_VIEW.targetX);
    expect(twice.targetX).toBeGreaterThan(once.targetX);
    expect(up.targetHeight).toBeLessThan(DEFAULT_PREVIEW_CAMERA_VIEW.targetHeight);
    expect(down.targetHeight).toBe(DEFAULT_PREVIEW_CAMERA_VIEW.targetHeight);
    expect(isCameraNudgeDirection('right')).toBe(true);
    expect(isCameraNudgeDirection('top')).toBe(false);
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

  it('pans the preview target like a Blender viewport drag', () => {
    expect(
      cameraViewForPan(DEFAULT_PREVIEW_CAMERA_VIEW, {
        deltaX: 100,
        deltaY: -50,
        viewportWidth: 500,
        viewportHeight: 500,
      }),
    ).toMatchObject({
      targetX: -0.42,
      targetHeight: -0.21,
      targetZ: 0,
    });
  });

  it('zooms the camera with wheel and pinch directions used by viewport navigation', () => {
    expect(cameraViewForZoom(DEFAULT_PREVIEW_CAMERA_VIEW, { deltaY: -240 }).distance).toBeLessThan(
      DEFAULT_PREVIEW_CAMERA_VIEW.distance,
    );
    expect(cameraViewForZoom(DEFAULT_PREVIEW_CAMERA_VIEW, { deltaY: 4000 }).distance).toBe(5);
    expect(
      cameraViewForPinchZoom(DEFAULT_PREVIEW_CAMERA_VIEW, {
        startDistance: 100,
        currentDistance: 200,
      }).distance,
    ).toBeCloseTo(1.05);
  });
});

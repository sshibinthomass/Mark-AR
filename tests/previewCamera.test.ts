import { describe, expect, it } from 'vitest';
import {
  cameraViewForArrowOrbit,
  cameraViewForPan,
  cameraViewForPinchZoom,
  cameraViewForDrag,
  cameraViewForPreset,
  cameraViewForZoom,
  DEFAULT_PREVIEW_CAMERA_VIEW,
  isCameraArrowDirection,
  isCameraPreset,
} from '../src/scene/previewCamera';

describe('preview camera presets', () => {
  it('maps camera gizmo presets to deterministic preview camera views', () => {
    expect(cameraViewForPreset('reset')).toEqual(DEFAULT_PREVIEW_CAMERA_VIEW);
    expect(cameraViewForPreset('home')).toEqual(DEFAULT_PREVIEW_CAMERA_VIEW);
    expect(cameraViewForPreset('front')).toMatchObject({
      distance: DEFAULT_PREVIEW_CAMERA_VIEW.distance,
      yawDegrees: 0,
    });
    expect(cameraViewForPreset('left')).toMatchObject({
      distance: DEFAULT_PREVIEW_CAMERA_VIEW.distance,
      yawDegrees: -90,
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
    expect(isCameraPreset('reset')).toBe(true);
    expect(isCameraPreset('top')).toBe(true);
    expect(isCameraPreset('front')).toBe(true);
    expect(isCameraPreset('left')).toBe(true);
    expect(isCameraPreset('right')).toBe(true);
    expect(isCameraPreset('home')).toBe(true);
    expect(isCameraPreset('bottom')).toBe(false);
    expect(isCameraPreset('sideways')).toBe(false);
  });

  it('uses left and right arrows for 90-degree horizontal orbit only', () => {
    const startView = {
      ...DEFAULT_PREVIEW_CAMERA_VIEW,
      yawDegrees: 46,
      height: 1.4,
      targetHeight: 0.2,
    };
    const right = cameraViewForArrowOrbit(startView, 'right');
    const left = cameraViewForArrowOrbit(startView, 'left');

    expect([right, left].map((view) => yawAsCompassDegrees(view.yawDegrees))).toEqual([
      180,
      0,
    ]);
    expect([right, left].every((view) => view.height === startView.height)).toBe(true);
    expect(left.targetX).toBe(startView.targetX);
    expect(isCameraArrowDirection('right')).toBe(true);
    expect(isCameraArrowDirection('top')).toBe(false);
  });

  it('uses up and down arrows for 90-degree vertical orbit without changing yaw', () => {
    const startView = {
      ...DEFAULT_PREVIEW_CAMERA_VIEW,
      yawDegrees: 46,
      height: 1.4,
      targetHeight: 0.2,
    };
    const up = cameraViewForArrowOrbit(startView, 'up');
    const down = cameraViewForArrowOrbit(startView, 'down');

    expect(up.yawDegrees).toBe(startView.yawDegrees);
    expect(down.yawDegrees).toBe(startView.yawDegrees);
    expect(up.height).toBeGreaterThan(startView.height);
    expect(down.height).toBeLessThan(startView.height);
    expect(up.distance).toBeLessThan(startView.distance);
    expect(down.distance).toBeLessThan(startView.distance);
    expect(up.targetHeight).toBe(startView.targetHeight);
    expect(down.targetHeight).toBe(startView.targetHeight);
  });

  it('keeps stepping to the next cardinal angle when an arrow is pressed repeatedly', () => {
    const firstLeft = cameraViewForArrowOrbit(DEFAULT_PREVIEW_CAMERA_VIEW, 'left');
    const secondLeft = cameraViewForArrowOrbit(firstLeft, 'left');
    const thirdLeft = cameraViewForArrowOrbit(secondLeft, 'left');
    const fourthLeft = cameraViewForArrowOrbit(thirdLeft, 'left');
    const firstRight = cameraViewForArrowOrbit(DEFAULT_PREVIEW_CAMERA_VIEW, 'right');
    const secondRight = cameraViewForArrowOrbit(firstRight, 'right');
    const thirdRight = cameraViewForArrowOrbit(secondRight, 'right');
    const fourthRight = cameraViewForArrowOrbit(thirdRight, 'right');

    expect([firstLeft, secondLeft, thirdLeft, fourthLeft].map((view) => yawAsCompassDegrees(view.yawDegrees))).toEqual([
      270,
      180,
      90,
      0,
    ]);
    expect([firstRight, secondRight, thirdRight, fourthRight].map((view) => yawAsCompassDegrees(view.yawDegrees))).toEqual([
      90,
      180,
      270,
      0,
    ]);
    expect([firstLeft, secondLeft, thirdLeft, fourthLeft].every((view) => view.height === DEFAULT_PREVIEW_CAMERA_VIEW.height)).toBe(true);
  });

  it('keeps vertical arrow clicks on the same horizontal angle', () => {
    const firstUp = cameraViewForArrowOrbit(DEFAULT_PREVIEW_CAMERA_VIEW, 'up');
    const secondUp = cameraViewForArrowOrbit(firstUp, 'up');
    const firstDown = cameraViewForArrowOrbit(DEFAULT_PREVIEW_CAMERA_VIEW, 'down');
    const secondDown = cameraViewForArrowOrbit(firstDown, 'down');

    expect([firstUp, secondUp, firstDown, secondDown].map((view) => yawAsCompassDegrees(view.yawDegrees))).toEqual([
      0,
      0,
      0,
      0,
    ]);
    expect(secondUp.height).toBeGreaterThanOrEqual(firstUp.height);
    expect(secondDown.height).toBeLessThanOrEqual(firstDown.height);
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

function yawAsCompassDegrees(yawDegrees: number): number {
  return ((yawDegrees % 360) + 360) % 360;
}

export type PreviewCameraView = {
  distance: number;
  height: number;
  yawDegrees: number;
  targetX: number;
  targetHeight: number;
  targetZ: number;
};

export const DEFAULT_PREVIEW_CAMERA_VIEW: PreviewCameraView = {
  distance: 2.1,
  height: 1.1,
  yawDegrees: 0,
  targetX: 0,
  targetHeight: 0,
  targetZ: 0,
};

const CAMERA_DISTANCE_MIN = 0.8;
const CAMERA_DISTANCE_MAX = 5;
const CAMERA_HEIGHT_MIN = 0.1;
const CAMERA_HEIGHT_MAX = 3;
const CAMERA_TARGET_MIN = -2;
const CAMERA_TARGET_MAX = 2;
const CAMERA_DRAG_YAW_DEGREES_PER_PIXEL = 0.45;
const CAMERA_DRAG_HEIGHT_PER_PIXEL = 0.01;
const CAMERA_WHEEL_ZOOM_PER_DELTA = 0.0015;
const CAMERA_NUDGE_STEP = 0.12;
const CAMERA_PRESETS = ['top', 'front', 'right', 'home'] as const;
const CAMERA_NUDGE_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

export type CameraPreset = (typeof CAMERA_PRESETS)[number];
export type CameraNudgeDirection = (typeof CAMERA_NUDGE_DIRECTIONS)[number];

export function isCameraPreset(value: string | undefined): value is CameraPreset {
  return CAMERA_PRESETS.includes(value as CameraPreset);
}

export function isCameraNudgeDirection(value: string | undefined): value is CameraNudgeDirection {
  return CAMERA_NUDGE_DIRECTIONS.includes(value as CameraNudgeDirection);
}

export function cameraViewForPreset(preset: CameraPreset): PreviewCameraView {
  switch (preset) {
    case 'top':
      return {
        distance: 0.9,
        height: 3,
        yawDegrees: 0,
        targetX: 0,
        targetHeight: 0,
        targetZ: 0,
      };
    case 'right':
      return {
        ...DEFAULT_PREVIEW_CAMERA_VIEW,
        yawDegrees: 90,
      };
    case 'front':
      return {
        ...DEFAULT_PREVIEW_CAMERA_VIEW,
        yawDegrees: 0,
      };
    case 'home':
      return { ...DEFAULT_PREVIEW_CAMERA_VIEW };
  }
}

export function cameraViewForNudge(
  startView: PreviewCameraView,
  direction: CameraNudgeDirection,
): PreviewCameraView {
  switch (direction) {
    case 'up':
      return {
        ...startView,
        targetHeight: clamp(startView.targetHeight - CAMERA_NUDGE_STEP, CAMERA_TARGET_MIN, CAMERA_TARGET_MAX),
      };
    case 'down':
      return {
        ...startView,
        targetHeight: clamp(startView.targetHeight + CAMERA_NUDGE_STEP, CAMERA_TARGET_MIN, CAMERA_TARGET_MAX),
      };
    case 'left':
      return {
        ...startView,
        targetX: clamp(startView.targetX + CAMERA_NUDGE_STEP, CAMERA_TARGET_MIN, CAMERA_TARGET_MAX),
      };
    case 'right':
      return {
        ...startView,
        targetX: clamp(startView.targetX - CAMERA_NUDGE_STEP, CAMERA_TARGET_MIN, CAMERA_TARGET_MAX),
      };
  }
}

export function cameraViewForDrag(
  startView: PreviewCameraView,
  movement: { deltaX: number; deltaY: number },
): PreviewCameraView {
  return cameraViewForOrbit(startView, movement);
}

export function cameraViewForOrbit(
  startView: PreviewCameraView,
  movement: { deltaX: number; deltaY: number },
): PreviewCameraView {
  return {
    ...startView,
    yawDegrees: normalizeYaw(startView.yawDegrees + movement.deltaX * CAMERA_DRAG_YAW_DEGREES_PER_PIXEL),
    height: clamp(
      startView.height - movement.deltaY * CAMERA_DRAG_HEIGHT_PER_PIXEL,
      CAMERA_HEIGHT_MIN,
      CAMERA_HEIGHT_MAX,
    ),
  };
}

export function cameraViewForPan(
  startView: PreviewCameraView,
  movement: { deltaX: number; deltaY: number; viewportWidth: number; viewportHeight: number },
): PreviewCameraView {
  const viewportSize = Math.max(1, Math.min(movement.viewportWidth, movement.viewportHeight));
  const panScale = startView.distance / viewportSize;
  const yawRadians = (startView.yawDegrees * Math.PI) / 180;
  const rightX = Math.cos(yawRadians);
  const rightZ = -Math.sin(yawRadians);
  const horizontalPan = -movement.deltaX * panScale;

  return {
    ...startView,
    targetX: clamp(startView.targetX + horizontalPan * rightX, CAMERA_TARGET_MIN, CAMERA_TARGET_MAX),
    targetHeight: clamp(startView.targetHeight + movement.deltaY * panScale, CAMERA_TARGET_MIN, CAMERA_TARGET_MAX),
    targetZ: clamp(startView.targetZ + horizontalPan * rightZ, CAMERA_TARGET_MIN, CAMERA_TARGET_MAX),
  };
}

export function cameraViewForZoom(
  startView: PreviewCameraView,
  movement: { deltaY: number },
): PreviewCameraView {
  return {
    ...startView,
    distance: clamp(
      startView.distance * Math.exp(movement.deltaY * CAMERA_WHEEL_ZOOM_PER_DELTA),
      CAMERA_DISTANCE_MIN,
      CAMERA_DISTANCE_MAX,
    ),
  };
}

export function cameraViewForPinchZoom(
  startView: PreviewCameraView,
  movement: { startDistance: number; currentDistance: number },
): PreviewCameraView {
  if (movement.startDistance <= 0 || movement.currentDistance <= 0) {
    return { ...startView };
  }

  return {
    ...startView,
    distance: clamp(
      startView.distance * (movement.startDistance / movement.currentDistance),
      CAMERA_DISTANCE_MIN,
      CAMERA_DISTANCE_MAX,
    ),
  };
}

function normalizeYaw(value: number): number {
  const wrapped = ((((value + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : Number(wrapped.toFixed(3));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number(value.toFixed(3))));
}

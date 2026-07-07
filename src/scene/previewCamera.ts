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
const CAMERA_PRESETS = ['top', 'front', 'right', 'home'] as const;
const CAMERA_ARROW_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
const CAMERA_CARDINAL_STEP_DEGREES = 90;

export type CameraPreset = (typeof CAMERA_PRESETS)[number];
export type CameraArrowDirection = (typeof CAMERA_ARROW_DIRECTIONS)[number];

export function isCameraPreset(value: string | undefined): value is CameraPreset {
  return CAMERA_PRESETS.includes(value as CameraPreset);
}

export function isCameraArrowDirection(value: string | undefined): value is CameraArrowDirection {
  return CAMERA_ARROW_DIRECTIONS.includes(value as CameraArrowDirection);
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

export function cameraViewForArrowOrbit(
  startView: PreviewCameraView,
  direction: CameraArrowDirection,
): PreviewCameraView {
  if (direction === 'up' || direction === 'down') {
    return cameraViewForVerticalArrowOrbit(startView, direction);
  }

  const nearestCardinalYaw = nearestCardinalYawDegrees(startView.yawDegrees);
  const yawStep = direction === 'right' ? CAMERA_CARDINAL_STEP_DEGREES : -CAMERA_CARDINAL_STEP_DEGREES;
  const yawDegrees = nearestCardinalYaw + yawStep;

  return {
    ...startView,
    yawDegrees: normalizeYaw(yawDegrees),
  };
}

function cameraViewForVerticalArrowOrbit(
  startView: PreviewCameraView,
  direction: Extract<CameraArrowDirection, 'up' | 'down'>,
): PreviewCameraView {
  const currentPitch = verticalPitchDegrees(startView);
  const nearestPitch = nearestVerticalCardinalPitchDegrees(currentPitch);
  const pitchStep = direction === 'up' ? CAMERA_CARDINAL_STEP_DEGREES : -CAMERA_CARDINAL_STEP_DEGREES;
  const nextPitch = clamp(nearestPitch + pitchStep, -CAMERA_CARDINAL_STEP_DEGREES, CAMERA_CARDINAL_STEP_DEGREES);
  const pitchRadians = (nextPitch * Math.PI) / 180;
  const verticalOffset = startView.height - startView.targetHeight;
  const orbitRadius = Math.max(CAMERA_DISTANCE_MIN, Math.hypot(startView.distance, verticalOffset));

  return {
    ...startView,
    distance: clamp(Math.abs(Math.cos(pitchRadians) * orbitRadius), CAMERA_DISTANCE_MIN, CAMERA_DISTANCE_MAX),
    height: clamp(
      startView.targetHeight + Math.sin(pitchRadians) * orbitRadius,
      CAMERA_HEIGHT_MIN,
      CAMERA_HEIGHT_MAX,
    ),
  };
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

function nearestCardinalYawDegrees(value: number): number {
  const compassYaw = ((value % 360) + 360) % 360;
  return Math.round(compassYaw / CAMERA_CARDINAL_STEP_DEGREES) * CAMERA_CARDINAL_STEP_DEGREES;
}

function verticalPitchDegrees(view: PreviewCameraView): number {
  return (Math.atan2(view.height - view.targetHeight, view.distance) * 180) / Math.PI;
}

function nearestVerticalCardinalPitchDegrees(value: number): number {
  return clamp(
    Math.round(value / CAMERA_CARDINAL_STEP_DEGREES) * CAMERA_CARDINAL_STEP_DEGREES,
    -CAMERA_CARDINAL_STEP_DEGREES,
    CAMERA_CARDINAL_STEP_DEGREES,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number(value.toFixed(3))));
}

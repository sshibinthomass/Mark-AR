export type PreviewCameraView = {
  distance: number;
  height: number;
  yawDegrees: number;
  targetHeight: number;
};

export const DEFAULT_PREVIEW_CAMERA_VIEW: PreviewCameraView = {
  distance: 2.1,
  height: 1.1,
  yawDegrees: 0,
  targetHeight: 0,
};

const CAMERA_HEIGHT_MIN = 0.1;
const CAMERA_HEIGHT_MAX = 3;
const CAMERA_DRAG_YAW_DEGREES_PER_PIXEL = 0.45;
const CAMERA_DRAG_HEIGHT_PER_PIXEL = 0.01;
const CAMERA_PRESETS = ['top', 'front', 'right', 'home'] as const;

export type CameraPreset = (typeof CAMERA_PRESETS)[number];

export function isCameraPreset(value: string | undefined): value is CameraPreset {
  return CAMERA_PRESETS.includes(value as CameraPreset);
}

export function cameraViewForPreset(preset: CameraPreset): PreviewCameraView {
  switch (preset) {
    case 'top':
      return {
        distance: 0.9,
        height: 3,
        yawDegrees: 0,
        targetHeight: 0,
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

export function cameraViewForDrag(
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

function normalizeYaw(value: number): number {
  const wrapped = ((((value + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : Number(wrapped.toFixed(3));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number(value.toFixed(3))));
}

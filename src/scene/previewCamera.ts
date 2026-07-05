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

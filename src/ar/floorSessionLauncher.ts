const FLOOR_UNSUPPORTED_MESSAGE =
  'Floor placement needs Android Chrome with WebXR. Image scanning is still available.';

export type FloorSessionLauncherPreparation =
  | { supported: false; message: string }
  | { supported: true; launcher: { start(): Promise<XRSession> } };

export async function prepareFloorSessionLauncher(
  overlayRoot: HTMLElement,
  xr: XRSystem | undefined = navigator.xr,
): Promise<FloorSessionLauncherPreparation> {
  if (!xr) return unsupportedPreparation();

  try {
    if (!await xr.isSessionSupported('immersive-ar')) return unsupportedPreparation();
  } catch {
    return unsupportedPreparation();
  }

  const sessionInit: XRSessionInit = {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay', 'plane-detection', 'light-estimation'],
    domOverlay: { root: overlayRoot },
  };

  return {
    supported: true,
    launcher: {
      start() {
        return xr.requestSession('immersive-ar', sessionInit);
      },
    },
  };
}

function unsupportedPreparation(): FloorSessionLauncherPreparation {
  return { supported: false, message: FLOOR_UNSUPPORTED_MESSAGE };
}

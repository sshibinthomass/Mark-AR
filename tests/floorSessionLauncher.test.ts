import { describe, expect, it, vi } from 'vitest';
import { prepareFloorSessionLauncher } from '../src/ar/floorSessionLauncher';

const unsupportedResult = {
  supported: false,
  message: 'Floor placement needs Android Chrome with WebXR. Image scanning is still available.',
} as const;

describe('prepareFloorSessionLauncher', () => {
  it('returns the floor fallback when WebXR is absent', async () => {
    const result = await prepareFloorSessionLauncher(document.createElement('div'));

    expect(result).toEqual(unsupportedResult);
  });

  it('returns the floor fallback when immersive AR is unsupported', async () => {
    const { xr, isSessionSupported, requestSession } = fakeXRSystem(false);

    const result = await prepareFloorSessionLauncher(document.createElement('div'), xr);

    expect(result).toEqual(unsupportedResult);
    expect(isSessionSupported).toHaveBeenCalledOnce();
    expect(isSessionSupported).toHaveBeenCalledWith('immersive-ar');
    expect(requestSession).not.toHaveBeenCalled();
  });

  it('returns the floor fallback when the immersive AR preflight rejects', async () => {
    const { xr, requestSession } = fakeXRSystem(
      Promise.reject(new Error('XR support check failed')),
    );

    const result = await prepareFloorSessionLauncher(document.createElement('div'), xr);

    expect(result).toEqual(unsupportedResult);
    expect(requestSession).not.toHaveBeenCalled();
  });

  it('starts the session synchronously with the floor features and exact overlay root', async () => {
    const overlayRoot = document.createElement('main');
    const session = {} as XRSession;
    const sessionPromise = Promise.resolve(session);
    const { xr, requestSession } = fakeXRSystem(true, sessionPromise);
    const result = await prepareFloorSessionLauncher(overlayRoot, xr);
    if (!result.supported) throw new Error('expected immersive AR support');

    expect(requestSession).not.toHaveBeenCalled();

    const returnedPromise = result.launcher.start();

    expect(requestSession).toHaveBeenCalledOnce();
    expect(requestSession).toHaveBeenCalledWith('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay', 'plane-detection', 'light-estimation'],
      domOverlay: { root: overlayRoot },
    });
    expect(returnedPromise).toBe(sessionPromise);
    await expect(returnedPromise).resolves.toBe(session);
  });
});

function fakeXRSystem(
  supported: boolean | Promise<boolean>,
  sessionPromise: Promise<XRSession> = Promise.resolve({} as XRSession),
) {
  const isSessionSupported = vi.fn(() => Promise.resolve(supported));
  const requestSession = vi.fn(() => sessionPromise);
  const xr = { isSessionSupported, requestSession } as unknown as XRSystem;

  return { xr, isSessionSupported, requestSession };
}

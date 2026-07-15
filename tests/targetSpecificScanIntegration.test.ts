import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudImageTarget } from '../src/app/cloudImageTargets';

const scanTarget: CloudImageTarget = {
  id: 'target-one',
  scanId: 'scan-one',
  accessMode: 'anyone_with_link',
  allowedEmails: [],
  label: 'Only this marker',
  imageUrl: 'https://worker.example/image-targets/only-this-marker.jpg',
  imageObjectKey: 'image-targets/only-this-marker.jpg',
  objects: [{
    kind: 'model',
    id: 'object-one',
    model: {
      id: 'chair',
      label: 'Chair',
      url: 'https://worker.example/models/chair.glb',
    },
    placement: {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      height: 0.12,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
    },
  }],
  groups: [],
};

const cloudImageTargetMocks = vi.hoisted(() => {
  class ImageTargetRequestError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }

  return {
    ImageTargetRequestError,
    createImageTarget: vi.fn(),
    deleteImageTarget: vi.fn(),
    getImageTargetForScan: vi.fn(),
    listImageTargets: vi.fn(async () => []),
    updateImageTarget: vi.fn(),
  };
});

const markerArMocks = vi.hoisted(() => ({
  sessionStop: vi.fn(),
  startMarkerAR: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  loadWorkerAuthToken: vi.fn<() => string | null>(),
  loginToWebArWorker: vi.fn(),
}));

vi.mock('../src/app/cloudflareModels', () => ({
  DEFAULT_GENERATE_MODEL_API_URL: 'https://worker.example/generate-3d',
  loadCloudflareModelOptions: vi.fn(async () => []),
}));

vi.mock('../src/app/cloudImageTargets', () => cloudImageTargetMocks);

vi.mock('../src/app/webArAuth', () => ({
  clearWorkerAuthToken: vi.fn(),
  getCurrentWebArUser: vi.fn(async () => null),
  loadWorkerAuthToken: authMocks.loadWorkerAuthToken,
  loginToWebArWorker: authMocks.loginToWebArWorker,
  saveWorkerAuthToken: vi.fn(),
  signupToWebArWorker: vi.fn(),
}));

vi.mock('../src/capture/cameraCapture', () => ({
  imageFileToCapturedImage: vi.fn(),
}));

vi.mock('../src/ar/mindarRuntime', () => ({
  startMarkerAR: markerArMocks.startMarkerAR,
}));

vi.mock('../src/scene/ImageTargetPreview', () => ({
  ImageTargetPreview: class {
    update = vi.fn(async () => undefined);
    dispose = vi.fn();
  },
}));

describe('target-specific scan route integration', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="app"></div>';
    window.localStorage.clear();
    window.history.replaceState(null, '', '#/scan/scan-one');
    authMocks.loadWorkerAuthToken.mockReset();
    authMocks.loadWorkerAuthToken.mockReturnValue(null);
    authMocks.loginToWebArWorker.mockReset();
    cloudImageTargetMocks.getImageTargetForScan.mockReset();
    cloudImageTargetMocks.listImageTargets.mockClear();
    markerArMocks.sessionStop.mockClear();
    markerArMocks.startMarkerAR.mockReset();
    markerArMocks.startMarkerAR.mockResolvedValue({ stop: markerArMocks.sessionStop });
  });

  it('opens the camera with exactly the target assigned to the URL', async () => {
    cloudImageTargetMocks.getImageTargetForScan.mockResolvedValue(scanTarget);

    await import('../src/main');
    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 1);

    expect(cloudImageTargetMocks.getImageTargetForScan).toHaveBeenCalledWith({
      apiUrl: 'https://worker.example/generate-3d',
      scanId: 'scan-one',
      authToken: null,
    });
    const options = markerArMocks.startMarkerAR.mock.calls[0][1] as {
      targets: Array<{
        marker: { id: string; imagePath?: string; targetIndex: number };
        cloudflareAsset?: { objects?: Array<{ id: string }> };
      }>;
    };
    expect(options.targets).toHaveLength(1);
    expect(options.targets[0]).toMatchObject({
      marker: {
        id: 'cloud-target-one',
        imagePath: scanTarget.imageUrl,
        targetIndex: 0,
      },
      cloudflareAsset: {
        objects: [expect.objectContaining({ id: 'object-one' })],
      },
    });
  });

  it.each([
    [403, "You don't have access to this target."],
    [404, 'Target not found.'],
  ])('does not start the camera when the scan endpoint returns %s', async (statusCode, message) => {
    cloudImageTargetMocks.getImageTargetForScan.mockRejectedValue(
      new cloudImageTargetMocks.ImageTargetRequestError('Denied', statusCode),
    );

    await import('../src/main');
    await waitFor(() => document.querySelector('#ar-status')?.textContent === message);

    expect(markerArMocks.startMarkerAR).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLButtonElement>('#start-ar')?.disabled).toBe(true);
  });

  it('remembers the exact scan URL across sign-in after a 401 response', async () => {
    cloudImageTargetMocks.getImageTargetForScan
      .mockRejectedValueOnce(new cloudImageTargetMocks.ImageTargetRequestError('Login required', 401))
      .mockResolvedValue(scanTarget);
    authMocks.loginToWebArWorker.mockResolvedValue({
      token: 'token-123',
      user: {
        email: 'viewer@example.com',
        role: 'user',
        status: 'active',
      },
    });

    await import('../src/main');
    await waitFor(() => window.location.hash === '#/account');

    const email = document.querySelector<HTMLInputElement>('#worker-email');
    const password = document.querySelector<HTMLInputElement>('#worker-password');
    if (email && password) {
      email.value = 'viewer@example.com';
      password.value = 'password';
    }
    document.querySelector<HTMLFormElement>('#worker-login-form')?.dispatchEvent(
      new SubmitEvent('submit', { bubbles: true, cancelable: true }),
    );

    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length > 0);
    expect(window.location.hash).toBe('#/scan/scan-one');
    expect(cloudImageTargetMocks.getImageTargetForScan).toHaveBeenLastCalledWith({
      apiUrl: 'https://worker.example/generate-3d',
      scanId: 'scan-one',
      authToken: 'token-123',
    });
  });
});

async function waitFor(assertion: () => boolean): Promise<void> {
  const timeoutAt = Date.now() + 2000;
  while (Date.now() < timeoutAt) {
    if (assertion()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for target-specific scan state');
}

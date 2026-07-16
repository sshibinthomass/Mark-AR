import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CloudImageTarget,
  CloudImageTargetGroup,
} from '../src/app/cloudImageTargets';
import type { ImageTargetAccess } from '../src/app/imageTargetAccess';
import type { TargetEditorObject } from '../src/app/targetEditorObjects';

type SaveInput = {
  label: string;
  objects: TargetEditorObject[];
  groups: CloudImageTargetGroup[];
  access: ImageTargetAccess;
};

const model = {
  id: 'generated-chair',
  label: 'Chair',
  url: 'https://worker.example/models/chair.glb',
  previewUrl: 'https://worker.example/previews/chair.png',
};

const cloudMocks = vi.hoisted(() => ({
  createImageTarget: vi.fn(),
  deleteImageTarget: vi.fn(async () => undefined),
  getImageTargetForScan: vi.fn(),
  listImageTargets: vi.fn(),
  updateImageTarget: vi.fn(),
  currentTarget: undefined as CloudImageTarget | undefined,
}));

const captureMocks = vi.hoisted(() => ({
  imageFileToCapturedImage: vi.fn(async () => ({
    imageBase64: 'AA==',
    imageMimeType: 'image/png',
  })),
}));

const qrMocks = vi.hoisted(() => ({
  createTargetQrArtifact: vi.fn(),
  downloadTargetQrArtifact: vi.fn(),
}));

const browserMocks = vi.hoisted(() => ({
  canShare: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
  share: vi.fn(),
  writeText: vi.fn(async () => undefined),
}));

vi.mock('../src/app/cloudflareModels', () => ({
  DEFAULT_GENERATE_MODEL_API_URL: 'https://worker.example/generate-3d',
  loadCloudflareModelOptions: vi.fn(async () => [model]),
}));

vi.mock('../src/app/cloudImageTargets', () => ({
  createImageTarget: cloudMocks.createImageTarget,
  deleteImageTarget: cloudMocks.deleteImageTarget,
  getImageTargetForScan: cloudMocks.getImageTargetForScan,
  ImageTargetRequestError: class extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  listImageTargets: cloudMocks.listImageTargets,
  updateImageTarget: cloudMocks.updateImageTarget,
}));

vi.mock('../src/app/webArAuth', () => ({
  clearWorkerAuthToken: vi.fn(),
  getCurrentWebArUser: vi.fn(async () => ({ email: 'maker@example.com' })),
  loadWorkerAuthToken: vi.fn(() => 'token-123'),
  loginToWebArWorker: vi.fn(),
  saveWorkerAuthToken: vi.fn(),
  signupToWebArWorker: vi.fn(),
}));

vi.mock('../src/capture/cameraCapture', () => captureMocks);

vi.mock('../src/app/targetQrCode', () => qrMocks);

vi.mock('../src/ar/mindarRuntime', () => ({
  startMarkerAR: vi.fn(async () => ({ stop: vi.fn() })),
}));

vi.mock('../src/scene/ImageTargetPreview', () => ({
  ImageTargetPreview: class {
    update = vi.fn(async () => undefined);
    dispose = vi.fn();
  },
}));

describe('target QR integration', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="app"></div>';
    window.localStorage.clear();
    setWindowUrl('https://example.com/Mark-AR/#/targets');

    cloudMocks.currentTarget = undefined;
    cloudMocks.createImageTarget.mockReset();
    cloudMocks.deleteImageTarget.mockClear();
    cloudMocks.getImageTargetForScan.mockReset();
    cloudMocks.listImageTargets.mockReset();
    cloudMocks.updateImageTarget.mockReset();
    captureMocks.imageFileToCapturedImage.mockClear();
    qrMocks.createTargetQrArtifact.mockReset();
    qrMocks.downloadTargetQrArtifact.mockClear();
    browserMocks.createObjectURL.mockReset();
    browserMocks.revokeObjectURL.mockClear();
    browserMocks.share.mockReset();
    browserMocks.canShare.mockReset();
    browserMocks.writeText.mockClear();

    cloudMocks.listImageTargets.mockImplementation(async () => (
      cloudMocks.currentTarget ? [cloudMocks.currentTarget] : []
    ));
    cloudMocks.createImageTarget.mockImplementation(async (input: SaveInput) => {
      cloudMocks.currentTarget = targetFromInput(input);
      return cloudMocks.currentTarget;
    });
    cloudMocks.updateImageTarget.mockImplementation(async (input: SaveInput) => {
      cloudMocks.currentTarget = targetFromInput(input, cloudMocks.currentTarget);
      return cloudMocks.currentTarget;
    });
    cloudMocks.getImageTargetForScan.mockImplementation(async () => cloudMocks.currentTarget);

    qrMocks.createTargetQrArtifact.mockImplementation(async (input: {
      label: string;
      targetId: string;
    }) => ({
      blob: new Blob(['png'], { type: 'image/png' }),
      filename: `anchorar-${input.label.toLowerCase().replace(/\s+/g, '-')}-qr.png`,
    }));
    browserMocks.createObjectURL.mockImplementation(() => (
      `blob:target-qr-${browserMocks.createObjectURL.mock.calls.length}`
    ));
    browserMocks.share.mockResolvedValue(undefined);
    browserMocks.canShare.mockReturnValue(true);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: browserMocks.createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: browserMocks.revokeObjectURL,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: browserMocks.writeText },
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: browserMocks.share,
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: browserMocks.canShare,
    });
  });

  it('opens once after initial creation and does not reopen after updating that target', async () => {
    await import('../src/main');
    await createNewTarget();

    await waitFor(() => isQrDialogOpen());
    expect(qrMocks.createTargetQrArtifact).toHaveBeenCalledWith({
      scanUrl: 'https://example.com/Mark-AR/#/scan/scan-new',
      label: 'New marker',
      targetId: 'target-new',
    });
    expect(document.querySelector('[data-target-qr-heading]')?.textContent).toBe(
      'Your AR experience is ready',
    );
    expect(document.querySelector<HTMLImageElement>('[data-target-qr-preview]')?.src).toBe(
      'blob:target-qr-1',
    );

    document.querySelector<HTMLButtonElement>('[data-target-qr-done]')?.click();
    expect(isQrDialogOpen()).toBe(false);
    expect(browserMocks.revokeObjectURL).toHaveBeenCalledWith('blob:target-qr-1');
    document.querySelector<HTMLButtonElement>('#save-image-target')?.click();
    await waitFor(() => cloudMocks.updateImageTarget.mock.calls.length === 1);

    expect(isQrDialogOpen()).toBe(false);
    expect(qrMocks.createTargetQrArtifact).toHaveBeenCalledTimes(1);
  }, 10000);

  it('downloads, copies, and opens the scanner from the first-creation prompt', async () => {
    await import('../src/main');
    await createNewTarget();
    await waitFor(() => isQrDialogOpen());

    document.querySelector<HTMLButtonElement>('[data-target-qr-download]')?.click();
    expect(qrMocks.downloadTargetQrArtifact).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'anchorar-new-marker-qr.png',
    }));

    document.querySelector<HTMLButtonElement>('[data-target-qr-copy]')?.click();
    await waitFor(() => browserMocks.writeText.mock.calls.length === 1);
    expect(browserMocks.writeText).toHaveBeenCalledWith(
      'https://example.com/Mark-AR/#/scan/scan-new',
    );

    document.querySelector<HTMLButtonElement>('[data-target-qr-open]')?.click();
    await waitFor(() => window.location.hash === '#/scan/scan-new');
    expect(isQrDialogOpen()).toBe(false);
  }, 10000);

  it('shares the retained QR image and exact scan URL from the prompt', async () => {
    await import('../src/main');
    await createNewTarget();
    await waitFor(() => isQrDialogOpen());

    document.querySelector<HTMLButtonElement>('[data-target-qr-share]')?.click();
    await waitFor(() => browserMocks.share.mock.calls.length === 1);

    const payload = browserMocks.share.mock.calls[0][0] as ShareData;
    expect(payload.title).toBe('AnchorAR — New marker');
    expect(payload.text).toBe(
      'Scan this QR code to open the AR experience: https://example.com/Mark-AR/#/scan/scan-new',
    );
    expect(payload.url).toBe('https://example.com/Mark-AR/#/scan/scan-new');
    expect(payload.files?.[0].name).toBe('anchorar-new-marker-qr.png');
    expect(payload.files?.[0].type).toBe('image/png');
    expect(qrMocks.createTargetQrArtifact).toHaveBeenCalledTimes(1);
    expect(qrMocks.downloadTargetQrArtifact).not.toHaveBeenCalled();
    expect(browserMocks.writeText).not.toHaveBeenCalled();
    await waitFor(() => document.querySelector('[data-target-qr-share-status]')?.textContent === (
      'QR code and scan link shared.'
    ));
  }, 10000);

  it('downloads the retained QR and copies its URL when file sharing is unsupported', async () => {
    browserMocks.canShare.mockReturnValue(false);
    await import('../src/main');
    await createNewTarget();
    await waitFor(() => isQrDialogOpen());

    document.querySelector<HTMLButtonElement>('[data-target-qr-share]')?.click();
    await waitFor(() => qrMocks.downloadTargetQrArtifact.mock.calls.length === 1);
    await waitFor(() => browserMocks.writeText.mock.calls.length === 1);

    expect(qrMocks.downloadTargetQrArtifact).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'anchorar-new-marker-qr.png',
    }));
    expect(browserMocks.writeText).toHaveBeenCalledWith(
      'https://example.com/Mark-AR/#/scan/scan-new',
    );
    expect(browserMocks.share).not.toHaveBeenCalled();
    expect(qrMocks.createTargetQrArtifact).toHaveBeenCalledTimes(1);
    await waitFor(() => document.querySelector('[data-target-qr-share-status]')?.textContent === (
      'QR downloaded and scan link copied. Attach the QR image and paste the link in your app.'
    ));
  }, 10000);

  it('generates and downloads the QR anytime from an existing saved-target row', async () => {
    cloudMocks.currentTarget = existingTarget();
    await import('../src/main');
    await waitFor(() => Boolean(document.querySelector('[data-download-target-qr="target-existing"]')));

    document.querySelector<HTMLButtonElement>('[data-download-target-qr="target-existing"]')?.click();
    await waitFor(() => qrMocks.downloadTargetQrArtifact.mock.calls.length === 1);

    expect(qrMocks.createTargetQrArtifact).toHaveBeenCalledWith({
      scanUrl: 'https://example.com/Mark-AR/#/scan/scan-existing',
      label: 'Existing marker',
      targetId: 'target-existing',
    });
    expect(document.querySelector('[data-target-qr-overlay]')).toBeTruthy();
    expect(isQrDialogOpen()).toBe(false);
  }, 10000);

  it('coalesces repeated saved-row download clicks while generation is pending', async () => {
    cloudMocks.currentTarget = existingTarget();
    let resolveArtifact = (_value: { blob: Blob; filename: string }) => undefined;
    qrMocks.createTargetQrArtifact.mockImplementationOnce(() => (
      new Promise((resolve) => {
        resolveArtifact = resolve;
      })
    ));

    await import('../src/main');
    await waitFor(() => Boolean(document.querySelector('[data-download-target-qr="target-existing"]')));
    const download = document.querySelector<HTMLButtonElement>(
      '[data-download-target-qr="target-existing"]',
    );

    download?.click();
    download?.click();
    await waitFor(() => qrMocks.createTargetQrArtifact.mock.calls.length === 1);
    resolveArtifact({
      blob: new Blob(['png'], { type: 'image/png' }),
      filename: 'anchorar-existing-marker-qr.png',
    });
    await waitFor(() => qrMocks.downloadTargetQrArtifact.mock.calls.length === 1);

    expect(qrMocks.createTargetQrArtifact).toHaveBeenCalledTimes(1);
    expect(qrMocks.downloadTargetQrArtifact).toHaveBeenCalledTimes(1);
  }, 10000);

  it('keeps the saved target successful when generation fails and retries in place', async () => {
    qrMocks.createTargetQrArtifact
      .mockRejectedValueOnce(new Error('QR renderer offline'))
      .mockResolvedValueOnce({
        blob: new Blob(['png'], { type: 'image/png' }),
        filename: 'anchorar-new-marker-qr.png',
      });

    await import('../src/main');
    await createNewTarget();
    await waitFor(() => document.querySelector('[data-target-qr-error]')?.textContent === 'QR renderer offline');

    expect(document.querySelector('#image-target-status')?.textContent).toBe(
      'Image target saved to Cloudflare.',
    );
    document.querySelector<HTMLButtonElement>('[data-target-qr-retry]')?.click();
    await waitFor(() => qrMocks.createTargetQrArtifact.mock.calls.length === 2);
    await waitFor(() => document.querySelector<HTMLImageElement>('[data-target-qr-preview]')?.hidden === false);

    expect(isQrDialogOpen()).toBe(true);
  }, 10000);

  it('ignores a late QR result after the prompt is closed', async () => {
    let resolveArtifact = (_value: { blob: Blob; filename: string }) => undefined;
    qrMocks.createTargetQrArtifact.mockImplementation(() => (
      new Promise((resolve) => {
        resolveArtifact = resolve;
      })
    ));

    await import('../src/main');
    await createNewTarget();
    await waitFor(() => isQrDialogOpen());
    document.querySelector<HTMLButtonElement>('[data-target-qr-done]')?.click();

    resolveArtifact({
      blob: new Blob(['png'], { type: 'image/png' }),
      filename: 'anchorar-new-marker-qr.png',
    });
    await nextTick();

    expect(isQrDialogOpen()).toBe(false);
    expect(browserMocks.createObjectURL).not.toHaveBeenCalled();
  }, 10000);

  it('still prompts from the successful create response when the following list refresh fails', async () => {
    cloudMocks.listImageTargets
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Refresh offline'));

    await import('../src/main');
    await createNewTarget();
    await waitFor(() => isQrDialogOpen());

    expect(document.querySelector('#image-target-status')?.textContent).toContain(
      'saved in Cloudflare',
    );
    expect(document.querySelector('#image-target-status')?.textContent).toContain(
      'Refresh offline',
    );
  }, 10000);

  it('does not prompt or generate a QR when the create response lacks a scan ID', async () => {
    cloudMocks.createImageTarget.mockImplementationOnce(async (input: SaveInput) => {
      cloudMocks.currentTarget = {
        ...targetFromInput(input),
        scanId: undefined,
      };
      return cloudMocks.currentTarget;
    });

    await import('../src/main');
    await createNewTarget();
    await waitFor(() => document.querySelector('#image-target-status')?.textContent?.includes(
      'did not return a scan link',
    ) === true);

    expect(isQrDialogOpen()).toBe(false);
    expect(qrMocks.createTargetQrArtifact).not.toHaveBeenCalled();
  }, 10000);
});

async function createNewTarget(): Promise<void> {
  await waitFor(() => document.querySelectorAll<HTMLButtonElement>('.target-model-card').length === 1);
  const fileInput = document.querySelector<HTMLInputElement>('#target-image-file')!;
  const file = new File([new Uint8Array([1])], 'new-marker.png', { type: 'image/png' });
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: [file],
  });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await waitFor(() => document.querySelector<HTMLInputElement>('#target-label')?.value === 'new-marker');

  document.querySelectorAll<HTMLButtonElement>('.target-model-card')[0].click();
  await waitFor(() => document.querySelectorAll('[data-select-target-object]').length === 1);
  const label = document.querySelector<HTMLInputElement>('#target-label')!;
  label.value = 'New marker';
  document.querySelector<HTMLButtonElement>('#save-image-target')?.click();
  await waitFor(() => cloudMocks.createImageTarget.mock.calls.length === 1);
}

function targetFromInput(
  input: SaveInput,
  existing?: CloudImageTarget,
): CloudImageTarget {
  const firstModel = input.objects.find((object) => 'model' in object);
  return {
    id: existing?.id ?? 'target-new',
    scanId: existing?.scanId ?? 'scan-new',
    label: input.label,
    imageUrl: existing?.imageUrl ?? 'https://worker.example/image-targets/new-marker.png',
    imageObjectKey: existing?.imageObjectKey ?? 'image-targets/new-marker.png',
    objects: structuredClone(input.objects),
    groups: structuredClone(input.groups),
    ...(firstModel ? {
      model: firstModel.model,
      placement: structuredClone(firstModel.placement),
    } : {}),
    accessMode: input.access.accessMode,
    allowedEmails: [...input.access.allowedEmails],
  };
}

function existingTarget(): CloudImageTarget {
  const placement = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    height: 0.12,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
  };
  return {
    id: 'target-existing',
    scanId: 'scan-existing',
    label: 'Existing marker',
    imageUrl: 'https://worker.example/image-targets/existing.png',
    imageObjectKey: 'image-targets/existing.png',
    model,
    placement,
    objects: [{ id: 'object-existing', model, placement }],
    groups: [],
    accessMode: 'owner_only',
    allowedEmails: [],
  };
}

function isQrDialogOpen(): boolean {
  return document.querySelector<HTMLElement>('[data-target-qr-overlay]')?.hidden === false;
}

function setWindowUrl(url: string): void {
  const happyWindow = window as typeof window & {
    happyDOM: { setURL: (nextUrl: string) => void };
  };
  happyWindow.happyDOM.setURL(url);
}

async function nextTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitFor(assertion: () => boolean): Promise<void> {
  const timeoutAt = Date.now() + 2000;
  while (Date.now() < timeoutAt) {
    if (assertion()) {
      return;
    }
    await nextTick();
  }
  throw new Error('Timed out waiting for target QR integration state');
}

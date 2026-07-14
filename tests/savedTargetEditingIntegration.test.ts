import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudImageTarget } from '../src/app/cloudImageTargets';

const placement = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  height: 0.12,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
};

const savedTarget: CloudImageTarget = {
  id: 'target-1',
  label: 'Kitchen marker',
  imageUrl: 'https://worker.example/image-targets/images/kitchen.jpg',
  imageObjectKey: 'image-targets/images/kitchen.jpg',
  model: { id: 'chair', label: 'Chair', url: 'https://worker.example/models/chair.glb' },
  placement,
  objects: [
    {
      kind: 'model',
      id: 'chair-1',
      model: { id: 'chair', label: 'Chair', url: 'https://worker.example/models/chair.glb' },
      placement,
      groupId: 'group-1',
      localPlacement: { ...placement, offsetX: -0.15 },
    },
    {
      kind: 'text',
      id: 'text-1',
      text: {
        value: 'Welcome',
        language: 'english',
        font: 'studio-sans-bold',
        color: '#123456',
        fillMode: 'gradient',
        gradientStart: '#234567',
        gradientEnd: '#345678',
        gradientDirection: 'diagonal',
        sideColor: '#456789',
        depth: 0.08,
        bevel: 0.01,
        gloss: 0.9,
        stylePreset: 'gold-bevel',
      },
      placement: { ...placement, offsetX: 0.2 },
      groupId: 'group-1',
      localPlacement: { ...placement, offsetX: 0.15 },
      animation: {
        preset: 'custom',
        tracks: [{ property: 'rotationY', motion: 'spin', amount: 360, speed: 0.25, phase: 0 }],
      },
    },
  ],
  groups: [{
    id: 'group-1',
    label: 'Welcome set',
    placement: { ...placement, height: 0.2, rotationY: 20 },
    animation: {
      preset: 'custom',
      tracks: [{ property: 'height', motion: 'triangle', amount: 0.1, speed: 0.5, phase: 0 }],
    },
  }],
};

const cloudImageTargetMocks = vi.hoisted(() => ({
  createImageTarget: vi.fn(),
  deleteImageTarget: vi.fn(async () => undefined),
  listImageTargets: vi.fn(),
  updateImageTarget: vi.fn(),
}));

const previewMocks = vi.hoisted(() => ({
  update: vi.fn(async () => undefined),
}));

vi.mock('../src/app/cloudflareModels', () => ({
  DEFAULT_GENERATE_MODEL_API_URL: 'https://worker.example/generate-3d',
  loadCloudflareModelOptions: vi.fn(async () => [{
    id: 'chair',
    label: 'Chair',
    url: 'https://worker.example/models/chair.glb',
  }]),
}));

vi.mock('../src/app/cloudImageTargets', () => cloudImageTargetMocks);

vi.mock('../src/app/webArAuth', () => ({
  clearWorkerAuthToken: vi.fn(),
  getCurrentWebArUser: vi.fn(async () => ({ email: 'maker@example.com' })),
  loadWorkerAuthToken: vi.fn(() => 'token-123'),
  loginToWebArWorker: vi.fn(),
  saveWorkerAuthToken: vi.fn(),
  signupToWebArWorker: vi.fn(),
}));

vi.mock('../src/capture/cameraCapture', () => ({
  imageFileToCapturedImage: vi.fn(),
}));

vi.mock('../src/ar/mindarRuntime', () => ({
  startMarkerAR: vi.fn(),
}));

vi.mock('../src/scene/ImageTargetPreview', () => ({
  ImageTargetPreview: class {
    update = previewMocks.update;
    dispose = vi.fn();
  },
}));

describe('saved target editing integration', () => {
  beforeEach(() => {
    vi.resetModules();
    cloudImageTargetMocks.createImageTarget.mockClear();
    cloudImageTargetMocks.deleteImageTarget.mockClear();
    cloudImageTargetMocks.listImageTargets.mockClear();
    cloudImageTargetMocks.listImageTargets.mockResolvedValue([savedTarget]);
    cloudImageTargetMocks.updateImageTarget.mockClear();
    cloudImageTargetMocks.updateImageTarget.mockResolvedValue(savedTarget);
    previewMocks.update.mockClear();
    document.body.innerHTML = '<div id="app"></div>';
    window.localStorage.clear();
  });

  it('loads every saved object into the editor when its card is clicked', async () => {
    await import('../src/main');
    await waitFor(() => Boolean(document.querySelector('[data-edit-target="target-1"]')));

    document.querySelector<HTMLButtonElement>('[data-edit-target="target-1"]')?.click();
    await waitFor(() => document.querySelector<HTMLInputElement>('#target-label')?.value === 'Kitchen marker');

    expect(document.querySelector<HTMLButtonElement>('#save-image-target')?.textContent).toBe('Update target');
    expect(document.querySelector<HTMLButtonElement>('#new-image-target')?.hidden).toBe(false);
    expect(document.querySelectorAll('.target-object-row')).toHaveLength(2);
    expect(document.querySelector('[data-edit-target="target-1"]')?.getAttribute('aria-current')).toBe('true');
    expect(previewMocks.update).toHaveBeenLastCalledWith(expect.objectContaining({
      imageUrl: savedTarget.imageUrl,
      objects: expect.arrayContaining([
        expect.objectContaining({ id: 'chair-1' }),
        expect.objectContaining({ kind: 'text', id: 'text-1' }),
      ]),
      groups: [expect.objectContaining({ id: 'group-1', label: 'Welcome set' })],
    }));
  });

  it('patches the active target without duplicating it and can reset to a new draft', async () => {
    await import('../src/main');
    await waitFor(() => Boolean(document.querySelector('[data-edit-target="target-1"]')));
    document.querySelector<HTMLButtonElement>('[data-edit-target="target-1"]')?.click();
    await waitFor(() => document.querySelector<HTMLButtonElement>('#save-image-target')?.textContent === 'Update target');

    document.querySelector<HTMLButtonElement>('#save-image-target')?.click();
    await waitFor(() => cloudImageTargetMocks.updateImageTarget.mock.calls.length === 1);

    expect(cloudImageTargetMocks.updateImageTarget).toHaveBeenCalledWith(expect.objectContaining({
      targetId: 'target-1',
      label: 'Kitchen marker',
      objects: expect.arrayContaining([
        expect.objectContaining({ id: 'chair-1' }),
        expect.objectContaining({ kind: 'text', id: 'text-1', text: expect.objectContaining({ value: 'Welcome' }) }),
      ]),
      groups: [expect.objectContaining({
        id: 'group-1',
        label: 'Welcome set',
        placement: expect.objectContaining({ rotationY: 20 }),
      })],
    }));
    expect(cloudImageTargetMocks.updateImageTarget.mock.calls[0][0]).not.toHaveProperty('imageBase64');
    expect(cloudImageTargetMocks.createImageTarget).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.saved-target-row')).toHaveLength(1);

    document.querySelector<HTMLButtonElement>('#new-image-target')?.click();
    await waitFor(() => document.querySelector<HTMLButtonElement>('#save-image-target')?.textContent === 'Save target');

    expect(document.querySelector<HTMLInputElement>('#target-label')?.value).toBe('');
    expect(document.querySelectorAll('.target-object-row')).toHaveLength(0);
    expect(document.querySelector<HTMLButtonElement>('#new-image-target')?.hidden).toBe(true);
    expect(document.querySelector('[data-edit-target="target-1"]')?.getAttribute('aria-current')).toBe('false');
  });
});

async function waitFor(assertion: () => boolean): Promise<void> {
  const timeoutAt = Date.now() + 1500;
  while (Date.now() < timeoutAt) {
    if (assertion()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for saved target editing state');
}

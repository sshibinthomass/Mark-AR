import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudImageTarget } from '../src/app/cloudImageTargets';
import { composeGroupPlacement } from '../src/app/targetEditorGroups';

const placement = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  height: 0.12,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
};

const groupPlacement = { ...placement, height: 0.2, rotationY: 20 };
const chairLocalPlacement = { ...placement, offsetX: -0.15, height: 0 };
const textLocalPlacement = { ...placement, offsetX: 0.15, height: 0 };
const chairPlacement = composeGroupPlacement(groupPlacement, chairLocalPlacement);
const textPlacement = composeGroupPlacement(groupPlacement, textLocalPlacement);

const savedTarget: CloudImageTarget = {
  id: 'target-1',
  scanId: 'scan-kitchen',
  accessMode: 'specific_accounts',
  allowedEmails: ['viewer@example.com'],
  label: 'Kitchen marker',
  imageUrl: 'https://worker.example/image-targets/images/kitchen.jpg',
  imageObjectKey: 'image-targets/images/kitchen.jpg',
  model: { id: 'chair', label: 'Chair', url: 'https://worker.example/models/chair.glb' },
  placement: chairPlacement,
  objects: [
    {
      kind: 'model',
      id: 'chair-1',
      model: { id: 'chair', label: 'Chair', url: 'https://worker.example/models/chair.glb' },
      placement: chairPlacement,
      groupId: 'group-1',
      localPlacement: chairLocalPlacement,
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
      placement: textPlacement,
      groupId: 'group-1',
      localPlacement: textLocalPlacement,
      animation: {
        preset: 'custom',
        tracks: [{ property: 'rotationY', motion: 'spin', amount: 360, speed: 0.25, phase: 0 }],
      },
    },
  ],
  groups: [{
    id: 'group-1',
    label: 'Welcome set',
    placement: groupPlacement,
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

const markerArMocks = vi.hoisted(() => ({
  startMarkerAR: vi.fn(async () => ({ stop: vi.fn() })),
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
  startMarkerAR: markerArMocks.startMarkerAR,
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
    markerArMocks.startMarkerAR.mockClear();
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
    expect(document.querySelector('[data-page="targets"]')?.getAttribute('data-has-target-draft')).toBe('true');
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

  it('loads, edits, and persists the saved target access policy', async () => {
    await import('../src/main');
    await waitFor(() => Boolean(document.querySelector('[data-edit-target="target-1"]')));

    document.querySelector<HTMLButtonElement>('[data-edit-target="target-1"]')?.click();
    await waitFor(() => document.querySelector<HTMLSelectElement>('#target-access-mode')?.value === 'specific_accounts');

    expect(document.querySelector<HTMLElement>('#target-access-emails-field')?.hidden).toBe(false);
    expect(document.querySelector<HTMLTextAreaElement>('#target-access-emails')?.value).toBe('viewer@example.com');

    const accessMode = document.querySelector<HTMLSelectElement>('#target-access-mode');
    if (accessMode) {
      accessMode.value = 'anyone_with_link';
      accessMode.dispatchEvent(new Event('change', { bubbles: true }));
    }
    expect(document.querySelector<HTMLElement>('#target-access-emails-field')?.hidden).toBe(true);

    document.querySelector<HTMLButtonElement>('#save-image-target')?.click();
    await waitFor(() => cloudImageTargetMocks.updateImageTarget.mock.calls.length === 1);

    expect(cloudImageTargetMocks.updateImageTarget).toHaveBeenCalledWith(expect.objectContaining({
      targetId: 'target-1',
      access: {
        accessMode: 'anyone_with_link',
        allowedEmails: [],
      },
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
      access: {
        accessMode: 'specific_accounts',
        allowedEmails: ['viewer@example.com'],
      },
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
    expect(document.querySelector('[data-page="targets"]')?.getAttribute('data-has-target-draft')).toBe('false');
    expect(document.querySelector('[data-edit-target="target-1"]')?.getAttribute('aria-current')).toBe('false');
  });

  it('reopens complete text styles and keeps animation scoped to the saved text object', async () => {
    await import('../src/main');
    await waitFor(() => Boolean(document.querySelector('[data-edit-target="target-1"]')));
    document.querySelector<HTMLButtonElement>('[data-edit-target="target-1"]')?.click();
    await waitFor(() => document.querySelectorAll('.target-object-row').length === 2);

    document.querySelector<HTMLButtonElement>('[data-select-target-object="text-1"]')?.click();
    await waitFor(() => document.querySelector<HTMLTextAreaElement>('#target-text-value')?.value === 'Welcome');
    expect(document.querySelector<HTMLSelectElement>('#target-text-fill-mode')?.value).toBe('gradient');
    expect(document.querySelector<HTMLInputElement>('#target-text-gradient-start')?.value).toBe('#234567');
    expect(document.querySelector<HTMLInputElement>('#target-text-gradient-end')?.value).toBe('#345678');
    expect(document.querySelector<HTMLInputElement>('#target-text-gloss')?.value).toBe('0.9');
    expect(document.querySelector<HTMLSelectElement>('#target-animation-preset')?.value).toBe('custom');
    expect(document.querySelectorAll('[data-animation-track]')).toHaveLength(1);

    document.querySelector<HTMLButtonElement>('#save-image-target')?.click();
    await waitFor(() => cloudImageTargetMocks.updateImageTarget.mock.calls.length === 1);
    expect(cloudImageTargetMocks.updateImageTarget).toHaveBeenCalledWith(expect.objectContaining({
      objects: [
        expect.objectContaining({ id: 'chair-1', animation: { preset: 'none', tracks: [] } }),
        expect.objectContaining({
          kind: 'text',
          id: 'text-1',
          text: expect.objectContaining({
            value: 'Welcome',
            fillMode: 'gradient',
            gradientStart: '#234567',
            gradientEnd: '#345678',
            gloss: 0.9,
          }),
          animation: {
            preset: 'custom',
            tracks: [{ property: 'rotationY', motion: 'spin', amount: 360, speed: 0.25, phase: 0 }],
          },
        }),
      ],
    }));
    await waitFor(() => document.querySelector('#image-target-status')?.textContent === 'Image target updated in Cloudflare.');

    document.querySelector<HTMLButtonElement>('[data-select-target-object="text-1"]')?.click();
    await waitFor(() => document.querySelector<HTMLSelectElement>('#target-animation-preset')?.value === 'custom');
    document.querySelector<HTMLButtonElement>('[data-select-target-object="chair-1"]')?.click();
    expect(document.querySelector<HTMLSelectElement>('#target-animation-preset')?.value).toBe('none');
  });

  it('keeps the complete editor draft when the Worker returns a lossy saved target', async () => {
    const lossyTarget: CloudImageTarget = {
      ...structuredClone(savedTarget),
      objects: [structuredClone(savedTarget.objects[0])],
    };
    cloudImageTargetMocks.listImageTargets.mockReset();
    cloudImageTargetMocks.listImageTargets
      .mockResolvedValueOnce([savedTarget])
      .mockResolvedValue([lossyTarget]);
    cloudImageTargetMocks.updateImageTarget.mockResolvedValue(lossyTarget);

    await import('../src/main');
    await waitFor(() => Boolean(document.querySelector('[data-edit-target="target-1"]')));
    document.querySelector<HTMLButtonElement>('[data-edit-target="target-1"]')?.click();
    await waitFor(() => document.querySelectorAll('.target-object-row').length === 2);

    document.querySelector<HTMLButtonElement>('#save-image-target')?.click();
    await waitFor(() => cloudImageTargetMocks.updateImageTarget.mock.calls.length === 1);
    await waitFor(() => document.querySelector('#image-target-status')?.textContent?.includes('did not preserve') === true);

    expect(document.querySelectorAll('.target-object-row')).toHaveLength(2);
    expect(previewMocks.update).toHaveBeenLastCalledWith(expect.objectContaining({
      objects: expect.arrayContaining([
        expect.objectContaining({ id: 'chair-1' }),
        expect.objectContaining({ kind: 'text', id: 'text-1' }),
      ]),
    }));
    expect(document.querySelector<HTMLButtonElement>('#save-image-target')?.textContent).toBe('Update target');
  });

  it('keeps the last good saved card when a successful refresh returns lossy target state', async () => {
    const lossyTarget: CloudImageTarget = {
      ...structuredClone(savedTarget),
      objects: [structuredClone(savedTarget.objects[0])],
    };
    cloudImageTargetMocks.listImageTargets.mockReset();
    cloudImageTargetMocks.listImageTargets
      .mockResolvedValueOnce([savedTarget])
      .mockResolvedValueOnce([lossyTarget]);

    await import('../src/main');
    await waitFor(() => Boolean(document.querySelector('[data-edit-target="target-1"]')));
    document.querySelector<HTMLButtonElement>('[data-edit-target="target-1"]')?.click();
    await waitFor(() => document.querySelectorAll('.target-object-row').length === 2);

    document.querySelector<HTMLButtonElement>('#save-image-target')?.click();
    await waitFor(() => document.querySelector('#image-target-status')?.textContent?.includes('did not preserve object') === true);

    document.querySelector<HTMLButtonElement>('[data-edit-target="target-1"]')?.click();
    await waitFor(() => document.querySelectorAll('.target-object-row').length === 2);
    expect(document.querySelectorAll('.target-object-row')).toHaveLength(2);
  });

  it('rejects a successful refresh that omits the saved target without clearing the last good card', async () => {
    cloudImageTargetMocks.listImageTargets.mockReset();
    cloudImageTargetMocks.listImageTargets
      .mockResolvedValueOnce([savedTarget])
      .mockResolvedValueOnce([]);

    await import('../src/main');
    await waitFor(() => Boolean(document.querySelector('[data-edit-target="target-1"]')));
    document.querySelector<HTMLButtonElement>('[data-edit-target="target-1"]')?.click();
    await waitFor(() => document.querySelectorAll('.target-object-row').length === 2);

    document.querySelector<HTMLButtonElement>('#save-image-target')?.click();
    await waitFor(() => document.querySelector('#image-target-status')?.textContent?.includes('did not return target target-1') === true);

    expect(document.querySelector('[data-edit-target="target-1"]')).toBeTruthy();
    expect(document.querySelectorAll('.target-object-row')).toHaveLength(2);
  });

  it('keeps the last good target list and active editor when a manual refresh fails', async () => {
    await import('../src/main');
    await waitFor(() => Boolean(document.querySelector('[data-edit-target="target-1"]')));
    document.querySelector<HTMLButtonElement>('[data-edit-target="target-1"]')?.click();
    await waitFor(() => document.querySelectorAll('.target-object-row').length === 2);
    cloudImageTargetMocks.listImageTargets.mockRejectedValueOnce(new Error('Refresh offline'));

    document.querySelector<HTMLButtonElement>('#refresh-image-targets')?.click();
    await waitFor(() => document.querySelector('#image-target-status')?.textContent === 'Refresh offline');

    expect(document.querySelector('[data-edit-target="target-1"]')).toBeTruthy();
    expect(document.querySelectorAll('.target-object-row')).toHaveLength(2);
    expect(document.querySelector<HTMLButtonElement>('#save-image-target')?.textContent).toBe('Update target');
  });

  it('reports a successful save separately when the following list refresh fails', async () => {
    await import('../src/main');
    await waitFor(() => Boolean(document.querySelector('[data-edit-target="target-1"]')));
    document.querySelector<HTMLButtonElement>('[data-edit-target="target-1"]')?.click();
    await waitFor(() => document.querySelectorAll('.target-object-row').length === 2);
    cloudImageTargetMocks.listImageTargets.mockRejectedValueOnce(new Error('Refresh offline'));

    document.querySelector<HTMLButtonElement>('#save-image-target')?.click();
    await waitFor(() => cloudImageTargetMocks.updateImageTarget.mock.calls.length === 1);
    await waitFor(() => {
      const message = document.querySelector('#image-target-status')?.textContent?.toLowerCase() ?? '';
      return message.includes('saved') && message.includes('refresh');
    });

    expect(document.querySelector('[data-edit-target="target-1"]')).toBeTruthy();
    expect(document.querySelectorAll('.target-object-row')).toHaveLength(2);
    expect(document.querySelector<HTMLButtonElement>('#save-image-target')?.textContent).toBe('Update target');
  });

  it('uses one active editor version of a saved target when starting AR', async () => {
    await import('../src/main');
    await waitFor(() => Boolean(document.querySelector('[data-edit-target="target-1"]')));
    document.querySelector<HTMLButtonElement>('[data-edit-target="target-1"]')?.click();
    await waitFor(() => document.querySelector<HTMLButtonElement>('#save-image-target')?.textContent === 'Update target');

    document.querySelector<HTMLButtonElement>('#start-ar')?.click();
    await waitFor(() => markerArMocks.startMarkerAR.mock.calls.length === 1);

    const options = markerArMocks.startMarkerAR.mock.calls[0][1] as {
      targets: Array<{
        marker: { id: string; imagePath?: string };
        cloudflareAsset?: { objects?: Array<{ id?: string; kind?: string }> };
      }>;
    };
    const activeTargets = options.targets.filter((target) => target.marker.imagePath === savedTarget.imageUrl);
    expect(activeTargets).toHaveLength(1);
    expect(activeTargets[0]).toMatchObject({
      marker: { id: 'draft-target-1' },
      cloudflareAsset: {
        objects: expect.arrayContaining([
          expect.objectContaining({ id: 'chair-1' }),
          expect.objectContaining({ kind: 'text', id: 'text-1' }),
        ]),
      },
    });
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

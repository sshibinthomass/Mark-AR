import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_IMAGE_TARGET_ANIMATION } from '../src/app/imageTargetAnimation';
import type { CloudflareModelOption } from '../src/app/cloudflareModels';
import type { TargetEditorObject } from '../src/app/targetEditorObjects';

const models: CloudflareModelOption[] = [
  {
    id: 'generated-chair',
    label: 'Chair',
    url: 'https://worker.example/models/chair.glb',
    previewUrl: 'https://worker.example/previews/chair.png',
  },
  {
    id: 'generated-sofa',
    label: 'Sofa',
    url: 'https://worker.example/models/sofa.glb',
    previewUrl: 'https://worker.example/previews/sofa.png',
  },
];

const previewUpdates: Array<{ objects: TargetEditorObject[] }> = [];

vi.mock('../src/app/cloudflareModels', () => ({
  DEFAULT_GENERATE_MODEL_API_URL: 'https://worker.example/generate-3d',
  loadCloudflareModelOptions: vi.fn(async () => models),
}));

vi.mock('../src/app/cloudImageTargets', () => ({
  createImageTarget: vi.fn(),
  deleteImageTarget: vi.fn(),
  listImageTargets: vi.fn(async () => []),
}));

vi.mock('../src/app/webArAuth', () => ({
  clearWorkerAuthToken: vi.fn(),
  getCurrentWebArUser: vi.fn(async () => null),
  loadWorkerAuthToken: vi.fn(() => null),
  loginToWebArWorker: vi.fn(),
  saveWorkerAuthToken: vi.fn(),
}));

vi.mock('../src/capture/cameraCapture', () => ({
  imageFileToCapturedImage: vi.fn(),
}));

vi.mock('../src/ar/mindarRuntime', () => ({
  startMarkerAR: vi.fn(),
}));

vi.mock('../src/scene/ImageTargetPreview', () => ({
  ImageTargetPreview: class {
    update = vi.fn(async (state: { objects: TargetEditorObject[] }) => {
      previewUpdates.push({
        objects: state.objects.map((object) => structuredClone(object)),
      });
    });
    dispose = vi.fn();
  },
}));

describe('new target object animation defaults', () => {
  beforeEach(() => {
    vi.resetModules();
    previewUpdates.length = 0;
    document.body.innerHTML = '<div id="app"></div>';
    window.localStorage.clear();
  });

  it('does not copy the selected object animation to newly added text or model objects', async () => {
    await import('../src/main');
    await waitFor(() => document.querySelectorAll<HTMLButtonElement>('.target-model-card').length === 2);

    const cards = document.querySelectorAll<HTMLButtonElement>('.target-model-card');
    cards[0].click();
    await waitFor(() => latestObjects().length === 1);

    selectAnimationPreset('showcase');
    await waitFor(() => latestObjects()[0]?.animation?.preset === 'showcase');

    document.querySelector<HTMLButtonElement>('#add-target-text')?.click();
    await waitFor(() => latestObjects().length === 2);
    expect(latestObjects()[1]?.animation).toEqual(DEFAULT_IMAGE_TARGET_ANIMATION);

    document.querySelector<HTMLButtonElement>('[data-select-target-object]')?.click();
    await waitFor(() => latestObjects()[0]?.animation?.preset === 'showcase');

    cards[1].click();
    await waitFor(() => latestObjects().length === 3);
    expect(latestObjects()[2]?.animation).toEqual(DEFAULT_IMAGE_TARGET_ANIMATION);
  }, 10000);
});

function selectAnimationPreset(value: string): void {
  const select = document.querySelector<HTMLSelectElement>('#target-animation-preset');
  if (!select) {
    throw new Error('Animation preset not found');
  }
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function latestObjects(): TargetEditorObject[] {
  return previewUpdates.at(-1)?.objects ?? [];
}

async function waitFor(assertion: () => boolean): Promise<void> {
  const timeoutAt = Date.now() + 1000;
  while (Date.now() < timeoutAt) {
    if (assertion()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for target animation defaults');
}

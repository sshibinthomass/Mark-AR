import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudflareModelOption } from '../src/app/cloudflareModels';

const previewMock = vi.hoisted(() => ({
  pendingModelLoad: undefined as undefined | { promise: Promise<void>; resolve: () => void },
}));

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
    update = vi.fn(async (state: { objects?: CloudflareModelOption[] }) => {
      if (state.objects?.length && previewMock.pendingModelLoad) {
        await previewMock.pendingModelLoad.promise;
      }
    });
    dispose = vi.fn();
  },
}));

describe('target model rail interaction', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="app"></div>';
    window.localStorage.clear();
    previewMock.pendingModelLoad = undefined;
  });

  it('adds a model object to the preview every time a rail card is clicked', async () => {
    await import('../src/main');
    await waitFor(() => document.querySelectorAll<HTMLButtonElement>('.target-model-card').length === 2);

    const cards = document.querySelectorAll<HTMLButtonElement>('.target-model-card');
    cards[0].click();
    await waitFor(() => document.querySelectorAll('[data-select-target-object]').length === 1);

    cards[1].click();
    await waitFor(() => document.querySelectorAll('[data-select-target-object]').length === 2);

    const objectRows = [...document.querySelectorAll('[data-select-target-object]')];
    expect(objectRows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Chair'),
      expect.stringContaining('Sofa'),
    ]);
    expect(document.querySelector('#image-target-status')?.textContent).toBe('Sofa added to the target.');
  }, 10000);

  it('shows a loader until the selected model finishes loading in the preview', async () => {
    let resolveModelLoad = () => undefined;
    const promise = new Promise<void>((resolve) => {
      resolveModelLoad = resolve;
    });
    previewMock.pendingModelLoad = { promise, resolve: resolveModelLoad };

    await import('../src/main');
    await waitFor(() => document.querySelectorAll<HTMLButtonElement>('.target-model-card').length === 2);

    document.querySelectorAll<HTMLButtonElement>('.target-model-card')[0].click();
    await waitFor(() => document.querySelector('.target-preview-loader') !== null);

    expect(document.querySelector('.target-preview-loader')?.textContent).toContain('Loading Chair…');
    expect(document.querySelector<HTMLButtonElement>('[data-model-id="generated-chair"]')?.disabled).toBe(true);

    resolveModelLoad();
    await waitFor(() => document.querySelector('.target-preview-loader') === null);
  }, 10000);
});

async function waitFor(assertion: () => boolean): Promise<void> {
  const timeoutAt = Date.now() + 1000;
  while (Date.now() < timeoutAt) {
    if (assertion()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for target model rail interaction');
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudflareModelOption } from '../src/app/cloudflareModels';

const models: CloudflareModelOption[] = [
  {
    id: 'generated-chair',
    label: 'Chair',
    url: 'https://worker.example/models/chair.glb',
    previewUrl: 'https://worker.example/previews/chair.png',
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
    update = vi.fn(async () => undefined);
    dispose = vi.fn();
  },
}));

describe('target object controls selection', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="app"></div>';
    window.localStorage.clear();
  });

  it('keeps object controls disabled without a selection and opens them when an object is selected', async () => {
    await import('../src/main');
    await waitFor(() => document.querySelectorAll<HTMLButtonElement>('.target-model-card').length === 1);

    const controlsTab = objectControlsTab();
    expect(controlsTab.disabled).toBe(true);
    expect(controlsTab.getAttribute('aria-disabled')).toBe('true');
    expect(controlsTab.getAttribute('aria-selected')).toBe('false');
    expect(objectControlsPanel().hidden).toBe(true);

    controlsTab.click();
    expect(controlsTab.getAttribute('aria-selected')).toBe('false');

    document.querySelector<HTMLButtonElement>('.target-model-card')?.click();
    await waitFor(() => objectControlsTab().getAttribute('aria-selected') === 'true');

    expect(objectControlsTab().disabled).toBe(false);
    expect(objectControlsTab().getAttribute('aria-disabled')).toBe('false');
    expect(objectControlsPanel().hidden).toBe(false);
    expect(textStylePanel().hidden).toBe(true);
    expect(document.querySelector('[data-target-inspector-panel="target"]')?.hasAttribute('hidden')).toBe(true);

    document.querySelector<HTMLButtonElement>('[data-delete-target-object]')?.click();
    await waitFor(() => objectControlsTab().disabled);

    expect(objectControlsTab().getAttribute('aria-selected')).toBe('false');
    expect(objectControlsPanel().hidden).toBe(true);
    expect(document.querySelector('[data-target-inspector-tab="objects"]')?.getAttribute('aria-selected')).toBe('true');
  }, 10000);

  it('shows text style controls in Object only when the selected object is text', async () => {
    await import('../src/main');
    await waitFor(() => document.querySelectorAll<HTMLButtonElement>('.target-model-card').length === 1);

    expect(textStylePanel().closest('[data-target-inspector-panel="object-controls"]')).toBeTruthy();
    expect(textStylePanel().closest('[data-target-inspector-panel="text"]')).toBeNull();
    expect(textStylePanel().hidden).toBe(true);

    document.querySelector<HTMLButtonElement>('#add-target-text')?.click();
    await waitFor(() => !textStylePanel().hidden);

    expect(objectControlsTab().getAttribute('aria-selected')).toBe('true');
    expect(textStylePanel().hidden).toBe(false);

    document.querySelector<HTMLButtonElement>('.target-model-card')?.click();
    await waitFor(() => textStylePanel().hidden);

    document.querySelector<HTMLButtonElement>('.target-object-row-text [data-select-target-object]')?.click();
    await waitFor(() => !textStylePanel().hidden);

    expect(textStylePanel().hidden).toBe(false);
  }, 10000);
});

function objectControlsTab(): HTMLButtonElement {
  const tab = document.querySelector<HTMLButtonElement>('[data-target-inspector-tab="object-controls"]');
  if (!tab) {
    throw new Error('Object controls tab not found');
  }
  return tab;
}

function objectControlsPanel(): HTMLElement {
  const panel = document.querySelector<HTMLElement>('[data-target-inspector-panel="object-controls"]');
  if (!panel) {
    throw new Error('Object controls panel not found');
  }
  return panel;
}

function textStylePanel(): HTMLDetailsElement {
  const panel = document.querySelector<HTMLDetailsElement>('[data-selected-text-style]');
  if (!panel) {
    throw new Error('Text style panel not found');
  }
  return panel;
}

async function waitFor(assertion: () => boolean): Promise<void> {
  const timeoutAt = Date.now() + 1000;
  while (Date.now() < timeoutAt) {
    if (assertion()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for target object controls selection');
}

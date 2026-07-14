import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudflareModelOption } from '../src/app/cloudflareModels';
import type { TargetEditorObject } from '../src/app/targetEditorObjects';

const models: CloudflareModelOption[] = [
  { id: 'chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
  { id: 'sofa', label: 'Sofa', url: 'https://worker.example/sofa.glb' },
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
  signupToWebArWorker: vi.fn(),
}));

vi.mock('../src/capture/cameraCapture', () => ({ imageFileToCapturedImage: vi.fn() }));
vi.mock('../src/ar/mindarRuntime', () => ({ startMarkerAR: vi.fn() }));
vi.mock('../src/scene/ImageTargetPreview', () => ({
  ImageTargetPreview: class {
    update = vi.fn(async (state: { objects: TargetEditorObject[] }) => {
      previewUpdates.push({ objects: structuredClone(state.objects) });
    });
    dispose = vi.fn();
  },
}));

describe('target animation editor integration', () => {
  beforeEach(() => {
    vi.resetModules();
    previewUpdates.length = 0;
    document.body.innerHTML = '<div id="app"></div>';
    window.localStorage.clear();
  });

  it('applies presets, changes edited tracks to Custom, and resets animation', async () => {
    await import('../src/main');
    await waitFor(() => document.querySelectorAll('.target-model-card').length === 2);
    document.querySelector<HTMLButtonElement>('.target-model-card')?.click();
    await waitFor(() => latestObjects().length === 1);

    selectPreset('showcase');
    await waitFor(() => latestObjects()[0]?.animation?.preset === 'showcase');
    expect(latestObjects()[0].animation?.tracks).toHaveLength(2);

    const amount = document.querySelector<HTMLInputElement>('[data-animation-field="amount"]')!;
    amount.value = '180';
    amount.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => latestObjects()[0]?.animation?.preset === 'custom');
    expect(currentPreset()).toBe('custom');

    document.querySelector<HTMLButtonElement>('#reset-target-animation')?.click();
    await waitFor(() => latestObjects()[0]?.animation?.preset === 'none');
    expect(latestObjects()[0].animation?.tracks).toEqual([]);
    expect(document.querySelectorAll('[data-animation-track]')).toHaveLength(0);
  }, 10000);

  it('restores independent animation state when switching selected objects', async () => {
    await import('../src/main');
    await waitFor(() => document.querySelectorAll('.target-model-card').length === 2);
    const modelCards = document.querySelectorAll<HTMLButtonElement>('.target-model-card');
    modelCards[0].click();
    await waitFor(() => latestObjects().length === 1);
    selectPreset('orbit');
    await waitFor(() => latestObjects()[0]?.animation?.preset === 'orbit');

    modelCards[1].click();
    await waitFor(() => latestObjects().length === 2);
    expect(latestObjects()[1].animation?.preset).toBe('none');
    expect(currentPreset()).toBe('none');

    document.querySelectorAll<HTMLButtonElement>('[data-select-target-object]')[0].click();
    await waitFor(() => currentPreset() === 'orbit');
    expect(document.querySelectorAll('[data-animation-track]')).toHaveLength(2);
  }, 10000);

  it('collapses a multi-selection before editing one object animation', async () => {
    await import('../src/main');
    await waitFor(() => document.querySelectorAll('.target-model-card').length === 2);
    const modelCards = document.querySelectorAll<HTMLButtonElement>('.target-model-card');
    modelCards[0].click();
    await waitFor(() => latestObjects().length === 1);
    selectPreset('orbit');
    await waitFor(() => latestObjects()[0]?.animation?.preset === 'orbit');

    modelCards[1].click();
    await waitFor(() => latestObjects().length === 2);
    const [firstObject, secondObject] = latestObjects();

    selectObject(firstObject.id, { ctrlKey: true });
    await waitFor(() => selectedObjectIds().length === 2);
    selectObject(firstObject.id);
    await waitFor(() => selectedObjectIds().length === 1);

    expect(selectedObjectIds()).toEqual([firstObject.id]);
    selectPreset('turntable');
    await waitFor(() => latestObjects()[0]?.animation?.preset === 'turntable');
    expect(latestObjects()[1]?.id).toBe(secondObject.id);
    expect(latestObjects()[1]?.animation?.preset).toBe('none');
  }, 10000);
});

function selectPreset(value: string): void {
  const select = document.querySelector<HTMLSelectElement>('#target-animation-preset')!;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function currentPreset(): string | undefined {
  return document.querySelector<HTMLSelectElement>('#target-animation-preset')?.value;
}

function latestObjects(): TargetEditorObject[] {
  return previewUpdates.at(-1)?.objects ?? [];
}

function selectObject(objectId: string, options: { ctrlKey?: boolean } = {}): void {
  document.querySelector<HTMLButtonElement>(`[data-select-target-object="${objectId}"]`)?.dispatchEvent(
    new MouseEvent('click', { bubbles: true, ctrlKey: options.ctrlKey }),
  );
}

function selectedObjectIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.target-object-row[aria-selected="true"]'))
    .map((row) => row.dataset.objectId)
    .filter((objectId): objectId is string => Boolean(objectId));
}

async function waitFor(assertion: () => boolean): Promise<void> {
  const timeoutAt = Date.now() + 1500;
  while (Date.now() < timeoutAt) {
    if (assertion()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for target animation editor state');
}

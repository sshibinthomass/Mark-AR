import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudflareModelOption } from '../src/app/cloudflareModels';
import type { TargetEditorGroup, TargetEditorSelection } from '../src/app/targetEditorGroups';
import { resolveObjectPlacement } from '../src/app/targetEditorGroups';
import type { TargetEditorObject } from '../src/app/targetEditorObjects';

const models: CloudflareModelOption[] = [
  { id: 'chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
  { id: 'lamp', label: 'Lamp', url: 'https://worker.example/lamp.glb' },
  { id: 'plant', label: 'Plant', url: 'https://worker.example/plant.glb' },
];
type PreviewUpdate = { objects: TargetEditorObject[]; groups: TargetEditorGroup[]; selection: TargetEditorSelection };
const previewUpdates: PreviewUpdate[] = [];

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
    update = vi.fn(async (state: PreviewUpdate) => previewUpdates.push(structuredClone(state)));
    dispose = vi.fn();
  },
}));

describe('target group editor integration', () => {
  beforeEach(() => {
    vi.resetModules();
    previewUpdates.length = 0;
    document.body.innerHTML = '<div id="app"></div>';
    window.localStorage.clear();
  });

  it('groups selected objects, edits the group and child, then ungroups without moving children', async () => {
    await import('../src/main');
    await waitFor(() => document.querySelectorAll('.target-model-card').length === 3);
    const cards = document.querySelectorAll<HTMLButtonElement>('.target-model-card');
    cards[0].click();
    cards[1].click();
    cards[2].click();
    await waitFor(() => latest().objects.length === 3);

    clickObject('chair');
    clickObject('lamp', { ctrlKey: true });
    await waitFor(() => document.querySelector<HTMLButtonElement>('#group-selected-objects')?.disabled === false);
    document.querySelector<HTMLButtonElement>('#group-selected-objects')?.click();
    await waitFor(() => latest().groups.length === 1);

    const groupId = latest().groups[0].id;
    expect(document.querySelectorAll('[data-target-object-group]')).toHaveLength(1);
    expect(document.querySelectorAll(`[data-target-object-group="${groupId}"] .target-object-group-children > .target-object-row`)).toHaveLength(2);
    expect(document.querySelectorAll('#target-object-list > .target-object-row')).toHaveLength(1);
    expect(document.querySelector('[data-target-inspector-tab="object-controls"]')?.textContent).toBe('Group 1');

    setRange('#target-offset-x', 0.4);
    selectPreset('gentle-float');
    await waitFor(() => latest().groups[0]?.placement.offsetX === 0.4 && latest().groups[0]?.animation.preset === 'gentle-float');

    clickObject('chair');
    await waitFor(() => document.querySelector('[data-target-inspector-tab="object-controls"]')?.textContent === 'Child of Group 1');
    const beforeLocalX = latest().objects.find((object) => modelIdOf(object) === 'chair')?.localPlacement?.offsetX ?? 0;
    setRange('#target-offset-x', beforeLocalX + 0.15);
    selectPreset('turntable');
    await waitFor(() => latest().objects.find((object) => modelIdOf(object) === 'chair')?.animation?.preset === 'turntable');
    expect(latest().groups[0].animation.preset).toBe('gentle-float');

    const worldsBefore = latest().objects
      .filter((object) => object.groupId === groupId)
      .map((object) => resolveObjectPlacement(object, latest().groups));
    document.querySelector<HTMLButtonElement>(`[data-ungroup-target-group="${groupId}"]`)?.click();
    await waitFor(() => latest().groups.length === 0);
    const formerChildren = latest().objects.filter((object) => modelIdOf(object) === 'chair' || modelIdOf(object) === 'lamp');
    formerChildren.forEach((object, index) => {
      expect(object.groupId).toBeUndefined();
      expect(object.localPlacement).toBeUndefined();
      expect(object.placement.offsetX).toBeCloseTo(worldsBefore[index].offsetX);
      expect(object.placement.offsetY).toBeCloseTo(worldsBefore[index].offsetY);
      expect(object.placement.height).toBeCloseTo(worldsBefore[index].height);
    });
  }, 10000);

  it('shows Mixed for different animations and batch-copies presets to selected objects', async () => {
    await import('../src/main');
    await waitFor(() => document.querySelectorAll('.target-model-card').length === 3);
    const cards = document.querySelectorAll<HTMLButtonElement>('.target-model-card');
    cards[0].click();
    await waitFor(() => latest().objects.length === 1);
    selectPreset('orbit');
    cards[1].click();
    await waitFor(() => latest().objects.length === 2);

    clickObject('chair', { ctrlKey: true });
    await waitFor(() => document.querySelector<HTMLSelectElement>('#target-animation-preset')?.value === 'mixed');
    expect(document.querySelectorAll('[data-animation-track]')).toHaveLength(0);
    expect(document.querySelector('[data-target-inspector-tab="object-controls"]')?.textContent).toBe('Selection (2)');

    selectPreset('showcase');
    await waitFor(() => latest().objects.every((object) => object.animation?.preset === 'showcase'));
    expect(latest().objects[0].animation?.tracks).not.toBe(latest().objects[1].animation?.tracks);
    expect(latest().objects.every((object) => object.animation?.tracks.length === 2)).toBe(true);

    document.querySelector<HTMLButtonElement>('#reset-target-animation')?.click();
    await waitFor(() => latest().objects.every((object) => object.animation?.preset === 'none'));
    expect(latest().objects.every((object) => object.animation?.tracks.length === 0)).toBe(true);
  }, 10000);
});

function clickObject(modelId: string, modifiers: MouseEventInit = {}): void {
  const object = latest().objects.find((candidate) => modelIdOf(candidate) === modelId);
  document.querySelector<HTMLButtonElement>(`[data-select-target-object="${object?.id}"]`)
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true, ...modifiers }));
}

function modelIdOf(object: TargetEditorObject): string {
  return 'model' in object ? object.model.id : '';
}

function setRange(selector: string, value: number): void {
  const input = document.querySelector<HTMLInputElement>(selector)!;
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function selectPreset(value: string): void {
  const select = document.querySelector<HTMLSelectElement>('#target-animation-preset')!;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function latest(): PreviewUpdate {
  return previewUpdates.at(-1) ?? { objects: [], groups: [], selection: { objectIds: [] } };
}

async function waitFor(assertion: () => boolean): Promise<void> {
  const timeoutAt = Date.now() + 1800;
  while (Date.now() < timeoutAt) {
    if (assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for target group editor state');
}

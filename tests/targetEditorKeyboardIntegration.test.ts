import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudflareModelOption } from '../src/app/cloudflareModels';
import type { TargetEditorGroup, TargetEditorSelection } from '../src/app/targetEditorGroups';
import type { TargetEditorObject } from '../src/app/targetEditorObjects';

const models: CloudflareModelOption[] = [
  { id: 'chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
  { id: 'lamp', label: 'Lamp', url: 'https://worker.example/lamp.glb' },
  { id: 'plant', label: 'Plant', url: 'https://worker.example/plant.glb' },
];
type PreviewUpdate = {
  objects: TargetEditorObject[];
  groups: TargetEditorGroup[];
  selection: TargetEditorSelection;
};
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
  getCurrentWebArUser: vi.fn(async () => ({ email: 'maker@example.com' })),
  loadWorkerAuthToken: vi.fn(() => 'token-123'),
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

describe('target editor keyboard integration', () => {
  beforeEach(() => {
    vi.resetModules();
    previewUpdates.length = 0;
    document.body.innerHTML = '<div id="app"></div>';
    window.localStorage.clear();
    window.history.replaceState(null, '', '#/targets');
  });

  it('moves and deletes the selected object anywhere on Targets while synchronizing inputs', async () => {
    await import('../src/main');
    await waitForEditor();
    document.querySelectorAll<HTMLButtonElement>('.target-model-card')[0].click();
    await waitFor(() => latest().objects.length === 1);

    const moveEvent = dispatchEditorKey(document.body, 'ArrowRight');
    await waitFor(() => latest().objects[0]?.placement.offsetX === 0.05);

    expect(moveEvent.defaultPrevented).toBe(true);
    expect(document.querySelector<HTMLInputElement>('#target-offset-x')?.value).toBe('0.05');

    const deleteEvent = dispatchEditorKey(document.body, 'Delete');
    await waitFor(() => latest().objects.length === 0);

    expect(deleteEvent.defaultPrevented).toBe(true);
    expect(document.querySelector('#target-object-list')?.textContent).toContain('No objects placed yet');
  }, 10000);

  it('leaves keyboard input alone while typing and when Targets is inactive', async () => {
    await import('../src/main');
    await waitForEditor();
    document.querySelectorAll<HTMLButtonElement>('.target-model-card')[0].click();
    await waitFor(() => latest().objects.length === 1);

    const label = document.querySelector<HTMLInputElement>('#target-label')!;
    const typingMove = dispatchEditorKey(label, 'ArrowRight');
    const typingDelete = dispatchEditorKey(label, 'Delete');

    expect(typingMove.defaultPrevented).toBe(false);
    expect(typingDelete.defaultPrevented).toBe(false);
    expect(latest().objects).toHaveLength(1);
    expect(latest().objects[0].placement.offsetX).toBe(0);

    document.querySelector<HTMLAnchorElement>('[data-route-link="home"]')!.click();
    await waitFor(() => document.querySelector('[data-app-shell]')?.getAttribute('data-active-page') === 'home');
    const inactiveMove = dispatchEditorKey(document.body, 'ArrowRight');

    expect(inactiveMove.defaultPrevented).toBe(false);
    expect(latest().objects[0].placement.offsetX).toBe(0);
  }, 10000);

  it('does not consume supported keys without a selection', async () => {
    await import('../src/main');
    await waitForEditor();

    const event = dispatchEditorKey(document.body, 'PageUp');

    expect(event.defaultPrevented).toBe(false);
    expect(latest().objects).toHaveLength(0);
  }, 10000);

  it('moves multi-object and group selections and deletes a selected group', async () => {
    await import('../src/main');
    await waitForEditor();
    const cards = document.querySelectorAll<HTMLButtonElement>('.target-model-card');
    cards[0].click();
    cards[1].click();
    cards[2].click();
    await waitFor(() => latest().objects.length === 3);

    clickObject('chair');
    clickObject('lamp', { ctrlKey: true });
    const chairStart = objectForModel('chair').placement.offsetY;
    const lampStart = objectForModel('lamp').placement.offsetY;

    dispatchEditorKey(document.body, 'ArrowUp');
    await waitFor(() => (
      Math.abs(objectForModel('chair').placement.offsetY - (chairStart - 0.05)) < 0.0001
      && Math.abs(objectForModel('lamp').placement.offsetY - (lampStart - 0.05)) < 0.0001
    ));

    document.querySelector<HTMLButtonElement>('#group-selected-objects')!.click();
    await waitFor(() => latest().groups.length === 1);
    dispatchEditorKey(document.body, 'PageUp');
    await waitFor(() => Math.abs(latest().groups[0].placement.height - 0.14) < 0.0001);

    dispatchEditorKey(document.body, 'Delete');
    await waitFor(() => latest().objects.length === 1);

    expect(latest().groups).toHaveLength(0);
    expect(modelIdOf(latest().objects[0])).toBe('plant');
  }, 10000);
});

function dispatchEditorKey(target: EventTarget, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function clickObject(modelId: string, modifiers: MouseEventInit = {}): void {
  const object = objectForModel(modelId);
  document.querySelector<HTMLButtonElement>(`[data-select-target-object="${object.id}"]`)!
    .dispatchEvent(new MouseEvent('click', { bubbles: true, ...modifiers }));
}

function objectForModel(modelId: string): TargetEditorObject {
  const object = latest().objects.find((candidate) => modelIdOf(candidate) === modelId);
  if (!object) {
    throw new Error(`Object for model ${modelId} not found`);
  }
  return object;
}

function modelIdOf(object: TargetEditorObject): string {
  return 'model' in object ? object.model.id : '';
}

function latest(): PreviewUpdate {
  return previewUpdates.at(-1) ?? { objects: [], groups: [], selection: { objectIds: [] } };
}

async function waitForEditor(): Promise<void> {
  await waitFor(() => (
    document.querySelectorAll('.target-model-card').length === models.length
    && document.querySelector('[data-app-shell]')?.getAttribute('data-active-page') === 'targets'
  ));
}

async function waitFor(assertion: () => boolean): Promise<void> {
  const timeoutAt = Date.now() + 1800;
  while (Date.now() < timeoutAt) {
    if (assertion()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for target keyboard editor state');
}

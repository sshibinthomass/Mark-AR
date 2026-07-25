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
  hiddenObjectIds?: string[];
  selectionLocked?: boolean;
};
const previewUpdates: PreviewUpdate[] = [];
const previewTransformModes: string[] = [];
const previewAnimationStates: boolean[] = [];

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
    setTransformMode = vi.fn((mode: string) => previewTransformModes.push(mode));
    setAnimationPlaying = vi.fn((playing: boolean) => previewAnimationStates.push(playing));
    dispose = vi.fn();
  },
}));

describe('target editor keyboard integration', () => {
  beforeEach(() => {
    vi.resetModules();
    previewUpdates.length = 0;
    previewTransformModes.length = 0;
    previewAnimationStates.length = 0;
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

  it('does not consume Undo, Redo, or disabled Save when no action can run', async () => {
    await import('../src/main');
    await waitForEditor();
    const saveButton = document.querySelector<HTMLButtonElement>('#save-image-target')!;
    saveButton.disabled = true;

    expect(dispatchEditorKey(document.body, 'z', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(dispatchEditorKey(document.body, 'z', { ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(false);
    expect(dispatchEditorKey(document.body, 's', { ctrlKey: true }).defaultPrevented).toBe(false);
  }, 10000);

  it('ignores modified and already-consumed keyboard events', async () => {
    await import('../src/main');
    await waitForEditor();
    document.querySelectorAll<HTMLButtonElement>('.target-model-card')[0].click();
    await waitFor(() => latest().objects.length === 1);

    const modifiedMove = dispatchEditorKey(document.body, 'ArrowRight', { ctrlKey: true });
    const shiftDelete = dispatchEditorKey(document.body, 'Delete', { shiftKey: true });
    const consumedMove = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    consumedMove.preventDefault();
    document.body.dispatchEvent(consumedMove);

    expect(modifiedMove.defaultPrevented).toBe(false);
    expect(shiftDelete.defaultPrevented).toBe(false);
    expect(latest().objects).toHaveLength(1);
    expect(latest().objects[0].placement.offsetX).toBe(0);
  }, 10000);

  it('deletes every object in an ungrouped multi-selection', async () => {
    await import('../src/main');
    await waitForEditor();
    const cards = document.querySelectorAll<HTMLButtonElement>('.target-model-card');
    cards[0].click();
    cards[1].click();
    cards[2].click();
    await waitFor(() => latest().objects.length === 3);

    clickObject('chair');
    clickObject('lamp', { ctrlKey: true });
    dispatchEditorKey(document.body, 'Delete');
    await waitFor(() => latest().objects.length === 1);

    expect(latest().groups).toHaveLength(0);
    expect(modelIdOf(latest().objects[0])).toBe('plant');
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

  it('supports fine movement, direct transforms, reset, and transform modes', async () => {
    await import('../src/main');
    await waitForEditor();
    document.querySelectorAll<HTMLButtonElement>('.target-model-card')[0].click();
    await waitFor(() => latest().objects.length === 1);

    dispatchEditorKey(document.body, 'ArrowRight', { shiftKey: true });
    dispatchEditorKey(document.body, 'PageUp', { shiftKey: true });
    dispatchEditorKey(document.body, '+', { shiftKey: true });
    dispatchEditorKey(document.body, ']');
    await waitFor(() => latest().objects[0]?.placement.rotationY === 5);

    expect(latest().objects[0].placement).toMatchObject({
      offsetX: 0.01,
      height: 0.125,
      scale: 1.05,
      rotationY: 5,
    });

    dispatchEditorKey(document.body, 'e');
    dispatchEditorKey(document.body, 'r');
    dispatchEditorKey(document.body, 'w');
    expect(previewTransformModes.slice(-3)).toEqual(['rotate', 'scale', 'translate']);

    dispatchEditorKey(document.body, 'Home');
    await waitFor(() => latest().objects[0]?.placement.rotationY === 0);
    expect(latest().objects[0].placement).toMatchObject({
      offsetX: 0,
      offsetY: 0,
      height: 0.12,
      scale: 1,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
    });
  }, 10000);

  it('cycles, duplicates, undoes, and redoes editor changes', async () => {
    await import('../src/main');
    await waitForEditor();
    const cards = document.querySelectorAll<HTMLButtonElement>('.target-model-card');
    cards[0].click();
    cards[1].click();
    cards[2].click();
    await waitFor(() => latest().objects.length === 3);

    const tabEvent = dispatchEditorKey(document.body, 'Tab');
    expect(tabEvent.defaultPrevented).toBe(true);
    expect(modelIdOf(selectedObject())).toBe('chair');

    dispatchEditorKey(document.body, 'Tab', { shiftKey: true });
    expect(modelIdOf(selectedObject())).toBe('plant');

    const plantOffset = selectedObject().placement.offsetX;
    dispatchEditorKey(document.body, 'd', { ctrlKey: true });
    await waitFor(() => latest().objects.length === 4);
    expect(modelIdOf(selectedObject())).toBe('plant');
    expect(selectedObject().placement.offsetX).toBeCloseTo(plantOffset + 0.05);

    dispatchEditorKey(document.body, 'ArrowRight');
    await waitFor(() => Math.abs(selectedObject().placement.offsetX - (plantOffset + 0.1)) < 0.0001);
    dispatchEditorKey(document.body, 'z', { ctrlKey: true });
    await waitFor(() => Math.abs(selectedObject().placement.offsetX - (plantOffset + 0.05)) < 0.0001);
    dispatchEditorKey(document.body, 'z', { ctrlKey: true, shiftKey: true });
    await waitFor(() => Math.abs(selectedObject().placement.offsetX - (plantOffset + 0.1)) < 0.0001);
  }, 10000);

  it('temporarily hides and locks a selection and rejects locked edits', async () => {
    await import('../src/main');
    await waitForEditor();
    document.querySelectorAll<HTMLButtonElement>('.target-model-card')[0].click();
    await waitFor(() => latest().objects.length === 1);

    dispatchEditorKey(document.body, 'h');
    await waitFor(() => latest().hiddenObjectIds?.length === 1);
    expect(latest().hiddenObjectIds).toEqual([latest().objects[0].id]);
    expect(document.querySelector('[data-object-state="hidden"]')?.textContent).toBe('Hidden');

    dispatchEditorKey(document.body, 'l');
    await waitFor(() => latest().selectionLocked === true);
    expect(document.querySelector('[data-object-state="locked"]')?.textContent).toBe('Locked');
    const modeCount = previewTransformModes.length;
    const lockedMode = dispatchEditorKey(document.body, 'e');
    const lockedMove = dispatchEditorKey(document.body, 'ArrowRight');
    const lockedDelete = dispatchEditorKey(document.body, 'Delete');
    expect(lockedMode.defaultPrevented).toBe(true);
    expect(previewTransformModes).toHaveLength(modeCount);
    expect(lockedMove.defaultPrevented).toBe(true);
    expect(lockedDelete.defaultPrevented).toBe(true);
    expect(latest().objects).toHaveLength(1);
    expect(latest().objects[0].placement.offsetX).toBe(0);
    expect(document.querySelector('#image-target-status')?.textContent).toContain('locked');

    dispatchEditorKey(document.body, 'l');
    dispatchEditorKey(document.body, 'ArrowRight');
    await waitFor(() => latest().objects[0]?.placement.offsetX === 0.05);
  }, 10000);

  it('runs camera, animation, and save shortcuts without an object selection', async () => {
    await import('../src/main');
    await waitForEditor();

    const cameraEvent = dispatchEditorKey(document.body, '7');
    expect(cameraEvent.defaultPrevented).toBe(true);
    expect(document.querySelector<HTMLInputElement>('#target-camera-distance')?.value).toBe('0.9');
    expect(document.querySelector<HTMLInputElement>('#target-camera-height')?.value).toBe('3');

    const animationEvent = dispatchEditorKey(document.body, ' ');
    expect(animationEvent.defaultPrevented).toBe(true);
    expect(previewAnimationStates.at(-1)).toBe(false);

    document.querySelectorAll<HTMLButtonElement>('.target-model-card')[0].click();
    await waitFor(() => latest().objects.length === 1);
    const helpInvoker = document.querySelector<HTMLButtonElement>('[data-transform-mode="translate"]')!;
    helpInvoker.focus();
    const helpEvent = dispatchEditorKey(helpInvoker, '?', { shiftKey: true });
    expect(helpEvent.defaultPrevented).toBe(true);
    expect(document.querySelector<HTMLElement>('#target-keyboard-help')?.hidden).toBe(false);
    expect(document.activeElement).toBe(document.querySelector('#close-target-keyboard-help'));
    const toggleCloseEvent = dispatchEditorKey(document.body, '?', { shiftKey: true });
    expect(toggleCloseEvent.defaultPrevented).toBe(true);
    expect(document.querySelector<HTMLElement>('#target-keyboard-help')?.hidden).toBe(true);
    dispatchEditorKey(helpInvoker, '?', { shiftKey: true });
    const blockedDelete = dispatchEditorKey(document.body, 'Delete');
    expect(blockedDelete.defaultPrevented).toBe(true);
    expect(latest().objects).toHaveLength(1);
    const closeEvent = dispatchEditorKey(document.body, 'Escape');
    expect(closeEvent.defaultPrevented).toBe(true);
    expect(document.querySelector<HTMLElement>('#target-keyboard-help')?.hidden).toBe(true);
    expect(document.activeElement).toBe(helpInvoker);

    let saveClicks = 0;
    document.querySelector<HTMLButtonElement>('#save-image-target')!
      .addEventListener('click', () => saveClicks += 1);
    const saveEvent = dispatchEditorKey(document.body, 's', { ctrlKey: true });
    expect(saveEvent.defaultPrevented).toBe(true);
    expect(saveClicks).toBe(1);
  }, 10000);

  it('disables destructive group controls while the group is locked', async () => {
    await import('../src/main');
    await waitForEditor();
    const cards = document.querySelectorAll<HTMLButtonElement>('.target-model-card');
    cards[0].click();
    cards[1].click();
    await waitFor(() => latest().objects.length === 2);
    clickObject('chair');
    clickObject('lamp', { ctrlKey: true });
    document.querySelector<HTMLButtonElement>('#group-selected-objects')!.click();
    await waitFor(() => latest().groups.length === 1);

    dispatchEditorKey(document.body, 'l');
    await waitFor(() => latest().selectionLocked === true);
    const ungroup = document.querySelector<HTMLButtonElement>('[data-ungroup-target-group]')!;
    expect(ungroup.disabled).toBe(true);
    ungroup.click();
    expect(latest().groups).toHaveLength(1);
  }, 10000);
});

function dispatchEditorKey(
  target: EventTarget,
  key: string,
  init: Omit<KeyboardEventInit, 'key'> = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
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

function selectedObject(): TargetEditorObject {
  const selectedId = latest().selection.objectIds.at(-1);
  const object = latest().objects.find((candidate) => candidate.id === selectedId);
  if (!object) {
    throw new Error('Selected object not found');
  }
  return object;
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

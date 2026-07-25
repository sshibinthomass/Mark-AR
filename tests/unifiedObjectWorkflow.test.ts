import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TargetEditorObject } from '../src/app/targetEditorObjects';

const previewUpdates: Array<{ objects: TargetEditorObject[] }> = [];
const createFileDraft = vi.fn();
const createUrlDraft = vi.fn();

vi.mock('../src/app/cloudflareModels', () => ({
  DEFAULT_GENERATE_MODEL_API_URL: 'https://worker.example/generate-3d',
  loadCloudflareModelOptions: vi.fn(async () => []),
}));

vi.mock('../src/app/cloudImageTargets', () => ({
  createImageTarget: vi.fn(),
  deleteImageTarget: vi.fn(),
  listImageTargets: vi.fn(async () => []),
  updateImageTarget: vi.fn(),
}));

vi.mock('../src/app/targetMediaDraft', () => ({
  createTargetImageDraftFromFile: createFileDraft,
  createTargetImageDraftFromUrl: createUrlDraft,
}));

vi.mock('../src/app/webArAuth', () => ({
  clearWorkerAuthToken: vi.fn(),
  getCurrentWebArUser: vi.fn(async () => null),
  loadWorkerAuthToken: vi.fn(() => null),
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
    update = vi.fn(async (state: { objects: TargetEditorObject[] }) => {
      previewUpdates.push({ objects: structuredClone(state.objects) });
    });
    setTransformMode = vi.fn();
    dispose = vi.fn();
  },
}));

describe('unified target object workflow', () => {
  beforeEach(() => {
    vi.resetModules();
    previewUpdates.length = 0;
    createFileDraft.mockReset();
    createUrlDraft.mockReset();
    document.body.innerHTML = '<div id="app"></div>';
    window.localStorage.clear();
  });

  it('switches creators and adds image and YouTube planes to the transformable scene', async () => {
    createUrlDraft.mockResolvedValue({
      image: {
        url: 'https://cdn.example/poster.png',
        label: 'poster.png',
        width: 1200,
        height: 800,
        aspectRatio: 1.5,
      },
      source: { source: 'url', sourceUrl: 'https://cdn.example/poster.png' },
    });
    await import('../src/main');

    clickKind('image');
    expect(creator('image').hidden).toBe(false);
    expect(creator('model').hidden).toBe(true);
    const imageUrl = document.querySelector<HTMLInputElement>('#target-object-image-url')!;
    imageUrl.value = 'https://cdn.example/poster.png';
    document.querySelector<HTMLButtonElement>('#add-target-image')!.click();
    await waitFor(() => latestObjects().some((object) => object.kind === 'image'));

    clickKind('youtube');
    const youtubeUrl = document.querySelector<HTMLInputElement>('#target-object-youtube-url')!;
    youtubeUrl.value = 'https://youtu.be/dQw4w9WgXcQ';
    document.querySelector<HTMLButtonElement>('#add-target-youtube')!.click();
    await waitFor(() => latestObjects().some((object) => object.kind === 'youtube'));

    const [image, youtube] = latestObjects();
    expect(image).toMatchObject({
      kind: 'image',
      image: { label: 'poster.png', aspectRatio: 1.5 },
    });
    expect(youtube).toMatchObject({
      kind: 'youtube',
      youtube: {
        videoId: 'dQw4w9WgXcQ',
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      },
    });
    expect(image.placement).toBeTruthy();
    expect(youtube.placement).toBeTruthy();
    expect(document.querySelector('.target-object-row-image')).toBeTruthy();
    expect(document.querySelector('.target-object-row-youtube')).toBeTruthy();
  }, 10000);
});

function clickKind(kind: string): void {
  document.querySelector<HTMLButtonElement>(`[data-add-object-kind="${kind}"]`)!.click();
}

function creator(kind: string): HTMLElement {
  return document.querySelector<HTMLElement>(`[data-object-creator="${kind}"]`)!;
}

function latestObjects(): TargetEditorObject[] {
  return previewUpdates.at(-1)?.objects ?? [];
}

async function waitFor(assertion: () => boolean): Promise<void> {
  const timeoutAt = Date.now() + 1500;
  while (Date.now() < timeoutAt) {
    if (assertion()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for object workflow');
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudImageTarget } from '../src/app/cloudImageTargets';

const savedTarget: CloudImageTarget = {
  id: 'target-1',
  label: 'Kitchen marker',
  imageUrl: 'https://worker.example/targets/kitchen.png',
  imageObjectKey: 'targets/kitchen.png',
  model: { id: 'chair', label: 'Chair', url: 'https://worker.example/models/chair.glb' },
  placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 0, rotationZ: 0 },
  objects: [
    {
      id: 'object-1',
      model: { id: 'chair', label: 'Chair', url: 'https://worker.example/models/chair.glb' },
      placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 0, rotationZ: 0 },
    },
  ],
};

const cloudImageTargetMocks = vi.hoisted(() => ({
  deleteImageTarget: vi.fn(async () => undefined),
  listImageTargets: vi.fn(async () => []),
}));

vi.mock('../src/app/cloudflareModels', () => ({
  DEFAULT_GENERATE_MODEL_API_URL: 'https://worker.example/generate-3d',
  loadCloudflareModelOptions: vi.fn(async () => []),
}));

vi.mock('../src/app/cloudImageTargets', () => ({
  createImageTarget: vi.fn(),
  deleteImageTarget: cloudImageTargetMocks.deleteImageTarget,
  listImageTargets: cloudImageTargetMocks.listImageTargets,
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

describe('saved target delete control', () => {
  beforeEach(() => {
    vi.resetModules();
    cloudImageTargetMocks.deleteImageTarget.mockClear();
    cloudImageTargetMocks.listImageTargets.mockResolvedValue([savedTarget]);
    document.body.innerHTML = '<div id="app"></div>';
    window.localStorage.clear();
  });

  it('renders saved target delete as an icon-only button with an accessible label', async () => {
    await import('../src/main');
    await waitFor(() => Boolean(document.querySelector<HTMLButtonElement>('[data-delete-target="target-1"]')));

    const deleteButton = document.querySelector<HTMLButtonElement>('[data-delete-target="target-1"]');

    expect(deleteButton?.getAttribute('aria-label')).toBe('Delete target Kitchen marker');
    expect(deleteButton?.getAttribute('title')).toBe('Delete target Kitchen marker');
    expect(deleteButton?.textContent?.trim()).toBe('');
    const icon = deleteButton?.querySelector('svg.trash-icon');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(icon?.querySelectorAll('path')).toHaveLength(3);

    deleteButton?.click();
    await waitFor(() => cloudImageTargetMocks.deleteImageTarget.mock.calls.length === 1);

    expect(cloudImageTargetMocks.deleteImageTarget).toHaveBeenCalledWith(expect.objectContaining({
      targetId: 'target-1',
    }));
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
  throw new Error('Timed out waiting for saved target delete control');
}

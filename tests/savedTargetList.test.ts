import { describe, expect, it, vi } from 'vitest';
import type { CloudImageTarget } from '../src/app/cloudImageTargets';
import { renderSavedTargetList } from '../src/ui/savedTargetList';

const placement = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  height: 0.12,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
};

const modelTarget: CloudImageTarget = {
  id: 'target-model',
  label: 'Product marker',
  imageUrl: 'https://worker.example/product.jpg',
  imageObjectKey: 'image-targets/images/product.jpg',
  model: { id: 'chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
  placement,
  objects: [
    { id: 'chair-1', model: { id: 'chair', label: 'Chair', url: 'https://worker.example/chair.glb' }, placement },
    { kind: 'text', id: 'text-1', text: { value: 'Sale', language: 'english', font: 'studio-sans' }, placement },
  ],
  groups: [],
  scanId: 'scan-target-model',
  accessMode: 'owner_only',
  allowedEmails: [],
};

const textTarget: CloudImageTarget = {
  id: 'target-text',
  label: 'Greeting marker',
  imageUrl: 'https://worker.example/greeting.jpg',
  imageObjectKey: 'image-targets/images/greeting.jpg',
  objects: [
    { kind: 'text', id: 'text-2', text: { value: 'Hallo AR', language: 'german', font: 'studio-serif-bold' }, placement },
  ],
  groups: [],
};

describe('saved target list', () => {
  it('renders independent keyboard edit and delete controls with active state', () => {
    const container = document.createElement('div');
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    renderSavedTargetList(container, {
      targets: [modelTarget, textTarget],
      activeTargetId: 'target-model',
      onEdit,
      onDelete,
    });

    const edit = container.querySelector<HTMLButtonElement>('[data-edit-target="target-model"]');
    const remove = container.querySelector<HTMLButtonElement>('[data-delete-target="target-model"]');
    expect(edit?.getAttribute('aria-current')).toBe('true');
    expect(edit?.closest('.saved-target-row')?.classList.contains('is-active')).toBe(true);
    expect(edit?.textContent).toContain('2 objects');
    expect(edit?.querySelector('button')).toBeNull();
    expect(remove?.getAttribute('aria-label')).toBe('Delete target Product marker');

    edit?.click();
    expect(onEdit).toHaveBeenCalledWith(modelTarget);
    expect(onDelete).not.toHaveBeenCalled();

    remove?.click();
    expect(onDelete).toHaveBeenCalledWith(modelTarget);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('uses the reusable text value as a single text target summary', () => {
    const container = document.createElement('div');

    renderSavedTargetList(container, {
      targets: [textTarget],
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });

    expect(container.querySelector('[data-edit-target="target-text"]')?.textContent).toContain('Hallo AR');
  });

  it('renders and copies the stable URL for exactly one saved target', () => {
    const container = document.createElement('div');
    const onCopyLink = vi.fn();
    const onDownloadQr = vi.fn();

    renderSavedTargetList(container, {
      targets: [modelTarget, textTarget],
      currentUrl: 'https://example.com/Mark-AR/#/targets',
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onCopyLink,
      onDownloadQr,
    });

    const openScan = container.querySelector<HTMLAnchorElement>('[data-open-target-scan="target-model"]');
    const copyLink = container.querySelector<HTMLButtonElement>('[data-copy-target-link="target-model"]');
    const downloadQr = container.querySelector<HTMLButtonElement>('[data-download-target-qr="target-model"]');
    expect(openScan?.getAttribute('href')).toBe('#/scan/scan-target-model');
    expect(openScan?.textContent).toBe('Open scanner');
    expect(copyLink?.textContent).toBe('Copy link');
    expect(downloadQr?.textContent).toBe('Download QR');
    expect(container.querySelector('[data-open-target-scan="target-text"]')).toBeNull();
    expect(container.querySelector('[data-download-target-qr="target-text"]')).toBeNull();

    copyLink?.click();
    expect(onCopyLink).toHaveBeenCalledWith(
      modelTarget,
      'https://example.com/Mark-AR/#/scan/scan-target-model',
    );
    downloadQr?.click();
    expect(onDownloadQr).toHaveBeenCalledWith(
      modelTarget,
      'https://example.com/Mark-AR/#/scan/scan-target-model',
    );
  });

  it('renders a directional empty state', () => {
    const container = document.createElement('div');

    renderSavedTargetList(container, {
      targets: [],
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    });

    expect(container.textContent).toBe('No saved experiences yet.');
  });
});

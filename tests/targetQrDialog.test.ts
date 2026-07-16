import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTargetQrDialog } from '../src/ui/targetQrDialog';

describe('target QR first-creation dialog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('opens in a loading state with the approved copy and dialog semantics', () => {
    const host = document.createElement('main');
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save target';
    document.body.append(host, saveButton);
    const handlers = createHandlers();
    const dialog = createTargetQrDialog(host, handlers);

    saveButton.focus();
    dialog.open({
      targetLabel: 'Product marker',
      scanUrl: 'https://example.com/Mark-AR/#/scan/scan-one',
      scanHref: '#/scan/scan-one',
      returnFocus: saveButton,
    });

    const overlay = host.querySelector<HTMLElement>('[data-target-qr-overlay]');
    const modal = host.querySelector<HTMLElement>('[role="dialog"]');
    expect(overlay?.hidden).toBe(false);
    expect(modal?.getAttribute('aria-modal')).toBe('true');
    expect(modal?.getAttribute('aria-labelledby')).toBe('target-qr-heading');
    expect(modal?.getAttribute('aria-describedby')).toBe('target-qr-instructions');
    expect(host.querySelector('[data-target-qr-heading]')?.textContent).toBe(
      'Your AR experience is ready',
    );
    expect(host.querySelector('[data-target-qr-target]')?.textContent).toBe('Product marker');
    expect(host.textContent).toContain(
      'Share this QR code with your audience. Scan it to open the AR experience, allow camera access, then point the camera at the target image to reveal the content in augmented reality.',
    );
    expect(host.querySelector('[data-target-qr-url]')?.textContent).toBe(
      'https://example.com/Mark-AR/#/scan/scan-one',
    );
    expect(host.querySelector<HTMLElement>('[data-target-qr-loading]')?.hidden).toBe(false);
    expect(host.querySelector<HTMLImageElement>('[data-target-qr-preview]')?.hidden).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('[data-target-qr-download]')?.disabled).toBe(true);
    expect(document.activeElement).toBe(host.querySelector('[data-target-qr-done]'));
    expect(dialog.isOpen()).toBe(true);
  });

  it('renders ready and error states without removing the share actions', () => {
    const host = document.createElement('main');
    document.body.append(host);
    const dialog = createTargetQrDialog(host, createHandlers());
    dialog.open(openInput());

    dialog.setReady('blob:target-preview');

    const preview = host.querySelector<HTMLImageElement>('[data-target-qr-preview]');
    expect(preview?.src).toBe('blob:target-preview');
    expect(preview?.alt).toBe('QR code for Product marker');
    expect(preview?.hidden).toBe(false);
    expect(host.querySelector<HTMLElement>('[data-target-qr-loading]')?.hidden).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('[data-target-qr-download]')?.disabled).toBe(false);
    expect(host.querySelector<HTMLElement>('[data-target-qr-retry]')?.hidden).toBe(true);

    dialog.setError('Unable to prepare the QR code.');

    expect(preview?.hidden).toBe(true);
    expect(host.querySelector<HTMLElement>('[data-target-qr-loading]')?.hidden).toBe(true);
    expect(host.querySelector<HTMLElement>('[data-target-qr-error]')?.hidden).toBe(false);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Unable to prepare the QR code.');
    expect(host.querySelector<HTMLButtonElement>('[data-target-qr-download]')?.disabled).toBe(true);
    expect(host.querySelector<HTMLElement>('[data-target-qr-retry]')?.hidden).toBe(false);
    expect(host.querySelector('[data-target-qr-copy]')).toBeTruthy();
    expect(host.querySelector('[data-target-qr-open]')).toBeTruthy();
    expect(host.querySelector('[data-target-qr-done]')).toBeTruthy();
  });

  it('routes every action through the current open target', () => {
    const host = document.createElement('main');
    document.body.append(host);
    const handlers = createHandlers();
    const dialog = createTargetQrDialog(host, handlers);
    dialog.open(openInput());
    dialog.setReady('blob:target-preview');

    host.querySelector<HTMLButtonElement>('[data-target-qr-download]')?.click();
    host.querySelector<HTMLButtonElement>('[data-target-qr-copy]')?.click();
    host.querySelector<HTMLButtonElement>('[data-target-qr-open]')?.click();
    dialog.setError('Try again');
    host.querySelector<HTMLButtonElement>('[data-target-qr-retry]')?.click();

    expect(handlers.onDownload).toHaveBeenCalledOnce();
    expect(handlers.onCopy).toHaveBeenCalledWith(
      'https://example.com/Mark-AR/#/scan/scan-one',
    );
    expect(handlers.onOpenScanner).toHaveBeenCalledWith('#/scan/scan-one');
    expect(handlers.onRetry).toHaveBeenCalledOnce();
  });

  it('closes on Done, Escape, and the backdrop and restores focus', () => {
    const host = document.createElement('main');
    const saveButton = document.createElement('button');
    document.body.append(host, saveButton);
    const handlers = createHandlers();
    const dialog = createTargetQrDialog(host, handlers);

    for (const closeDialog of [
      () => host.querySelector<HTMLButtonElement>('[data-target-qr-done]')?.click(),
      () => host.querySelector<HTMLElement>('[data-target-qr-overlay]')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
      () => host.querySelector<HTMLElement>('[data-target-qr-overlay]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      ),
    ]) {
      saveButton.focus();
      dialog.open({ ...openInput(), returnFocus: saveButton });
      closeDialog();
      expect(dialog.isOpen()).toBe(false);
      expect(host.querySelector<HTMLElement>('[data-target-qr-overlay]')?.hidden).toBe(true);
      expect(document.activeElement).toBe(saveButton);
    }

    expect(handlers.onClose).toHaveBeenCalledTimes(3);
  });

  it('contains Tab focus within enabled dialog actions', () => {
    const host = document.createElement('main');
    document.body.append(host);
    const dialog = createTargetQrDialog(host, createHandlers());
    dialog.open(openInput());
    dialog.setReady('blob:target-preview');
    const overlay = host.querySelector<HTMLElement>('[data-target-qr-overlay]')!;
    const copy = host.querySelector<HTMLButtonElement>('[data-target-qr-copy]')!;
    const done = host.querySelector<HTMLButtonElement>('[data-target-qr-done]')!;
    const download = host.querySelector<HTMLButtonElement>('[data-target-qr-download]')!;

    done.focus();
    overlay.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    }));
    expect(document.activeElement).toBe(download);

    download.focus();
    overlay.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }));
    expect(document.activeElement).toBe(done);

    copy.focus();
    overlay.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    }));
    expect(document.activeElement).toBe(copy);
  });

  it('destroys its markup and listeners without double-closing', () => {
    const host = document.createElement('main');
    document.body.append(host);
    const handlers = createHandlers();
    const dialog = createTargetQrDialog(host, handlers);
    dialog.open(openInput());

    dialog.destroy();
    dialog.destroy();

    expect(host.querySelector('[data-target-qr-overlay]')).toBeNull();
    expect(handlers.onClose).toHaveBeenCalledOnce();
  });
});

function openInput() {
  return {
    targetLabel: 'Product marker',
    scanUrl: 'https://example.com/Mark-AR/#/scan/scan-one',
    scanHref: '#/scan/scan-one',
  };
}

function createHandlers() {
  return {
    onDownload: vi.fn(),
    onCopy: vi.fn(),
    onOpenScanner: vi.fn(),
    onRetry: vi.fn(),
    onClose: vi.fn(),
  };
}

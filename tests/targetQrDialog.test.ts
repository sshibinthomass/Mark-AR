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
    expect(host.querySelector<HTMLButtonElement>('[data-target-qr-share]')?.disabled).toBe(true);
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
    expect(host.querySelector<HTMLButtonElement>('[data-target-qr-share]')?.disabled).toBe(false);
    expect(host.querySelector<HTMLButtonElement>('[data-target-qr-download]')?.disabled).toBe(false);
    expect(host.querySelector<HTMLElement>('[data-target-qr-retry]')?.hidden).toBe(true);

    dialog.setError('Unable to prepare the QR code.');

    expect(preview?.hidden).toBe(true);
    expect(host.querySelector<HTMLElement>('[data-target-qr-loading]')?.hidden).toBe(true);
    expect(host.querySelector<HTMLElement>('[data-target-qr-error]')?.hidden).toBe(false);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Unable to prepare the QR code.');
    expect(host.querySelector<HTMLButtonElement>('[data-target-qr-share]')?.disabled).toBe(true);
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

    host.querySelector<HTMLButtonElement>('[data-target-qr-share]')?.click();
    host.querySelector<HTMLButtonElement>('[data-target-qr-download]')?.click();
    host.querySelector<HTMLButtonElement>('[data-target-qr-copy]')?.click();
    host.querySelector<HTMLButtonElement>('[data-target-qr-open]')?.click();
    dialog.setError('Try again');
    host.querySelector<HTMLButtonElement>('[data-target-qr-retry]')?.click();

    expect(handlers.onShare).toHaveBeenCalledWith(
      'https://example.com/Mark-AR/#/scan/scan-one',
      'Product marker',
    );
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
    const share = host.querySelector<HTMLButtonElement>('[data-target-qr-share]')!;

    done.focus();
    overlay.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    }));
    expect(document.activeElement).toBe(share);

    share.focus();
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

  it('places Share QR first as the primary action and Download QR second', () => {
    const host = document.createElement('main');
    document.body.append(host);
    const dialog = createTargetQrDialog(host, createHandlers());
    dialog.open(openInput());

    const actions = [...host.querySelectorAll<HTMLButtonElement>('.target-qr-actions button')];
    const share = host.querySelector<HTMLButtonElement>('[data-target-qr-share]')!;
    const download = host.querySelector<HTMLButtonElement>('[data-target-qr-download]')!;

    expect(actions.indexOf(share)).toBeLessThan(actions.indexOf(download));
    expect(share.classList.contains('action-control--primary')).toBe(true);
    expect(download.classList.contains('action-control--secondary')).toBe(true);
  });

  it('guards repeated shares, reports success, and restores the ready state', async () => {
    const host = document.createElement('main');
    document.body.append(host);
    let resolveShare = (_result: 'shared') => undefined;
    const handlers = createHandlers();
    handlers.onShare.mockImplementation(() => new Promise((resolve) => {
      resolveShare = resolve;
    }));
    const dialog = createTargetQrDialog(host, handlers);
    dialog.open(openInput());
    dialog.setReady('blob:target-preview');
    const share = host.querySelector<HTMLButtonElement>('[data-target-qr-share]')!;

    share.click();
    share.click();

    expect(handlers.onShare).toHaveBeenCalledOnce();
    expect(handlers.onShare).toHaveBeenCalledWith(
      'https://example.com/Mark-AR/#/scan/scan-one',
      'Product marker',
    );
    expect(share.disabled).toBe(true);
    expect(share.textContent).toBe('Sharing\u2026');
    expect(share.getAttribute('aria-busy')).toBe('true');

    resolveShare('shared');
    await Promise.resolve();
    await Promise.resolve();

    expect(share.disabled).toBe(false);
    expect(share.textContent).toBe('Share QR');
    expect(share.hasAttribute('aria-busy')).toBe(false);
    expect(host.querySelector('[data-target-qr-share-status]')?.textContent).toBe(
      'QR code and scan link shared.',
    );
  });

  it.each([
    ['downloaded-and-copied', 'QR downloaded and scan link copied. Attach the QR image and paste the link in your app.'],
    ['downloaded-copy-failed', 'QR downloaded. Copy the scan link manually from above.'],
    ['failed', 'The QR could not be shared. Try again or use Download QR and Copy link.'],
  ] as const)('renders the %s share result', async (result, message) => {
    const host = document.createElement('main');
    document.body.append(host);
    const handlers = createHandlers();
    handlers.onShare.mockResolvedValue(result);
    const dialog = createTargetQrDialog(host, handlers);
    dialog.open(openInput());
    dialog.setReady('blob:target-preview');

    host.querySelector<HTMLButtonElement>('[data-target-qr-share]')?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(host.querySelector('[data-target-qr-share-status]')?.textContent).toBe(message);
  });

  it('keeps cancellation silent and ignores a result after close', async () => {
    const host = document.createElement('main');
    document.body.append(host);
    let resolveShare = (_result: 'cancelled' | 'shared') => undefined;
    const handlers = createHandlers();
    handlers.onShare.mockImplementation(() => new Promise((resolve) => {
      resolveShare = resolve;
    }));
    const dialog = createTargetQrDialog(host, handlers);
    dialog.open(openInput());
    dialog.setReady('blob:target-preview');
    host.querySelector<HTMLButtonElement>('[data-target-qr-share]')?.click();
    resolveShare('cancelled');
    await Promise.resolve();
    await Promise.resolve();
    expect(host.querySelector<HTMLElement>('[data-target-qr-share-status]')?.hidden).toBe(true);

    host.querySelector<HTMLButtonElement>('[data-target-qr-share]')?.click();
    dialog.close();
    resolveShare('shared');
    await Promise.resolve();
    await Promise.resolve();
    expect(dialog.isOpen()).toBe(false);
    expect(host.querySelector<HTMLElement>('[data-target-qr-share-status]')?.hidden).toBe(true);
  });

  it('ignores an old share result after reopening with the same input object', async () => {
    const host = document.createElement('main');
    document.body.append(host);
    let resolveOldShare = (_result: 'shared') => undefined;
    let resolveNewShare = (_result: 'downloaded-copy-failed') => undefined;
    const handlers = createHandlers();
    handlers.onShare
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveOldShare = resolve;
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveNewShare = resolve;
      }));
    const dialog = createTargetQrDialog(host, handlers);
    const input = openInput();
    const share = host.querySelector<HTMLButtonElement>('[data-target-qr-share]')!;
    const status = host.querySelector<HTMLElement>('[data-target-qr-share-status]')!;

    dialog.open(input);
    dialog.setReady('blob:old-target-preview');
    share.click();
    dialog.close();

    dialog.open(input);
    dialog.setReady('blob:new-target-preview');
    share.click();

    resolveOldShare('shared');
    await Promise.resolve();
    await Promise.resolve();

    expect(status.hidden).toBe(true);
    expect(status.textContent).toBe('');
    expect(share.disabled).toBe(true);
    expect(share.textContent).toBe('Sharing\u2026');

    resolveNewShare('downloaded-copy-failed');
    await Promise.resolve();
    await Promise.resolve();

    expect(status.hidden).toBe(false);
    expect(status.textContent).toBe('QR downloaded. Copy the scan link manually from above.');
    expect(share.disabled).toBe(false);
    expect(share.textContent).toBe('Share QR');
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
    onShare: vi.fn().mockResolvedValue('shared'),
    onDownload: vi.fn(),
    onCopy: vi.fn(),
    onOpenScanner: vi.fn(),
    onRetry: vi.fn(),
    onClose: vi.fn(),
  };
}

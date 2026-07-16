export type TargetQrDialogOpenInput = {
  targetLabel: string;
  scanUrl: string;
  scanHref: string;
  returnFocus?: HTMLElement;
};

export type TargetQrDialogHandlers = {
  onDownload: () => void;
  onCopy: (scanUrl: string) => void | Promise<void>;
  onOpenScanner: (scanHref: string) => void;
  onRetry: () => void;
  onClose: () => void;
};

export type TargetQrDialog = {
  open: (input: TargetQrDialogOpenInput) => void;
  setLoading: () => void;
  setReady: (previewUrl: string) => void;
  setError: (message: string) => void;
  close: () => void;
  isOpen: () => boolean;
  destroy: () => void;
};

export function createTargetQrDialog(
  host: HTMLElement,
  handlers: TargetQrDialogHandlers,
): TargetQrDialog {
  const overlay = document.createElement('div');
  overlay.className = 'target-qr-overlay';
  overlay.dataset.targetQrOverlay = '';
  overlay.hidden = true;
  overlay.innerHTML = `
    <section
      class="target-qr-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="target-qr-heading"
      aria-describedby="target-qr-instructions"
    >
      <div class="target-qr-dialog-copy">
        <p class="eyebrow">AnchorAR share link</p>
        <h2 id="target-qr-heading" data-target-qr-heading>Your AR experience is ready</h2>
        <p id="target-qr-instructions">Share this QR code with your audience. Scan it to open the AR experience, allow camera access, then point the camera at the target image to reveal the content in augmented reality.</p>
        <p class="target-qr-target"><span>Target</span><strong data-target-qr-target></strong></p>
      </div>
      <div class="target-qr-preview-shell">
        <div class="target-qr-loading" data-target-qr-loading role="status">
          Preparing your QR code…
        </div>
        <img data-target-qr-preview alt="" hidden>
        <p class="target-qr-error" data-target-qr-error role="alert" hidden></p>
      </div>
      <div class="target-qr-share-link">
        <span>Scan URL</span>
        <code data-target-qr-url></code>
      </div>
      <div class="target-qr-actions">
        <button
          class="action-control action-control--primary"
          type="button"
          data-target-qr-download
          disabled
        >Download QR</button>
        <button
          class="action-control action-control--secondary"
          type="button"
          data-target-qr-copy
        >Copy link</button>
        <button
          class="action-control action-control--secondary"
          type="button"
          data-target-qr-open
        >Open scanner</button>
        <button
          class="action-control action-control--secondary"
          type="button"
          data-target-qr-retry
          hidden
        >Try again</button>
        <button
          class="action-control action-control--quiet"
          type="button"
          data-target-qr-done
        >Done</button>
      </div>
    </section>
  `;
  host.append(overlay);

  const targetLabel = queryRequired<HTMLElement>(overlay, '[data-target-qr-target]');
  const url = queryRequired<HTMLElement>(overlay, '[data-target-qr-url]');
  const loading = queryRequired<HTMLElement>(overlay, '[data-target-qr-loading]');
  const preview = queryRequired<HTMLImageElement>(overlay, '[data-target-qr-preview]');
  const error = queryRequired<HTMLElement>(overlay, '[data-target-qr-error]');
  const download = queryRequired<HTMLButtonElement>(overlay, '[data-target-qr-download]');
  const copy = queryRequired<HTMLButtonElement>(overlay, '[data-target-qr-copy]');
  const openScanner = queryRequired<HTMLButtonElement>(overlay, '[data-target-qr-open]');
  const retry = queryRequired<HTMLButtonElement>(overlay, '[data-target-qr-retry]');
  const done = queryRequired<HTMLButtonElement>(overlay, '[data-target-qr-done]');
  let currentInput: TargetQrDialogOpenInput | undefined;
  let returnFocus: HTMLElement | undefined;
  let destroyed = false;

  const close = (): void => {
    if (overlay.hidden) {
      return;
    }
    overlay.hidden = true;
    currentInput = undefined;
    handlers.onClose();
    const focusTarget = returnFocus;
    returnFocus = undefined;
    focusTarget?.focus({ preventScroll: true });
  };

  const onOverlayClick = (event: MouseEvent): void => {
    if (event.target === overlay) {
      close();
    }
  };

  const onOverlayKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const focusable = enabledActions(overlay);
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onDownload = (): void => {
    if (!download.disabled) {
      handlers.onDownload();
    }
  };
  const onCopy = (): void => {
    if (currentInput) {
      void handlers.onCopy(currentInput.scanUrl);
    }
  };
  const onOpenScanner = (): void => {
    if (currentInput) {
      handlers.onOpenScanner(currentInput.scanHref);
    }
  };

  overlay.addEventListener('click', onOverlayClick);
  overlay.addEventListener('keydown', onOverlayKeyDown);
  download.addEventListener('click', onDownload);
  copy.addEventListener('click', onCopy);
  openScanner.addEventListener('click', onOpenScanner);
  retry.addEventListener('click', handlers.onRetry);
  done.addEventListener('click', close);

  const setLoading = (): void => {
    loading.hidden = false;
    preview.hidden = true;
    preview.removeAttribute('src');
    error.hidden = true;
    error.textContent = '';
    retry.hidden = true;
    download.disabled = true;
  };

  return {
    open(input) {
      if (destroyed) {
        return;
      }
      currentInput = input;
      returnFocus = input.returnFocus
        ?? (document.activeElement instanceof HTMLElement ? document.activeElement : undefined);
      targetLabel.textContent = input.targetLabel;
      url.textContent = input.scanUrl;
      setLoading();
      overlay.hidden = false;
      done.focus({ preventScroll: true });
    },
    setLoading,
    setReady(previewUrl) {
      loading.hidden = true;
      error.hidden = true;
      error.textContent = '';
      retry.hidden = true;
      preview.src = previewUrl;
      preview.alt = `QR code for ${currentInput?.targetLabel ?? 'target'}`;
      preview.hidden = false;
      download.disabled = false;
    },
    setError(message) {
      loading.hidden = true;
      preview.hidden = true;
      preview.removeAttribute('src');
      error.textContent = message;
      error.hidden = false;
      retry.hidden = false;
      download.disabled = true;
    },
    close,
    isOpen() {
      return !overlay.hidden;
    },
    destroy() {
      if (destroyed) {
        return;
      }
      close();
      destroyed = true;
      overlay.removeEventListener('click', onOverlayClick);
      overlay.removeEventListener('keydown', onOverlayKeyDown);
      download.removeEventListener('click', onDownload);
      copy.removeEventListener('click', onCopy);
      openScanner.removeEventListener('click', onOpenScanner);
      retry.removeEventListener('click', handlers.onRetry);
      done.removeEventListener('click', close);
      overlay.remove();
    },
  };
}

function enabledActions(overlay: HTMLElement): HTMLButtonElement[] {
  return [...overlay.querySelectorAll<HTMLButtonElement>('button')]
    .filter((button) => !button.disabled && !button.hidden);
}

function queryRequired<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Target QR dialog control not found: ${selector}`);
  }
  return element;
}

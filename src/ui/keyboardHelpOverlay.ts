type KeyboardHelpOverlay = {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  handleKeyDown(event: KeyboardEvent): boolean;
};

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function createKeyboardHelpOverlay(
  root: HTMLElement,
  closeButton: HTMLButtonElement,
): KeyboardHelpOverlay {
  let returnFocus: HTMLElement | undefined;

  function focusableElements(): HTMLElement[] {
    return [...root.querySelectorAll<HTMLElement>(focusableSelector)]
      .filter((element) => !element.hidden);
  }

  function open(): void {
    if (!root.hidden) {
      return;
    }
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    root.hidden = false;
    closeButton.focus();
  }

  function close(): void {
    if (root.hidden) {
      return;
    }
    root.hidden = true;
    if (returnFocus?.isConnected) {
      returnFocus.focus();
    }
    returnFocus = undefined;
  }

  return {
    open,
    close,
    toggle() {
      if (root.hidden) {
        open();
      } else {
        close();
      }
    },
    isOpen() {
      return !root.hidden;
    },
    handleKeyDown(event) {
      if (root.hidden) {
        return false;
      }
      if (event.key === 'Escape' || event.key === '?') {
        close();
        return true;
      }
      if (event.key !== 'Tab') {
        return true;
      }

      const focusable = focusableElements();
      if (focusable.length === 0) {
        return true;
      }
      const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const startIndex = activeIndex < 0 ? 0 : activeIndex;
      const nextIndex = event.shiftKey
        ? (startIndex - 1 + focusable.length) % focusable.length
        : (startIndex + 1) % focusable.length;
      focusable[nextIndex].focus();
      return true;
    },
  };
}

import { describe, expect, it } from 'vitest';
import { createKeyboardHelpOverlay } from '../src/ui/keyboardHelpOverlay';

describe('keyboard help overlay', () => {
  it('focuses the close control, traps Tab, blocks background commands, and restores focus', () => {
    document.body.innerHTML = `
      <button id="invoker">Help</button>
      <section id="overlay" hidden>
        <button id="close">Close</button>
        <a href="#settings">Settings</a>
      </section>
    `;
    const invoker = document.querySelector<HTMLButtonElement>('#invoker')!;
    const root = document.querySelector<HTMLElement>('#overlay')!;
    const close = document.querySelector<HTMLButtonElement>('#close')!;
    const settings = document.querySelector<HTMLAnchorElement>('a')!;
    const overlay = createKeyboardHelpOverlay(root, close);

    invoker.focus();
    overlay.open();
    expect(root.hidden).toBe(false);
    expect(document.activeElement).toBe(close);
    expect(overlay.handleKeyDown(new KeyboardEvent('keydown', { key: 'Delete' }))).toBe(true);
    expect(overlay.handleKeyDown(new KeyboardEvent('keydown', { key: '?', shiftKey: true }))).toBe(true);
    expect(root.hidden).toBe(true);
    expect(document.activeElement).toBe(invoker);

    overlay.open();
    close.focus();
    expect(overlay.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))).toBe(true);
    expect(document.activeElement).toBe(settings);

    expect(overlay.handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }))).toBe(true);
    expect(root.hidden).toBe(true);
    expect(document.activeElement).toBe(invoker);
  });
});

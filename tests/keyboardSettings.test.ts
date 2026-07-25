import { describe, expect, it } from 'vitest';
import { keyboardShortcutSections } from '../src/app/keyboardShortcuts';
import { renderKeyboardSettings } from '../src/ui/keyboardSettings';

describe('keyboard shortcut Settings', () => {
  it('catalogs every currently implemented shortcut and no proposed actions', () => {
    expect(keyboardShortcutSections.map((section) => section.id)).toEqual([
      'editing',
      'object-movement',
      'transform-tools',
      'visibility-playback',
      'camera-views',
    ]);
    const catalog = JSON.stringify(keyboardShortcutSections);
    expect(catalog).toMatch(/Undo/);
    expect(catalog).toMatch(/Redo/);
    expect(catalog).toMatch(/Duplicate/);
    expect(catalog).toMatch(/Hide or show/);
    expect(catalog).toMatch(/Lock or unlock/);
    expect(catalog).toMatch(/Play or pause animation/);
    expect(catalog).toMatch(/Save the target/);
    expect(catalog).toMatch(/Open keyboard help/);
    expect(keyboardShortcutSections.flatMap((section) => section.shortcuts)).toHaveLength(27);
  });

  it('renders sectioned semantic lists, key labels, and scope guidance', () => {
    const container = document.createElement('div');
    container.innerHTML = renderKeyboardSettings();

    expect(container.querySelectorAll('.keyboard-shortcut-card')).toHaveLength(5);
    expect(container.querySelectorAll('.keyboard-shortcut-row')).toHaveLength(27);
    expect([...container.querySelectorAll('kbd')].map((key) => key.textContent)).toEqual(
      expect.arrayContaining(['Ctrl/Command + Z', 'Shift + Arrow', 'Delete', 'H', 'L', 'Space', '?']),
    );
    expect(container.querySelector('.keyboard-settings-intro')?.textContent).toContain(
      'work throughout Studio',
    );
    expect(container.textContent).toContain('Not while typing or editing a form');
    expect(container.textContent).toContain('Available throughout Studio');
    expect(container.querySelectorAll('.keyboard-shortcut-list')).toHaveLength(5);
  });
});

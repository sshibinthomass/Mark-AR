import { describe, expect, it } from 'vitest';
import { keyboardShortcutSections } from '../src/app/keyboardShortcuts';
import { renderKeyboardSettings } from '../src/ui/keyboardSettings';

describe('keyboard shortcut Settings', () => {
  it('catalogs every currently implemented shortcut and no proposed actions', () => {
    expect(keyboardShortcutSections.map((section) => section.id)).toEqual([
      'object-movement',
      'transform-tools',
      'camera-views',
    ]);
    expect(keyboardShortcutSections.flatMap((section) => (
      section.shortcuts.map(({ action, keys }) => ({ action, keys: [...keys] }))
    ))).toEqual([
      { action: 'Move selected objects left', keys: ['Arrow Left'] },
      { action: 'Move selected objects right', keys: ['Arrow Right'] },
      { action: 'Move selected objects forward', keys: ['Arrow Up'] },
      { action: 'Move selected objects backward', keys: ['Arrow Down'] },
      { action: 'Raise selected objects', keys: ['Page Up'] },
      { action: 'Lower selected objects', keys: ['Page Down'] },
      { action: 'Remove selected objects', keys: ['Delete'] },
      { action: 'Activate Move', keys: ['W', 'G'] },
      { action: 'Activate Rotate', keys: ['E'] },
      { action: 'Activate Scale', keys: ['R', 'S'] },
      { action: 'Finish the interaction and return to Move', keys: ['Escape', 'Enter'] },
      { action: 'Front view', keys: ['1'] },
      { action: 'Right view', keys: ['3'] },
      { action: 'Top view', keys: ['7'] },
      { action: 'Home view', keys: ['0', 'F'] },
    ]);
    expect(JSON.stringify(keyboardShortcutSections)).not.toMatch(
      /undo|redo|duplicate|hide|lock|play animation/i,
    );
    expect(keyboardShortcutSections[1].shortcuts.map((shortcut) => shortcut.scope)).toEqual([
      '3D preview focus and selection required.',
      '3D preview focus and selection required.',
      '3D preview focus and selection required.',
      '3D preview focus required.',
    ]);
  });

  it('renders sectioned semantic lists, key labels, and scope guidance', () => {
    const container = document.createElement('div');
    container.innerHTML = renderKeyboardSettings();

    expect(container.querySelectorAll('.keyboard-shortcut-card')).toHaveLength(3);
    expect(container.querySelectorAll('.keyboard-shortcut-row')).toHaveLength(15);
    expect([...container.querySelectorAll('kbd')].map((key) => key.textContent)).toEqual([
      'Arrow Left', 'Arrow Right', 'Arrow Up', 'Arrow Down', 'Page Up', 'Page Down', 'Delete',
      'W', 'G', 'E', 'R', 'S', 'Escape', 'Enter', '1', '3', '7', '0', 'F',
    ]);
    expect(container.querySelector('.keyboard-settings-intro')?.textContent).toContain(
      'selection shortcuts work across Studio',
    );
    expect(container.textContent).toContain('Not while typing or editing a form');
    expect(container.textContent).toContain('3D preview focus required');
    expect(container.querySelectorAll('.keyboard-shortcut-list')).toHaveLength(3);
  });
});

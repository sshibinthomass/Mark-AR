import { describe, expect, it } from 'vitest';
import {
  isEditableKeyboardTarget,
  nudgeTargetPlacement,
  targetEditorKeyboardCommand,
} from '../src/app/targetEditorKeyboard';

describe('target editor keyboard commands', () => {
  it.each([
    ['ArrowLeft', { type: 'move', offsetX: -0.05, offsetY: 0, height: 0 }],
    ['ArrowRight', { type: 'move', offsetX: 0.05, offsetY: 0, height: 0 }],
    ['ArrowUp', { type: 'move', offsetX: 0, offsetY: -0.05, height: 0 }],
    ['ArrowDown', { type: 'move', offsetX: 0, offsetY: 0.05, height: 0 }],
    ['PageUp', { type: 'move', offsetX: 0, offsetY: 0, height: 0.02 }],
    ['PageDown', { type: 'move', offsetX: 0, offsetY: 0, height: -0.02 }],
    ['Delete', { type: 'delete' }],
  ])('maps %s to an editor command', (key, expected) => {
    expect(targetEditorKeyboardCommand(keyEvent({ key }))).toEqual(expected);
  });

  it.each([
    [{ key: 'z', ctrlKey: true }, { type: 'undo' }],
    [{ key: 'z', metaKey: true }, { type: 'undo' }],
    [{ key: 'z', ctrlKey: true, shiftKey: true }, { type: 'redo' }],
    [{ key: 'y', ctrlKey: true }, { type: 'redo' }],
    [{ key: 'd', metaKey: true }, { type: 'duplicate' }],
    [{ key: 'Tab' }, { type: 'cycle-selection', direction: 1 }],
    [{ key: 'Tab', shiftKey: true }, { type: 'cycle-selection', direction: -1 }],
    [{ key: 'ArrowLeft', shiftKey: true }, { type: 'move', offsetX: -0.01, offsetY: 0, height: 0 }],
    [{ key: 'PageUp', shiftKey: true }, { type: 'move', offsetX: 0, offsetY: 0, height: 0.005 }],
    [{ key: 'w' }, { type: 'transform-mode', mode: 'translate' }],
    [{ key: 'e' }, { type: 'transform-mode', mode: 'rotate' }],
    [{ key: 'r' }, { type: 'transform-mode', mode: 'scale' }],
    [{ key: '+', shiftKey: true }, { type: 'scale', amount: 0.05 }],
    [{ key: '=' }, { type: 'scale', amount: 0.05 }],
    [{ key: '-' }, { type: 'scale', amount: -0.05 }],
    [{ key: '[' }, { type: 'rotate-y', degrees: -5 }],
    [{ key: ']' }, { type: 'rotate-y', degrees: 5 }],
    [{ key: 'Home' }, { type: 'reset-transform' }],
    [{ key: 'h' }, { type: 'toggle-hidden' }],
    [{ key: 'l' }, { type: 'toggle-locked' }],
    [{ key: '1' }, { type: 'camera-preset', preset: 'front' }],
    [{ key: '3' }, { type: 'camera-preset', preset: 'right' }],
    [{ key: '7' }, { type: 'camera-preset', preset: 'top' }],
    [{ key: '0' }, { type: 'camera-preset', preset: 'home' }],
    [{ key: 'f' }, { type: 'camera-preset', preset: 'home' }],
    [{ key: ' ' }, { type: 'toggle-animation' }],
    [{ key: 's', ctrlKey: true }, { type: 'save' }],
    [{ key: '?', shiftKey: true }, { type: 'toggle-help' }],
    [{ key: 'Escape' }, { type: 'finish-interaction' }],
    [{ key: 'Enter' }, { type: 'finish-interaction' }],
  ])('maps %o to %o', (event, expected) => {
    expect(targetEditorKeyboardCommand(keyEvent(event))).toEqual(expected);
  });

  it('applies a movement command without changing scale or rotation', () => {
    const placement = nudgeTargetPlacement(
      {
        scale: 1.2,
        offsetX: 0.1,
        offsetY: -0.2,
        height: 0.3,
        rotationX: 4,
        rotationY: 5,
        rotationZ: 6,
      },
      { type: 'move', offsetX: 0.05, offsetY: -0.05, height: 0.02 },
    );

    expect(placement.offsetX).toBeCloseTo(0.15);
    expect(placement.offsetY).toBeCloseTo(-0.25);
    expect(placement.height).toBeCloseTo(0.32);
    expect(placement).toMatchObject({
      scale: 1.2,
      rotationX: 4,
      rotationY: 5,
      rotationZ: 6,
    });
  });

  it('ignores modified and unsupported shortcuts', () => {
    expect(targetEditorKeyboardCommand(keyEvent({ key: 'ArrowLeft', ctrlKey: true }))).toBeUndefined();
    expect(targetEditorKeyboardCommand(keyEvent({ key: 'Delete', shiftKey: true }))).toBeUndefined();
    expect(targetEditorKeyboardCommand(keyEvent({ key: 'd', ctrlKey: true, shiftKey: true }))).toBeUndefined();
    expect(targetEditorKeyboardCommand(keyEvent({ key: 'ArrowRight', altKey: true }))).toBeUndefined();
    expect(targetEditorKeyboardCommand(keyEvent({ key: 'Unknown' }))).toBeUndefined();
  });

  it.each(['input', 'textarea', 'select'])('recognizes editable %s targets', (tag) => {
    expect(isEditableKeyboardTarget(document.createElement(tag))).toBe(true);
  });

  it('recognizes descendants of content-editable regions', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    const child = document.createElement('span');
    editor.append(child);
    document.body.append(editor);

    expect(isEditableKeyboardTarget(child)).toBe(true);

    editor.remove();
  });

  it('does not classify ordinary page content as editable', () => {
    expect(isEditableKeyboardTarget(document.createElement('button'))).toBe(false);
    expect(isEditableKeyboardTarget(null)).toBe(false);
  });
});

function keyEvent(
  event: Pick<KeyboardEvent, 'key'> & Partial<Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>>,
): Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'> {
  return {
    key: event.key,
    altKey: event.altKey ?? false,
    ctrlKey: event.ctrlKey ?? false,
    metaKey: event.metaKey ?? false,
    shiftKey: event.shiftKey ?? false,
  };
}

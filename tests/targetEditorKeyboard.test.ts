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
    expect(targetEditorKeyboardCommand({
      key,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
    })).toEqual(expected);
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
    expect(targetEditorKeyboardCommand({
      key: 'ArrowLeft',
      altKey: false,
      ctrlKey: true,
      metaKey: false,
    })).toBeUndefined();
    expect(targetEditorKeyboardCommand({
      key: 'Home',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
    })).toBeUndefined();
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

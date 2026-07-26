import type { ImageTargetPlacement } from './imageTargetPayload';

export type TargetEditorKeyboardCommand =
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'duplicate' }
  | { type: 'cycle-selection'; direction: 1 | -1 }
  | { type: 'move'; offsetX: number; offsetY: number; height: number }
  | { type: 'transform-mode'; mode: 'translate' | 'rotate' | 'scale' }
  | { type: 'scale'; amount: number }
  | { type: 'rotate-y'; degrees: number }
  | { type: 'reset-transform' }
  | { type: 'delete' }
  | { type: 'toggle-hidden' }
  | { type: 'toggle-locked' }
  | { type: 'camera-preset'; preset: 'front' | 'right' | 'top' | 'home' }
  | { type: 'toggle-animation' }
  | { type: 'save' }
  | { type: 'toggle-help' }
  | { type: 'finish-interaction' };

type KeyboardCommandEvent = Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;
type TargetEditorMoveCommand = Extract<TargetEditorKeyboardCommand, { type: 'move' }>;

const KEY_COMMANDS: Readonly<Record<string, TargetEditorKeyboardCommand>> = {
  ArrowLeft: { type: 'move', offsetX: -0.05, offsetY: 0, height: 0 },
  ArrowRight: { type: 'move', offsetX: 0.05, offsetY: 0, height: 0 },
  ArrowUp: { type: 'move', offsetX: 0, offsetY: -0.05, height: 0 },
  ArrowDown: { type: 'move', offsetX: 0, offsetY: 0.05, height: 0 },
  PageUp: { type: 'move', offsetX: 0, offsetY: 0, height: 0.02 },
  PageDown: { type: 'move', offsetX: 0, offsetY: 0, height: -0.02 },
  Delete: { type: 'delete' },
  Tab: { type: 'cycle-selection', direction: 1 },
  Home: { type: 'reset-transform' },
  Escape: { type: 'finish-interaction' },
  Enter: { type: 'finish-interaction' },
  w: { type: 'transform-mode', mode: 'translate' },
  g: { type: 'transform-mode', mode: 'translate' },
  e: { type: 'transform-mode', mode: 'rotate' },
  r: { type: 'transform-mode', mode: 'scale' },
  s: { type: 'transform-mode', mode: 'scale' },
  '=': { type: 'scale', amount: 0.05 },
  '-': { type: 'scale', amount: -0.05 },
  '[': { type: 'rotate-y', degrees: -5 },
  ']': { type: 'rotate-y', degrees: 5 },
  h: { type: 'toggle-hidden' },
  l: { type: 'toggle-locked' },
  '1': { type: 'camera-preset', preset: 'front' },
  '3': { type: 'camera-preset', preset: 'right' },
  '7': { type: 'camera-preset', preset: 'top' },
  '0': { type: 'camera-preset', preset: 'home' },
  f: { type: 'camera-preset', preset: 'home' },
  ' ': { type: 'toggle-animation' },
};

const FINE_MOVE_COMMANDS: Readonly<Record<string, TargetEditorMoveCommand>> = {
  ArrowLeft: { type: 'move', offsetX: -0.01, offsetY: 0, height: 0 },
  ArrowRight: { type: 'move', offsetX: 0.01, offsetY: 0, height: 0 },
  ArrowUp: { type: 'move', offsetX: 0, offsetY: -0.01, height: 0 },
  ArrowDown: { type: 'move', offsetX: 0, offsetY: 0.01, height: 0 },
  PageUp: { type: 'move', offsetX: 0, offsetY: 0, height: 0.005 },
  PageDown: { type: 'move', offsetX: 0, offsetY: 0, height: -0.005 },
};

export function targetEditorKeyboardCommand(
  event: KeyboardCommandEvent,
): TargetEditorKeyboardCommand | undefined {
  if (event.altKey) {
    return undefined;
  }

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (event.ctrlKey || event.metaKey) {
    if (key === 'z') {
      return event.shiftKey ? { type: 'redo' } : { type: 'undo' };
    }
    if (!event.shiftKey && key === 'y' && event.ctrlKey && !event.metaKey) {
      return { type: 'redo' };
    }
    if (!event.shiftKey && key === 'd') {
      return { type: 'duplicate' };
    }
    if (!event.shiftKey && key === 's') {
      return { type: 'save' };
    }
    return undefined;
  }

  if (event.shiftKey) {
    if (event.key === 'Tab') {
      return { type: 'cycle-selection', direction: -1 };
    }
    if (event.key === '+' || event.key === '=') {
      return { type: 'scale', amount: 0.05 };
    }
    if (event.key === '?') {
      return { type: 'toggle-help' };
    }
    return FINE_MOVE_COMMANDS[event.key];
  }

  return KEY_COMMANDS[key] ?? KEY_COMMANDS[event.key];
}

export function nudgeTargetPlacement(
  placement: ImageTargetPlacement,
  command: TargetEditorMoveCommand,
): ImageTargetPlacement {
  return {
    ...placement,
    offsetX: placement.offsetX + command.offsetX,
    offsetY: placement.offsetY + command.offsetY,
    height: placement.height + command.height,
  };
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
  ));
}

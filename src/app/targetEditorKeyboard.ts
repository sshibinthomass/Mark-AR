import type { ImageTargetPlacement } from './imageTargetPayload';

export type TargetEditorKeyboardCommand =
  | { type: 'move'; offsetX: number; offsetY: number; height: number }
  | { type: 'delete' };

type KeyboardCommandEvent = Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey'>;
type TargetEditorMoveCommand = Extract<TargetEditorKeyboardCommand, { type: 'move' }>;

const KEY_COMMANDS: Readonly<Record<string, TargetEditorKeyboardCommand>> = {
  ArrowLeft: { type: 'move', offsetX: -0.05, offsetY: 0, height: 0 },
  ArrowRight: { type: 'move', offsetX: 0.05, offsetY: 0, height: 0 },
  ArrowUp: { type: 'move', offsetX: 0, offsetY: -0.05, height: 0 },
  ArrowDown: { type: 'move', offsetX: 0, offsetY: 0.05, height: 0 },
  PageUp: { type: 'move', offsetX: 0, offsetY: 0, height: 0.02 },
  PageDown: { type: 'move', offsetX: 0, offsetY: 0, height: -0.02 },
  Delete: { type: 'delete' },
};

export function targetEditorKeyboardCommand(
  event: KeyboardCommandEvent,
): TargetEditorKeyboardCommand | undefined {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return undefined;
  }
  return KEY_COMMANDS[event.key];
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

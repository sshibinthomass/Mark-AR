export type ShortcutSectionId =
  | 'editing'
  | 'object-movement'
  | 'transform-tools'
  | 'visibility-playback'
  | 'camera-views';

export type KeyboardShortcut = Readonly<{
  action: string;
  keys: readonly string[];
  scope: string;
}>;

export type KeyboardShortcutSection = Readonly<{
  id: ShortcutSectionId;
  label: string;
  description: string;
  shortcuts: readonly KeyboardShortcut[];
}>;

const studioSelectionScope = 'Selection required. Not while typing or editing a form.';
const studioScope = 'Available throughout Studio. Not while typing or editing a form.';

export const keyboardShortcutSections: readonly KeyboardShortcutSection[] = [
  {
    id: 'editing',
    label: 'Editing',
    description: 'Manage changes and move quickly through the object list.',
    shortcuts: [
      { action: 'Undo', keys: ['Ctrl/Command + Z'], scope: studioScope },
      { action: 'Redo', keys: ['Ctrl/Command + Shift + Z', 'Ctrl + Y'], scope: studioScope },
      { action: 'Duplicate the selection', keys: ['Ctrl/Command + D'], scope: studioSelectionScope },
      { action: 'Cycle the selection', keys: ['Tab', 'Shift + Tab'], scope: studioScope },
    ],
  },
  {
    id: 'object-movement',
    label: 'Object movement',
    description: 'Move or remove the current Studio selection.',
    shortcuts: [
      { action: 'Move selected objects left', keys: ['Arrow Left'], scope: studioSelectionScope },
      { action: 'Move selected objects right', keys: ['Arrow Right'], scope: studioSelectionScope },
      { action: 'Move selected objects forward', keys: ['Arrow Up'], scope: studioSelectionScope },
      { action: 'Move selected objects backward', keys: ['Arrow Down'], scope: studioSelectionScope },
      { action: 'Raise or lower selected objects', keys: ['Page Up', 'Page Down'], scope: studioSelectionScope },
      {
        action: 'Move in fine increments',
        keys: ['Shift + Arrow', 'Shift + Page Up/Down'],
        scope: studioSelectionScope,
      },
      { action: 'Remove selected objects', keys: ['Delete'], scope: studioSelectionScope },
    ],
  },
  {
    id: 'transform-tools',
    label: 'Transform tools',
    description: 'Switch tools or finish the current direct interaction.',
    shortcuts: [
      { action: 'Activate Move', keys: ['W', 'G'], scope: studioSelectionScope },
      { action: 'Activate Rotate', keys: ['E'], scope: studioSelectionScope },
      { action: 'Activate Scale', keys: ['R', 'S'], scope: studioSelectionScope },
      { action: 'Scale directly', keys: ['+', '-'], scope: studioSelectionScope },
      { action: 'Rotate around the vertical axis', keys: ['[', ']'], scope: studioSelectionScope },
      { action: 'Reset the selected transform', keys: ['Home'], scope: studioSelectionScope },
      {
        action: 'Finish the interaction and return to Move',
        keys: ['Escape', 'Enter'],
        scope: studioScope,
      },
    ],
  },
  {
    id: 'visibility-playback',
    label: 'Visibility and playback',
    description: 'Control temporary editor state, preview playback, saving, and help.',
    shortcuts: [
      { action: 'Hide or show the selection', keys: ['H'], scope: studioSelectionScope },
      { action: 'Lock or unlock the selection', keys: ['L'], scope: studioSelectionScope },
      { action: 'Play or pause animation', keys: ['Space'], scope: studioScope },
      { action: 'Save the target', keys: ['Ctrl/Command + S'], scope: studioScope },
      { action: 'Open keyboard help', keys: ['?'], scope: studioScope },
    ],
  },
  {
    id: 'camera-views',
    label: 'Camera views',
    description: 'Jump to a standard view of the target.',
    shortcuts: [
      { action: 'Front view', keys: ['1'], scope: studioScope },
      { action: 'Right view', keys: ['3'], scope: studioScope },
      { action: 'Top view', keys: ['7'], scope: studioScope },
      { action: 'Home view', keys: ['0', 'F'], scope: studioScope },
    ],
  },
] as const;

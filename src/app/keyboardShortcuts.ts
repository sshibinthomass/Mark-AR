export type ShortcutSectionId = 'object-movement' | 'transform-tools' | 'camera-views';

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
const previewScope = '3D preview focus required.';
const previewSelectionScope = '3D preview focus and selection required.';

export const keyboardShortcutSections: readonly KeyboardShortcutSection[] = [
  {
    id: 'object-movement',
    label: 'Object movement',
    description: 'Move or remove the current Studio selection.',
    shortcuts: [
      { action: 'Move selected objects left', keys: ['Arrow Left'], scope: studioSelectionScope },
      { action: 'Move selected objects right', keys: ['Arrow Right'], scope: studioSelectionScope },
      { action: 'Move selected objects forward', keys: ['Arrow Up'], scope: studioSelectionScope },
      { action: 'Move selected objects backward', keys: ['Arrow Down'], scope: studioSelectionScope },
      { action: 'Raise selected objects', keys: ['Page Up'], scope: studioSelectionScope },
      { action: 'Lower selected objects', keys: ['Page Down'], scope: studioSelectionScope },
      { action: 'Remove selected objects', keys: ['Delete'], scope: studioSelectionScope },
    ],
  },
  {
    id: 'transform-tools',
    label: 'Transform tools',
    description: 'Switch tools or finish the current direct interaction.',
    shortcuts: [
      { action: 'Activate Move', keys: ['W', 'G'], scope: previewSelectionScope },
      { action: 'Activate Rotate', keys: ['E'], scope: previewSelectionScope },
      { action: 'Activate Scale', keys: ['R', 'S'], scope: previewSelectionScope },
      {
        action: 'Finish the interaction and return to Move',
        keys: ['Escape', 'Enter'],
        scope: previewScope,
      },
    ],
  },
  {
    id: 'camera-views',
    label: 'Camera views',
    description: 'Jump to a standard view of the target.',
    shortcuts: [
      { action: 'Front view', keys: ['1'], scope: previewScope },
      { action: 'Right view', keys: ['3'], scope: previewScope },
      { action: 'Top view', keys: ['7'], scope: previewScope },
      { action: 'Home view', keys: ['0', 'F'], scope: previewScope },
    ],
  },
] as const;

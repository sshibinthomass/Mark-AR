# Keyboard Object Controls Design

## Goal

Allow a selected target-editor object to be positioned or deleted with the keyboard from anywhere on the Targets page, except while the user is typing or editing a form control.

## Interaction Design

The keyboard commands operate on the current editor selection:

| Key | Action |
| --- | --- |
| `ArrowLeft` | Move the selection `0.05` units left on the X axis |
| `ArrowRight` | Move the selection `0.05` units right on the X axis |
| `ArrowUp` | Move the selection `0.05` units forward on the Z axis |
| `ArrowDown` | Move the selection `0.05` units backward on the Z axis |
| `PageUp` | Raise the selection `0.02` units |
| `PageDown` | Lower the selection `0.02` units |
| `Delete` | Remove the selected object or objects |

Holding a movement key uses the browser's normal key-repeat behavior. Movement increments match the existing placement input steps. Existing placement normalization continues to enforce the editor's allowed bounds.

The commands are active whenever an object, multi-object selection, or group is selected. A group moves as a group. Deleting a selected group removes all objects in that group. Deleting a multi-object selection removes every selected object.

The controller does not handle a shortcut when the event originated from an `input`, `textarea`, `select`, or content-editable element. It also does nothing when there is no selection. Browser defaults such as page scrolling are prevented only when the editor actually handles a shortcut.

## Architecture

A small keyboard-command module will own the reusable, testable rules:

- identify editable event targets;
- map supported keys to movement deltas or deletion;
- apply movement deltas to an `ImageTargetPlacement`.

The Targets page will register one page-level `keydown` listener. The listener reads the canonical editor selection, invokes the keyboard-command rules, and then uses the existing selection update, placement normalization, inspector synchronization, object-list rendering, status messaging, and preview update paths.

The keyboard controller will not mutate Three.js objects or placement sliders directly. Keeping editor state authoritative ensures that the preview, controls, persisted payload, individual objects, multi-selections, and groups remain synchronized.

The listener will be removed only with the page lifecycle if a corresponding teardown is introduced later; the current application shell is initialized once and already uses page-level listeners with the same lifetime.

## Selection and Deletion Behavior

For a single selected object, movement updates that object's placement. For a selected child of a group, movement updates its local placement through the existing child-placement path. For a multi-selection, movement updates the shared selection pivot through the existing multi-selection transform path. For a selected group, movement updates the group placement.

Deletion will be handled as one selection operation rather than repeatedly invoking the single-row delete callback. The operation removes all selected object IDs, or all members of the selected group, then:

1. removes groups that no longer have enough members;
2. preserves the existing automatic next-object selection behavior where possible;
3. synchronizes the inspector and object list;
4. reports the resulting object count;
5. refreshes the preview once.

## Error and Conflict Handling

Unsupported keys and modified browser/editor shortcuts are left alone. Existing preview-canvas shortcuts such as transform-mode and camera keys continue to work; an event already handled by the preview is ignored by the page-level controller.

The keyboard handler exits without side effects when the Targets editor is not active, no object or group is selected, or the event target is editable.

## Testing

Unit tests will cover key mapping, movement increments, forward/back direction, height changes, unsupported keys, and editable-target detection.

Targets-page integration tests will cover:

- moving a selected object when focus is outside a form field;
- synchronizing the canonical placement and placement controls;
- ignoring movement and deletion while an input or editable element has focus;
- doing nothing with no selection;
- deleting one selected object;
- deleting a multi-selection;
- moving and deleting a selected group;
- preventing browser defaults only for handled shortcuts.

The existing preview tests and complete test suite will be run, followed by a production build and browser verification of the available local Targets route.

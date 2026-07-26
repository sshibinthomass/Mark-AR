# Studio Keyboard Actions Design

## Goal

Make every documented Studio keyboard action perform a real editor operation from anywhere on the active Studio page, except while the user is typing or editing a form control.

## Scope

This feature expands the existing object movement shortcuts into a complete Studio command system. It includes:

- undo and redo for scene-authoring edits;
- selection duplication and cycling;
- normal and fine movement;
- transform-tool activation;
- direct scale, rotation, and transform reset;
- temporary hide and lock state;
- animation preview play and pause;
- save or update;
- a keyboard-help overlay;
- existing camera presets and object deletion.

It does not make keyboard bindings configurable. It does not persist temporary hidden or locked state to the saved target or published AR experience.

## Command Architecture

Extend the existing pure keyboard-command mapper into the single source of truth for Studio key combinations. Each recognized key combination produces a typed command; the mapper does not mutate editor state.

The Studio-level keyboard handler will:

1. ignore already-consumed events;
2. require the active route to be Studio;
3. ignore editable targets such as inputs, textareas, selects, and contenteditable elements;
4. resolve a typed command;
5. verify selection and lock requirements for that command;
6. execute the corresponding editor operation;
7. prevent the browser default only when Studio handled the command.

The existing preview-canvas handler remains responsible for direct pointer interactions. Canvas keyboard events that it already consumes will not run twice because the Studio handler ignores `defaultPrevented` events.

## Shortcut Map

### History

- `Ctrl/Cmd + Z`: undo the most recent scene-authoring edit.
- `Ctrl/Cmd + Shift + Z`: redo the most recently undone edit.
- `Ctrl + Y`: redo on platforms where that convention is expected.

History covers object and group creation/removal, duplication, selection transforms, text and animation edits, grouping, ungrouping, and temporary hidden/locked state. It does not undo authentication, navigation, camera view, file selection, network save, or account changes.

History stores immutable editor snapshots with a bounded capacity of 100 entries. Continuous changes to the same control or preview interaction are coalesced so one drag or slider adjustment does not require many Undo presses. Creating a new edit after Undo clears the redo stack.

### Selection and duplication

- `Ctrl/Cmd + D`: duplicate the selected object, multi-selection, or group.
- `Tab`: select the next object in the object-list order.
- `Shift + Tab`: select the previous object.

Cycling wraps at either end. When a group is selected, cycling continues from the first or last group member into the object list. Duplicated items receive new IDs, a small positional offset, and copied text, model, transform, and animation data. Duplicating a group creates a new group and new member objects while preserving their local placements.

### Movement and transforms

- Arrow keys: move the selection left, right, forward, or backward using the existing `0.05` step.
- `Page Up` / `Page Down`: raise or lower the selection using the existing `0.02` step.
- `Shift + Arrow`: fine horizontal or depth movement using a `0.01` step.
- `Shift + Page Up` / `Shift + Page Down`: fine vertical movement using a `0.005` step.
- `W` or `G`: activate Move.
- `E`: activate Rotate.
- `R` or `S`: activate Scale.
- `+` or `=`: increase selection scale by `0.05`.
- `-`: decrease selection scale by `0.05`, clamped to the editor’s valid minimum.
- `[`: rotate selection around the Y axis by `-5` degrees.
- `]`: rotate selection around the Y axis by `5` degrees.
- `Home`: reset move, rotation, and scale for the current selection.
- `Delete`: remove the selected object, multi-selection, or group.

Movement, transforms, reset, and deletion require an unlocked selection. Locked selections remain selectable so `L` can unlock them.

### Temporary editor state

- `H`: toggle temporary preview visibility for the selection.
- `L`: toggle temporary editing lock for the selection.

Hidden objects remain present and selectable in the object list. Locked objects remain visible and selectable but reject movement, direct transforms, reset, and deletion. Object-list rows show visible “Hidden” and “Locked” status badges so keyboard state is not conveyed by the preview alone.

Hidden and locked sets are part of Undo/Redo history but are cleared when starting a new target or loading another saved target. They are excluded from all persistence payloads.

### Preview, save, and help

- `1`: Front camera view.
- `3`: Right camera view.
- `7`: Top camera view.
- `0` or `F`: Home camera view.
- `Space`: play or pause all Studio preview animations.
- `Ctrl/Cmd + S`: invoke the existing Save target or Update target operation.
- `?`: open or close the keyboard-help overlay.
- `Escape`: close the help overlay when it is open; otherwise finish a direct preview interaction and return to Move.
- `Enter`: finish a direct preview interaction and return to Move.

Camera, animation playback, Save, and Help do not require an object selection. Save follows all existing validation, authentication, loading, and error behavior and does nothing if the existing Save button is disabled.

Pausing animation freezes the preview at its current animation time. Resuming continues from that point instead of restarting. The play/pause state is editor-only and resets to playing for a new or loaded target.

## Undo/Redo State

Introduce a focused editor-history module that owns:

- the bounded undo stack;
- the bounded redo stack;
- snapshot equality;
- snapshot restoration;
- coalescing metadata for continuous edits.

An editor snapshot contains scene-authoring state only:

- target objects;
- groups;
- current selection;
- current placement and animation inspector state;
- temporary hidden object/group identifiers;
- temporary locked object/group identifiers.

Restoring a snapshot normalizes selection, refreshes inspector controls and object rows, and updates the preview once. It must not trigger a save or network request.

## Help and Settings

The authenticated Settings page remains the full read-only shortcut reference. Its typed catalog will be expanded to cover every command in this specification and updated so scope notes match the new Studio-wide behavior.

The Studio help overlay reuses the same catalog renderer rather than maintaining separate shortcut copy. It includes:

- an accessible dialog heading;
- the same categorized shortcut lists as Settings;
- a close button;
- focus placement on open;
- focus restoration to the previously focused control on close;
- `Escape` and `?` close behavior;
- background interaction blocking while open.

## Presentation and Accessibility

- Use existing Arvenilo cards, tokens, spacing, focus indicators, and reduced-motion behavior.
- Use semantic `<kbd>` elements for displayed keys.
- Announce Undo, Redo, Duplicate, Hide, Lock, Play, Pause, and blocked locked-object operations through the existing Studio status region.
- Do not consume shortcuts while focus is in an editable control.
- Respect both Control and Command conventions where specified.
- Keep browser and assistive-technology defaults when Studio does not execute a command.
- The help overlay and expanded Settings cards remain usable in the five-item authenticated mobile navigation layout.

## Error and Edge Handling

- Commands requiring a selection are ignored when no valid selection exists.
- Commands that mutate a locked selection are rejected with a concise status message.
- Undo and Redo are ignored when their corresponding stack is empty.
- Duplicate and reset operate on the group as a unit when a group is selected.
- Scaling never crosses the existing minimum valid scale.
- Selection cycling is ignored when the scene contains no objects.
- Save reuses the existing disabled/loading guard to prevent duplicate requests.
- Hidden or locked IDs for deleted objects are removed during deletion and normalized during history restoration.
- Unknown keys and unsupported modifier combinations are not consumed.

## Testing

Automated tests will cover:

- the exact key-to-command map, including Control/Command variants;
- editable-target, inactive-route, modifier, and `defaultPrevented` guards;
- Undo/Redo snapshot behavior, coalescing, capacity, and redo invalidation;
- object, multi-selection, and group duplication;
- forward/backward selection cycling and wrapping;
- normal and fine movement;
- direct scale, rotation, reset, and minimum-scale clamping;
- temporary hide/show and lock/unlock;
- rejection of mutations on locked selections;
- camera shortcuts without a selection;
- animation pause/resume continuity;
- Save delegation and disabled-button behavior;
- help overlay focus, close, and shared catalog content;
- Settings catalog completeness;
- no regression to pointer/canvas keyboard handling;
- the full root test suite and production build.

Manual browser verification will confirm the keyboard flow in the running Studio with a selected object, the visible hidden/locked indicators, help-overlay responsiveness, and signed-in Settings reference.

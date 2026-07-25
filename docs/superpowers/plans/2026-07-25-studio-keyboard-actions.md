# Studio Keyboard Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement every documented Studio keyboard command as a real editor action available across Studio except while typing.

**Architecture:** Extend the pure shortcut parser, add generic bounded snapshot history and pure scene-command helpers, then keep DOM and application-state orchestration in `main.ts`. The 3D preview receives explicit visibility, lock, and animation-playback state, while Settings and the Studio help overlay render one shared shortcut catalog.

**Tech Stack:** TypeScript, Vite, Vitest with jsdom, Three.js, semantic HTML, existing Arvenilo CSS tokens.

## Global Constraints

- Keyboard bindings remain fixed and are not user-configurable.
- Hidden and locked state is temporary Studio state and must never enter save/update payloads.
- All Studio shortcuts are ignored while typing in inputs, textareas, selects, or contenteditable elements.
- Do not consume unsupported keys or commands that Studio cannot execute.
- History is limited to 100 immutable scene-authoring snapshots.
- Camera view, navigation, authentication, file selection, network save, and account state are not undoable.
- Preserve existing pointer/canvas behavior and prevent duplicate execution through `defaultPrevented`.
- Keep unrelated untracked workspace files untouched.

---

## File Structure

- Modify `src/app/targetEditorKeyboard.ts`: complete typed key-to-command mapping.
- Create `src/app/editorHistory.ts`: bounded generic snapshot undo/redo with coalescing.
- Create `src/app/targetEditorCommands.ts`: pure selection cycling, duplication, state-key, and lock helpers.
- Create `src/ui/keyboardHelpOverlay.ts`: accessible reusable Studio help overlay controller.
- Modify `src/app/keyboardShortcuts.ts`: catalog every implemented command.
- Modify `src/ui/keyboardSettings.ts`: render expanded catalog in Settings and Help.
- Modify `src/ui/targetObjectList.ts`: render Hidden and Locked badges.
- Modify `src/scene/ImageTargetPreview.ts`: hidden-object filtering, locked-selection protection, and animation pause/resume.
- Modify `src/ui/appShell.ts`: add the Studio help overlay container.
- Modify `src/main.ts`: own history, temporary state, and command execution.
- Modify `src/styles/arvenilo-redesign.css`: badges and responsive help overlay.
- Modify or create focused tests under `tests/` for every module and integration boundary.

---

### Task 1: Complete Typed Keyboard Command Mapping

**Files:**

- Modify: `src/app/targetEditorKeyboard.ts`
- Modify: `tests/targetEditorKeyboard.test.ts`

**Interfaces:**

- Produces `TargetEditorKeyboardCommand`, including `undo`, `redo`, `duplicate`, `cycle-selection`, `move`, `transform-mode`, `scale`, `rotate-y`, `reset-transform`, `delete`, `toggle-hidden`, `toggle-locked`, `camera-preset`, `toggle-animation`, `save`, `toggle-help`, and `finish-interaction`.
- Keeps `targetEditorKeyboardCommand(event)` pure.
- Keeps `isEditableKeyboardTarget(target)` unchanged.

- [ ] **Step 1: Add failing table-driven key mapping tests**

Extend `tests/targetEditorKeyboard.test.ts` with literal expectations:

```ts
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
  [{ key: '+' , shiftKey: true }, { type: 'scale', amount: 0.05 }],
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
] as const)('maps %o to %o', (event, expected) => {
  expect(targetEditorKeyboardCommand(keyEvent(event))).toEqual(expected);
});
```

Add negative cases for `Alt+Arrow`, `Ctrl+Arrow`, `Ctrl+D` with Shift, `Ctrl+S` with Shift, and unknown keys.

- [ ] **Step 2: Run the mapper test and verify it fails**

```powershell
npx vitest run --exclude=.worktrees/** tests/targetEditorKeyboard.test.ts
```

Expected: FAIL because the command union and mappings do not exist.

- [ ] **Step 3: Implement normalized modifier-aware mapping**

In `src/app/targetEditorKeyboard.ts`, define:

```ts
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
```

Normalize one-character keys to lowercase, handle Control/Command commands before unmodified commands, allow Shift only for Redo, reverse cycling, fine movement, `+`, and `?`, and return `undefined` for unsupported modifier combinations.

- [ ] **Step 4: Run mapper and existing keyboard tests**

```powershell
npx vitest run --exclude=.worktrees/** tests/targetEditorKeyboard.test.ts tests/targetEditorKeyboardIntegration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the parser**

```powershell
git add -- src/app/targetEditorKeyboard.ts tests/targetEditorKeyboard.test.ts
git commit -m "feat: map all studio keyboard commands"
```

---

### Task 2: Bounded History and Pure Scene Commands

**Files:**

- Create: `src/app/editorHistory.ts`
- Create: `src/app/targetEditorCommands.ts`
- Create: `tests/editorHistory.test.ts`
- Create: `tests/targetEditorCommands.test.ts`

**Interfaces:**

- Produces `createEditorHistory<T>({ clone, equals?, limit?, coalesceWindowMs?, now? })`.
- History methods: `record(snapshot, coalesceKey?)`, `undo(current)`, `redo(current)`, `clear()`, `canUndo()`, and `canRedo()`.
- Produces `TargetEditorTransientState` with `hiddenKeys` and `lockedKeys`.
- Produces `selectionStateKeys`, `isSelectionLocked`, `cycleTargetSelection`, and `duplicateTargetSelection`.

- [ ] **Step 1: Write failing history behavior tests**

Create `tests/editorHistory.test.ts` covering:

```ts
it('undoes, redoes, and clears redo after a new edit', () => {
  const history = createEditorHistory<number>({ clone: (value) => value });
  history.record(0);
  expect(history.undo(1)).toBe(0);
  expect(history.redo(0)).toBe(1);
  expect(history.undo(1)).toBe(0);
  history.record(2);
  expect(history.canRedo()).toBe(false);
});

it('coalesces the same operation inside the configured window', () => {
  let time = 1000;
  const history = createEditorHistory<number>({
    clone: (value) => value,
    now: () => time,
    coalesceWindowMs: 300,
  });
  history.record(0, 'placement');
  time += 100;
  history.record(1, 'placement');
  expect(history.undo(2)).toBe(0);
});

it('keeps only the configured number of snapshots', () => {
  const history = createEditorHistory<number>({ clone: (value) => value, limit: 2 });
  history.record(0);
  history.record(1);
  history.record(2);
  expect(history.undo(3)).toBe(2);
  expect(history.undo(2)).toBe(1);
  expect(history.undo(1)).toBeUndefined();
});
```

- [ ] **Step 2: Write failing pure scene-command tests**

Create `tests/targetEditorCommands.test.ts` with literal model/text/group fixtures and verify:

- forward/backward cycling wraps;
- group selection cycles from its first/last member;
- duplication assigns injected IDs;
- a group duplicates its group record and every member;
- duplicates offset world placement by `0.05` on X and `0.05` on Y/depth;
- text/model/animation/local placements are deeply copied;
- duplicated items are selected, visible, and unlocked;
- `selectionStateKeys` returns `object:<id>` or `group:<id>`;
- `isSelectionLocked` is true when any selected state key is locked.

Use:

```ts
const result = duplicateTargetSelection({
  objects,
  groups,
  selection,
  createObjectId: sequence('copy-object'),
  createGroupId: sequence('copy-group'),
});
```

- [ ] **Step 3: Run both new test files and verify they fail**

```powershell
npx vitest run --exclude=.worktrees/** tests/editorHistory.test.ts tests/targetEditorCommands.test.ts
```

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement generic bounded history**

Create `src/app/editorHistory.ts` with:

```ts
export type EditorHistory<T> = {
  record(snapshot: T, coalesceKey?: string): void;
  undo(current: T): T | undefined;
  redo(current: T): T | undefined;
  clear(): void;
  canUndo(): boolean;
  canRedo(): boolean;
};
```

Clone on every stack boundary, compare snapshots before recording, retain the first pre-edit snapshot while coalescing, clear redo on a new record, and trim the oldest undo entries beyond the configured limit.

- [ ] **Step 5: Implement pure selection and duplication helpers**

Create `src/app/targetEditorCommands.ts` with:

```ts
export type TargetEditorTransientState = {
  hiddenKeys: string[];
  lockedKeys: string[];
};

export function selectionStateKeys(
  selection: TargetEditorSelection,
  objects: TargetEditorObject[],
): string[];

export function isSelectionLocked(
  selection: TargetEditorSelection,
  objects: TargetEditorObject[],
  lockedKeys: ReadonlySet<string>,
): boolean;

export function cycleTargetSelection(input: {
  objects: TargetEditorObject[];
  groups: TargetEditorGroup[];
  selection: TargetEditorSelection;
  direction: 1 | -1;
}): TargetEditorSelection;

export function duplicateTargetSelection(input: {
  objects: TargetEditorObject[];
  groups: TargetEditorGroup[];
  selection: TargetEditorSelection;
  createObjectId(): string;
  createGroupId(): string;
}): {
  objects: TargetEditorObject[];
  groups: TargetEditorGroup[];
  selection: TargetEditorSelection;
};
```

Use existing `resolveObjectPlacement`, `localPlacementForGroup`, and animation normalization helpers. Do not add transient state fields to persisted object or group types.

- [ ] **Step 6: Run the focused pure-module tests**

```powershell
npx vitest run --exclude=.worktrees/** tests/editorHistory.test.ts tests/targetEditorCommands.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit history and scene commands**

```powershell
git add -- src/app/editorHistory.ts src/app/targetEditorCommands.ts tests/editorHistory.test.ts tests/targetEditorCommands.test.ts
git commit -m "feat: add studio history and scene commands"
```

---

### Task 3: Integrate Commands, History, Temporary State, and Save

**Files:**

- Modify: `src/main.ts`
- Modify: `tests/targetEditorKeyboardIntegration.test.ts`
- Modify: `tests/savedTargetEditingIntegration.test.ts`

**Interfaces:**

- Consumes Task 1 commands and Task 2 history/scene helpers.
- Owns `hiddenTargetKeys`, `lockedTargetKeys`, `targetAnimationPlaying`, and editor snapshot capture/restore.
- Adds no fields to create/update API payloads.

- [ ] **Step 1: Expand the keyboard integration mock and write failing behavior tests**

In `tests/targetEditorKeyboardIntegration.test.ts`, make the preview mock expose:

```ts
setTransformMode = vi.fn();
setAnimationPlaying = vi.fn();
```

Add integration tests that select real fixture objects through the rendered UI and assert:

- `W/E/R/G/S` update toolbar `aria-pressed` from `document.body`;
- camera keys update camera range inputs without a selection;
- `Shift+Arrow` and `Shift+PageUp` use fine increments;
- `+`, `-`, `[`, `]`, and `Home` mutate the selected placement;
- `Tab` and `Shift+Tab` cycle and wrap selection;
- `Ctrl/Cmd+D` duplicates object, multi-selection, and group selections;
- `H` and `L` toggle visible row badges;
- locked selections reject movement and Delete;
- `Space` calls preview animation playback state;
- `Ctrl/Cmd+S` dispatches the existing save path only while the button is enabled;
- `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, and `Ctrl+Y` restore object edits;
- no command runs from an editable target or inactive route.

- [ ] **Step 2: Add a failing persistence boundary assertion**

In `tests/savedTargetEditingIntegration.test.ts`, hide and lock an object through keyboard events, save it, and assert the mocked create/update request objects contain no `hidden`, `locked`, `hiddenKeys`, or `lockedKeys` fields.

- [ ] **Step 3: Run integration tests and verify the new cases fail**

```powershell
npx vitest run --exclude=.worktrees/** tests/targetEditorKeyboardIntegration.test.ts tests/savedTargetEditingIntegration.test.ts
```

Expected: FAIL because the new commands are parsed but not executed.

- [ ] **Step 4: Add editor snapshot ownership to `main.ts`**

Define:

```ts
type TargetEditorSnapshot = {
  objects: TargetEditorObject[];
  groups: TargetEditorGroup[];
  selection: TargetEditorSelection;
  hiddenKeys: string[];
  lockedKeys: string[];
};
```

Add `captureTargetEditorSnapshot`, `restoreTargetEditorSnapshot`, `recordTargetEditorMutation`, and `clearTargetEditorHistory`. Deep-clone placement, local placement, text, and animation data. Restore selection through `normalizeTargetEditorSelection`, normalize transient keys against current objects/groups, sync inspector/list/status, and call `updateTargetPreview()` once.

Record snapshots before object add/remove, grouping/ungrouping, duplication, placement changes, text changes, animation changes, and hide/lock changes. Use stable coalescing keys such as `placement`, `text:<objectId>`, and `animation:<selection-key>`.

- [ ] **Step 5: Implement the central command executor**

Refactor `handleTargetEditorKeyDown` into guard plus a switch. Required command behavior:

```ts
case 'camera-preset':
  applyTargetCameraView(cameraViewForPreset(command.preset));
  break;
case 'transform-mode':
  requireUnlockedSelection();
  targetTransformMode = command.mode;
  syncTargetTransformModeButtons(command.mode);
  imageTargetPreview?.setTransformMode(command.mode);
  break;
case 'save':
  if (saveImageTargetButton && !saveImageTargetButton.disabled) saveImageTargetButton.click();
  else return;
  break;
```

Implement the remaining cases using Task 2 helpers and existing placement functions. Scale through `normalizePlacement({ ...targetPlacement, scale: targetPlacement.scale + amount })`; rotate Y by adding degrees; reset all transform fields to the default placement; maintain local-placement semantics through `updateSelectedTargetObjectPlacement`.

Only call `event.preventDefault()` after a command succeeds. Report locked-selection rejection through `updateImageTargetStatus`.

- [ ] **Step 6: Reset transient state at editor-session boundaries**

Clear history, hidden/locked keys, and reset animation playback to playing inside both `resetImageTargetEditor()` and the saved-target session load path. Do not include transient state in target payload construction.

- [ ] **Step 7: Run the focused integration tests**

```powershell
npx vitest run --exclude=.worktrees/** tests/targetEditorKeyboard.test.ts tests/targetEditorKeyboardIntegration.test.ts tests/savedTargetEditingIntegration.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit application integration**

```powershell
git add -- src/main.ts tests/targetEditorKeyboardIntegration.test.ts tests/savedTargetEditingIntegration.test.ts
git commit -m "feat: execute studio keyboard actions"
```

---

### Task 4: Preview Visibility, Lock Protection, and Animation Playback

**Files:**

- Modify: `src/scene/ImageTargetPreview.ts`
- Modify: `tests/imageTargetPreview.test.ts` or the existing preview integration test that constructs `ImageTargetPreview`

**Interfaces:**

- Extends `PreviewState` with `hiddenObjectIds?: readonly string[]` and `selectionLocked?: boolean`.
- Adds `setAnimationPlaying(playing: boolean): void`.
- Hidden objects are skipped during preview loading only; source editor objects remain intact.

- [ ] **Step 1: Write failing preview-state tests**

Extend the existing preview harness to assert:

- hidden model/text IDs do not create loaded preview objects;
- hiding all members of a group leaves no rendered member but does not corrupt group state;
- `selectionLocked: true` prevents transform-control attachment and pointer placement callbacks;
- `setAnimationPlaying(false)` freezes evaluated animation time across frames;
- resuming continues from the frozen elapsed time.

Use deterministic request-frame timestamps such as `0`, `1000`, `2000`, and `3000`.

- [ ] **Step 2: Run the focused preview tests and verify failure**

```powershell
npx vitest run --exclude=.worktrees/** tests/imageTargetPreview.test.ts
```

If the repository’s preview tests use a different filename, run the exact file containing the `ImageTargetPreview` constructor harness. Expected: FAIL on missing state fields/method.

- [ ] **Step 3: Implement preview state behavior**

In `ImageTargetPreview`:

- store `selectionLocked`;
- convert `hiddenObjectIds` to a `Set`;
- filter hidden objects before model/text loading;
- skip `attachTransformControls()` and drag/rotate/scale starts while locked;
- keep camera orbit and selection picking available;
- add `animationPlaying = true`;
- always update `lastFrameTimestamp`, but increment `elapsedSeconds` only while playing;
- expose `setAnimationPlaying`.

In `main.ts`, pass:

```ts
hiddenObjectIds: hiddenObjectIdsForPreview(),
selectionLocked: isCurrentSelectionLocked(),
```

on every preview update and call `setAnimationPlaying` after preview creation/update.

- [ ] **Step 4: Run preview and keyboard integration tests**

```powershell
npx vitest run --exclude=.worktrees/** tests/imageTargetPreview.test.ts tests/targetEditorKeyboardIntegration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit preview behavior**

```powershell
git add -- src/scene/ImageTargetPreview.ts src/main.ts tests/imageTargetPreview.test.ts tests/targetEditorKeyboardIntegration.test.ts
git commit -m "feat: control studio preview state"
```

---

### Task 5: Shared Help Overlay, Expanded Settings, and State Badges

**Files:**

- Create: `src/ui/keyboardHelpOverlay.ts`
- Create: `tests/keyboardHelpOverlay.test.ts`
- Modify: `src/app/keyboardShortcuts.ts`
- Modify: `src/ui/keyboardSettings.ts`
- Modify: `src/ui/targetObjectList.ts`
- Modify: `src/ui/appShell.ts`
- Modify: `src/main.ts`
- Modify: `src/styles/arvenilo-redesign.css`
- Modify: `tests/keyboardSettings.test.ts`
- Modify: `tests/targetObjectList.test.ts`
- Modify: `tests/appShell.test.ts`
- Modify: `tests/responsiveNavigationStyles.test.ts`

**Interfaces:**

- `createKeyboardHelpOverlay(root): { open(returnFocus?: HTMLElement): void; close(): void; toggle(returnFocus?: HTMLElement): void; isOpen(): boolean }`.
- `renderKeyboardSettings` remains the sole shortcut-list renderer.
- `TargetObjectListOptions` gains `hiddenKeys: ReadonlySet<string>` and `lockedKeys: ReadonlySet<string>`.

- [ ] **Step 1: Write failing catalog and overlay tests**

Update `tests/keyboardSettings.test.ts` to expect sections for History, Selection, Movement, Transform, Object state, Preview, and General commands with every exact key from the specification.

Create `tests/keyboardHelpOverlay.test.ts`:

```ts
it('opens accessibly, closes with Escape, and restores focus', () => {
  const root = fixtureWithHelpOverlay();
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const overlay = createKeyboardHelpOverlay(root);

  overlay.open(trigger);
  expect(root.hidden).toBe(false);
  expect(root.getAttribute('aria-modal')).toBe('true');
  expect(document.activeElement).toBe(root.querySelector('[data-keyboard-help-close]'));

  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(root.hidden).toBe(true);
  expect(document.activeElement).toBe(trigger);
});
```

Assert Help contains the same shortcut row count and key text as Settings.

- [ ] **Step 2: Write failing badge and shell tests**

In `tests/targetObjectList.test.ts`, pass hidden/locked sets and require visible badge text plus `data-hidden`/`data-locked` attributes for object and group rows.

In `tests/appShell.test.ts`, require one hidden help overlay with `role="dialog"`, `aria-modal="true"`, a heading, close button, and shared shortcut markup.

In `tests/responsiveNavigationStyles.test.ts`, require a viewport-bounded scrolling overlay and single-column shortcut cards on mobile.

- [ ] **Step 3: Run UI tests and verify they fail**

```powershell
npx vitest run --exclude=.worktrees/** tests/keyboardSettings.test.ts tests/keyboardHelpOverlay.test.ts tests/targetObjectList.test.ts tests/appShell.test.ts tests/responsiveNavigationStyles.test.ts
```

Expected: FAIL because the expanded catalog, overlay, and badges are absent.

- [ ] **Step 4: Expand the immutable shortcut catalog**

Update `keyboardShortcutSections` to represent every command in the specification. Use display keys such as `Ctrl/Cmd + Z`, `Shift + Arrow`, and `?`, and scope text:

- `Selection required`
- `Unlocked selection required`
- `Available across Studio`
- `Ignored while typing`

Update the Settings introduction to say all listed commands work across Studio according to their scope notes.

- [ ] **Step 5: Implement the reusable overlay controller and shell markup**

Create `src/ui/keyboardHelpOverlay.ts` with explicit focus restoration and an internal keydown listener for Escape. Add the overlay to `renderAppShell()` inside the Studio page:

```html
<section class="keyboard-help-overlay" data-keyboard-help-overlay role="dialog"
  aria-modal="true" aria-labelledby="keyboard-help-title" hidden>
  <div class="keyboard-help-panel">
    <header>
      <h2 id="keyboard-help-title" tabindex="-1">Studio keyboard shortcuts</h2>
      <button type="button" data-keyboard-help-close>Close</button>
    </header>
    ${renderKeyboardSettings()}
  </div>
</section>
```

Wire `toggle-help` and Escape precedence in `main.ts`.

- [ ] **Step 6: Render temporary state badges**

Extend object-list options with default empty sets for backward compatibility. Add:

```html
<span class="target-object-state-badge">Hidden</span>
<span class="target-object-state-badge">Locked</span>
```

only when the relevant object/group state key is present. Keep select buttons available; disable delete/ungroup controls for locked rows.

- [ ] **Step 7: Add responsive overlay and badge styles**

Use a fixed inset overlay with a translucent spatial-ink backdrop, a viewport-bounded white panel, `overflow:auto`, visible focus treatment, and existing card radii/tokens. On mobile, keep the panel within safe-area insets and reuse the single-column shortcut grid.

- [ ] **Step 8: Run all focused UI and keyboard tests**

```powershell
npx vitest run --exclude=.worktrees/** tests/keyboardSettings.test.ts tests/keyboardHelpOverlay.test.ts tests/targetObjectList.test.ts tests/appShell.test.ts tests/responsiveNavigationStyles.test.ts tests/targetEditorKeyboardIntegration.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit UI and documentation**

```powershell
git add -- src/app/keyboardShortcuts.ts src/ui/keyboardSettings.ts src/ui/keyboardHelpOverlay.ts src/ui/targetObjectList.ts src/ui/appShell.ts src/main.ts src/styles/arvenilo-redesign.css tests/keyboardSettings.test.ts tests/keyboardHelpOverlay.test.ts tests/targetObjectList.test.ts tests/appShell.test.ts tests/responsiveNavigationStyles.test.ts tests/targetEditorKeyboardIntegration.test.ts
git commit -m "feat: add studio keyboard help and state feedback"
```

---

### Task 6: Full Verification, Browser Validation, and Review

**Files:**

- Verification only unless a failing check reveals a regression.

- [ ] **Step 1: Run every keyboard/editor-focused suite**

```powershell
npx vitest run --exclude=.worktrees/** tests/targetEditorKeyboard.test.ts tests/editorHistory.test.ts tests/targetEditorCommands.test.ts tests/targetEditorKeyboardIntegration.test.ts tests/imageTargetPreview.test.ts tests/keyboardSettings.test.ts tests/keyboardHelpOverlay.test.ts tests/targetObjectList.test.ts tests/savedTargetEditingIntegration.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the complete root test suite**

```powershell
npx vitest run --exclude=.worktrees/** --maxWorkers=4
```

Expected: all root-project tests PASS.

- [ ] **Step 3: Run the production build**

```powershell
npm run build
```

Expected: TypeScript and Vite complete successfully. Existing vendor externalization and bundle-size warnings may remain.

- [ ] **Step 4: Restart and validate the local app**

Restart Vite on port `5175`. In an authenticated Studio session with an object selected, verify:

- all key mappings execute from the object list and page background;
- editable inputs remain unaffected;
- Undo/Redo, Duplicate, cycling, transforms, Hide, Lock, animation, Save, and Help work;
- Hidden/Locked badges and help overlay are readable at desktop and mobile widths;
- Settings lists the exact same commands;
- a saved target payload excludes temporary state.

- [ ] **Step 5: Inspect final repository state**

```powershell
git diff --check
git status --short
git log --oneline -12
```

Expected: no whitespace errors; only intended commits plus pre-existing unrelated untracked files.

- [ ] **Step 6: Request independent code review**

Use `superpowers:requesting-code-review` with the design, plan, base SHA, and head SHA. Resolve Critical and Important findings through `superpowers:receiving-code-review`, rerun the full suite and build, and commit fixes separately.

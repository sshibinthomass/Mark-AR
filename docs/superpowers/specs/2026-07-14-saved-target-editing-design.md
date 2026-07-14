# Saved Target Editing and Complete Object Persistence Design

## Goal

Make every saved image target reopenable from the **Cloud image targets** list. Clicking a saved target loads it into the existing target editor, and saving updates that same cloud record instead of creating a duplicate.

The cloud record must preserve everything that belongs to the target: its label, image, model objects, custom 3D text and text styling, object and group transforms, animations, and group membership. Reloading the target later must recreate the same editable scene and the same AR result.

## Scope

This feature spans both repositories that already own the cloud-target workflow:

- `D:\Github-Projects\Mark-AR` owns saved-target selection, editor hydration, editing state, serialization, preview rendering, and AR reuse.
- `D:\Github-Projects\Web-AR` owns Worker validation and durable R2 storage for the complete target record.

The work extends the existing image-target routes and record format. It does not introduce a new backend, local-only persistence, nested groups, object templates shared between targets, or collaborative conflict resolution.

## User Flow

1. The signed-in user opens **Image targets** and sees their saved cloud targets.
2. The user clicks a saved target's image or metadata area.
3. Mark-AR loads the target label, existing image, objects, groups, transforms, animations, and text styling into the current editor.
4. The clicked card is shown as active, the main action changes from **Save target** to **Update target**, and a **New target** action becomes available.
5. The user edits the target image, label, objects, text, transforms, animations, or groups.
6. **Update target** sends a `PATCH` for the selected target ID. The image is included only when the user selected a replacement file.
7. Mark-AR refreshes the cloud list and keeps the updated record active in the editor.
8. Clicking **New target** clears editing state and starts a blank target without modifying the saved target.

The delete action remains independent. Clicking delete must not open the target, and deleting the active target returns the editor to a new blank target.

## Selected Architecture

Use a typed union in the existing `objects` array. Both model and text objects remain first-class records that the editor, preview, and AR runtime can understand directly.

This is preferred over an opaque editor-state blob because the Worker can validate the stored data and other clients can render it. It is preferred over separate R2 records for every object because one target is edited and loaded as one aggregate and does not need extra network requests.

## Mark-AR Editing State

Add explicit target-editing state alongside the current draft state:

```ts
type EditingTargetState = {
  targetId: string;
  imageUrl: string;
};
```

`targetImagePayload` continues to mean that the user selected a new local image. When editing an existing target, the preview source is the local data URL when a replacement exists and otherwise the saved `imageUrl`. This avoids downloading and re-encoding the existing image merely to send an update.

Loading a saved target must:

- Deep-clone its objects, groups, placements, animations, and text content so unsaved editor changes do not mutate the list cache.
- Set the target label and existing image source.
- Clear the file input because browsers do not permit programmatically restoring an uploaded file.
- Select the first object when one exists, otherwise clear selection.
- Sync the object list, inspector, text controls, transform controls, model rail, preview, button labels, active-card state, and status message.
- Keep the existing camera view because camera position is an editor preference, not target content.

A small pure `targetEditorSession` helper should own cloning and hydration/reset decisions. DOM event wiring and preview refresh remain in `main.ts`.

## Saved Target List Interaction

Each row will contain:

- A semantic open/edit button covering the thumbnail and metadata.
- A separate icon-only delete button with the existing accessible label.

This avoids nesting one button inside another and gives keyboard users normal Enter/Space behavior. The active row receives a visible selected state and `aria-current="true"` on its open button. Delete stops at its own action and never triggers loading.

The object summary displays the complete object count, including custom text. A single object may use its model label or a short text label; multiple objects use the existing `N objects` summary.

## Complete Object Record

The Worker and Mark-AR client will use a discriminated object union:

```ts
type StoredImageTargetObject =
  | {
      kind: 'model';
      id: string;
      model: ImageTargetModel;
      placement: ImageTargetPlacement;
      animation?: ImageTargetAnimation;
      group_id?: string;
      local_placement?: ImageTargetPlacement;
    }
  | {
      kind: 'text';
      id: string;
      text: ImageTargetText;
      placement: ImageTargetPlacement;
      animation?: ImageTargetAnimation;
      group_id?: string;
      local_placement?: ImageTargetPlacement;
    };
```

Model writes include `kind: "model"`. Existing stored objects without `kind` continue to be interpreted as model objects when they contain valid model metadata.

Text records preserve:

- Text value and language.
- Font and style preset.
- Solid or gradient fill mode.
- Main, gradient, and side colors.
- Gradient direction.
- Depth, bevel, and gloss.
- Placement, local placement, animation, and group membership.

Text-only targets are valid. A target must contain at least one valid model or text object.

## Groups, Transforms, and Animations

The target record preserves the existing `groups` array. Each group stores its ID, label, placement, and animation. Grouped objects store both the editable local placement and resolved world placement.

The Worker will normalize and preserve:

- Overall scale, X/Y offsets, height, and X/Y/Z rotation.
- Animation preset and custom animation tracks.
- Group ID and local placement only when the referenced group is valid.
- Unique object and group IDs.

Empty groups are removed. A missing or invalid group reference makes the object ungrouped and retains its resolved world placement. Nested groups remain unsupported.

## Legacy Compatibility

Existing target records remain readable without migration:

- An object without `kind` and with valid `model` data is treated as a model object.
- A record without `objects` falls back to its legacy top-level `model` and `placement` fields.
- A record without `groups`, rotations, or custom animation tracks receives the current normalized defaults.
- New mixed targets retain top-level `model` and `placement` aliases from the first model object when one exists.
- Text-only targets may omit the legacy top-level model alias. New Mark-AR code reads their typed `objects` directly.

The scanner and preview use the typed objects array, so saved text objects render after refresh and in AR just like the current local draft text objects.

## Create and Update Semantics

When no saved target is active, **Save target** uses the existing create route and requires a local image payload.

When a saved target is active, **Update target** uses the existing patch route with:

- Target ID.
- Label.
- Complete normalized object array.
- Complete normalized group array.
- Replacement image bytes and MIME type only when a new file was selected.

The update replaces the target's authoring state as one aggregate. It does not merge individual objects with stale server state. The current API remains last-write-wins; multi-user version conflicts are outside this iteration.

After a successful create, Mark-AR activates the returned target. After a successful update, it refreshes the list and rehydrates the matching returned record so the editor and list cache use the server-normalized state. A refresh-button click updates only the list and must not discard unsaved editor changes.

## Worker Validation

The Web-AR Worker validates rather than blindly storing editor JSON:

- Object IDs and group IDs must be non-empty and unique after normalization.
- Text values are trimmed, non-empty, and limited to 512 Unicode code points.
- Language, font, fill mode, gradient direction, and style preset use the Mark-AR-supported values, with safe defaults for omitted legacy fields.
- Colors must use six-digit hexadecimal form.
- Depth, bevel, gloss, placement values, rotation, animation amounts, speeds, and phases use the same finite bounds as Mark-AR.
- Models retain the existing ID, label, URL, and optional preview URL checks.
- Unknown object kinds and objects missing their required model or text payload are rejected from the normalized list.
- Create and update fail with a clear `400` response if no valid renderable objects remain.

The Worker continues writing the target index and per-target record after normalization. Image bytes remain in the existing R2 image namespace.

## Error Handling

- Loading a target with no valid objects shows an error and leaves the current editor unchanged.
- A failed update preserves all unsaved editor state and keeps the same target active.
- A missing target on update reports the Worker error and allows the user to start a new target.
- Validation failures never replace the prior stored image. A storage or network failure reports an error and leaves the unsaved editor state intact.
- Deleting the active target through the current UI clears edit mode. A manual list refresh never discards the active editor state, even if the target is no longer returned.
- Preview model-load failures keep the existing fallback behavior. One bad model must not remove the other saved objects.

## Testing

### Mark-AR

- Parse and serialize model objects with explicit `kind` while accepting legacy model objects without it.
- Parse and serialize every custom text field, placement, animation, group ID, and local placement.
- Support mixed model/text targets and text-only targets.
- Clone loaded target state without sharing nested references with the list cache.
- Choose saved image URL versus replacement data URL correctly.
- Render keyboard-accessible edit controls and keep delete independent.
- Load a clicked target into the label, object list, groups, inspector, and preview.
- Switch between two targets without leaking objects between them.
- Patch the same target ID and keep the target count unchanged.
- Preserve unsaved editor state when refresh or update fails.
- Render restored text objects in preview and AR runtime.
- Keep existing legacy and model-only target tests passing.

### Web-AR Worker

- Create and update mixed model/text targets.
- Create and update text-only targets without a top-level model alias.
- Preserve text styling, rotations, custom tracks, groups, and local placements through the index and record objects.
- Normalize invalid group references and remove empty groups.
- Reject invalid text payloads and requests with no valid objects.
- Continue accepting legacy model-only request and stored-record shapes.
- Keep owner/admin authorization and image replacement behavior unchanged.

### Browser Verification

1. Open the targets page with at least two saved targets.
2. Click the first target and verify its image and complete object scene load.
3. Edit its label, a model transform, text styling, animation, and group state.
4. Update it and verify no duplicate target is created.
5. Refresh, click the same target, and verify the full scene is restored.
6. Switch to the second target and confirm the first target's objects do not leak into it.
7. Create and reload a text-only target.
8. Start AR and confirm restored model and text objects render on the saved target image.
9. Confirm keyboard card activation and delete behavior on desktop and mobile layouts.

## Repository Safety

The Web-AR checkout already contains unrelated tracked and untracked changes. Implementation must preserve those changes, keep edits narrowly scoped to the image-target contract and tests, and stage or commit only files intentionally changed for this feature.

# Multi-Object Groups Design

## Goal

Allow users to Ctrl-click or Command-click multiple objects in the 3D preview or Objects panel, transform and animate the selection together, and convert the selection into a persistent group. Groups must survive cloud save/load and behave the same way in AR, while every child object remains independently editable.

## Selected Architecture

Use a hybrid authoring and runtime format:

- Store editable group hierarchy, group transform, and group animation.
- Store each grouped object's local transform and individual animation.
- Also store a resolved world placement for every object as a backward-compatible snapshot.

New Mark-AR clients use the hierarchy. Older consumers that do not understand groups can still display every object at its resolved placement. Existing targets without groups remain ungrouped and require no migration.

## Scope

The first version supports one group level. An object may belong to at most one group; groups cannot contain other groups. This avoids cycle handling and keeps selection, serialization, and runtime transforms predictable.

Groups may contain model objects, local text objects, or both. Cloud saves continue to exclude local-only text according to the existing save policy, so a cloud group omits any unsaveable local child and is omitted if no cloud-saveable children remain.

## Selection Behavior

- Plain-click an unselected object: replace the selection with that object.
- Plain-click an already selected member of a multi-selection: keep the selection and make that object active.
- Ctrl-click on Windows/Linux or Command-click on macOS: toggle the clicked object in the selection.
- Ctrl/Command-click in the Objects panel follows the same rule.
- Click empty preview space: clear the full selection.
- Clicking a group row selects the group as one persistent transform target.
- Clicking a child row selects only that child for local editing.
- Ctrl/Command-drag on empty preview space retains the current camera zoom behavior. Ctrl/Command-click on an object takes precedence over zoom and toggles selection.

The selected object IDs are ordered. The last selected object is active and supplies object-specific labels where needed.

## Objects Panel

When two or more ungrouped objects are selected, the Objects panel shows a **Group selected** action. Activating it creates `Group 1`, `Group 2`, and so on, preserving the objects' current world appearance.

Each persistent group renders as a collapsible row with:

- Group name and member count.
- Select group action.
- Expand/collapse action.
- Ungroup action.

Expanded groups show their child rows indented beneath the group. Child rows keep their existing select and delete actions. Deleting a child removes it from its group; deleting the last child removes the empty group. Ungrouping preserves each child's resolved world transform and individual animation.

Group rename and nested groups are outside this iteration.

## Transform Semantics

Creating a group calculates a shared pivot at the centroid of member world positions. The group starts with rotation zero and scale one. Each child's local transform is calculated relative to that pivot, so grouping causes no visual jump.

Group transform controls use the existing overall scale model:

- Move changes the group pivot and moves every child equally.
- Rotate rotates child positions and orientations around the shared pivot.
- Scale changes child distances and individual scales around the shared pivot.

Selecting a child edits its local position, local rotation, and local scale inside the group. Selecting a group edits only the shared group transform. Ungrouping composes group and local matrices into each child's normal world placement.

A temporary multi-selection uses a transient centroid pivot with the same shared transform behavior. Changes are resolved back into the selected objects' current world placements unless the user creates a persistent group.

Transform composition and decomposition live in a pure helper using Three.js `Matrix4`, `Quaternion`, `Euler`, and `Vector3`. The helper normalizes the result through the existing placement bounds before storing it.

## Animation Semantics

Persistent groups own a normal `ImageTargetAnimation`. It is evaluated on the group node, making all children move, rotate, orbit, pulse, or bounce together around the group pivot.

Every child retains its own `ImageTargetAnimation`, evaluated locally after group animation. Group and child animation are additive through hierarchy rather than merged into one track list. This lets a group float together while one child also spins.

For a temporary multi-selection:

- Choosing a preset or resetting animation copies that complete animation configuration to every selected object.
- Editing custom tracks copies the same custom configuration to every selected object.
- If selected objects begin with different animations, the preset displays **Mixed** and the track editor stays empty until the user chooses a preset or adds a motion.

Selecting a persistent group shows group animation. Selecting one child shows that child's individual animation.

## State Model

```ts
type TargetEditorGroup = {
  id: string;
  label: string;
  placement: ImageTargetPlacement;
  animation: ImageTargetAnimation;
};

type TargetEditorObject = ExistingTargetEditorObject & {
  groupId?: string;
  localPlacement?: ImageTargetPlacement;
};

type TargetEditorSelection = {
  objectIds: string[];
  groupId?: string;
};
```

`groupId` selection and `objectIds` selection are mutually exclusive. A grouped child may be selected through `objectIds` for individual editing.

## Cloud Contract

The target record adds an optional `groups` array and optional group fields on objects:

```json
{
  "groups": [
    {
      "id": "group-1",
      "label": "Group 1",
      "placement": {},
      "animation": {}
    }
  ],
  "objects": [
    {
      "id": "object-1",
      "group_id": "group-1",
      "local_placement": {},
      "placement": {}
    }
  ]
}
```

`placement` is always the resolved static world placement. `local_placement` is present only for grouped objects. Group animation and child animation use the existing preset/track wire shape and legacy aliases.

The Web-AR Worker validates and preserves groups, filters invalid group IDs, ensures an object belongs to at most one group, and leaves legacy records unchanged. If a grouped object references a missing group, clients treat it as ungrouped and use `placement`.

## Preview and AR Runtime

The preview maintains group roots under its model root and attaches grouped child roots beneath them. Single group selection attaches TransformControls directly to the group root. Single child selection attaches to the child root. Temporary multi-selection attaches TransformControls to a transient selection pivot and resolves its delta back to member placements.

The AR runtime creates the same group-root/child-root hierarchy. It evaluates group animation on group roots and individual animation on child roots. Ungrouped objects use the existing direct path.

Raycasting continues to map descendants back to object IDs. Group roots are not separately pickable in the preview; users select a group through its Objects row or by selecting all members and grouping them.

## Inspector Behavior

- No selection: Object tab remains disabled.
- One object: existing individual Transform and Animation controls.
- Multiple objects: Object tab title becomes `Selection (N)`; Transform applies shared deltas and Animation applies a shared copy.
- Group: Object tab title becomes the group label; Transform and Animation edit group properties.
- Grouped child: Object tab shows `Child of <group label>` and edits local transform/individual animation.
- Text style controls appear only when exactly one text child is selected, never for a group or mixed selection.

## Normalization and Failure Handling

- Remove duplicate selected IDs and IDs not present in the current object list.
- Clear group selection if that group no longer exists.
- Ignore invalid or duplicate group records after the first valid ID.
- Treat missing-group objects as ungrouped using their resolved placement.
- Remove empty groups after delete, load normalization, or cloud filtering.
- If matrix decomposition yields non-finite values, keep the last valid placement and show the existing status error channel rather than corrupting the target.

## Testing

Focused tests cover:

- Selection toggle, active object, empty-space clear, and Ctrl/Command camera conflict.
- Object-list multi-selection styling and group row nesting.
- Group creation without visual jumps, shared-pivot move/rotate/scale, child local edits, and ungroup preservation.
- Temporary selection transform behavior.
- Group animation plus child animation hierarchy.
- Mixed animation UI and batch preset/custom/reset updates.
- Delete and empty-group cleanup.
- Cloud parsing/serialization, resolved placement snapshots, missing-group fallback, and Worker preservation.
- Backward compatibility for existing ungrouped records and first-object aliases.

After focused tests, run full Mark-AR and Web-AR Worker suites, normal and GitHub Pages builds, then browser-smoke Ctrl selection, group creation, nested rows, shared transforms, child overrides, animation, ungroup, desktop/mobile layout, and console state.

## Out of Scope

- Nested groups.
- Group rename.
- Drag-and-drop reordering.
- Cross-target reusable group templates.
- Boolean geometry merging or exporting a new combined GLB.

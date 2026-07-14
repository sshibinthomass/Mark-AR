# Multi-Object Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Ctrl/Command multi-selection, persistent cloud-backed groups, shared group transforms/animation, and independent child transforms/animation in preview and AR.

**Architecture:** A pure group model composes uniform-scale transform matrices and normalizes selection. Mark-AR stores group roots plus child-local placements while also resolving world placements for compatibility; preview and AR build the same group-root hierarchy. The Web-AR Worker validates and preserves the optional hierarchy without changing legacy records.

**Tech Stack:** TypeScript 6, Three.js r150, Vite 8, Vitest 4, happy-dom, Web-AR Cloudflare Worker.

## Global Constraints

- One group level only; an object belongs to at most one group.
- Ctrl-click/Command-click toggles object membership; Ctrl/Command-drag on empty space remains camera zoom.
- Group creation, group transform, child-local transform, and Ungroup must preserve visible world transforms.
- Group animation runs on the group root; child animation runs locally on top.
- Temporary multi-selection transforms around a centroid and batch animation copies to all selected objects.
- Existing ungrouped records and first-object aliases remain valid.
- Every saved grouped object includes `group_id`, `local_placement`, and resolved world `placement`.
- No new runtime dependency.
- Keep `.codex-remote-attachments/` untracked.

---

### Task 1: Pure group transform and selection model

**Files:**
- Create: `src/app/targetEditorGroups.ts`
- Create: `tests/targetEditorGroups.test.ts`
- Modify: `src/app/targetEditorObjects.ts`
- Modify: `src/app/cloudImageTargets.ts`

**Interfaces:**
- Produces: `TargetEditorGroup`, `TargetEditorSelection`, and optional `groupId` / `localPlacement` object fields.
- Produces: `composeGroupPlacement(groupPlacement, localPlacement)`, `localPlacementForGroup(groupPlacement, worldPlacement)`, `selectionPivotPlacement(objects, groups)`, `transformSelectionPlacements(input)`, `createTargetEditorGroup(input)`, `ungroupTargetEditorGroup(input)`, `normalizeTargetEditorSelection(selection, objects, groups)`, and `toggleTargetObjectSelection(selection, objectId)`.

- [ ] **Step 1: Write failing transform composition tests**

Test identity composition, translated parent, 90-degree parent rotation, uniform parent scale, inverse local conversion, finite normalization, and group-create/ungroup round trips:

```ts
const created = createTargetEditorGroup({
  id: 'group-1',
  label: 'Group 1',
  objectIds: ['chair', 'lamp'],
  objects,
});
expect(created.objects.map(resolveObjectPlacement)).toEqualWorldPlacements(objects);
expect(ungroupTargetEditorGroup(created).objects).toEqualWorldPlacements(objects);
```

- [ ] **Step 2: Run transform tests and confirm RED**

Run: `npm.cmd test -- tests/targetEditorGroups.test.ts`

Expected: FAIL because `targetEditorGroups.ts` does not exist.

- [ ] **Step 3: Implement matrix composition and group lifecycle**

Map placement axes to Three.js position `(offsetX, height, offsetY)`, compose `Matrix4` from `Quaternion.setFromEuler(new Euler(x, y, z, 'XYZ'))`, decompose to uniform scale, and normalize local height in `[-2, 2]` rather than the world placement's `[0, 1]`. Group creation uses the centroid, zero rotation, and scale one; ungroup composes group and local matrices.

- [ ] **Step 4: Add failing selection tests**

Cover replacement, Ctrl toggle, active-last ordering, duplicate/missing ID removal, mutually exclusive group/object selection, deleted group fallback, and centroid calculation across grouped and ungrouped objects.

- [ ] **Step 5: Run selection tests and confirm RED**

Run: `npm.cmd test -- tests/targetEditorGroups.test.ts`

Expected: FAIL on missing selection helpers.

- [ ] **Step 6: Implement selection helpers and object fields**

Use these exact public shapes:

```ts
export type TargetEditorGroup = {
  id: string;
  label: string;
  placement: ImageTargetPlacement;
  animation: ImageTargetAnimation;
};

export type TargetEditorSelection = {
  objectIds: string[];
  groupId?: string;
};
```

Add `groupId?: string` and `localPlacement?: ImageTargetPlacement` to model and text object types.

- [ ] **Step 7: Verify Task 1 GREEN and commit**

Run: `npm.cmd test -- tests/targetEditorGroups.test.ts`

Expected: PASS.

Commit: `feat: add target group transform model`

### Task 2: Nested Objects panel and modifier selection

**Files:**
- Modify: `src/ui/targetObjectList.ts`
- Modify: `src/ui/appShell.ts`
- Modify: `src/style.css`
- Modify: `tests/targetObjectList.test.ts`
- Modify: `tests/appShell.test.ts`

**Interfaces:**
- Consumes: `TargetEditorGroup` and `TargetEditorSelection` from Task 1.
- Produces: `renderTargetObjectList(options)` for nested group rows and child rows.
- Produces callbacks `onSelectObject(objectId, additive)`, `onSelectGroup(groupId)`, `onGroupSelected()`, `onUngroup(groupId)`, and `onDeleteObject(objectId)`.

- [ ] **Step 1: Write failing list tests**

Render two selected ungrouped objects and assert **Group selected** is enabled. Render a selected group and assert a collapsible group row, member count, indented children, group selection styling, child selection styling, and Ungroup. Dispatch Ctrl-click and Meta-click on child buttons and assert `additive === true`.

- [ ] **Step 2: Confirm list RED**

Run: `npm.cmd test -- tests/targetObjectList.test.ts tests/appShell.test.ts`

Expected: FAIL because only single flat rows exist.

- [ ] **Step 3: Implement nested list rendering and shell hooks**

Keep `renderTargetObjectListItem` as the child-row primitive. Add group rows with `aria-expanded`, `aria-selected`, member count, and stable `data-select-target-group` / `data-ungroup-target-group` attributes. Add `#group-selected-objects` to the Objects panel toolbar, hidden or disabled unless at least two object IDs are selected.

- [ ] **Step 4: Style group hierarchy and multi-selection**

Use the current teal selected state, a subtle left rail for children, distinct group-row typography, visible keyboard focus, and a single-column mobile layout. Do not change global typography.

- [ ] **Step 5: Verify Task 2 GREEN and commit**

Run: `npm.cmd test -- tests/targetObjectList.test.ts tests/appShell.test.ts`

Expected: PASS.

Commit: `feat: add grouped object list controls`

### Task 3: Main editor group state and inspector behavior

**Files:**
- Modify: `src/main.ts`
- Modify: `src/ui/targetInspectorTabs.ts`
- Modify: `tests/targetObjectControlsSelection.test.ts`
- Modify: `tests/targetAnimationEditorIntegration.test.ts`
- Create: `tests/targetGroupEditorIntegration.test.ts`

**Interfaces:**
- Consumes: group lifecycle and selection helpers from Task 1 and grouped list callbacks from Task 2.
- Produces: `targetGroups: TargetEditorGroup[]` and `targetSelection: TargetEditorSelection` as the main state source.
- Produces preview state `{ groups, selection }` and batch placement/group placement handlers.

- [ ] **Step 1: Write failing main integration tests**

Mount the app, add three objects, Ctrl-click two list rows, group them, assert one nested group plus one ungrouped row, select the group, change transform/animation, select a child, change local transform/animation, and ungroup without changing resolved placements.

- [ ] **Step 2: Add failing mixed/batch animation tests**

Select two differently animated objects and assert the preset is Mixed with no tracks. Choose Showcase and assert both objects receive cloned Showcase animations. Reset and assert both become None without sharing mutable track arrays.

- [ ] **Step 3: Confirm main integration RED**

Run: `npm.cmd test -- tests/targetGroupEditorIntegration.test.ts tests/targetObjectControlsSelection.test.ts tests/targetAnimationEditorIntegration.test.ts`

Expected: FAIL because main owns one `selectedTargetObjectId` and has no groups.

- [ ] **Step 4: Replace single selection state**

Replace `selectedTargetObjectId` with `targetSelection`. Use the last object ID as active for object labels. Selecting a group clears object IDs; selecting any object clears group selection. Group IDs are generated with the existing object-ID collision style.

- [ ] **Step 5: Implement inspector adapters**

For one object, retain current behavior. For multiple objects, expose centroid transform and apply transform deltas through `transformSelectionPlacements`; batch-copy animation changes. For a group, edit group placement/animation. For a grouped child, edit `localPlacement` and individual animation. Show text style only for exactly one selected text child.

- [ ] **Step 6: Update tab labels and status copy**

Expose `setTabLabel('object-controls', label)` on `targetInspectorTabs`; use `Object`, `Selection (N)`, group label, or `Child of <group label>`. Status copy reports selected count, group creation, and ungrouping.

- [ ] **Step 7: Verify Task 3 GREEN and commit**

Run: `npm.cmd test -- tests/targetGroupEditorIntegration.test.ts tests/targetObjectControlsSelection.test.ts tests/targetAnimationEditorIntegration.test.ts tests/newTargetAnimationDefaults.test.ts`

Expected: PASS.

Commit: `feat: add group and multi-selection editor state`

### Task 4: Preview multi-selection, group roots, and shared pivots

**Files:**
- Modify: `src/scene/ImageTargetPreview.ts`
- Modify: `tests/imageTargetPreview.test.ts`

**Interfaces:**
- Consumes: `TargetEditorGroup`, `TargetEditorSelection`, and transform helpers.
- Produces: preview state `{ objects, groups, selection }`.
- Produces callbacks `onSelectionChange(selection)`, `onPlacementsChange(changes)`, and `onGroupPlacementChange(change)`.

- [ ] **Step 1: Write failing modifier selection tests**

Load three objects and raycast clicks so plain click replaces, Ctrl-click toggles, Meta-click toggles, clicking an already-selected member preserves the multi-selection and makes it active, empty click clears, and Ctrl-drag on empty space still zooms.

- [ ] **Step 2: Confirm selection RED**

Run: `npm.cmd test -- tests/imageTargetPreview.test.ts`

Expected: FAIL because the preview emits one object ID and Ctrl selects zoom mode.

- [ ] **Step 3: Implement selection state and conflict rule**

Pick on left-button object hits before choosing camera mode. Ctrl/Meta object hits toggle and return without starting zoom. Ctrl/Meta empty-space drag keeps `cameraDragModeFromEvent` zoom. Plain-click on a selected multi-member preserves the set; plain-click elsewhere replaces it.

- [ ] **Step 4: Write failing group hierarchy tests**

Assert grouped child roots are parented to group roots, group TransformControls attach to the group root, individual child controls attach locally, group animation moves all children, and child animation remains additive.

- [ ] **Step 5: Write failing temporary pivot tests**

Assert multi-selection TransformControls attach to a centroid proxy and that translate, rotate, and scale emit placement changes for every selected member around the shared pivot without altering unselected objects.

- [ ] **Step 6: Implement group roots and transient pivot**

Maintain `groupRoots`, `groupPlacements`, and `groupAnimations`. Parent grouped child roots under their group root and apply local placements. For temporary selection, attach controls to a proxy at `selectionPivotPlacement`; on `objectChange`, calculate `delta = currentPivot * inverse(startPivot)` and transform each captured world matrix before converting back to local or ungrouped placement.

- [ ] **Step 7: Extend direct drag/rotate/scale gestures**

Reuse the same transient-pivot transform helper when more than one object is selected; keep current one-object gesture behavior unchanged.

- [ ] **Step 8: Verify Task 4 GREEN and commit**

Run: `npm.cmd test -- tests/imageTargetPreview.test.ts`

Expected: PASS.

Commit: `feat: transform grouped preview objects`

### Task 5: Mark-AR cloud group contract and resolved snapshots

**Files:**
- Modify: `src/app/cloudImageTargets.ts`
- Modify: `tests/cloudImageTargets.test.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: group types and composition helpers.
- Produces: `CloudImageTarget.groups`, object `groupId` / `localPlacement`, Worker `groups`, `group_id`, and `local_placement` mapping.
- Produces: `resolveGroupedObjectsForSave(objects, groups)` returning world `placement` snapshots.

- [ ] **Step 1: Write failing cloud parse tests**

Parse a target with one group and two grouped objects. Assert camel-case group data, local placements, resolved placements, and missing-group fallback to ungrouped world placement. Keep all legacy ungrouped assertions.

- [ ] **Step 2: Write failing serialization tests**

Save the same target and assert snake-case `groups`, `group_id`, `local_placement`, and matrix-resolved `placement`; assert first-object `model` / `placement` aliases still use the resolved first object.

- [ ] **Step 3: Confirm cloud RED**

Run: `npm.cmd test -- tests/cloudImageTargets.test.ts`

Expected: FAIL because groups are absent from client and wire types.

- [ ] **Step 4: Implement parsing, normalization, and request bodies**

Normalize groups before objects. Drop duplicate group IDs after the first. Keep only group references that exist. Parse/save group animation through the existing animation mapper. Resolve every grouped object before constructing legacy aliases.

- [ ] **Step 5: Wire save/load state in main**

When loading a saved target, populate `targetGroups`, normalized objects, and an empty selection. When saving, omit empty groups and groups containing no saveable model children while preserving resolved child output.

- [ ] **Step 6: Verify Task 5 GREEN and commit**

Run: `npm.cmd test -- tests/cloudImageTargets.test.ts tests/targetGroupEditorIntegration.test.ts`

Expected: PASS.

Commit: `feat: persist target object groups`

### Task 6: AR runtime group hierarchy

**Files:**
- Modify: `src/ar/cloudflareMarkerObject.ts`
- Modify: `tests/cloudflareMarkerObject.test.ts`

**Interfaces:**
- Consumes: `CloudImageTarget.groups`, grouped object local placement, and existing animation evaluation.
- Produces: group-root and child-root animation hierarchy in `createCloudflareMarkerObject`.

- [ ] **Step 1: Write failing AR group tests**

Create a group with two children, apply a translated/rotated/scaled group placement, group Float animation, and child Spin animation. Assert hierarchy names, shared group motion, additive child motion, resolved fallback for a missing group, and unchanged ungrouped behavior.

- [ ] **Step 2: Confirm AR RED**

Run: `npm.cmd test -- tests/cloudflareMarkerObject.test.ts`

Expected: FAIL because every object root is currently attached directly to the marker group.

- [ ] **Step 3: Implement group roots and layered animation**

Create one root per valid group, apply group placement/animation there, and attach grouped object roots using `localPlacement`. Keep ungrouped roots direct. Evaluate group animation first, then individual animation each update.

- [ ] **Step 4: Verify Task 6 GREEN and commit**

Run: `npm.cmd test -- tests/cloudflareMarkerObject.test.ts`

Expected: PASS.

Commit: `feat: render object groups in AR`

### Task 7: Web-AR Worker schema preservation

**Files (in `D:\Github-Projects\Web-AR` isolated worktree):**
- Modify: `worker/src/index.ts`
- Modify: `tests/worker/generateModelWorker.test.ts`

**Interfaces:**
- Consumes: snake-case Mark-AR group wire format from Task 5.
- Produces: normalized stored `groups`, `group_id`, and `local_placement` fields while retaining resolved `placement` and legacy records.

- [ ] **Step 1: Write failing endpoint-level Worker test**

POST an image target with one group and two grouped objects, then assert the create response, R2 index record, full record, and authenticated list response all preserve normalized group fields and animation tracks. Add invalid duplicate/missing group cases.

- [ ] **Step 2: Confirm Worker RED**

Run: `npm.cmd test -- tests/worker/generateModelWorker.test.ts`

Expected: FAIL because the Worker filters group fields.

- [ ] **Step 3: Extend Worker types and normalizers**

Add `ImageTargetGroup`, optional entry `groups`, object `group_id`, and `local_placement`. Reuse placement normalization with local bounds `[-2, 2]`; normalize groups before objects; remove invalid references; preserve legacy-only response shape when no groups are supplied.

- [ ] **Step 4: Verify Task 7 GREEN and commit**

Run: `npm.cmd test -- tests/worker/generateModelWorker.test.ts`

Expected: PASS.

Commit: `feat: preserve image target groups`

### Task 8: Full regression and real UI verification

**Files:**
- Modify only files already listed if verification exposes a covered defect.

**Interfaces:**
- Produces: test, build, browser, and repository-state evidence.

- [ ] **Step 1: Run focused Mark-AR regression**

Run: `npm.cmd test -- tests/targetEditorGroups.test.ts tests/targetObjectList.test.ts tests/targetGroupEditorIntegration.test.ts tests/imageTargetPreview.test.ts tests/cloudImageTargets.test.ts tests/cloudflareMarkerObject.test.ts`

Expected: PASS.

- [ ] **Step 2: Run full Mark-AR tests and builds**

Run: `npm.cmd test`

Expected: all tests pass.

Run: `npm.cmd run build`

Expected: TypeScript and Vite succeed.

Run: `$env:GITHUB_PAGES='true'; npm.cmd run build`

Expected: TypeScript and Vite succeed with `/Mark-AR/` asset paths.

- [ ] **Step 3: Run full Web-AR Worker repository verification**

Run from the Worker worktree: `npm.cmd test` then `npm.cmd run build`.

Expected: all tests and TypeScript/Vite build pass.

- [ ] **Step 4: Start and probe Mark-AR**

Run: `npm.cmd run dev -- --host 127.0.0.1 --port 5182 --strictPort`

Probe: `Invoke-WebRequest http://127.0.0.1:5182/`

Expected: HTTP 200 and title `Mark AR`.

- [ ] **Step 5: Browser-smoke grouping**

Using authenticated state or a temporary component harness built from the committed modules, verify: Ctrl/Command multi-selection, Group selected, nested rows, group move/rotate/scale, child local edit, group plus child animation, Ungroup preservation, empty selection, desktop/mobile layout, and zero browser console errors.

- [ ] **Step 6: Inspect final repository state**

Run `git status --short --branch` and `git diff --check` in both worktrees.

Expected: only scoped commits; no whitespace errors; user-owned Web-AR dirty checkout remains untouched; `.codex-remote-attachments/` remains untracked.

import { normalizeAnimation } from './imageTargetAnimation';
import {
  composeGroupPlacement,
  resolveObjectPlacement,
  type TargetEditorGroup,
  type TargetEditorSelection,
} from './targetEditorGroups';
import { isTextTargetObject, type TargetEditorObject } from './targetEditorObjects';

export type TargetEditorTransientState = {
  hiddenKeys: string[];
  lockedKeys: string[];
};

export function selectionStateKeys(
  selection: TargetEditorSelection,
  objects: TargetEditorObject[],
): string[] {
  if (selection.groupId) {
    return [`group:${selection.groupId}`];
  }
  const validIds = new Set(objects.map((object) => object.id));
  return selection.objectIds
    .filter((id, index, values) => validIds.has(id) && values.indexOf(id) === index)
    .map((id) => `object:${id}`);
}

export function isSelectionLocked(
  selection: TargetEditorSelection,
  objects: TargetEditorObject[],
  lockedKeys: ReadonlySet<string>,
): boolean {
  return selectionStateKeys(selection, objects).some((key) => lockedKeys.has(key));
}

export function cycleTargetSelection({
  objects,
  selection,
  direction,
}: {
  objects: TargetEditorObject[];
  groups: TargetEditorGroup[];
  selection: TargetEditorSelection;
  direction: 1 | -1;
}): TargetEditorSelection {
  if (objects.length === 0) {
    return { objectIds: [] };
  }

  let currentIndex = -1;
  if (selection.groupId) {
    const memberIndexes = objects.flatMap((object, index) => object.groupId === selection.groupId ? [index] : []);
    currentIndex = direction === 1
      ? memberIndexes.at(-1) ?? -1
      : memberIndexes[0] ?? 0;
  } else if (selection.objectIds.length > 0) {
    currentIndex = objects.findIndex((object) => object.id === selection.objectIds.at(-1));
  }

  const nextIndex = (currentIndex + direction + objects.length) % objects.length;
  return { objectIds: [objects[nextIndex].id] };
}

export function duplicateTargetSelection({
  objects,
  groups,
  selection,
  createObjectId,
  createGroupId,
}: {
  objects: TargetEditorObject[];
  groups: TargetEditorGroup[];
  selection: TargetEditorSelection;
  createObjectId(): string;
  createGroupId(): string;
}): {
  objects: TargetEditorObject[];
  groups: TargetEditorGroup[];
  selection: TargetEditorSelection;
} {
  if (selection.groupId) {
    const group = groups.find((candidate) => candidate.id === selection.groupId);
    const members = objects.filter((object) => object.groupId === selection.groupId);
    if (!group || members.length === 0) {
      return { objects, groups, selection };
    }
    const groupId = createGroupId();
    const groupCopy: TargetEditorGroup = {
      ...group,
      id: groupId,
      label: `${group.label} copy`,
      placement: offsetPlacement(group.placement),
      animation: normalizeAnimation(group.animation),
    };
    const nextGroups = [...groups, groupCopy];
    const copies = members.map((object) => {
      const copy = cloneTargetObject(object, createObjectId());
      const localPlacement = object.localPlacement ? { ...object.localPlacement } : { ...object.placement };
      return {
        ...copy,
        groupId,
        localPlacement,
        placement: composeGroupPlacement(groupCopy.placement, localPlacement),
      } as TargetEditorObject;
    });
    return {
      objects: [...objects, ...copies],
      groups: nextGroups,
      selection: { objectIds: [], groupId },
    };
  }

  const selectedIds = new Set(selection.objectIds);
  const selected = objects.filter((object) => selectedIds.has(object.id));
  if (selected.length === 0) {
    return { objects, groups, selection };
  }
  const copies = selected.map((object) => {
    const copy = cloneTargetObject(object, createObjectId());
    const { groupId: _groupId, localPlacement: _localPlacement, ...ungrouped } = copy;
    return {
      ...ungrouped,
      placement: offsetPlacement(resolveObjectPlacement(object, groups)),
    } as TargetEditorObject;
  });
  return {
    objects: [...objects, ...copies],
    groups,
    selection: { objectIds: copies.map((object) => object.id) },
  };
}

function cloneTargetObject(object: TargetEditorObject, id: string): TargetEditorObject {
  const common = {
    ...object,
    id,
    placement: { ...object.placement },
    ...(object.localPlacement ? { localPlacement: { ...object.localPlacement } } : {}),
    animation: normalizeAnimation(object.animation),
  };
  return isTextTargetObject(object)
    ? { ...common, kind: 'text', text: { ...object.text } }
    : { ...common, model: { ...object.model } };
}

function offsetPlacement<T extends { offsetX: number; offsetY: number }>(placement: T): T {
  return {
    ...placement,
    offsetX: placement.offsetX + 0.05,
    offsetY: placement.offsetY + 0.05,
  };
}

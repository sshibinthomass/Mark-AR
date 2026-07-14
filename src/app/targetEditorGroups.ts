import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { DEFAULT_IMAGE_TARGET_ANIMATION, normalizeAnimation, type ImageTargetAnimation } from './imageTargetAnimation';
import type { ImageTargetPlacement } from './imageTargetPayload';
import type { TargetEditorObject } from './targetEditorObjects';

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

type GroupState = {
  objects: TargetEditorObject[];
  groups: TargetEditorGroup[];
};

const zeroPlacement: ImageTargetPlacement = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  height: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
};

export function composeGroupPlacement(
  groupPlacement: ImageTargetPlacement,
  localPlacement: ImageTargetPlacement,
): ImageTargetPlacement {
  return placementFromMatrix(
    placementMatrix(groupPlacement).multiply(placementMatrix(localPlacement)),
  );
}

export function localPlacementForGroup(
  groupPlacement: ImageTargetPlacement,
  worldPlacement: ImageTargetPlacement,
): ImageTargetPlacement {
  const inverseGroup = placementMatrix(groupPlacement).invert();
  return placementFromMatrix(inverseGroup.multiply(placementMatrix(worldPlacement)));
}

export function resolveObjectPlacement(
  object: TargetEditorObject,
  groups: TargetEditorGroup[] = [],
): ImageTargetPlacement {
  if (!object.groupId || !object.localPlacement) {
    return finitePlacement(object.placement);
  }
  const group = groups.find((candidate) => candidate.id === object.groupId);
  return group ? composeGroupPlacement(group.placement, object.localPlacement) : finitePlacement(object.placement);
}

export function selectionPivotPlacement(
  objects: TargetEditorObject[],
  groups: TargetEditorGroup[],
  objectIds: string[],
): ImageTargetPlacement {
  const selectedIds = new Set(objectIds);
  const placements = objects
    .filter((object) => selectedIds.has(object.id))
    .map((object) => resolveObjectPlacement(object, groups));
  if (placements.length === 0) {
    return { ...zeroPlacement };
  }
  return {
    ...zeroPlacement,
    offsetX: average(placements.map((placement) => placement.offsetX)),
    offsetY: average(placements.map((placement) => placement.offsetY)),
    height: average(placements.map((placement) => placement.height)),
  };
}

export function transformSelectionPlacements({
  objects,
  groups,
  objectIds,
  startPivot,
  endPivot,
}: {
  objects: TargetEditorObject[];
  groups: TargetEditorGroup[];
  objectIds: string[];
  startPivot: ImageTargetPlacement;
  endPivot: ImageTargetPlacement;
}): TargetEditorObject[] {
  const selectedIds = new Set(objectIds);
  const delta = placementMatrix(endPivot).multiply(placementMatrix(startPivot).invert());

  return objects.map((object) => {
    if (!selectedIds.has(object.id)) {
      return object;
    }
    const worldPlacement = placementFromMatrix(
      delta.clone().multiply(placementMatrix(resolveObjectPlacement(object, groups))),
    );
    const group = object.groupId ? groups.find((candidate) => candidate.id === object.groupId) : undefined;
    return {
      ...object,
      placement: worldPlacement,
      ...(group ? { localPlacement: localPlacementForGroup(group.placement, worldPlacement) } : {}),
    };
  });
}

export function createTargetEditorGroup({
  id,
  label,
  objectIds,
  objects,
  groups,
}: {
  id: string;
  label: string;
  objectIds: string[];
  objects: TargetEditorObject[];
  groups: TargetEditorGroup[];
}): GroupState & { group: TargetEditorGroup } {
  const selectedIds = new Set(objectIds);
  const selectedObjects = objects.filter((object) => selectedIds.has(object.id));
  const placement = selectionPivotPlacement(objects, groups, objectIds);
  const group: TargetEditorGroup = {
    id,
    label,
    placement,
    animation: normalizeAnimation(DEFAULT_IMAGE_TARGET_ANIMATION),
  };
  const nextObjects = objects.map((object) => {
    if (!selectedIds.has(object.id)) {
      return object;
    }
    const worldPlacement = resolveObjectPlacement(object, groups);
    return {
      ...object,
      groupId: id,
      localPlacement: localPlacementForGroup(placement, worldPlacement),
      placement: worldPlacement,
    };
  });

  if (selectedObjects.length < 2) {
    return { objects, groups, group };
  }
  return { objects: nextObjects, groups: [...groups, group], group };
}

export function ungroupTargetEditorGroup({
  groupId,
  objects,
  groups,
}: {
  groupId: string;
  objects: TargetEditorObject[];
  groups: TargetEditorGroup[];
}): GroupState {
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group) {
    return { objects, groups };
  }
  return {
    groups: groups.filter((candidate) => candidate.id !== groupId),
    objects: objects.map((object) => {
      if (object.groupId !== groupId) {
        return object;
      }
      const placement = resolveObjectPlacement(object, groups);
      const { groupId: _groupId, localPlacement: _localPlacement, ...ungrouped } = object;
      return { ...ungrouped, placement } as TargetEditorObject;
    }),
  };
}

export function normalizeTargetEditorSelection(
  selection: TargetEditorSelection,
  objects: TargetEditorObject[],
  groups: TargetEditorGroup[],
): TargetEditorSelection {
  if (selection.groupId && groups.some((group) => group.id === selection.groupId)) {
    return { objectIds: [], groupId: selection.groupId };
  }
  const objectIds = new Set(objects.map((object) => object.id));
  return {
    objectIds: selection.objectIds.filter((id, index, values) => objectIds.has(id) && values.indexOf(id) === index),
  };
}

export function toggleTargetObjectSelection(
  selection: TargetEditorSelection,
  objectId: string,
): TargetEditorSelection {
  const objectIds = selection.objectIds.filter((id) => id !== objectId);
  if (objectIds.length === selection.objectIds.length) {
    objectIds.push(objectId);
  }
  return { objectIds };
}

export function placementMatrix(placement: ImageTargetPlacement): Matrix4 {
  const normalized = finitePlacement(placement);
  return new Matrix4().compose(
    new Vector3(normalized.offsetX, normalized.height, normalized.offsetY),
    new Quaternion().setFromEuler(new Euler(
      degreesToRadians(normalized.rotationX),
      degreesToRadians(normalized.rotationY),
      degreesToRadians(normalized.rotationZ),
      'XYZ',
    )),
    new Vector3(normalized.scale, normalized.scale, normalized.scale),
  );
}

export function placementFromMatrix(matrix: Matrix4): ImageTargetPlacement {
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  matrix.decompose(position, quaternion, scale);
  const euler = new Euler().setFromQuaternion(quaternion, 'XYZ');
  return finitePlacement({
    scale: (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3,
    offsetX: position.x,
    offsetY: position.z,
    height: position.y,
    rotationX: radiansToDegrees(euler.x),
    rotationY: radiansToDegrees(euler.y),
    rotationZ: radiansToDegrees(euler.z),
  });
}

function finitePlacement(value: Partial<ImageTargetPlacement>): ImageTargetPlacement {
  return {
    scale: clamp(finite(value.scale, 1), 0.01, 50),
    offsetX: clamp(finite(value.offsetX, 0), -50, 50),
    offsetY: clamp(finite(value.offsetY, 0), -50, 50),
    height: clamp(finite(value.height, 0), -50, 50),
    rotationX: normalizeDegrees(value.rotationX),
    rotationY: normalizeDegrees(value.rotationY),
    rotationZ: normalizeDegrees(value.rotationZ),
  };
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeDegrees(value: unknown): number {
  const number = finite(value, 0);
  const wrapped = ((((number + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : Number(wrapped.toFixed(6));
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

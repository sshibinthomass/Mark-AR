import { describe, expect, it } from 'vitest';
import type { ImageTargetPlacement } from '../src/app/imageTargetPayload';
import type { TargetEditorObject } from '../src/app/targetEditorObjects';
import {
  composeGroupPlacement,
  createTargetEditorGroup,
  localPlacementForGroup,
  normalizeTargetEditorSelection,
  resolveObjectPlacement,
  selectionPivotPlacement,
  toggleTargetObjectSelection,
  transformSelectionPlacements,
  ungroupTargetEditorGroup,
  type TargetEditorGroup,
} from '../src/app/targetEditorGroups';

const identity: ImageTargetPlacement = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  height: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
};

function modelObject(id: string, placement: Partial<ImageTargetPlacement>): TargetEditorObject {
  return {
    id,
    model: { id, label: id, url: `https://example.com/${id}.glb` },
    placement: { ...identity, ...placement },
  };
}

function expectPlacementClose(actual: ImageTargetPlacement, expected: ImageTargetPlacement): void {
  expect(actual.scale).toBeCloseTo(expected.scale, 5);
  expect(actual.offsetX).toBeCloseTo(expected.offsetX, 5);
  expect(actual.offsetY).toBeCloseTo(expected.offsetY, 5);
  expect(actual.height).toBeCloseTo(expected.height, 5);
  expect(actual.rotationX).toBeCloseTo(expected.rotationX, 5);
  expect(actual.rotationY).toBeCloseTo(expected.rotationY, 5);
  expect(actual.rotationZ).toBeCloseTo(expected.rotationZ, 5);
}

describe('target editor group transforms', () => {
  it('composes identity, translation, rotation, and uniform scale', () => {
    expectPlacementClose(composeGroupPlacement(identity, { ...identity, offsetX: 0.25, height: -0.4 }), {
      ...identity,
      offsetX: 0.25,
      height: -0.4,
    });

    expectPlacementClose(
      composeGroupPlacement({ ...identity, offsetX: 0.4, offsetY: -0.2, height: 0.3 }, { ...identity, offsetX: 0.1, height: 0.2 }),
      { ...identity, offsetX: 0.5, offsetY: -0.2, height: 0.5 },
    );

    expectPlacementClose(
      composeGroupPlacement({ ...identity, rotationY: 90 }, { ...identity, offsetX: 1 }),
      { ...identity, offsetY: -1, rotationY: 90 },
    );

    expectPlacementClose(
      composeGroupPlacement({ ...identity, scale: 2, offsetX: 0.1 }, { ...identity, scale: 0.5, offsetX: 0.25 }),
      { ...identity, scale: 1, offsetX: 0.6 },
    );
  });

  it('round-trips world and local placements without world-height clamping', () => {
    const group = { ...identity, scale: 1.5, offsetX: 0.4, offsetY: -0.3, height: 0.8, rotationX: 15, rotationY: 35 };
    const world = { ...identity, scale: 0.7, offsetX: -0.2, offsetY: 0.25, height: 0.1, rotationX: -10, rotationY: 5, rotationZ: 25 };
    const local = localPlacementForGroup(group, world);

    expect(local.height).toBeLessThan(0);
    expectPlacementClose(composeGroupPlacement(group, local), world);
  });

  it('normalizes non-finite matrix input to finite placement values', () => {
    const result = composeGroupPlacement(
      { ...identity, offsetX: Number.NaN, rotationY: Number.POSITIVE_INFINITY },
      { ...identity, height: Number.NEGATIVE_INFINITY, scale: Number.NaN },
    );

    expect(Object.values(result).every(Number.isFinite)).toBe(true);
  });

  it('creates and ungroups a group without moving its objects', () => {
    const objects = [
      modelObject('chair', { offsetX: -0.4, offsetY: 0.2, height: 0.1, rotationY: 20 }),
      modelObject('lamp', { offsetX: 0.6, offsetY: -0.1, height: 0.5, scale: 0.8, rotationZ: 15 }),
    ];
    const before = objects.map((object) => object.placement);
    const created = createTargetEditorGroup({ id: 'group-1', label: 'Group 1', objectIds: ['chair', 'lamp'], objects, groups: [] });

    expect(created.group.placement.offsetX).toBeCloseTo(0.1);
    expect(created.group.placement.offsetY).toBeCloseTo(0.05);
    expect(created.group.placement.height).toBeCloseTo(0.3);
    expect(created.objects.every((object) => object.groupId === 'group-1')).toBe(true);
    created.objects.forEach((object, index) => expectPlacementClose(resolveObjectPlacement(object, created.groups), before[index]));

    const ungrouped = ungroupTargetEditorGroup({ groupId: 'group-1', objects: created.objects, groups: created.groups });
    expect(ungrouped.groups).toEqual([]);
    ungrouped.objects.forEach((object, index) => {
      expect(object.groupId).toBeUndefined();
      expect(object.localPlacement).toBeUndefined();
      expectPlacementClose(object.placement, before[index]);
    });
  });
});

describe('target editor selection', () => {
  const objects = [modelObject('chair', { offsetX: -0.5 }), modelObject('lamp', { offsetX: 0.5 }), modelObject('plant', { height: 0.6 })];
  const groups: TargetEditorGroup[] = [{
    id: 'group-1',
    label: 'Group 1',
    placement: identity,
    animation: { preset: 'none', tracks: [] },
  }];

  it('toggles additive object selection and keeps the active object last', () => {
    expect(toggleTargetObjectSelection({ objectIds: ['chair'] }, 'lamp')).toEqual({ objectIds: ['chair', 'lamp'] });
    expect(toggleTargetObjectSelection({ objectIds: ['chair', 'lamp'] }, 'chair')).toEqual({ objectIds: ['lamp'] });
    expect(toggleTargetObjectSelection({ objectIds: ['chair'], groupId: 'group-1' }, 'lamp')).toEqual({ objectIds: ['chair', 'lamp'] });
  });

  it('normalizes duplicates and missing IDs with mutually exclusive group selection', () => {
    expect(normalizeTargetEditorSelection({ objectIds: ['chair', 'missing', 'chair', 'lamp'] }, objects, groups)).toEqual({ objectIds: ['chair', 'lamp'] });
    expect(normalizeTargetEditorSelection({ objectIds: ['chair'], groupId: 'group-1' }, objects, groups)).toEqual({ objectIds: [], groupId: 'group-1' });
    expect(normalizeTargetEditorSelection({ objectIds: [], groupId: 'missing' }, objects, groups)).toEqual({ objectIds: [] });
  });

  it('calculates a centroid pivot from selected resolved placements', () => {
    const pivot = selectionPivotPlacement(objects, groups, ['chair', 'lamp', 'plant']);
    expectPlacementClose(pivot, { ...identity, height: 0.2 });
  });

  it('transforms all selected members around their centroid and leaves the rest unchanged', () => {
    const transformed = transformSelectionPlacements({
      objects,
      groups,
      objectIds: ['chair', 'lamp'],
      startPivot: identity,
      endPivot: { ...identity, offsetX: 0.25, rotationY: 90, scale: 2 },
    });

    expectPlacementClose(transformed[0].placement, { ...identity, offsetX: 0.25, offsetY: 1, scale: 2, rotationY: 90 });
    expectPlacementClose(transformed[1].placement, { ...identity, offsetX: 0.25, offsetY: -1, scale: 2, rotationY: 90 });
    expect(transformed[2]).toBe(objects[2]);
  });
});

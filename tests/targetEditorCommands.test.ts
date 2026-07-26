import { describe, expect, it } from 'vitest';
import { DEFAULT_IMAGE_TARGET_ANIMATION } from '../src/app/imageTargetAnimation';
import {
  cycleTargetSelection,
  duplicateTargetSelection,
  isSelectionLocked,
  selectionStateKeys,
} from '../src/app/targetEditorCommands';
import type { TargetEditorGroup, TargetEditorSelection } from '../src/app/targetEditorGroups';
import type { TargetEditorObject } from '../src/app/targetEditorObjects';

const placement = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  height: 0.1,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
};

const objects: TargetEditorObject[] = [
  {
    id: 'chair',
    model: { id: 'chair-model', label: 'Chair', url: '/chair.glb' },
    placement: { ...placement },
    animation: DEFAULT_IMAGE_TARGET_ANIMATION,
  },
  {
    kind: 'text',
    id: 'label',
    text: { value: 'Hello', language: 'english', font: 'studio-sans' },
    placement: { ...placement, offsetX: 0.2 },
    animation: DEFAULT_IMAGE_TARGET_ANIMATION,
  },
  {
    id: 'lamp',
    model: { id: 'lamp-model', label: 'Lamp', url: '/lamp.glb' },
    placement: { ...placement, offsetX: 0.4 },
    animation: DEFAULT_IMAGE_TARGET_ANIMATION,
  },
];

describe('target editor scene commands', () => {
  it('cycles object selection forward, backward, and across list boundaries', () => {
    expect(cycleTargetSelection({
      objects,
      groups: [],
      selection: { objectIds: ['chair'] },
      direction: 1,
    })).toEqual({ objectIds: ['label'] });
    expect(cycleTargetSelection({
      objects,
      groups: [],
      selection: { objectIds: ['chair'] },
      direction: -1,
    })).toEqual({ objectIds: ['lamp'] });
    expect(cycleTargetSelection({
      objects,
      groups: [],
      selection: { objectIds: [] },
      direction: 1,
    })).toEqual({ objectIds: ['chair'] });
  });

  it('continues cycling from the selected group boundary', () => {
    const group: TargetEditorGroup = {
      id: 'furniture',
      label: 'Furniture',
      placement: { ...placement },
      animation: DEFAULT_IMAGE_TARGET_ANIMATION,
    };
    const grouped = objects.map((object, index) => index < 2
      ? { ...object, groupId: group.id, localPlacement: { ...object.placement } }
      : object) as TargetEditorObject[];

    expect(cycleTargetSelection({
      objects: grouped,
      groups: [group],
      selection: { objectIds: [], groupId: group.id },
      direction: 1,
    })).toEqual({ objectIds: ['lamp'] });
    expect(cycleTargetSelection({
      objects: grouped,
      groups: [group],
      selection: { objectIds: [], groupId: group.id },
      direction: -1,
    })).toEqual({ objectIds: ['lamp'] });
  });

  it('duplicates an object with a new id, copied data, and offset placement', () => {
    const result = duplicateTargetSelection({
      objects,
      groups: [],
      selection: { objectIds: ['label'] },
      createObjectId: sequence('copy-object'),
      createGroupId: sequence('copy-group'),
    });

    expect(result.selection).toEqual({ objectIds: ['copy-object-1'] });
    expect(result.objects).toHaveLength(4);
    expect(result.objects[3]).toMatchObject({
      id: 'copy-object-1',
      kind: 'text',
      placement: { offsetX: 0.25, offsetY: 0.05 },
      text: { value: 'Hello' },
    });
    expect(result.objects[3]).not.toBe(objects[1]);
    expect(result.objects[3].placement).not.toBe(objects[1].placement);
  });

  it('duplicates a multi-selection and selects every copy', () => {
    const result = duplicateTargetSelection({
      objects,
      groups: [],
      selection: { objectIds: ['chair', 'lamp'] },
      createObjectId: sequence('copy-object'),
      createGroupId: sequence('copy-group'),
    });

    expect(result.selection).toEqual({ objectIds: ['copy-object-1', 'copy-object-2'] });
    expect(result.objects.slice(-2).map((object) => object.placement.offsetX)).toEqual([0.05, 0.45]);
  });

  it('duplicates image and YouTube objects without adding model data', () => {
    const mediaObjects: TargetEditorObject[] = [
      {
        kind: 'image',
        id: 'poster',
        image: {
          url: 'https://cdn.example/poster.webp',
          label: 'Poster',
          width: 1200,
          height: 800,
          aspectRatio: 1.5,
        },
        placement: { ...placement },
        animation: DEFAULT_IMAGE_TARGET_ANIMATION,
      },
      {
        kind: 'youtube',
        id: 'video',
        youtube: {
          videoId: 'dQw4w9WgXcQ',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        },
        placement: { ...placement, offsetX: 0.4 },
        animation: DEFAULT_IMAGE_TARGET_ANIMATION,
      },
    ];

    const result = duplicateTargetSelection({
      objects: mediaObjects,
      groups: [],
      selection: { objectIds: ['poster', 'video'] },
      createObjectId: sequence('copy-object'),
      createGroupId: sequence('copy-group'),
    });

    const [imageCopy, youtubeCopy] = result.objects.slice(-2);
    expect(imageCopy).toMatchObject({ kind: 'image', image: mediaObjects[0].kind === 'image' ? mediaObjects[0].image : {} });
    expect(youtubeCopy).toMatchObject({ kind: 'youtube', youtube: mediaObjects[1].kind === 'youtube' ? mediaObjects[1].youtube : {} });
    expect('model' in imageCopy).toBe(false);
    expect('model' in youtubeCopy).toBe(false);
    expect(imageCopy.kind === 'image' && imageCopy.image).not.toBe(mediaObjects[0].kind === 'image' && mediaObjects[0].image);
    expect(youtubeCopy.kind === 'youtube' && youtubeCopy.youtube).not.toBe(mediaObjects[1].kind === 'youtube' && mediaObjects[1].youtube);
  });

  it('duplicates a group and all members while preserving local placements', () => {
    const group: TargetEditorGroup = {
      id: 'furniture',
      label: 'Furniture',
      placement: { ...placement, offsetX: 0.1 },
      animation: DEFAULT_IMAGE_TARGET_ANIMATION,
    };
    const grouped = objects.slice(0, 2).map((object) => ({
      ...object,
      groupId: group.id,
      localPlacement: { ...object.placement },
    })) as TargetEditorObject[];

    const result = duplicateTargetSelection({
      objects: [...grouped, objects[2]],
      groups: [group],
      selection: { objectIds: [], groupId: group.id },
      createObjectId: sequence('copy-object'),
      createGroupId: sequence('copy-group'),
    });

    expect(result.selection).toEqual({ objectIds: [], groupId: 'copy-group-1' });
    expect(result.groups[1]).toMatchObject({
      id: 'copy-group-1',
      label: 'Furniture copy',
    });
    expect(result.groups[1].placement.offsetX).toBeCloseTo(0.15);
    expect(result.groups[1].placement.offsetY).toBeCloseTo(0.05);
    expect(result.objects.slice(-2).map((object) => object.groupId)).toEqual([
      'copy-group-1',
      'copy-group-1',
    ]);
    expect(result.objects.slice(-2).map((object) => object.localPlacement)).toEqual(
      grouped.map((object) => object.localPlacement),
    );
  });

  it('derives object/group state keys and detects locked selections', () => {
    const objectSelection: TargetEditorSelection = { objectIds: ['chair', 'lamp'] };
    const groupSelection: TargetEditorSelection = { objectIds: [], groupId: 'furniture' };

    expect(selectionStateKeys(objectSelection, objects)).toEqual(['object:chair', 'object:lamp']);
    expect(selectionStateKeys(groupSelection, objects)).toEqual(['group:furniture']);
    expect(isSelectionLocked(objectSelection, objects, new Set(['object:lamp']))).toBe(true);
    expect(isSelectionLocked(groupSelection, objects, new Set(['group:furniture']))).toBe(true);
    expect(isSelectionLocked(objectSelection, objects, new Set())).toBe(false);
  });
});

function sequence(prefix: string): () => string {
  let value = 0;
  return () => `${prefix}-${++value}`;
}

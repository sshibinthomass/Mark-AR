import { describe, expect, it } from 'vitest';
import type { CloudImageTarget } from '../src/app/cloudImageTargets';
import { savedTargetAuthoringMismatch } from '../src/app/targetPersistence';
import type { TargetEditorGroup } from '../src/app/targetEditorGroups';
import type { TargetEditorObject } from '../src/app/targetEditorObjects';

const placement = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  height: 0.12,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
};

const groups: TargetEditorGroup[] = [{
  id: 'group-1',
  label: 'Greeting group',
  placement: { ...placement, height: 0.3, rotationY: 25 },
  animation: {
    preset: 'custom',
    tracks: [{ property: 'positionY', motion: 'smooth', amount: 0.1, speed: 0.5, phase: 0 }],
  },
}];

const objects: TargetEditorObject[] = [
  {
    kind: 'model',
    id: 'model-1',
    model: { id: 'chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
    placement,
  },
  {
    kind: 'text',
    id: 'text-1',
    text: {
      value: 'Welcome back',
      language: 'english',
      font: 'studio-sans-bold',
      color: '#123456',
      fillMode: 'gradient',
      gradientStart: '#234567',
      gradientEnd: '#345678',
      gradientDirection: 'diagonal',
      sideColor: '#456789',
      depth: 0.08,
      bevel: 0.01,
      gloss: 0.9,
      stylePreset: 'gold-bevel',
    },
    placement: { ...placement, offsetX: 0.25, height: 0.36, rotationY: 25 },
    animation: {
      preset: 'orbit',
      tracks: [
        { property: 'positionX', motion: 'smooth', amount: 0.18, speed: 0.3, phase: 0 },
        { property: 'positionZ', motion: 'smooth', amount: 0.18, speed: 0.3, phase: 90 },
      ],
    },
    groupId: 'group-1',
    localPlacement: { ...placement, offsetX: 0.25, height: 0 },
  },
];

const completeTarget: CloudImageTarget = {
  id: 'target-1',
  label: 'Complete target',
  imageUrl: 'https://worker.example/image-targets/target-1.jpg',
  imageObjectKey: 'image-targets/target-1.jpg',
  model: objects[0].kind === 'text' ? undefined : objects[0].model,
  placement,
  objects: structuredClone(objects),
  groups: structuredClone(groups),
};

describe('saved target authoring acknowledgement', () => {
  it('accepts a complete normalized object and group round trip', () => {
    const normalizedTarget = structuredClone(completeTarget);
    normalizedTarget.objects[0].animation = { preset: 'none', tracks: [] };

    expect(savedTargetAuthoringMismatch(objects, groups, normalizedTarget)).toBeUndefined();
  });

  it('identifies a text object removed by a lossy Worker response', () => {
    const target = structuredClone(completeTarget);
    target.objects = target.objects.filter((object) => object.id !== 'text-1');

    expect(savedTargetAuthoringMismatch(objects, groups, target)).toContain('text-1');
  });

  it('identifies changed animation tracks on one object', () => {
    const target = structuredClone(completeTarget);
    const text = target.objects.find((object) => object.id === 'text-1');
    if (text) {
      text.animation = {
        preset: 'orbit',
        tracks: [{ property: 'positionX', motion: 'smooth', amount: 0.5, speed: 0.3, phase: 0 }],
      };
    }

    expect(savedTargetAuthoringMismatch(objects, groups, target)).toContain('text-1');
  });

  it('identifies changed text styling and local placement', () => {
    const styledTarget = structuredClone(completeTarget);
    const styledText = styledTarget.objects.find((object) => object.kind === 'text');
    if (styledText?.kind === 'text') {
      styledText.text.gloss = 0.2;
    }
    expect(savedTargetAuthoringMismatch(objects, groups, styledTarget)).toContain('text-1');

    const movedTarget = structuredClone(completeTarget);
    const movedText = movedTarget.objects.find((object) => object.id === 'text-1');
    if (movedText?.localPlacement) {
      movedText.localPlacement.offsetX = -0.5;
    }
    expect(savedTargetAuthoringMismatch(objects, groups, movedTarget)).toContain('text-1');
  });

  it('identifies missing groups, added objects, and duplicate ids', () => {
    const targetWithoutGroup = structuredClone(completeTarget);
    targetWithoutGroup.groups = [];
    expect(savedTargetAuthoringMismatch(objects, groups, targetWithoutGroup)).toContain('group-1');

    const targetWithExtraObject = structuredClone(completeTarget);
    targetWithExtraObject.objects.push({
      kind: 'model',
      id: 'unexpected-model',
      model: { id: 'lamp', label: 'Lamp', url: 'https://worker.example/lamp.glb' },
      placement,
    });
    expect(savedTargetAuthoringMismatch(objects, groups, targetWithExtraObject)).toContain('unexpected-model');

    const targetWithDuplicate = structuredClone(completeTarget);
    targetWithDuplicate.objects.push(structuredClone(targetWithDuplicate.objects[0]));
    expect(savedTargetAuthoringMismatch(objects, groups, targetWithDuplicate)).toContain('model-1');
  });
});

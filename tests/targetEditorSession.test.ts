import { describe, expect, it } from 'vitest';
import type { CloudImageTarget } from '../src/app/cloudImageTargets';
import {
  createEditingTargetSession,
  targetPreviewImageUrl,
} from '../src/app/targetEditorSession';

const placement = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  height: 0.12,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
};

const target: CloudImageTarget = {
  id: 'target-1',
  label: 'Reusable scene',
  imageUrl: 'https://worker.example/image-targets/images/target-1.jpg',
  imageObjectKey: 'image-targets/images/target-1.jpg',
  model: { id: 'chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
  placement,
  objects: [
    {
      kind: 'model',
      id: 'model-1',
      model: { id: 'chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
      placement,
    },
    {
      kind: 'text',
      id: 'text-1',
      text: { value: 'Hello AR', language: 'english', font: 'studio-sans', color: '#123456' },
      placement: { ...placement, offsetX: 0.2 },
      animation: {
        preset: 'custom',
        tracks: [{ property: 'rotationY', motion: 'spin', amount: 360, speed: 0.25, phase: 0 }],
      },
      groupId: 'group-1',
      localPlacement: { ...placement, height: 0 },
    },
  ],
  groups: [{
    id: 'group-1',
    label: 'Group 1',
    placement,
    animation: {
      preset: 'gentle-float',
      tracks: [{ property: 'positionY', motion: 'smooth', amount: 0.1, speed: 0.5, phase: 0 }],
    },
  }],
};

describe('target editor session', () => {
  it('deep-clones complete target state before editing it', () => {
    const session = createEditingTargetSession(target);

    session.objects[1].placement.offsetX = 0.9;
    session.groups[0].animation.tracks[0].amount = 99;

    expect(target.objects[1].placement.offsetX).toBe(0.2);
    expect(target.groups[0].animation.tracks[0].amount).toBe(0.1);
    expect(session).toMatchObject({
      targetId: 'target-1',
      imageUrl: target.imageUrl,
      label: 'Reusable scene',
      selection: { objectIds: ['model-1'] },
    });
  });

  it('uses a replacement image when present and otherwise keeps the saved image URL', () => {
    const editing = { targetId: target.id, imageUrl: target.imageUrl };

    expect(targetPreviewImageUrl(editing)).toBe(target.imageUrl);
    expect(targetPreviewImageUrl(editing, {
      imageBase64: 'aW1hZ2U=',
      imageMimeType: 'image/png',
    })).toBe('data:image/png;base64,aW1hZ2U=');
    expect(targetPreviewImageUrl(undefined)).toBeUndefined();
  });
});

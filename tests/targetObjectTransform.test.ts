import { Group } from 'three';
import { describe, expect, it } from 'vitest';
import { applyTargetAnimation, applyTargetPlacement } from '../src/scene/targetObjectTransform';

describe('target object transforms', () => {
  it('applies saved placement in the preview Y-up coordinate frame', () => {
    const root = new Group();

    applyTargetPlacement(root, {
      scale: 1.5,
      offsetX: 0.2,
      offsetY: -0.3,
      height: 0.4,
      rotationX: 10,
      rotationY: 20,
      rotationZ: 30,
    });

    expect(root.position.toArray()).toEqual([0.2, 0.4, -0.3]);
    expect(root.scale.toArray()).toEqual([1.5, 1.5, 1.5]);
    expect(root.rotation.x).toBeCloseTo(Math.PI / 18);
    expect(root.rotation.y).toBeCloseTo(Math.PI / 9);
    expect(root.rotation.z).toBeCloseTo(Math.PI / 6);
  });

  it('applies animation in the same local axes as the preview', () => {
    const root = new Group();
    const placement = {
      scale: 2,
      offsetX: 0.2,
      offsetY: 0.1,
      height: 0.3,
      rotationX: 10,
      rotationY: 20,
      rotationZ: 30,
    };

    applyTargetAnimation(root, placement, {
      preset: 'custom',
      tracks: [
        { property: 'positionY', motion: 'smooth', amount: 0.4, speed: 0.5, phase: 0 },
        { property: 'rotationY', motion: 'spin', amount: 360, speed: 0.5, phase: 0 },
        { property: 'scale', motion: 'smooth', amount: 0.25, speed: 0.5, phase: 0 },
      ],
    }, 0.5);

    expect(root.position.x).toBeCloseTo(0.2);
    expect(root.position.y).toBeCloseTo(0.7);
    expect(root.position.z).toBeCloseTo(0.1);
    expect(root.rotation.x).toBeCloseTo(Math.PI / 18);
    expect(root.rotation.y).toBeCloseTo(Math.PI / 9 + Math.PI / 2);
    expect(root.rotation.z).toBeCloseTo(Math.PI / 6);
    expect(root.scale.x).toBeCloseTo(2.5);
  });
});

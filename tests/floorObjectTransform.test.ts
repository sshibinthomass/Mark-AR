import { Euler, Group, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { FloorObjectTransform } from '../src/ar/floorObjectTransform';

describe('FloorObjectTransform', () => {
  it('moves an interaction root by a world-space delta under a transformed parent', () => {
    const parent = new Group();
    parent.position.set(3, 2, -4);
    parent.rotation.copy(new Euler(0.2, Math.PI / 3, -0.15));
    parent.scale.setScalar(1.75);
    const root = new Group();
    root.position.set(0.4, -0.2, 0.8);
    parent.add(root);
    parent.updateMatrixWorld(true);
    const initialWorldPosition = root.getWorldPosition(new Vector3());
    const delta = new Vector3(0.75, 0.3, -1.1);
    const transform = new FloorObjectTransform(root);

    transform.moveByWorldDelta(delta);
    parent.updateMatrixWorld(true);

    expect(root.getWorldPosition(new Vector3()).distanceTo(
      initialWorldPosition.add(delta),
    )).toBeLessThan(1e-9);
  });

  it('clamps uniform scaling to the same safe range as the complete scene', () => {
    const root = new Group();
    const transform = new FloorObjectTransform(root);

    transform.scaleBy(100);
    expect(root.scale.toArray()).toEqual([5, 5, 5]);

    transform.scaleBy(0.001);
    expect(root.scale.toArray()).toEqual([0.1, 0.1, 0.1]);
  });
});

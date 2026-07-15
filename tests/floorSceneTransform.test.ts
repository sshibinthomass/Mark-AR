import { Euler, Group, Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { FloorSceneTransform } from '../src/ar/floorSceneTransform';

describe('FloorSceneTransform', () => {
  it('places and manipulates one complete root without touching its children', () => {
    const root = new Group();
    const child = new Group();
    child.position.set(0.4, 0.2, -0.3);
    root.add(child);
    const transform = new FloorSceneTransform(root);

    transform.placeAt(new Matrix4().makeTranslation(1, 0, -2));
    transform.rotateTo(45);
    transform.scaleBy(1.5);
    transform.moveTo(new Vector3(2, 0.5, -3));

    expect(child.position.toArray()).toEqual([0.4, 0.2, -0.3]);
    expect(root.position.toArray()).toEqual([2, 0, -3]);
    expect(root.rotation.y).toBeCloseTo(Math.PI / 4);
    expect(root.scale.toArray()).toEqual([1.5, 1.5, 1.5]);
    expect(root.matrixAutoUpdate).toBe(true);
    expect(root.visible).toBe(true);
  });

  it('keeps movement on the detected floor and treats rotation as an absolute control', () => {
    const root = new Group();
    const transform = new FloorSceneTransform(root);
    const baseQuaternion = new Quaternion().setFromEuler(new Euler(0, Math.PI / 6, 0));
    const pose = new Matrix4().compose(
      new Vector3(1, 0.25, -2),
      baseQuaternion,
      new Vector3(2, 2, 2),
    );

    transform.placeAt(pose);
    transform.moveTo(new Vector3(4, 8, -5));
    transform.rotateTo(45);
    transform.rotateTo(10);

    const expectedQuaternion = baseQuaternion.clone().multiply(
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 18),
    );
    expect(root.position.toArray()).toEqual([4, 0.25, -5]);
    expect(root.quaternion.angleTo(expectedQuaternion)).toBeCloseTo(0);
    expect(root.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('clamps uniform scaling to the safe range', () => {
    const root = new Group();
    const transform = new FloorSceneTransform(root);

    transform.placeAt(new Matrix4());
    transform.scaleBy(100);
    expect(root.scale.toArray()).toEqual([5, 5, 5]);

    transform.scaleBy(0.001);
    expect(root.scale.toArray()).toEqual([0.1, 0.1, 0.1]);
  });

  it('resets scale, rotation, and floor position at a replacement pose', () => {
    const root = new Group();
    const transform = new FloorSceneTransform(root);
    const resetQuaternion = new Quaternion().setFromEuler(new Euler(0, -Math.PI / 5, 0));
    const resetMatrix = new Matrix4().compose(
      new Vector3(-3, 0.4, 2),
      resetQuaternion,
      new Vector3(4, 4, 4),
    );

    transform.placeAt(new Matrix4().makeTranslation(1, 0, -2));
    transform.rotateTo(80);
    transform.scaleBy(2);
    transform.moveTo(new Vector3(7, 9, 8));
    transform.resetAt(resetMatrix);

    expect(root.position.toArray()).toEqual([-3, 0.4, 2]);
    expect(root.quaternion.angleTo(resetQuaternion)).toBeCloseTo(0);
    expect(root.scale.toArray()).toEqual([1, 1, 1]);
  });
});

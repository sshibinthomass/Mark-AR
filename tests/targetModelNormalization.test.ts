import { Box3, BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  createNormalizedTargetModelGroup,
  NORMALIZED_TARGET_MODEL_SIZE,
} from '../src/scene/targetModelNormalization';

describe('target model normalization', () => {
  it('normalizes every runtime to the same size, center, and floor', () => {
    const scene = new Group();
    scene.add(new Mesh(new BoxGeometry(2, 4, 1)));

    const wrapper = createNormalizedTargetModelGroup(scene, 'normalized-target-model');
    const bounds = new Box3().setFromObject(wrapper);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());

    expect(wrapper.name).toBe('normalized-target-model');
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(NORMALIZED_TARGET_MODEL_SIZE);
    expect(center.x).toBeCloseTo(0);
    expect(center.z).toBeCloseTo(0);
    expect(bounds.min.y).toBeCloseTo(0);
    expect(wrapper.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
  });
});

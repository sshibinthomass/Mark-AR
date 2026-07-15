import { Box3, Group, Vector3 } from 'three';

export const NORMALIZED_TARGET_MODEL_SIZE = 0.36;

export function createNormalizedTargetModelGroup(scene: Group, wrapperName: string): Group {
  const wrapper = new Group();
  wrapper.name = wrapperName;

  const bounds = new Box3().setFromObject(scene);
  const size = bounds.getSize(new Vector3());
  const largestDimension = Math.max(size.x, size.y, size.z);
  if (Number.isFinite(largestDimension) && largestDimension > 0) {
    scene.scale.setScalar(NORMALIZED_TARGET_MODEL_SIZE / largestDimension);
  }

  const scaledBounds = new Box3().setFromObject(scene);
  const center = scaledBounds.getCenter(new Vector3());
  scene.position.set(-center.x, -scaledBounds.min.y, -center.z);
  wrapper.add(scene);
  return wrapper;
}

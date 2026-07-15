import type { Object3D } from 'three';
import { evaluateAnimationFrame, type ImageTargetAnimation } from '../app/imageTargetAnimation';
import type { ImageTargetPlacement } from '../app/imageTargetPayload';

export function applyTargetPlacement(root: Object3D, placement: ImageTargetPlacement): void {
  root.position.set(placement.offsetX, placement.height, placement.offsetY);
  root.scale.setScalar(placement.scale);
  root.rotation.set(
    degreesToRadians(placement.rotationX),
    degreesToRadians(placement.rotationY),
    degreesToRadians(placement.rotationZ),
  );
}

export function applyTargetAnimation(
  root: Object3D,
  placement: ImageTargetPlacement,
  animation: ImageTargetAnimation,
  elapsedSeconds: number,
): void {
  const frame = evaluateAnimationFrame(animation, elapsedSeconds);
  root.position.set(
    placement.offsetX + frame.position.x,
    placement.height + frame.position.y,
    placement.offsetY + frame.position.z,
  );
  root.scale.setScalar(placement.scale * frame.scaleMultiplier);
  root.rotation.set(
    degreesToRadians(placement.rotationX) + frame.rotationRadians.x,
    degreesToRadians(placement.rotationY) + frame.rotationRadians.y,
    degreesToRadians(placement.rotationZ) + frame.rotationRadians.z,
  );
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

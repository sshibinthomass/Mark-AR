import { Vector3, type Object3D } from 'three';

export class FloorObjectTransform {
  private readonly root: Object3D;

  constructor(root: Object3D) {
    this.root = root;
  }

  moveByWorldDelta(delta: Vector3): void {
    const targetWorldPosition = this.root.getWorldPosition(new Vector3()).add(delta);
    this.root.position.copy(
      this.root.parent
        ? this.root.parent.worldToLocal(targetWorldPosition)
        : targetWorldPosition,
    );
  }

  scaleBy(multiplier: number): void {
    const scale = Math.min(5, Math.max(0.1, this.root.scale.x * multiplier));
    this.root.scale.setScalar(scale);
  }
}

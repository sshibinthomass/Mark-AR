import { MathUtils, Quaternion, type Group, type Matrix4, type Vector3 } from 'three';

export class FloorSceneTransform {
  private readonly root: Group;
  private readonly baseQuaternion = new Quaternion();
  private floorY: number | null = null;

  constructor(root: Group) {
    this.root = root;
  }

  placeAt(matrix: Matrix4): void {
    matrix.decompose(this.root.position, this.root.quaternion, this.root.scale);
    this.baseQuaternion.copy(this.root.quaternion);
    this.floorY = this.root.position.y;
    this.root.scale.setScalar(1);
    this.root.matrixAutoUpdate = true;
    this.root.visible = true;
  }

  moveTo(point: Vector3): void {
    if (this.floorY === null) {
      return;
    }

    this.root.position.set(point.x, this.floorY, point.z);
  }

  rotateTo(degrees: number): void {
    this.root.quaternion.copy(this.baseQuaternion);
    this.root.rotateY(MathUtils.degToRad(degrees));
  }

  scaleBy(multiplier: number): void {
    const scale = Math.min(5, Math.max(0.1, this.root.scale.x * multiplier));
    this.root.scale.setScalar(scale);
  }

  resetAt(matrix: Matrix4): void {
    this.placeAt(matrix);
  }
}

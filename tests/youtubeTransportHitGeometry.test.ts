import {
  Object3D,
  PerspectiveCamera,
} from 'three';
import { describe, expect, it } from 'vitest';
import {
  createTransportProjectionSnapshot,
  pointInProjectedQuad,
  projectTransportRegion,
  selectProjectedTransportRegion,
} from '../src/ar/youtubeTransportHitGeometry';

describe('YouTube transport projected hit geometry', () => {
  it('rejects the blank AABB corner of a rotated perspective control plane', () => {
    const camera = new PerspectiveCamera(60, 4 / 3, 0.1, 100);
    const snapshot = createTransportProjectionSnapshot(camera, {
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    });
    const object = new Object3D();
    object.position.set(0, 0, -3);
    object.rotation.set(-0.35, 0.9, 0.45);
    object.updateMatrixWorld(true);

    const region = projectTransportRegion({
      key: 'rotated',
      matrixWorld: object.matrixWorld,
      snapshot,
      layout: {
        widthPx: 240,
        heightPx: 60,
        buttons: [],
      },
      paintOrder: 1,
      cssPixelsPerWorldUnit: 270,
    });

    expect(region).toBeDefined();
    expect(region?.frameQuad.map(({ x, y }) => [
      Number(x.toFixed(2)),
      Number(y.toFixed(2)),
    ])).toEqual([
      [345.08, 293.53],
      [433.83, 271.99],
      [443.09, 305.08],
      [356.96, 335.63],
    ]);
    const blankAabbCorner = { x: 346.08, y: 272.99 };
    expect(blankAabbCorner.x).toBeGreaterThan(345.08);
    expect(blankAabbCorner.y).toBeGreaterThan(271.99);
    expect(pointInProjectedQuad(blankAabbCorner, region!.frameQuad)).toBe(false);
    expect(selectProjectedTransportRegion(
      blankAabbCorner,
      [region!],
      snapshot,
    )).toBeUndefined();
  });

  it('ranks current ray depth before coplanar paint order', () => {
    const camera = new PerspectiveCamera(60, 4 / 3, 0.1, 100);
    const snapshot = createTransportProjectionSnapshot(camera, {
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    });
    const nearObject = new Object3D();
    nearObject.position.z = -2;
    nearObject.updateMatrixWorld(true);
    const farObject = new Object3D();
    farObject.position.z = -4;
    farObject.scale.setScalar(2);
    farObject.updateMatrixWorld(true);
    const layout = {
      widthPx: 240,
      heightPx: 60,
      buttons: [],
    };
    const near = projectTransportRegion({
      key: 'near',
      matrixWorld: nearObject.matrixWorld,
      snapshot,
      layout,
      paintOrder: 1,
      cssPixelsPerWorldUnit: 270,
    })!;
    const farButLaterPainted = projectTransportRegion({
      key: 'far',
      matrixWorld: farObject.matrixWorld,
      snapshot,
      layout,
      paintOrder: 2,
      cssPixelsPerWorldUnit: 270,
    })!;

    expect(selectProjectedTransportRegion(
      { x: 400, y: 300 },
      [near, farButLaterPainted],
      snapshot,
    )?.key).toBe('near');

    const coplanarLaterPainted = projectTransportRegion({
      key: 'coplanar-later',
      matrixWorld: nearObject.matrixWorld,
      snapshot,
      layout,
      paintOrder: 3,
      cssPixelsPerWorldUnit: 270,
    })!;
    expect(selectProjectedTransportRegion(
      { x: 400, y: 300 },
      [near, coplanarLaterPainted],
      snapshot,
    )?.key).toBe('coplanar-later');
  });
});

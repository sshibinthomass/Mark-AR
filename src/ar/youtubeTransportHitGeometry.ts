import {
  Matrix4,
  Plane,
  Ray,
  Vector3,
  Vector4,
  type Camera,
} from 'three';

export type ClientPoint = {
  x: number;
  y: number;
};

export type ClientViewport = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ProjectedQuad = readonly [
  ClientPoint,
  ClientPoint,
  ClientPoint,
  ClientPoint,
];

export type TransportLayout<TButton> = {
  widthPx: number;
  heightPx: number;
  buttons: readonly {
    button: TButton;
    leftPx: number;
    topPx: number;
    widthPx: number;
    heightPx: number;
  }[];
};

export type TransportProjectionSnapshot = {
  viewport: ClientViewport;
  projectionViewMatrix: Matrix4;
  inverseProjectionViewMatrix: Matrix4;
};

export type ProjectedTransportRegion<TKey, TButton = never> = {
  key: TKey;
  frameQuad: ProjectedQuad;
  worldPlane: Plane;
  paintOrder: number;
  buttons: readonly {
    button: TButton;
    quad: ProjectedQuad;
  }[];
};

type ProjectedBox = {
  clientQuad: ProjectedQuad;
  worldQuad: readonly [Vector3, Vector3, Vector3, Vector3];
};

const MIN_HOMOGENEOUS_W = 1e-8;
const QUAD_EDGE_EPSILON = 1e-6;
const DEPTH_TIE_EPSILON = 1e-5;

export function createTransportProjectionSnapshot(
  camera: Camera,
  viewport: ClientViewport,
): TransportProjectionSnapshot {
  camera.updateWorldMatrix(true, false);
  const viewMatrix = camera.matrixWorld.clone().invert();
  const projectionViewMatrix = new Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    viewMatrix,
  );
  return {
    viewport: { ...viewport },
    projectionViewMatrix,
    inverseProjectionViewMatrix: projectionViewMatrix.clone().invert(),
  };
}

export function projectTransportRegion<TKey, TButton = never>(
  input: {
    key: TKey;
    matrixWorld: Matrix4;
    snapshot: TransportProjectionSnapshot;
    layout: TransportLayout<TButton>;
    paintOrder: number;
    cssPixelsPerWorldUnit: number;
  },
): ProjectedTransportRegion<TKey, TButton> | undefined {
  const {
    key,
    matrixWorld,
    snapshot,
    layout,
    paintOrder,
    cssPixelsPerWorldUnit,
  } = input;
  if (
    !validPositive(layout.widthPx)
    || !validPositive(layout.heightPx)
    || !validPositive(cssPixelsPerWorldUnit)
    || !validPositive(snapshot.viewport.width)
    || !validPositive(snapshot.viewport.height)
  ) {
    return undefined;
  }
  const frame = projectLayoutBox(
    {
      leftPx: 0,
      topPx: 0,
      widthPx: layout.widthPx,
      heightPx: layout.heightPx,
    },
    layout,
    cssPixelsPerWorldUnit,
    matrixWorld,
    snapshot,
  );
  if (!frame || quadArea(frame.clientQuad) <= QUAD_EDGE_EPSILON) {
    return undefined;
  }
  const worldPlane = new Plane().setFromCoplanarPoints(
    frame.worldQuad[0],
    frame.worldQuad[1],
    frame.worldQuad[3],
  );
  if (!finiteVector(worldPlane.normal) || worldPlane.normal.lengthSq() === 0) {
    return undefined;
  }

  const buttons: Array<{ button: TButton; quad: ProjectedQuad }> = [];
  for (const button of layout.buttons) {
    if (!validPositive(button.widthPx) || !validPositive(button.heightPx)) {
      continue;
    }
    const projected = projectLayoutBox(
      button,
      layout,
      cssPixelsPerWorldUnit,
      matrixWorld,
      snapshot,
    );
    if (projected && quadArea(projected.clientQuad) > QUAD_EDGE_EPSILON) {
      buttons.push({
        button: button.button,
        quad: projected.clientQuad,
      });
    }
  }

  return {
    key,
    frameQuad: frame.clientQuad,
    worldPlane,
    paintOrder,
    buttons,
  };
}

export function pointInProjectedQuad(
  point: ClientPoint,
  quad: ProjectedQuad,
): boolean {
  let windingSign = 0;
  for (let index = 0; index < quad.length; index += 1) {
    const start = quad[index];
    const end = quad[(index + 1) % quad.length];
    const cross = (
      (end.x - start.x) * (point.y - start.y)
      - (end.y - start.y) * (point.x - start.x)
    );
    if (Math.abs(cross) <= QUAD_EDGE_EPSILON) {
      continue;
    }
    const edgeSign = Math.sign(cross);
    if (windingSign !== 0 && windingSign !== edgeSign) {
      return false;
    }
    windingSign = edgeSign;
  }
  return quadArea(quad) > QUAD_EDGE_EPSILON;
}

export function selectProjectedTransportRegion<TKey, TButton>(
  point: ClientPoint,
  regions: readonly ProjectedTransportRegion<TKey, TButton>[],
  snapshot: TransportProjectionSnapshot,
): ProjectedTransportRegion<TKey, TButton> | undefined {
  const ray = clientPointRay(point, snapshot);
  if (!ray) {
    return undefined;
  }
  let selected:
    | {
        region: ProjectedTransportRegion<TKey, TButton>;
        distance: number;
      }
    | undefined;
  const intersection = new Vector3();
  for (const region of regions) {
    if (!pointInProjectedQuad(point, region.frameQuad)) {
      continue;
    }
    const hit = ray.intersectPlane(region.worldPlane, intersection);
    if (!hit) {
      continue;
    }
    const distance = ray.origin.distanceTo(hit);
    if (!Number.isFinite(distance) || distance < 0) {
      continue;
    }
    if (
      !selected
      || depthPrecedes(
        distance,
        region.paintOrder,
        selected.distance,
        selected.region.paintOrder,
      )
    ) {
      selected = { region, distance };
    }
  }
  return selected?.region;
}

function projectLayoutBox<TButton>(
  box: {
    leftPx: number;
    topPx: number;
    widthPx: number;
    heightPx: number;
  },
  layout: TransportLayout<TButton>,
  cssPixelsPerWorldUnit: number,
  matrixWorld: Matrix4,
  snapshot: TransportProjectionSnapshot,
): ProjectedBox | undefined {
  // Invariant: DOM layout pixels describe the visible controls plane before
  // CSS3D projection. Divide by the reciprocal 270px frame scale and invert
  // CSS's downward Y axis; matrixWorld and the camera then produce the same
  // projected quadrilateral the renderer paints, without using its AABB.
  const left = (box.leftPx - layout.widthPx / 2) / cssPixelsPerWorldUnit;
  const right = (
    box.leftPx + box.widthPx - layout.widthPx / 2
  ) / cssPixelsPerWorldUnit;
  const top = (layout.heightPx / 2 - box.topPx) / cssPixelsPerWorldUnit;
  const bottom = (
    layout.heightPx / 2 - box.topPx - box.heightPx
  ) / cssPixelsPerWorldUnit;
  const localCorners = [
    new Vector3(left, top, 0),
    new Vector3(right, top, 0),
    new Vector3(right, bottom, 0),
    new Vector3(left, bottom, 0),
  ] as const;
  const worldQuad = localCorners.map((corner) => (
    corner.clone().applyMatrix4(matrixWorld)
  )) as [Vector3, Vector3, Vector3, Vector3];
  const clientPoints: ClientPoint[] = [];
  for (const worldPoint of worldQuad) {
    const clipPoint = new Vector4(
      worldPoint.x,
      worldPoint.y,
      worldPoint.z,
      1,
    ).applyMatrix4(snapshot.projectionViewMatrix);
    if (
      !Number.isFinite(clipPoint.w)
      || clipPoint.w <= MIN_HOMOGENEOUS_W
    ) {
      return undefined;
    }
    const ndcX = clipPoint.x / clipPoint.w;
    const ndcY = clipPoint.y / clipPoint.w;
    const clientPoint = {
      x: snapshot.viewport.left
        + (ndcX + 1) * snapshot.viewport.width / 2,
      y: snapshot.viewport.top
        + (1 - ndcY) * snapshot.viewport.height / 2,
    };
    if (!Number.isFinite(clientPoint.x) || !Number.isFinite(clientPoint.y)) {
      return undefined;
    }
    clientPoints.push(clientPoint);
  }
  return {
    clientQuad: clientPoints as [
      ClientPoint,
      ClientPoint,
      ClientPoint,
      ClientPoint,
    ],
    worldQuad,
  };
}

function clientPointRay(
  point: ClientPoint,
  snapshot: TransportProjectionSnapshot,
): Ray | undefined {
  const { viewport } = snapshot;
  if (!validPositive(viewport.width) || !validPositive(viewport.height)) {
    return undefined;
  }
  const ndcX = ((point.x - viewport.left) / viewport.width) * 2 - 1;
  const ndcY = -((point.y - viewport.top) / viewport.height) * 2 + 1;
  const near = new Vector3(ndcX, ndcY, -1).applyMatrix4(
    snapshot.inverseProjectionViewMatrix,
  );
  const far = new Vector3(ndcX, ndcY, 1).applyMatrix4(
    snapshot.inverseProjectionViewMatrix,
  );
  const direction = far.clone().sub(near);
  if (
    !finiteVector(near)
    || !finiteVector(far)
    || direction.lengthSq() <= Number.EPSILON
  ) {
    return undefined;
  }
  return new Ray(near, direction.normalize());
}

function depthPrecedes(
  candidateDistance: number,
  candidatePaintOrder: number,
  selectedDistance: number,
  selectedPaintOrder: number,
): boolean {
  const tolerance = DEPTH_TIE_EPSILON * Math.max(
    1,
    candidateDistance,
    selectedDistance,
  );
  if (Math.abs(candidateDistance - selectedDistance) <= tolerance) {
    return candidatePaintOrder > selectedPaintOrder;
  }
  return candidateDistance < selectedDistance;
}

function quadArea(quad: ProjectedQuad): number {
  let doubledArea = 0;
  for (let index = 0; index < quad.length; index += 1) {
    const current = quad[index];
    const next = quad[(index + 1) % quad.length];
    doubledArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(doubledArea) / 2;
}

function finiteVector(vector: Vector3): boolean {
  return Number.isFinite(vector.x)
    && Number.isFinite(vector.y)
    && Number.isFinite(vector.z);
}

function validPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

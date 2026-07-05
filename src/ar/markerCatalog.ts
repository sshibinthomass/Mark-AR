export type MarkerObjectKind = 'crystalTower' | 'orbitBeacon';

export type MarkerObjectSpec = {
  kind: MarkerObjectKind;
  color: number;
  accentColor: number;
};

export type MarkerSpec = {
  id: string;
  label: string;
  targetIndex: number;
  imagePath: string;
  object: MarkerObjectSpec;
};

export const AR_MARKERS: MarkerSpec[] = [
  {
    id: 'aurora-gate',
    label: 'Aurora Gate',
    targetIndex: 0,
    imagePath: '/markers/aurora-gate.svg',
    object: {
      kind: 'crystalTower',
      color: 0x16d9e3,
      accentColor: 0xf6d365,
    },
  },
  {
    id: 'orbit-key',
    label: 'Orbit Key',
    targetIndex: 1,
    imagePath: '/markers/orbit-key.svg',
    object: {
      kind: 'orbitBeacon',
      color: 0xff4f8b,
      accentColor: 0x78ffb6,
    },
  },
];

export function getMarkerImagePaths(): string[] {
  return AR_MARKERS.map((marker) => marker.imagePath);
}

export function getMarkerByTargetIndex(targetIndex: number): MarkerSpec | undefined {
  return AR_MARKERS.find((marker) => marker.targetIndex === targetIndex);
}

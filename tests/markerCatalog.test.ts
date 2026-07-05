import { describe, expect, it } from 'vitest';
import {
  AR_MARKERS,
  getMarkerByTargetIndex,
  getMarkerImagePaths,
} from '../src/ar/markerCatalog';

describe('AR marker catalog', () => {
  it('defines exactly two generated marker images', () => {
    expect(AR_MARKERS).toHaveLength(2);
    expect(getMarkerImagePaths()).toEqual([
      '/markers/aurora-gate.svg',
      '/markers/orbit-key.svg',
    ]);
  });

  it('maps each marker to a unique MindAR target index and object type', () => {
    expect(AR_MARKERS.map((marker) => marker.targetIndex)).toEqual([0, 1]);
    expect(new Set(AR_MARKERS.map((marker) => marker.object.kind)).size).toBe(2);
  });

  it('returns marker metadata by target index', () => {
    expect(getMarkerByTargetIndex(0)?.label).toBe('Aurora Gate');
    expect(getMarkerByTargetIndex(1)?.label).toBe('Orbit Key');
    expect(getMarkerByTargetIndex(9)).toBeUndefined();
  });
});

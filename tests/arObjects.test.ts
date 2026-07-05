import { describe, expect, it } from 'vitest';
import { Group } from 'three';
import { AR_MARKERS } from '../src/ar/markerCatalog';
import { createMarkerObject } from '../src/ar/arObjects';

describe('marker AR objects', () => {
  it('creates a named group for each marker object kind', () => {
    const groups = AR_MARKERS.map((marker) => createMarkerObject(marker.object).group);

    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group instanceof Group)).toBe(true);
    expect(groups.map((group) => group.name)).toEqual([
      'crystal-tower-object',
      'orbit-beacon-object',
    ]);
    expect(new Set(groups.map((group) => group.children.length)).size).toBe(2);
  });

  it('animates each object without replacing its group', () => {
    const object = createMarkerObject(AR_MARKERS[1].object);
    const group = object.group;
    const initialY = group.rotation.y;

    object.update(0.5);

    expect(object.group).toBe(group);
    expect(group.rotation.y).toBeGreaterThan(initialY);
  });
});

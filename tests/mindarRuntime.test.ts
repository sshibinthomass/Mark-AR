import { describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { AR_MARKERS } from '../src/ar/markerCatalog';
import { setupMarkerAnchors } from '../src/ar/mindarRuntime';

describe('setupMarkerAnchors', () => {
  it('attaches one AR object to each MindAR target anchor', () => {
    const anchors: Array<{
      group: Group;
      onTargetFound?: () => void;
      onTargetLost?: () => void;
      targetIndex: number;
    }> = [];
    const scene = { add: vi.fn() };
    const states: string[] = [];
    const mindarThree = {
      addAnchor: (targetIndex: number) => {
        const anchor = { group: new Group(), targetIndex };
        anchors.push(anchor);
        return anchor;
      },
      scene,
    };

    const objects = setupMarkerAnchors(mindarThree, AR_MARKERS, (event) => {
      states.push(`${event.marker.label}:${event.visible}`);
    });

    expect(objects).toHaveLength(2);
    expect(anchors.map((anchor) => anchor.targetIndex)).toEqual([0, 1]);
    expect(anchors.map((anchor) => anchor.group.children[0].name)).toEqual([
      'crystal-tower-object',
      'orbit-beacon-object',
    ]);
    expect(scene.add).toHaveBeenCalledTimes(2);

    anchors[0].onTargetFound?.();
    anchors[1].onTargetLost?.();

    expect(states).toEqual(['Aurora Gate:true', 'Orbit Key:false']);
  });

  it('uses per-target Cloudflare assets when runtime targets include saved models', () => {
    const anchors: Array<{
      group: Group;
      onTargetFound?: () => void;
      onTargetLost?: () => void;
      targetIndex: number;
    }> = [];
    const scene = { add: vi.fn() };
    const mindarThree = {
      addAnchor: (targetIndex: number) => {
        const anchor = { group: new Group(), targetIndex };
        anchors.push(anchor);
        return anchor;
      },
      scene,
    };

    const objects = setupMarkerAnchors(mindarThree, [
      { marker: AR_MARKERS[0] },
      {
        marker: { ...AR_MARKERS[1], label: 'Cloud target' },
        cloudflareAsset: {
          model: { id: 'generated-chair', label: 'Chair', url: 'https://worker.example/chair.glb' },
          placement: { scale: 1.5, offsetX: 0.1, offsetY: 0.2, height: 0.2 },
        },
      },
    ]);

    expect(objects).toHaveLength(2);
    expect(anchors.map((anchor) => anchor.group.children[0].name)).toEqual([
      'crystal-tower-object',
      'cloudflare-model-object',
    ]);
  });
});

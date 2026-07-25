import { Color, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { applyLockedObjectTint } from '../src/scene/lockedObjectTint';

describe('applyLockedObjectTint', () => {
  it('clones, fades, and blends color-bearing mesh materials', () => {
    const original = new MeshStandardMaterial({ color: '#ffffff', opacity: 1 });
    const mesh = new Mesh(new PlaneGeometry(1, 1), original);
    const root = new Group();
    root.add(mesh);

    applyLockedObjectTint(root);

    const tinted = mesh.material as MeshStandardMaterial;
    expect(tinted).not.toBe(original);
    expect(original.opacity).toBe(1);
    expect(tinted.transparent).toBe(true);
    expect(tinted.opacity).toBe(0.62);
    expect(tinted.color.getHex()).toBe(
      new Color('#ffffff').lerp(new Color('#2457a7'), 0.55).getHex(),
    );
  });

  it('tints every entry in a material array and preserves lower original opacity', () => {
    const first = new MeshStandardMaterial({ color: '#ff0000', opacity: 0.4 });
    const second = new MeshStandardMaterial({ color: '#00ff00', opacity: 1 });
    const mesh = new Mesh(new PlaneGeometry(1, 1), [first, second]);

    applyLockedObjectTint(mesh);

    const tinted = mesh.material as MeshStandardMaterial[];
    expect(tinted[0]).not.toBe(first);
    expect(tinted[1]).not.toBe(second);
    expect(tinted[0].opacity).toBe(0.4);
    expect(tinted[1].opacity).toBe(0.62);
  });
});

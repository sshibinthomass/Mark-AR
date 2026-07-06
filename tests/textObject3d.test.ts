import { Mesh, MeshStandardMaterial, type Group } from 'three';
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js';
import testFontJson from 'three/examples/fonts/helvetiker_regular.typeface.json?raw';
import { describe, expect, it } from 'vitest';
import { TEXT_FONT_OPTIONS, type TargetTextContent } from '../src/app/targetEditorObjects';
import { createTextObject3D } from '../src/scene/textObject3d';

const testFont = new FontLoader().parse(JSON.parse(testFontJson)) as Font;

describe('createTextObject3D', () => {
  it('builds extruded letter geometry for every configured font instead of a text box', async () => {
    for (const fontOption of TEXT_FONT_OPTIONS) {
      const text: TargetTextContent = {
        value: 'Hello AR',
        language: 'english',
        font: fontOption.id,
        color: '#ef4444',
      };
      const group = createTextObject3D(text, { loadFont: async () => testFont });

      await settleTextBuild();

      const geometryTypes = collectMeshes(group).map((mesh) => mesh.geometry.type);
      expect(geometryTypes).toContain('TextGeometry');
      expect(geometryTypes).not.toContain('BoxGeometry');

      const mesh = collectMeshes(group).find((candidate) => candidate.geometry.type === 'TextGeometry');
      const materials = Array.isArray(mesh?.material) ? mesh.material : [mesh?.material];
      expect((materials[0] as MeshStandardMaterial).color.getHexString()).toBe('ef4444');
    }
  });

  it('applies gradient fill, side color, depth, bevel, and gloss to 3D text geometry', async () => {
    const group = createTextObject3D(
      {
        value: 'Gradient',
        language: 'english',
        font: 'studio-serif-bold',
        color: '#2563eb',
        fillMode: 'gradient',
        gradientStart: '#ef4444',
        gradientEnd: '#facc15',
        gradientDirection: 'horizontal',
        sideColor: '#111827',
        depth: 0.11,
        bevel: 0.012,
        gloss: 0.95,
        stylePreset: 'gold-bevel',
      },
      { loadFont: async () => testFont },
    );

    await settleTextBuild();

    const mesh = collectMeshes(group).find((candidate) => candidate.geometry.type === 'TextGeometry');
    expect(mesh).toBeTruthy();

    const materials = Array.isArray(mesh?.material) ? mesh.material : [mesh?.material];
    const frontMaterial = materials[0] as MeshStandardMaterial;
    const sideMaterial = materials[1] as MeshStandardMaterial;
    const geometryOptions = (mesh?.geometry as unknown as {
      parameters: { options: { depth?: number; bevelEnabled?: boolean; bevelSize?: number } };
    }).parameters.options;

    expect(mesh?.geometry.getAttribute('color')).toBeTruthy();
    expect(frontMaterial.vertexColors).toBe(true);
    expect(frontMaterial.roughness).toBeLessThan(0.2);
    expect(sideMaterial.color.getHexString()).toBe('111827');
    expect(geometryOptions.depth).toBeCloseTo(0.11);
    expect(geometryOptions.bevelEnabled).toBe(true);
    expect(geometryOptions.bevelSize).toBeCloseTo(0.012);
  });
});

async function settleTextBuild(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function collectMeshes(group: Group): Mesh[] {
  const meshes: Mesh[] = [];
  group.traverse((object) => {
    if ((object as Mesh).isMesh) {
      meshes.push(object as Mesh);
    }
  });
  return meshes;
}

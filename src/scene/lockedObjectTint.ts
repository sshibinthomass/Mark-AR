import { Color, Material, Mesh, Object3D } from 'three';

const lockColor = new Color('#2457a7');
const lockColorBlend = 0.55;
const lockOpacity = 0.62;

type ColorMaterial = Material & { color: Color };

export function applyLockedObjectTint(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneTintedMaterial)
      : cloneTintedMaterial(object.material);
  });
}

function cloneTintedMaterial(material: Material): Material {
  const tinted = material.clone();
  tinted.transparent = true;
  tinted.opacity = Math.min(material.opacity, lockOpacity);
  if (hasColor(tinted)) {
    tinted.color.lerp(lockColor, lockColorBlend);
  }
  tinted.needsUpdate = true;
  return tinted;
}

function hasColor(material: Material): material is ColorMaterial {
  return 'color' in material && material.color instanceof Color;
}

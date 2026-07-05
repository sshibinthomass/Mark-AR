import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { MarkerObjectSpec } from './markerCatalog';

export type MarkerObject = {
  group: Group;
  update: (deltaSeconds: number) => void;
};

export function createMarkerObject(spec: MarkerObjectSpec): MarkerObject {
  if (spec.kind === 'crystalTower') {
    return createCrystalTower(spec);
  }

  return createOrbitBeacon(spec);
}

function createCrystalTower(spec: MarkerObjectSpec): MarkerObject {
  const group = new Group();
  group.name = 'crystal-tower-object';

  const baseMaterial = new MeshStandardMaterial({
    color: spec.accentColor,
    metalness: 0.15,
    roughness: 0.32,
  });
  const crystalMaterial = new MeshStandardMaterial({
    color: spec.color,
    emissive: spec.color,
    emissiveIntensity: 0.25,
    metalness: 0.05,
    roughness: 0.18,
  });

  const plinth = new Mesh(new CylinderGeometry(0.42, 0.5, 0.12, 6), baseMaterial);
  plinth.name = 'tower-plinth';
  plinth.rotation.x = Math.PI / 2;
  plinth.position.z = 0.06;

  const shaft = new Mesh(new BoxGeometry(0.32, 0.32, 0.62), crystalMaterial);
  shaft.name = 'tower-crystal';
  shaft.position.z = 0.42;
  shaft.rotation.z = Math.PI / 4;

  const cap = new Mesh(new ConeGeometry(0.28, 0.34, 4), crystalMaterial);
  cap.name = 'tower-cap';
  cap.position.z = 0.9;
  cap.rotation.x = Math.PI / 2;
  cap.rotation.z = Math.PI / 4;

  group.add(plinth, shaft, cap);

  return {
    group,
    update: (deltaSeconds: number) => {
      shaft.rotation.z += deltaSeconds * 0.45;
      cap.rotation.z -= deltaSeconds * 0.35;
    },
  };
}

function createOrbitBeacon(spec: MarkerObjectSpec): MarkerObject {
  const group = new Group();
  group.name = 'orbit-beacon-object';

  const coreMaterial = new MeshStandardMaterial({
    color: spec.color,
    emissive: spec.color,
    emissiveIntensity: 0.2,
    roughness: 0.2,
  });
  const ringMaterial = new MeshStandardMaterial({
    color: spec.accentColor,
    metalness: 0.2,
    roughness: 0.28,
  });

  const core = new Mesh(new SphereGeometry(0.24, 32, 24), coreMaterial);
  core.name = 'beacon-core';
  core.position.z = 0.28;

  const ringA = new Mesh(new TorusGeometry(0.42, 0.025, 12, 72), ringMaterial);
  ringA.name = 'beacon-ring-a';
  ringA.position.z = 0.28;

  const ringB = new Mesh(new TorusGeometry(0.32, 0.02, 12, 72), ringMaterial);
  ringB.name = 'beacon-ring-b';
  ringB.position.z = 0.28;
  ringB.rotation.x = Math.PI / 2.8;
  ringB.rotation.y = Math.PI / 5;

  const satellite = new Mesh(new SphereGeometry(0.07, 16, 12), ringMaterial);
  satellite.name = 'beacon-satellite';
  satellite.position.set(0.42, 0, 0.28);

  group.add(core, ringA, ringB, satellite);

  return {
    group,
    update: (deltaSeconds: number) => {
      group.rotation.y += deltaSeconds * 0.7;
      ringA.rotation.z += deltaSeconds * 0.9;
      ringB.rotation.x += deltaSeconds * 0.55;
    },
  };
}

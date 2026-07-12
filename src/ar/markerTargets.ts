import type { CloudImageTarget } from '../app/cloudImageTargets';
import type { LocalImageTargetDraft } from '../app/targetEditorObjects';
import { AR_MARKERS, type MarkerSpec } from './markerCatalog';
import type { CloudflarePlacedAsset } from './cloudflareMarkerObject';

export type RuntimeMarkerTarget = {
  marker: MarkerSpec;
  cloudflareAsset?: CloudflarePlacedAsset;
};

type CreateRuntimeMarkerTargetsInput = {
  builtInMarkers?: MarkerSpec[];
  cloudTargets?: CloudImageTarget[];
  draftTarget?: LocalImageTargetDraft;
};

export function createRuntimeMarkerTargets({
  builtInMarkers = AR_MARKERS,
  cloudTargets = [],
  draftTarget,
}: CreateRuntimeMarkerTargetsInput = {}): RuntimeMarkerTarget[] {
  const builtInTargets = builtInMarkers.map((marker, index) => ({
    marker: { ...marker, targetIndex: index },
  }));

  const cloudRuntimeTargets = cloudTargets.map((target, index) => ({
    marker: {
      id: `cloud-${target.id}`,
      label: target.label,
      targetIndex: builtInTargets.length + index,
      imagePath: target.imageUrl,
      object: { kind: 'orbitBeacon' as const, color: 0x78ffb6, accentColor: 0xff4f8b },
    },
    cloudflareAsset: {
      model: target.model,
      placement: target.placement,
      objects: target.objects,
    },
  }));

  const draftRuntimeTargets = draftTarget
    ? [{
        marker: {
          id: `draft-${draftTarget.id}`,
          label: draftTarget.label,
          targetIndex: builtInTargets.length + cloudRuntimeTargets.length,
          imagePath: draftTarget.imageUrl,
          object: { kind: 'orbitBeacon' as const, color: 0x78ffb6, accentColor: 0xff4f8b },
        },
        cloudflareAsset: {
          objects: draftTarget.objects,
        },
      }]
    : [];

  return [...builtInTargets, ...cloudRuntimeTargets, ...draftRuntimeTargets];
}

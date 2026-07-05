import type { CloudImageTarget } from '../app/cloudImageTargets';
import type {
  CloudflareModelOption,
  ProcessedBaseImage,
} from '../app/cloudflareModels';
import { AR_MARKERS, type MarkerSpec } from './markerCatalog';
import type { CloudflarePlacedAsset } from './cloudflareMarkerObject';

export type RuntimeMarkerTarget = {
  marker: MarkerSpec;
  cloudflareAsset?: CloudflarePlacedAsset;
};

type CreateRuntimeMarkerTargetsInput = {
  builtInMarkers?: MarkerSpec[];
  cloudTargets?: CloudImageTarget[];
  selectedModel?: CloudflareModelOption;
  processedBaseImage?: ProcessedBaseImage;
};

export function createRuntimeMarkerTargets({
  builtInMarkers = AR_MARKERS,
  cloudTargets = [],
  selectedModel,
  processedBaseImage,
}: CreateRuntimeMarkerTargetsInput = {}): RuntimeMarkerTarget[] {
  const builtInTargets = builtInMarkers.map((marker, index) => ({
    marker: { ...marker, targetIndex: index },
    ...(selectedModel
      ? {
          cloudflareAsset: {
            model: selectedModel,
            ...(processedBaseImage ? { baseImage: processedBaseImage } : {}),
          },
        }
      : {}),
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
    },
  }));

  return [...builtInTargets, ...cloudRuntimeTargets];
}

import type { MarkerSpec } from './markerCatalog';

export type MindARCompiler = {
  compileImageTargets: (
    images: HTMLImageElement[],
    onProgress: (percent: number) => void,
  ) => Promise<unknown>;
  exportData: () => ArrayBuffer;
};

export type MindARCompilerConstructor = new () => MindARCompiler;

export type CompiledMarkerTargets = {
  imageTargetSrc: string;
  targetCount: number;
  dispose: () => void;
};

export type CompileMarkerTargetOptions = {
  Compiler: MindARCompilerConstructor;
  createObjectUrl?: (blob: Blob) => string;
  loadImage?: (path: string) => Promise<HTMLImageElement>;
  onProgress?: (percent: number) => void;
  revokeObjectUrl?: (url: string) => void;
};

export async function compileMarkerTargets(
  markers: MarkerSpec[],
  options: CompileMarkerTargetOptions,
): Promise<CompiledMarkerTargets> {
  const loadImage = options.loadImage ?? loadMarkerImage;
  const createObjectUrl = options.createObjectUrl ?? URL.createObjectURL.bind(URL);
  const revokeObjectUrl = options.revokeObjectUrl ?? URL.revokeObjectURL.bind(URL);
  const compiler = new options.Compiler();
  const images = await Promise.all(markers.map((marker) => loadImage(marker.imagePath)));

  await compiler.compileImageTargets(images, (percent) => {
    options.onProgress?.(percent);
  });

  const blob = new Blob([compiler.exportData()], { type: 'application/octet-stream' });
  const imageTargetSrc = createObjectUrl(blob);

  return {
    imageTargetSrc,
    targetCount: images.length,
    dispose: () => revokeObjectUrl(imageTargetSrc),
  };
}

export function loadMarkerImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load marker image: ${path}`));
    image.src = path;
  });
}

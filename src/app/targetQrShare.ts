import type { TargetQrArtifact } from './targetQrCode';

export type TargetQrShareResult =
  | 'shared'
  | 'downloaded-and-copied'
  | 'downloaded-copy-failed'
  | 'cancelled'
  | 'failed';

export type TargetQrShareInput = {
  artifact: TargetQrArtifact;
  targetLabel: string;
  scanUrl: string;
  download: (artifact: TargetQrArtifact) => void;
  copy: (scanUrl: string) => Promise<void>;
};

type TargetQrShareDependencies = {
  share: ((data: ShareData) => Promise<void>) | null;
  canShare: ((data: ShareData) => boolean) | null;
  createFile: (blob: Blob, filename: string) => File;
};

export async function shareTargetQrArtifact(
  input: TargetQrShareInput,
  dependencyOverrides: Partial<TargetQrShareDependencies> = {},
): Promise<TargetQrShareResult> {
  const dependencies = {
    ...browserShareDependencies(),
    ...dependencyOverrides,
  };

  let file: File;
  try {
    file = dependencies.createFile(input.artifact.blob, input.artifact.filename);
  } catch {
    return runFallback(input);
  }

  let canShareFile = false;
  try {
    canShareFile = Boolean(
      dependencies.share
      && dependencies.canShare?.({ files: [file] }),
    );
  } catch {
    return runFallback(input);
  }

  if (!canShareFile || !dependencies.share) {
    return runFallback(input);
  }

  try {
    await dependencies.share({
      title: `AnchorAR — ${input.targetLabel}`,
      text: `Scan this QR code to open the AR experience: ${input.scanUrl}`,
      url: input.scanUrl,
      files: [file],
    });
    return 'shared';
  } catch (error) {
    return isAbortError(error) ? 'cancelled' : 'failed';
  }
}

function browserShareDependencies(): TargetQrShareDependencies {
  const browserNavigator = typeof navigator === 'undefined' ? undefined : navigator;
  return {
    share: typeof browserNavigator?.share === 'function'
      ? browserNavigator.share.bind(browserNavigator)
      : null,
    canShare: typeof browserNavigator?.canShare === 'function'
      ? browserNavigator.canShare.bind(browserNavigator)
      : null,
    createFile: (blob, filename) => new File(
      [blob],
      filename,
      { type: blob.type || 'image/png' },
    ),
  };
}

async function runFallback(input: TargetQrShareInput): Promise<TargetQrShareResult> {
  try {
    input.download(input.artifact);
  } catch {
    return 'failed';
  }

  try {
    await input.copy(input.scanUrl);
    return 'downloaded-and-copied';
  } catch {
    return 'downloaded-copy-failed';
  }
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && (error as { name: unknown }).name === 'AbortError';
}

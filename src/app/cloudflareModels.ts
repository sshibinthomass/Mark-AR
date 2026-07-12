export type ModelVisibility = 'public' | 'private';

export type CloudflareModelOption = {
  id: string;
  label: string;
  url: string;
  previewUrl?: string;
  visibility?: ModelVisibility;
  ownerEmail?: string;
  bytes?: number;
  createdAt?: string;
  updatedAt?: string;
};

type LoadCloudflareModelsInput = {
  apiUrl?: string;
  authToken?: string | null;
  fetchImpl?: typeof fetch;
};

type WorkerGeneratedModelEntry = {
  id?: string;
  label?: string;
  model_url?: string;
  preview_url?: string;
  owner_email?: string;
  visibility?: ModelVisibility;
  bytes?: number;
  completed_at?: string;
  updated_at?: string;
};

type WorkerGeneratedModelsResponse = {
  models?: WorkerGeneratedModelEntry[];
  error?: string;
};

export const DEFAULT_GENERATE_MODEL_API_URL =
  'https://web-ar-generate-model.sshibinthomass.workers.dev/generate-3d';

const CLOUDFLARE_ASSET_ORIGIN = 'https://web-ar-model-assets.pages.dev';

export const STATIC_CLOUDFLARE_MODELS: CloudflareModelOption[] = [
  {
    id: 'trellis-fast-output',
    label: 'Fast output',
    url: `${CLOUDFLARE_ASSET_ORIGIN}/models/trellis-2-4b-fast-output.glb`,
  },
  {
    id: 'img4-output',
    label: 'Image 4 output',
    url: `${CLOUDFLARE_ASSET_ORIGIN}/models/img4_20260628_153027.glb`,
  },
  {
    id: 'img-fast-output',
    label: 'Image fast output',
    url: `${CLOUDFLARE_ASSET_ORIGIN}/models/img_fast_20260628_124313.glb`,
  },
];

export async function loadCloudflareModelOptions({
  apiUrl = DEFAULT_GENERATE_MODEL_API_URL,
  authToken,
  fetchImpl = fetch,
}: LoadCloudflareModelsInput = {}): Promise<CloudflareModelOption[]> {
  const workerModels = await listGeneratedModels({ apiUrl, authToken, fetchImpl });
  return dedupeModelsByUrl([...STATIC_CLOUDFLARE_MODELS, ...workerModels]);
}

async function listGeneratedModels({
  apiUrl,
  authToken,
  fetchImpl,
}: Required<Pick<LoadCloudflareModelsInput, 'apiUrl' | 'fetchImpl'>> &
  Pick<LoadCloudflareModelsInput, 'authToken'>): Promise<CloudflareModelOption[]> {
  const response = authToken
    ? await fetchImpl(`${apiUrl.replace(/\/+$/, '')}/models`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
    : await fetchImpl(`${apiUrl.replace(/\/+$/, '')}/models`);
  const body = (await response.json()) as WorkerGeneratedModelsResponse;

  if (!response.ok) {
    throw new Error(body.error ?? `Model list failed with HTTP ${response.status}.`);
  }

  return (body.models ?? [])
    .filter((model) => Boolean(model.id && model.label && model.model_url))
    .map((model) => ({
      id: `generated-${model.id}`,
      label: model.label as string,
      url: model.model_url as string,
      ...(model.preview_url ? { previewUrl: model.preview_url } : {}),
      ...(model.visibility ? { visibility: model.visibility } : {}),
      ...(model.owner_email ? { ownerEmail: model.owner_email } : {}),
      ...(typeof model.bytes === 'number' ? { bytes: model.bytes } : {}),
      ...(model.completed_at ? { createdAt: model.completed_at } : {}),
      ...(model.updated_at ? { updatedAt: model.updated_at } : {}),
    }));
}

function dedupeModelsByUrl(models: CloudflareModelOption[]): CloudflareModelOption[] {
  const seenUrls = new Set<string>();
  return models.filter((model) => {
    if (seenUrls.has(model.url)) {
      return false;
    }
    seenUrls.add(model.url);
    return true;
  });
}

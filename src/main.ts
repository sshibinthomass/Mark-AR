import './style.css';
import { AR_MARKERS } from './ar/markerCatalog';
import { startMarkerAR, type MarkerARSession } from './ar/mindarRuntime';
import { createRuntimeMarkerTargets } from './ar/markerTargets';
import {
  DEFAULT_GENERATE_MODEL_API_URL,
  extractProcessedBaseImage,
  loadCloudflareModelOptions,
  processedImageDataUrl,
  type CloudflareModelOption,
  type ProcessedBaseImage,
} from './app/cloudflareModels';
import {
  createImageTarget,
  deleteImageTarget,
  listImageTargets,
  type CloudImageTarget,
} from './app/cloudImageTargets';
import {
  DEFAULT_IMAGE_TARGET_PLACEMENT,
  imageTargetDataUrl,
  normalizePlacement,
  validateTargetImagePayload,
  type ImageTargetImagePayload,
  type ImageTargetPlacement,
} from './app/imageTargetPayload';
import {
  clearWorkerAuthToken,
  getCurrentWebArUser,
  loadWorkerAuthToken,
  loginToWebArWorker,
  saveWorkerAuthToken,
} from './app/webArAuth';
import {
  captureVideoFrame,
  imageFileToCapturedImage,
  startCameraPreview,
  stopCameraPreview,
  type CapturedImage,
} from './capture/cameraCapture';
import { ImageTargetPreview } from './scene/ImageTargetPreview';
import { renderAppShell } from './ui/appShell';
import { routeFromHash } from './ui/pageRoutes';
import { activateRoute } from './ui/pageRouter';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found');
}

app.innerHTML = renderAppShell(AR_MARKERS);

const shell = queryRequired<HTMLElement>('[data-app-shell]');
const stage = queryRequired<HTMLDivElement>('#ar-stage');
const startButton = queryRequired<HTMLButtonElement>('#start-ar');
const status = queryRequired<HTMLParagraphElement>('#ar-status');
const workerLoginForm = queryRequired<HTMLFormElement>('#worker-login-form');
const workerEmailInput = queryRequired<HTMLInputElement>('#worker-email');
const workerPasswordInput = queryRequired<HTMLInputElement>('#worker-password');
const workerLogoutButton = queryRequired<HTMLButtonElement>('#worker-logout');
const workerStatus = queryRequired<HTMLParagraphElement>('#worker-status');
const captureVideo = queryRequired<HTMLVideoElement>('#base-capture-video');
const startBaseCameraButton = queryRequired<HTMLButtonElement>('#start-base-camera');
const processBaseButton = queryRequired<HTMLButtonElement>('#process-base-image');
const baseImageFileInput = queryRequired<HTMLInputElement>('#base-image-file');
const baseImageStatus = queryRequired<HTMLParagraphElement>('#base-image-status');
const processedBasePreview = queryRequired<HTMLImageElement>('#processed-base-preview');
const modelSelect = queryRequired<HTMLSelectElement>('#cloudflare-model-select');
const reloadModelsButton = queryRequired<HTMLButtonElement>('#reload-cloudflare-models');
const modelStatus = queryRequired<HTMLParagraphElement>('#cloudflare-model-status');
const targetImageFile = document.querySelector<HTMLInputElement>('#target-image-file');
const targetLabelInput = document.querySelector<HTMLInputElement>('#target-label');
const targetModelSelect = document.querySelector<HTMLSelectElement>('#target-model-select');
const targetPreviewStage = document.querySelector<HTMLElement>('#target-preview-stage');
const targetScaleInput = document.querySelector<HTMLInputElement>('#target-scale');
const targetOffsetXInput = document.querySelector<HTMLInputElement>('#target-offset-x');
const targetOffsetYInput = document.querySelector<HTMLInputElement>('#target-offset-y');
const targetHeightInput = document.querySelector<HTMLInputElement>('#target-height');
const saveImageTargetButton = document.querySelector<HTMLButtonElement>('#save-image-target');
const refreshImageTargetsButton = document.querySelector<HTMLButtonElement>('#refresh-image-targets');
const imageTargetStatus = document.querySelector<HTMLElement>('#image-target-status');
const savedImageTargetList = document.querySelector<HTMLElement>('#saved-image-target-list');
let session: MarkerARSession | undefined;
let captureStream: MediaStream | null = null;
let authToken = loadWorkerAuthToken();
let processedBaseImage: ProcessedBaseImage | undefined;
let cloudflareModels: CloudflareModelOption[] = [];
let cloudImageTargets: CloudImageTarget[] = [];
let targetImagePayload: ImageTargetImagePayload | undefined;
let targetPlacement: ImageTargetPlacement = DEFAULT_IMAGE_TARGET_PLACEMENT;
let imageTargetPreview: ImageTargetPreview | undefined;

activateRoute(shell, routeFromHash(window.location.hash));
void initializeCloudflareControls();

window.addEventListener('hashchange', () => {
  activateRoute(shell, routeFromHash(window.location.hash));
});

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  status.textContent = 'Preparing marker targets';
  session?.stop();
  stage.replaceChildren();
  stopCameraPreview(captureStream);
  captureStream = null;

  try {
    const selectedModel = getSelectedModel();
    const runtimeTargets = createRuntimeMarkerTargets({
      cloudTargets: cloudImageTargets,
      selectedModel,
      processedBaseImage,
    });
    session = await startMarkerAR(stage, {
      targets: runtimeTargets,
      onCompileProgress: (percent) => {
        status.textContent = `Compiling targets ${Math.round(percent)}%`;
      },
      onMarkerVisibility: ({ marker, visible }) => {
        status.textContent = visible ? `${marker.label} active` : `${marker.label} lost`;
      },
      onReady: () => {
        status.textContent = 'Camera active. Scan a built-in marker or saved cloud image target.';
      },
    });
    startButton.textContent = 'Restart AR';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start AR';
    status.textContent = message;
  } finally {
    startButton.disabled = false;
  }
});

workerLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  workerStatus.textContent = 'Signing in';

  try {
    const sessionResult = await loginToWebArWorker({
      apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
      email: workerEmailInput.value,
      password: workerPasswordInput.value,
    });
    if (!sessionResult.token) {
      throw new Error('Worker did not return a session token.');
    }

    authToken = sessionResult.token;
    saveWorkerAuthToken(sessionResult.token);
    workerPasswordInput.value = '';
    workerStatus.textContent = `Signed in as ${sessionResult.user.email}`;
    await refreshCloudflareModels();
    await refreshImageTargets();
  } catch (error) {
    workerStatus.textContent = errorMessage(error, 'Unable to sign in');
  }
});

workerLogoutButton.addEventListener('click', async () => {
  authToken = null;
  clearWorkerAuthToken();
  workerStatus.textContent = 'Signed out. Public models only';
  await refreshCloudflareModels();
  await refreshImageTargets();
});

startBaseCameraButton.addEventListener('click', async () => {
  startBaseCameraButton.disabled = true;
  baseImageStatus.textContent = 'Starting camera';

  try {
    stopCameraPreview(captureStream);
    captureStream = await startCameraPreview(captureVideo);
    baseImageStatus.textContent = 'Camera ready';
  } catch (error) {
    baseImageStatus.textContent = errorMessage(error, 'Unable to start camera');
  } finally {
    startBaseCameraButton.disabled = false;
  }
});

processBaseButton.addEventListener('click', async () => {
  processBaseButton.disabled = true;
  baseImageStatus.textContent = 'Processing with OpenAI';

  try {
    const capturedImage = await captureVideoFrame(captureVideo);
    await processCapturedBaseImage(capturedImage);
  } catch (error) {
    baseImageStatus.textContent = errorMessage(error, 'Unable to process base image');
  } finally {
    processBaseButton.disabled = false;
  }
});

baseImageFileInput.addEventListener('change', async () => {
  const file = baseImageFileInput.files?.[0];
  if (!file) {
    return;
  }

  processBaseButton.disabled = true;
  baseImageStatus.textContent = 'Processing selected image';
  try {
    const capturedImage = await imageFileToCapturedImage(file);
    await processCapturedBaseImage(capturedImage);
  } catch (error) {
    baseImageStatus.textContent = errorMessage(error, 'Unable to process selected image');
  } finally {
    processBaseButton.disabled = false;
  }
});

reloadModelsButton.addEventListener('click', () => {
  void refreshCloudflareModelsAndTargets();
});

modelSelect.addEventListener('change', () => {
  const selectedModel = getSelectedModel();
  modelStatus.textContent = selectedModel
    ? `${selectedModel.label} selected`
    : 'No model selected';
});

targetImageFile?.addEventListener('change', async () => {
  const file = targetImageFile.files?.[0];
  if (!file) {
    return;
  }

  targetImagePayload = await imageFileToCapturedImage(file);
  if (targetLabelInput && !targetLabelInput.value) {
    targetLabelInput.value = file.name.replace(/\.[^.]+$/, '');
  }
  await updateTargetPreview();
});

[targetScaleInput, targetOffsetXInput, targetOffsetYInput, targetHeightInput].forEach((input) => {
  input?.addEventListener('input', () => {
    targetPlacement = readTargetPlacement();
    void updateTargetPreview();
  });
});

targetModelSelect?.addEventListener('change', () => {
  void updateTargetPreview();
});

saveImageTargetButton?.addEventListener('click', async () => {
  await saveCurrentImageTarget();
});

refreshImageTargetsButton?.addEventListener('click', async () => {
  await refreshImageTargets();
});

async function initializeCloudflareControls(): Promise<void> {
  if (authToken) {
    workerStatus.textContent = 'Checking saved Worker session';
    try {
      const user = await getCurrentWebArUser({
        apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
        token: authToken,
      });
      workerStatus.textContent = user ? `Signed in as ${user.email}` : 'Saved session expired';
      if (!user) {
        authToken = null;
        clearWorkerAuthToken();
      }
    } catch (error) {
      workerStatus.textContent = errorMessage(error, 'Could not verify saved session');
    }
  }

  await refreshCloudflareModelsAndTargets();
}

async function refreshCloudflareModelsAndTargets(): Promise<void> {
  await refreshCloudflareModels();
  await refreshImageTargets();
}

async function refreshCloudflareModels(): Promise<void> {
  reloadModelsButton.disabled = true;
  modelStatus.textContent = 'Loading Cloudflare models';

  try {
    cloudflareModels = await loadCloudflareModelOptions({
      apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
      authToken,
    });
    renderModelOptions(cloudflareModels);
    renderTargetModelOptions(cloudflareModels);
    modelStatus.textContent = `${cloudflareModels.length} Cloudflare models available`;
    if (!authToken) {
      workerStatus.textContent = 'Public models ready';
    }
  } catch (error) {
    modelSelect.innerHTML = '<option value="">Unable to load models</option>';
    if (targetModelSelect) {
      targetModelSelect.innerHTML = '<option value="">Unable to load models</option>';
    }
    modelStatus.textContent = errorMessage(error, 'Unable to load models');
  } finally {
    reloadModelsButton.disabled = false;
  }
}

async function processCapturedBaseImage(image: CapturedImage): Promise<void> {
  const selectedModel = getSelectedModel();
  processedBaseImage = await extractProcessedBaseImage({
    apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
    imageBase64: image.imageBase64,
    imageMimeType: image.imageMimeType,
    targetObject: selectedModel?.label,
    authToken,
  });
  processedBasePreview.src = processedImageDataUrl(processedBaseImage);
  processedBasePreview.hidden = false;
  baseImageStatus.textContent = 'Processed base ready';
}

function renderModelOptions(models: CloudflareModelOption[]): void {
  const selectedValue = modelSelect.value;
  modelSelect.replaceChildren();

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = 'Use marker object';
  modelSelect.append(emptyOption);

  for (const model of models) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.visibility === 'private'
      ? `${model.label} (private)`
      : model.label;
    modelSelect.append(option);
  }

  modelSelect.value = models.some((model) => model.id === selectedValue) ? selectedValue : '';
}

function getSelectedModel(): CloudflareModelOption | undefined {
  return cloudflareModels.find((model) => model.id === modelSelect.value);
}

function renderTargetModelOptions(models: CloudflareModelOption[]): void {
  if (!targetModelSelect) {
    return;
  }

  const selectedValue = targetModelSelect.value;
  targetModelSelect.innerHTML = '';

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = models.length ? 'Choose a Cloudflare model' : 'No models loaded';
  targetModelSelect.append(emptyOption);

  for (const model of models) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.label;
    targetModelSelect.append(option);
  }

  targetModelSelect.value = models.some((model) => model.id === selectedValue) ? selectedValue : '';
}

function ensureImageTargetPreview(): ImageTargetPreview | undefined {
  if (!targetPreviewStage) {
    return undefined;
  }
  imageTargetPreview ??= new ImageTargetPreview(targetPreviewStage);
  return imageTargetPreview;
}

function readTargetPlacement(): ImageTargetPlacement {
  return normalizePlacement({
    scale: Number(targetScaleInput?.value),
    offsetX: Number(targetOffsetXInput?.value),
    offsetY: Number(targetOffsetYInput?.value),
    height: Number(targetHeightInput?.value),
  });
}

function getSelectedTargetModel(): CloudflareModelOption | undefined {
  const selectedId = targetModelSelect?.value;
  return cloudflareModels.find((model) => model.id === selectedId);
}

async function updateTargetPreview(): Promise<void> {
  const preview = ensureImageTargetPreview();
  if (!preview) {
    return;
  }
  await preview.update({
    imageUrl: targetImagePayload ? imageTargetDataUrl(targetImagePayload) : undefined,
    model: getSelectedTargetModel(),
    placement: targetPlacement,
  });
}

async function saveCurrentImageTarget(): Promise<void> {
  if (!authToken) {
    updateImageTargetStatus('Sign in before saving an image target.', true);
    return;
  }
  if (!targetImagePayload) {
    updateImageTargetStatus('Choose a target image.', true);
    return;
  }

  const validationError = validateTargetImagePayload(targetImagePayload);
  if (validationError) {
    updateImageTargetStatus(validationError, true);
    return;
  }

  const model = getSelectedTargetModel();
  if (!model) {
    updateImageTargetStatus('Choose a Cloudflare model.', true);
    return;
  }

  targetPlacement = readTargetPlacement();
  updateImageTargetStatus('Saving image target...', false);

  try {
    await createImageTarget({
      apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
      authToken,
      label: targetLabelInput?.value.trim() || 'Image target',
      imageBase64: targetImagePayload.imageBase64,
      imageMimeType: targetImagePayload.imageMimeType,
      model,
      placement: targetPlacement,
    });
    await refreshImageTargets({ rethrowOnError: true });
    updateImageTargetStatus('Image target saved to Cloudflare.', false);
  } catch (error) {
    updateImageTargetStatus(errorMessage(error, 'Unable to save image target'), true);
  }
}

async function refreshImageTargets(options?: { rethrowOnError?: boolean }): Promise<void> {
  try {
    cloudImageTargets = await listImageTargets({
      apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
      authToken,
    });
    renderSavedImageTargets();
    updateImageTargetStatus(
      cloudImageTargets.length > 0
        ? `${cloudImageTargets.length} cloud image target${cloudImageTargets.length === 1 ? '' : 's'} loaded.`
        : 'No cloud image targets saved yet.',
      false,
    );
  } catch (error) {
    cloudImageTargets = [];
    renderSavedImageTargets();
    updateImageTargetStatus(errorMessage(error, 'Unable to load image targets'), true);
    if (options?.rethrowOnError) {
      throw error;
    }
  }
}

function renderSavedImageTargets(): void {
  if (!savedImageTargetList) {
    return;
  }

  savedImageTargetList.innerHTML = '';
  if (cloudImageTargets.length === 0) {
    savedImageTargetList.textContent = 'No cloud image targets saved yet.';
    return;
  }

  for (const target of cloudImageTargets) {
    const row = document.createElement('article');
    row.className = 'saved-target-row';

    const previewImage = document.createElement('img');
    previewImage.src = target.imageUrl;
    previewImage.alt = target.label;

    const meta = document.createElement('div');
    const label = document.createElement('strong');
    label.textContent = target.label;
    const modelName = document.createElement('span');
    modelName.textContent = target.model.label;
    meta.append(label, modelName);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.dataset.deleteTarget = target.id;
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', async () => {
      await deleteImageTarget({
        apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
        authToken,
        targetId: target.id,
      });
      await refreshImageTargets();
    });

    row.append(previewImage, meta, deleteButton);
    savedImageTargetList.append(row);
  }
}

function updateImageTargetStatus(message: string, isError: boolean): void {
  if (!imageTargetStatus) {
    return;
  }
  imageTargetStatus.textContent = message;
  imageTargetStatus.classList.toggle('is-error', isError);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function queryRequired<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required control not found: ${selector}`);
  }
  return element;
}

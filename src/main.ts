import './style.css';
import { AR_MARKERS } from './ar/markerCatalog';
import { startMarkerAR, type MarkerARSession } from './ar/mindarRuntime';
import {
  DEFAULT_GENERATE_MODEL_API_URL,
  extractProcessedBaseImage,
  loadCloudflareModelOptions,
  processedImageDataUrl,
  type CloudflareModelOption,
  type ProcessedBaseImage,
} from './app/cloudflareModels';
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
let session: MarkerARSession | undefined;
let captureStream: MediaStream | null = null;
let authToken = loadWorkerAuthToken();
let processedBaseImage: ProcessedBaseImage | undefined;
let cloudflareModels: CloudflareModelOption[] = [];

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
    session = await startMarkerAR(stage, {
      cloudflareAsset: selectedModel
        ? {
            model: selectedModel,
            ...(processedBaseImage ? { baseImage: processedBaseImage } : {}),
          }
        : undefined,
      onCompileProgress: (percent) => {
        status.textContent = `Preparing marker targets ${Math.round(percent)}%`;
      },
      onMarkerVisibility: ({ marker, visible }) => {
        status.textContent = visible ? `${marker.label} active` : 'Scan marker';
      },
      onReady: () => {
        status.textContent = 'Scan marker';
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
  } catch (error) {
    workerStatus.textContent = errorMessage(error, 'Unable to sign in');
  }
});

workerLogoutButton.addEventListener('click', () => {
  authToken = null;
  clearWorkerAuthToken();
  workerStatus.textContent = 'Signed out. Public models only';
  void refreshCloudflareModels();
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
  void refreshCloudflareModels();
});

modelSelect.addEventListener('change', () => {
  const selectedModel = getSelectedModel();
  modelStatus.textContent = selectedModel
    ? `${selectedModel.label} selected`
    : 'No model selected';
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

  await refreshCloudflareModels();
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
    modelStatus.textContent = `${cloudflareModels.length} Cloudflare models available`;
    if (!authToken) {
      workerStatus.textContent = 'Public models ready';
    }
  } catch (error) {
    modelSelect.innerHTML = '<option value="">Unable to load models</option>';
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
}

function getSelectedModel(): CloudflareModelOption | undefined {
  return cloudflareModels.find((model) => model.id === modelSelect.value);
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

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
  type CloudImageTargetObject,
} from './app/cloudImageTargets';
import {
  DEFAULT_IMAGE_TARGET_ANIMATION,
  normalizeAnimation,
  type ImageTargetAnimation,
  type ImageTargetSpinAxis,
} from './app/imageTargetAnimation';
import {
  DEFAULT_IMAGE_TARGET_PLACEMENT,
  imageTargetDataUrl,
  normalizePlacement,
  resetPlacementTransform,
  validateTargetImagePayload,
  type ImageTargetImagePayload,
  type ImageTargetPlacement,
  type PlacementTransformReset,
  type PlacementTransformResetAxis,
} from './app/imageTargetPayload';
import {
  clearWorkerAuthToken,
  getCurrentWebArUser,
  loadWorkerAuthToken,
  loginToWebArWorker,
  saveWorkerAuthToken,
} from './app/webArAuth';
import {
  createLocalTextObject,
  fontOption,
  isTargetTextFont,
  isTargetTextLanguage,
  isTextTargetObject,
  languageOption,
  saveableModelObjects,
  type LocalImageTargetDraft,
  type TargetEditorObject,
  type TargetTextFont,
  type TargetTextLanguage,
} from './app/targetEditorObjects';
import {
  captureVideoFrame,
  imageFileToCapturedImage,
  startCameraPreview,
  stopCameraPreview,
  type CapturedImage,
} from './capture/cameraCapture';
import {
  DEFAULT_PREVIEW_CAMERA_VIEW,
  type PreviewCameraView,
  cameraViewForDrag,
  cameraViewForPreset,
  isCameraPreset,
} from './scene/previewCamera';
import { ImageTargetPreview } from './scene/ImageTargetPreview';
import type { PreviewTransformMode } from './scene/ImageTargetPreview';
import { renderAppShell } from './ui/appShell';
import { renderTargetModelRail } from './ui/modelRail';
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
const targetModelRail = document.querySelector<HTMLElement>('#target-model-rail');
const addTargetObjectButton = document.querySelector<HTMLButtonElement>('#add-target-object');
const removeTargetObjectButton = document.querySelector<HTMLButtonElement>('#remove-target-object');
const targetObjectList = document.querySelector<HTMLElement>('#target-object-list');
const targetTextValueInput = document.querySelector<HTMLTextAreaElement>('#target-text-value');
const targetTextLanguageSelect = document.querySelector<HTMLSelectElement>('#target-text-language');
const targetTextFontSelect = document.querySelector<HTMLSelectElement>('#target-text-font');
const addTargetTextButton = document.querySelector<HTMLButtonElement>('#add-target-text');
const targetScaleInput = document.querySelector<HTMLInputElement>('#target-scale');
const targetOffsetXInput = document.querySelector<HTMLInputElement>('#target-offset-x');
const targetOffsetYInput = document.querySelector<HTMLInputElement>('#target-offset-y');
const targetHeightInput = document.querySelector<HTMLInputElement>('#target-height');
const targetRotationXInput = document.querySelector<HTMLInputElement>('#target-rotation-x');
const targetRotationYInput = document.querySelector<HTMLInputElement>('#target-rotation-y');
const targetRotationZInput = document.querySelector<HTMLInputElement>('#target-rotation-z');
const targetPlacementResetButtons = document.querySelectorAll<HTMLButtonElement>('[data-reset-transform]');
const targetTransformModeButtons = document.querySelectorAll<HTMLButtonElement>('[data-transform-mode]');
const targetCameraDistanceInput = document.querySelector<HTMLInputElement>('#target-camera-distance');
const targetCameraHeightInput = document.querySelector<HTMLInputElement>('#target-camera-height');
const targetCameraYawInput = document.querySelector<HTMLInputElement>('#target-camera-yaw');
const targetCameraTargetInput = document.querySelector<HTMLInputElement>('#target-camera-target');
const targetCameraGizmo = document.querySelector<HTMLElement>('#target-camera-gizmo');
const targetSpinAxisSelect = document.querySelector<HTMLSelectElement>('#target-spin-axis');
const targetSpinSpeedInput = document.querySelector<HTMLInputElement>('#target-spin-speed');
const targetBobHeightInput = document.querySelector<HTMLInputElement>('#target-bob-height');
const targetBobSpeedInput = document.querySelector<HTMLInputElement>('#target-bob-speed');
const resetTargetAnimationButton = document.querySelector<HTMLButtonElement>('#reset-target-animation');
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
let targetAnimation: ImageTargetAnimation = DEFAULT_IMAGE_TARGET_ANIMATION;
let targetCameraView: PreviewCameraView = DEFAULT_PREVIEW_CAMERA_VIEW;
let targetTransformMode: PreviewTransformMode = 'translate';
let targetObjects: TargetEditorObject[] = [];
let selectedTargetObjectId: string | undefined;
let imageTargetPreview: ImageTargetPreview | undefined;
let targetCameraGizmoDrag:
  | {
      pointerId: number;
      startX: number;
      startY: number;
      startView: PreviewCameraView;
      didMove: boolean;
    }
  | undefined;
let suppressedCameraGizmoClick: { x: number; y: number } | undefined;

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
      draftTarget: createCurrentDraftTarget(),
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

[targetScaleInput, targetOffsetXInput, targetOffsetYInput, targetHeightInput, targetRotationXInput, targetRotationYInput, targetRotationZInput].forEach((input) => {
  input?.addEventListener('input', () => {
    updateSelectedTargetObjectPlacement(readTargetPlacement());
    void updateTargetPreview();
  });
});

targetPlacementResetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (!isPlacementTransformReset(button.dataset.resetTransform) || !isPlacementTransformResetAxis(button.dataset.resetAxis)) {
      return;
    }

    const nextPlacement = resetPlacementTransform(readTargetPlacement(), button.dataset.resetTransform, button.dataset.resetAxis);
    updateSelectedTargetObjectPlacement(nextPlacement);
    syncTargetPlacementInputs(nextPlacement);
    void updateTargetPreview();
  });
});

targetTransformModeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (!isPreviewTransformMode(button.dataset.transformMode)) {
      return;
    }
    targetTransformMode = button.dataset.transformMode;
    syncTargetTransformModeButtons(targetTransformMode);
    imageTargetPreview?.setTransformMode(targetTransformMode);
  });
});

[targetCameraDistanceInput, targetCameraHeightInput, targetCameraYawInput, targetCameraTargetInput].forEach((input) => {
  input?.addEventListener('input', () => {
    targetCameraView = readTargetCameraView();
    void updateTargetPreview();
  });
});

targetCameraGizmo?.addEventListener('click', (event) => {
  if (suppressedCameraGizmoClick) {
    const distanceFromDragEnd = Math.hypot(
      event.clientX - suppressedCameraGizmoClick.x,
      event.clientY - suppressedCameraGizmoClick.y,
    );
    suppressedCameraGizmoClick = undefined;
    if (distanceFromDragEnd < 6) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }

  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-camera-preset]');
  if (!button || !isCameraPreset(button.dataset.cameraPreset)) {
    return;
  }

  targetCameraView = cameraViewForPreset(button.dataset.cameraPreset);
  syncTargetCameraInputs(targetCameraView);
  void updateTargetPreview();
});

targetCameraGizmo?.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 && event.pointerType !== 'touch') {
    return;
  }

  targetCameraGizmoDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startView: targetCameraView,
    didMove: false,
  };
  targetCameraGizmo.classList.add('is-dragging');
  window.addEventListener('pointermove', handleTargetCameraGizmoPointerMove);
  window.addEventListener('pointerup', handleTargetCameraGizmoPointerEnd);
  window.addEventListener('pointercancel', handleTargetCameraGizmoPointerEnd);
});

function handleTargetCameraGizmoPointerMove(event: PointerEvent): void {
  if (!targetCameraGizmoDrag || targetCameraGizmoDrag.pointerId !== event.pointerId) {
    return;
  }

  const deltaX = event.clientX - targetCameraGizmoDrag.startX;
  const deltaY = event.clientY - targetCameraGizmoDrag.startY;
  if (!targetCameraGizmoDrag.didMove && Math.hypot(deltaX, deltaY) < 3) {
    return;
  }

  targetCameraGizmoDrag.didMove = true;
  targetCameraView = cameraViewForDrag(targetCameraGizmoDrag.startView, { deltaX, deltaY });
  syncTargetCameraInputs(targetCameraView);
  void updateTargetPreview();
  event.preventDefault();
}

[targetSpinSpeedInput, targetBobHeightInput, targetBobSpeedInput].forEach((input) => {
  input?.addEventListener('input', () => {
    updateSelectedTargetObjectAnimation(readTargetAnimation());
    void updateTargetPreview();
  });
});

targetSpinAxisSelect?.addEventListener('change', () => {
  updateSelectedTargetObjectAnimation(readTargetAnimation());
  void updateTargetPreview();
});

resetTargetAnimationButton?.addEventListener('click', () => {
  updateSelectedTargetObjectAnimation(DEFAULT_IMAGE_TARGET_ANIMATION);
  syncTargetAnimationInputs(DEFAULT_IMAGE_TARGET_ANIMATION);
  void updateTargetPreview();
});

targetModelSelect?.addEventListener('change', () => {
  handleTargetModelSelectionChange();
});

addTargetObjectButton?.addEventListener('click', () => {
  addTargetObjectFromSelection();
});

removeTargetObjectButton?.addEventListener('click', () => {
  removeSelectedTargetObject();
});

targetTextLanguageSelect?.addEventListener('change', () => {
  const language = readTargetTextLanguage();
  if (targetTextValueInput) {
    targetTextValueInput.value = languageOption(language).sample;
  }
  if (targetTextFontSelect && language === 'tamil') {
    targetTextFontSelect.value = 'tamil-ui';
  }
});

addTargetTextButton?.addEventListener('click', () => {
  addTargetTextFromInput();
});

saveImageTargetButton?.addEventListener('click', async () => {
  await saveCurrentImageTarget();
});

refreshImageTargetsButton?.addEventListener('click', async () => {
  await refreshImageTargets();
});

renderTargetObjectList();
syncTargetCameraInputs(targetCameraView);
syncTargetTransformModeButtons(targetTransformMode);
syncTargetAnimationInputs(targetAnimation);

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
    renderTargetModelRailOptions([]);
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
  renderTargetModelRailOptions(models);
  renderTargetObjectList();
}

function ensureImageTargetPreview(): ImageTargetPreview | undefined {
  if (!targetPreviewStage) {
    return undefined;
  }
  imageTargetPreview ??= new ImageTargetPreview(targetPreviewStage, {
    onPlacementChange: ({ objectId, placement }) => {
      const object = targetObjects.find((entry) => entry.id === objectId);
      if (object) {
        object.placement = placement;
      }
      targetPlacement = placement;
      if (!selectedTargetObjectId || selectedTargetObjectId === objectId) {
        selectedTargetObjectId = objectId;
        syncTargetPlacementInputs(placement);
      }
      renderTargetObjectList();
    },
    onCameraChange: (cameraView) => {
      targetCameraView = cameraView;
      syncTargetCameraInputs(cameraView);
    },
    onSelectionChange: (objectId) => {
      selectTargetObject(objectId, { refreshPreview: false });
    },
    onTransformModeChange: (mode) => {
      targetTransformMode = mode;
      syncTargetTransformModeButtons(mode);
    },
  });
  return imageTargetPreview;
}

function readTargetPlacement(): ImageTargetPlacement {
  return normalizePlacement({
    scale: Number(targetScaleInput?.value),
    offsetX: Number(targetOffsetXInput?.value),
    offsetY: Number(targetOffsetYInput?.value),
    height: Number(targetHeightInput?.value),
    rotationX: Number(targetRotationXInput?.value),
    rotationY: Number(targetRotationYInput?.value),
    rotationZ: Number(targetRotationZInput?.value),
  });
}

function readTargetCameraView(): PreviewCameraView {
  return {
    distance: Number(targetCameraDistanceInput?.value) || DEFAULT_PREVIEW_CAMERA_VIEW.distance,
    height: Number(targetCameraHeightInput?.value) || DEFAULT_PREVIEW_CAMERA_VIEW.height,
    yawDegrees: Number(targetCameraYawInput?.value) || DEFAULT_PREVIEW_CAMERA_VIEW.yawDegrees,
    targetX: targetCameraView.targetX,
    targetHeight: Number(targetCameraTargetInput?.value) || DEFAULT_PREVIEW_CAMERA_VIEW.targetHeight,
    targetZ: targetCameraView.targetZ,
  };
}

function readTargetAnimation(): ImageTargetAnimation {
  return normalizeAnimation({
    spinAxis: targetSpinAxisSelect?.value as ImageTargetSpinAxis | undefined,
    spinSpeed: Number(targetSpinSpeedInput?.value),
    bobHeight: Number(targetBobHeightInput?.value),
    bobSpeed: Number(targetBobSpeedInput?.value),
  });
}

function renderTargetModelRailOptions(models: CloudflareModelOption[]): void {
  if (!targetModelRail) {
    return;
  }

  renderTargetModelRail(targetModelRail, {
    models,
    selectedModelId: targetModelSelect?.value,
    onSelect: (model) => selectTargetModel(model.id),
  });
}

function selectTargetModel(modelId: string): void {
  if (!targetModelSelect) {
    return;
  }

  targetModelSelect.value = modelId;
  handleTargetModelSelectionChange();
}

function syncTargetModelRailSelection(): void {
  const selectedId = targetModelSelect?.value ?? '';
  targetModelRail?.querySelectorAll<HTMLButtonElement>('.target-model-card').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.modelId === selectedId));
  });
}

function handleTargetModelSelectionChange(): void {
  syncTargetModelRailSelection();

  if (targetObjects.length === 0 && getSelectedTargetModel()) {
    addTargetObjectFromSelection();
    return;
  }

  const selectedModel = getSelectedTargetModel();
  if (selectedModel) {
    updateImageTargetStatus(`${selectedModel.label} ready to add.`, false);
  }
  renderTargetObjectList();
  void updateTargetPreview();
}

function getSelectedTargetModel(): CloudflareModelOption | undefined {
  const selectedId = targetModelSelect?.value;
  return cloudflareModels.find((model) => model.id === selectedId);
}

function addTargetObjectFromSelection(): void {
  const model = getSelectedTargetModel();
  if (!model) {
    updateImageTargetStatus('Choose a Cloudflare model before adding an object.', true);
    return;
  }

  const object = createTargetModelObject(model);
  targetObjects = [...targetObjects, object];
  selectTargetObject(object.id, { refreshPreview: false });
  renderTargetObjectList();
  updateImageTargetStatus(`${model.label} added to the target.`, false);
  void updateTargetPreview();
}

function addTargetTextFromInput(): void {
  const object = createLocalTextObject({
    id: createTargetObjectId(),
    text: {
      value: targetTextValueInput?.value,
      language: readTargetTextLanguage(),
      font: readTargetTextFont(),
    },
    placement: nextTargetObjectPlacement(),
    animation: nextTargetObjectAnimation(),
  });
  targetObjects = [...targetObjects, object];
  selectTargetObject(object.id, { refreshPreview: false });
  renderTargetObjectList();
  updateImageTargetStatus(`Text "${object.text.value}" added locally.`, false);
  void updateTargetPreview();
}

function createTargetModelObject(model: CloudflareModelOption): CloudImageTargetObject {
  return {
    id: createTargetObjectId(),
    model,
    placement: nextTargetObjectPlacement(),
    animation: nextTargetObjectAnimation(),
  };
}

function removeSelectedTargetObject(): void {
  if (targetObjects.length === 0) {
    updateImageTargetStatus('No placed objects to remove.', true);
    return;
  }

  const selectedIndex = targetObjects.findIndex((object) => object.id === selectedTargetObjectId);
  const removeIndex = selectedIndex >= 0 ? selectedIndex : targetObjects.length - 1;
  targetObjects = targetObjects.filter((_, index) => index !== removeIndex);
  selectedTargetObjectId = targetObjects[Math.min(removeIndex, targetObjects.length - 1)]?.id;

  const selectedObject = getSelectedTargetObject();
  targetPlacement = selectedObject?.placement ?? DEFAULT_IMAGE_TARGET_PLACEMENT;
  targetAnimation = selectedObject?.animation ?? DEFAULT_IMAGE_TARGET_ANIMATION;
  if (targetModelSelect) {
    targetModelSelect.value = selectedObject && !isTextTargetObject(selectedObject) ? selectedObject.model.id : '';
  }
  syncTargetModelRailSelection();
  syncTargetPlacementInputs(targetPlacement);
  syncTargetAnimationInputs(targetAnimation);
  renderTargetObjectList();
  updateImageTargetStatus(
    targetObjects.length > 0
      ? `${targetObjects.length} object${targetObjects.length === 1 ? '' : 's'} placed.`
      : 'No objects placed yet.',
    false,
  );
  void updateTargetPreview();
}

function selectTargetObject(objectId: string, options?: { refreshPreview?: boolean }): void {
  const object = targetObjects.find((entry) => entry.id === objectId);
  if (!object) {
    return;
  }

  selectedTargetObjectId = object.id;
  targetPlacement = object.placement;
  targetAnimation = object.animation ?? DEFAULT_IMAGE_TARGET_ANIMATION;
  if (targetModelSelect) {
    targetModelSelect.value = isTextTargetObject(object) ? '' : object.model.id;
  }
  syncTargetModelRailSelection();
  syncTargetPlacementInputs(object.placement);
  syncTargetAnimationInputs(targetAnimation);
  renderTargetObjectList();
  updateImageTargetStatus(
    isTextTargetObject(object) ? `${object.text.value} text selected.` : `${object.model.label} selected.`,
    false,
  );
  if (options?.refreshPreview !== false) {
    void updateTargetPreview();
  }
}

function updateSelectedTargetObjectPlacement(placement: ImageTargetPlacement): void {
  targetPlacement = normalizePlacement(placement);
  const object = getSelectedTargetObject();
  if (object) {
    object.placement = targetPlacement;
    renderTargetObjectList();
  }
}

function updateSelectedTargetObjectAnimation(animation: ImageTargetAnimation): void {
  targetAnimation = normalizeAnimation(animation);
  const object = getSelectedTargetObject();
  if (object) {
    object.animation = targetAnimation;
    renderTargetObjectList();
  }
}

function getSelectedTargetObject(): TargetEditorObject | undefined {
  return targetObjects.find((object) => object.id === selectedTargetObjectId);
}

function renderTargetObjectList(): void {
  if (!targetObjectList) {
    return;
  }

  if (addTargetObjectButton) {
    addTargetObjectButton.disabled = !getSelectedTargetModel();
  }
  if (removeTargetObjectButton) {
    removeTargetObjectButton.disabled = targetObjects.length === 0;
  }

  targetObjectList.innerHTML = '';
  if (targetObjects.length === 0) {
    targetObjectList.textContent = 'No objects placed yet.';
    return;
  }

  for (const [index, object] of targetObjects.entries()) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'target-object-row';
    row.dataset.objectId = object.id;
    row.setAttribute('aria-selected', String(object.id === selectedTargetObjectId));
    row.addEventListener('click', () => selectTargetObject(object.id));

    const label = document.createElement('strong');
    label.textContent = isTextTargetObject(object) ? object.text.value : object.model.label;
    const meta = document.createElement('small');
    meta.textContent = isTextTargetObject(object)
      ? `${languageOption(object.text.language).label} / ${fontOption(object.text.font).label}`
      : `${index + 1} / ${Number(object.placement.scale.toFixed(2))}x`;
    row.append(label, meta);
    targetObjectList.append(row);
  }
}

function nextTargetObjectPlacement(): ImageTargetPlacement {
  if (targetObjects.length === 0) {
    return normalizePlacement(readTargetPlacement());
  }

  const index = targetObjects.length;
  return normalizePlacement({
    ...DEFAULT_IMAGE_TARGET_PLACEMENT,
    offsetX: Math.max(-0.8, Math.min(0.8, -0.24 + index * 0.18)),
    offsetY: Math.max(-0.8, Math.min(0.8, (index % 3) * 0.12)),
  });
}

function nextTargetObjectAnimation(): ImageTargetAnimation {
  return normalizeAnimation(readTargetAnimation());
}

function createTargetObjectId(): string {
  const cryptoId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `object-${cryptoId}`;
}

function readTargetTextLanguage(): TargetTextLanguage {
  const value = targetTextLanguageSelect?.value;
  return isTargetTextLanguage(value) ? value : 'english';
}

function readTargetTextFont(): TargetTextFont {
  const value = targetTextFontSelect?.value;
  return isTargetTextFont(value) ? value : 'studio-sans';
}

function syncTargetPlacementInputs(placement: ImageTargetPlacement): void {
  const normalized = normalizePlacement(placement);
  setRangeInputValue(targetScaleInput, normalized.scale);
  setRangeInputValue(targetOffsetXInput, normalized.offsetX);
  setRangeInputValue(targetOffsetYInput, normalized.offsetY);
  setRangeInputValue(targetHeightInput, normalized.height);
  setRangeInputValue(targetRotationXInput, normalized.rotationX);
  setRangeInputValue(targetRotationYInput, normalized.rotationY);
  setRangeInputValue(targetRotationZInput, normalized.rotationZ);
}

function syncTargetAnimationInputs(animation: ImageTargetAnimation): void {
  const normalized = normalizeAnimation(animation);
  if (targetSpinAxisSelect) {
    targetSpinAxisSelect.value = normalized.spinAxis;
  }
  setRangeInputValue(targetSpinSpeedInput, normalized.spinSpeed);
  setRangeInputValue(targetBobHeightInput, normalized.bobHeight);
  setRangeInputValue(targetBobSpeedInput, normalized.bobSpeed);
}

function syncTargetCameraInputs(cameraView: PreviewCameraView): void {
  setRangeInputValue(targetCameraDistanceInput, cameraView.distance);
  setRangeInputValue(targetCameraHeightInput, cameraView.height);
  setRangeInputValue(targetCameraYawInput, cameraView.yawDegrees);
  setRangeInputValue(targetCameraTargetInput, cameraView.targetHeight);
}

function syncTargetTransformModeButtons(mode: PreviewTransformMode): void {
  targetTransformModeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.transformMode === mode));
  });
}

function handleTargetCameraGizmoPointerEnd(event: PointerEvent): void {
  if (!targetCameraGizmoDrag || targetCameraGizmoDrag.pointerId !== event.pointerId) {
    return;
  }

  if (targetCameraGizmoDrag.didMove) {
    suppressedCameraGizmoClick = { x: event.clientX, y: event.clientY };
    event.preventDefault();
  }

  targetCameraGizmoDrag = undefined;
  targetCameraGizmo?.classList.remove('is-dragging');
  window.removeEventListener('pointermove', handleTargetCameraGizmoPointerMove);
  window.removeEventListener('pointerup', handleTargetCameraGizmoPointerEnd);
  window.removeEventListener('pointercancel', handleTargetCameraGizmoPointerEnd);
}

function setRangeInputValue(input: HTMLInputElement | null, value: number): void {
  if (!input) {
    return;
  }

  input.value = String(Number(value.toFixed(3)));
}

function isPreviewTransformMode(value: string | undefined): value is PreviewTransformMode {
  return value === 'translate' || value === 'rotate' || value === 'scale';
}

function isPlacementTransformReset(value: string | undefined): value is PlacementTransformReset {
  return value === 'move' || value === 'rotate' || value === 'scale';
}

function isPlacementTransformResetAxis(value: string | undefined): value is PlacementTransformResetAxis {
  return value === 'all' || value === 'x' || value === 'y' || value === 'z';
}

async function updateTargetPreview(): Promise<void> {
  const preview = ensureImageTargetPreview();
  if (!preview) {
    return;
  }
  await preview.update({
    imageUrl: targetImagePayload ? imageTargetDataUrl(targetImagePayload) : undefined,
    objects: targetObjects,
    selectedObjectId: selectedTargetObjectId,
    camera: targetCameraView,
    transformMode: targetTransformMode,
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

  updateSelectedTargetObjectPlacement(readTargetPlacement());
  let objectsToSave = saveableModelObjects(targetObjects);
  if (objectsToSave.length === 0) {
    const model = getSelectedTargetModel();
    if (model) {
      const object = createTargetModelObject(model);
      targetObjects = [...targetObjects, object];
      objectsToSave = [object];
      selectTargetObject(object.id, { refreshPreview: false });
      renderTargetObjectList();
    }
  }

  if (objectsToSave.length === 0) {
    updateImageTargetStatus('Add at least one Cloudflare model before saving. Text is local-only for now.', true);
    return;
  }

  const objects = objectsToSave.map((object) => ({
    ...object,
    placement: normalizePlacement(object.placement),
    animation: normalizeAnimation(object.animation),
  }));
  updateImageTargetStatus('Saving image target...', false);

  try {
    await createImageTarget({
      apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
      authToken,
      label: targetLabelInput?.value.trim() || 'Image target',
      imageBase64: targetImagePayload.imageBase64,
      imageMimeType: targetImagePayload.imageMimeType,
      model: objects[0].model,
      placement: objects[0].placement,
      objects,
    });
    await refreshImageTargets({ rethrowOnError: true });
    updateImageTargetStatus(
      targetObjects.some(isTextTargetObject)
        ? 'Image target saved to Cloudflare. Text objects stayed local.'
        : 'Image target saved to Cloudflare.',
      false,
    );
  } catch (error) {
    updateImageTargetStatus(errorMessage(error, 'Unable to save image target'), true);
  }
}

function createCurrentDraftTarget(): LocalImageTargetDraft | undefined {
  if (!targetImagePayload || targetObjects.length === 0) {
    return undefined;
  }

  return {
    id: 'current-target',
    label: targetLabelInput?.value.trim() || 'Current target',
    imageUrl: imageTargetDataUrl(targetImagePayload),
    objects: targetObjects,
  };
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
    modelName.textContent = target.objects.length === 1
      ? target.model.label
      : `${target.objects.length} objects`;
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

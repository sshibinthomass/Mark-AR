import './style.css';
import { startMarkerAR, type MarkerARSession } from './ar/mindarRuntime';
import { createRuntimeMarkerTargets } from './ar/markerTargets';
import {
  DEFAULT_GENERATE_MODEL_API_URL,
  loadCloudflareModelOptions,
  type CloudflareModelOption,
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
  animationForPreset,
  normalizeAnimation,
  type ImageTargetAnimation,
  type ImageTargetAnimationPreset,
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
  signupToWebArWorker,
} from './app/webArAuth';
import {
  loginIntroMessage,
  protectedTargetsMessage,
  signupIntroMessage,
  userFacingAuthErrorMessage,
} from './app/authMessages';
import { recoverExistingAccount } from './app/authRecovery';
import {
  DEFAULT_TARGET_TEXT,
  createLocalTextObject,
  isTargetTextFillMode,
  isTargetTextFont,
  isTargetTextGradientDirection,
  isTargetTextColor,
  isTargetTextLanguage,
  isTargetTextStylePreset,
  isTextTargetObject,
  languageOption,
  normalizeTargetText,
  saveableModelObjects,
  textStylePreset,
  updateTargetTextObject,
  type LocalImageTargetDraft,
  type TargetEditorObject,
  type TargetTextContent,
  type TargetTextFillMode,
  type TargetTextFont,
  type TargetTextGradientDirection,
  type TargetTextLanguage,
  type TargetTextStylePreset,
} from './app/targetEditorObjects';
import {
  imageFileToCapturedImage,
} from './capture/cameraCapture';
import {
  DEFAULT_PREVIEW_CAMERA_VIEW,
  type PreviewCameraView,
  cameraViewForPreset,
  isCameraPreset,
} from './scene/previewCamera';
import { ImageTargetPreview } from './scene/ImageTargetPreview';
import type { PreviewTransformMode } from './scene/ImageTargetPreview';
import {
  applyAuthUi,
  isAuthenticated,
  resolveLoginResult,
  resolveSignupResult,
  type AuthUiState,
} from './ui/authUi';
import { AuthNavigation } from './ui/authNavigation';
import { applyAuthFormMode, type AuthFormMode } from './ui/authFormMode';
import { renderAppShell } from './ui/appShell';
import { createAnimationTrackEditor } from './ui/animationTrackEditor';
import { renderTargetModelRail } from './ui/modelRail';
import { hrefForRoute, routeFromHash, type AppRoute } from './ui/pageRoutes';
import { setupTargetInspectorTabs } from './ui/targetInspectorTabs';
import { renderTargetObjectListItem } from './ui/targetObjectList';
import { decorateDeleteIconButton } from './ui/deleteIconButton';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found');
}

app.innerHTML = renderAppShell();
const targetInspectorTabs = setupTargetInspectorTabs(app);

const shell = queryRequired<HTMLElement>('[data-app-shell]');
const stage = queryRequired<HTMLDivElement>('#ar-stage');
const startButton = queryRequired<HTMLButtonElement>('#start-ar');
const status = queryRequired<HTMLParagraphElement>('#ar-status');
const workerLoginForm = queryRequired<HTMLFormElement>('#worker-login-form');
const workerNameInput = queryRequired<HTMLInputElement>('#worker-name');
const workerEmailInput = queryRequired<HTMLInputElement>('#worker-email');
const workerPasswordInput = queryRequired<HTMLInputElement>('#worker-password');
const workerLogoutButton = queryRequired<HTMLButtonElement>('#worker-logout');
const authModeButtons = shell.querySelectorAll<HTMLButtonElement>('[data-auth-mode]');
const targetImageFile = document.querySelector<HTMLInputElement>('#target-image-file');
const targetLabelInput = document.querySelector<HTMLInputElement>('#target-label');
const targetModelSelect = document.querySelector<HTMLSelectElement>('#target-model-select');
const targetPreviewStage = document.querySelector<HTMLElement>('#target-preview-stage');
const targetModelRail = document.querySelector<HTMLElement>('#target-model-rail');
const targetObjectList = document.querySelector<HTMLElement>('#target-object-list');
const targetTextValueInput = document.querySelector<HTMLTextAreaElement>('#target-text-value');
const targetTextPresetSelect = document.querySelector<HTMLSelectElement>('#target-text-preset');
const targetTextLanguageSelect = document.querySelector<HTMLSelectElement>('#target-text-language');
const targetTextFontSelect = document.querySelector<HTMLSelectElement>('#target-text-font');
const targetTextColorInput = document.querySelector<HTMLInputElement>('#target-text-color');
const targetTextFillModeSelect = document.querySelector<HTMLSelectElement>('#target-text-fill-mode');
const targetTextGradientStartInput = document.querySelector<HTMLInputElement>('#target-text-gradient-start');
const targetTextGradientEndInput = document.querySelector<HTMLInputElement>('#target-text-gradient-end');
const targetTextGradientDirectionSelect = document.querySelector<HTMLSelectElement>('#target-text-gradient-direction');
const targetTextSideColorInput = document.querySelector<HTMLInputElement>('#target-text-side-color');
const targetTextDepthInput = document.querySelector<HTMLInputElement>('#target-text-depth');
const targetTextBevelInput = document.querySelector<HTMLInputElement>('#target-text-bevel');
const targetTextGlossInput = document.querySelector<HTMLInputElement>('#target-text-gloss');
const addTargetTextButton = document.querySelector<HTMLButtonElement>('#add-target-text');
const targetTextStylePanel = document.querySelector<HTMLDetailsElement>('[data-selected-text-style]');
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
const targetCameraPresetButtons = document.querySelectorAll<HTMLButtonElement>('[data-camera-preset]');
const targetAnimationPresetSelect = document.querySelector<HTMLSelectElement>('#target-animation-preset');
const targetAnimationTracks = document.querySelector<HTMLElement>('#target-animation-tracks');
const addTargetAnimationTrackButton = document.querySelector<HTMLButtonElement>('#add-target-animation-track');
const resetTargetAnimationButton = document.querySelector<HTMLButtonElement>('#reset-target-animation');
const saveImageTargetButton = document.querySelector<HTMLButtonElement>('#save-image-target');
const refreshImageTargetsButton = document.querySelector<HTMLButtonElement>('#refresh-image-targets');
const imageTargetStatus = document.querySelector<HTMLElement>('#image-target-status');
const savedImageTargetList = document.querySelector<HTMLElement>('#saved-image-target-list');
let session: MarkerARSession | undefined;
let authToken = loadWorkerAuthToken();
let authUiState: AuthUiState = authToken
  ? { status: 'checking', message: 'Checking your saved session…' }
  : { status: 'signed-out', message: loginIntroMessage };
const authNavigation = new AuthNavigation();
let authFormMode: AuthFormMode = 'login';
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
const animationTrackEditor = targetAnimationTracks
  ? createAnimationTrackEditor(targetAnimationTracks, {
      onChange: (animation) => {
        updateSelectedTargetObjectAnimation(animation);
        if (targetAnimationPresetSelect) {
          targetAnimationPresetSelect.value = 'custom';
        }
        void updateTargetPreview();
      },
    })
  : undefined;

applyAuthUi(shell, authUiState);
applyAuthFormMode(shell, authFormMode);
activateRequestedRoute(routeFromHash(window.location.hash));
void initializeCloudflareControls();

window.addEventListener('hashchange', () => {
  activateRequestedRoute(routeFromHash(window.location.hash));
});

shell.querySelectorAll<HTMLAnchorElement>('[data-auth-protected]').forEach((link) => {
  link.addEventListener('click', () => {
    if (isAuthenticated(authUiState)) {
      return;
    }
    authNavigation.remember('targets');
    setAuthUiState({
      ...authUiState,
      message: authUiState.status === 'checking'
        ? 'Checking your session before opening Image Targets…'
        : protectedTargetsMessage,
    });
  });
});

authModeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.authMode;
    if (mode !== 'login' && mode !== 'signup') {
      return;
    }
    setAuthFormMode(mode);
    setAuthUiState({
      status: 'signed-out',
      message: mode === 'signup'
        ? signupIntroMessage
        : loginIntroMessage,
    });
    if (mode === 'signup') {
      workerNameInput.focus();
    }
  });
});

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  status.textContent = 'Preparing marker targets';
  session?.stop();
  stage.replaceChildren();

  try {
    const runtimeTargets = createRuntimeMarkerTargets({
      cloudTargets: cloudImageTargets,
      draftTarget: createCurrentDraftTarget(),
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
        status.textContent = 'Camera active. Scan a saved cloud image target.';
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
  if (authFormMode === 'signup') {
    await createWorkerAccount();
    return;
  }
  await signInToWorker();
});

async function signInToWorker(message = 'Signing in…'): Promise<void> {
  setAuthUiState({ status: 'checking', message });

  try {
    const sessionResult = await loginToWebArWorker({
      apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
      email: workerEmailInput.value,
      password: workerPasswordInput.value,
    });
    const result = resolveLoginResult(sessionResult);

    authToken = result.token;
    saveWorkerAuthToken(result.token);
    workerPasswordInput.value = '';
    setAuthUiState(result.state);
    await refreshCloudflareModels();
    await refreshImageTargets();
    restorePendingProtectedRoute();
  } catch (error) {
    setAuthUiState({
      status: 'signed-out',
      message: userFacingAuthErrorMessage(error, 'login'),
    });
  }
}

workerLogoutButton.addEventListener('click', async () => {
  authToken = null;
  clearWorkerAuthToken();
  authNavigation.clear();
  setAuthFormMode('login');
  setAuthUiState({ status: 'signed-out', message: `Signed out. ${loginIntroMessage}` });
  if (shell.dataset.activePage === 'targets') {
    window.location.hash = hrefForRoute('account');
  }
  await refreshCloudflareModels();
  await refreshImageTargets();
});

async function createWorkerAccount(): Promise<void> {
  setAuthUiState({ status: 'checking', message: 'Creating account…' });

  try {
    const sessionResult = await signupToWebArWorker({
      apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
      email: workerEmailInput.value,
      password: workerPasswordInput.value,
      name: workerNameInput.value,
    });
    const result = resolveSignupResult(sessionResult);
    workerPasswordInput.value = '';

    if (result.kind === 'pending') {
      workerEmailInput.value = result.email;
      workerNameInput.value = '';
      setAuthFormMode('login');
      setAuthUiState({ status: 'signed-out', message: result.message });
      return;
    }

    authToken = result.token;
    saveWorkerAuthToken(result.token);
    workerNameInput.value = '';
    setAuthFormMode('login');
    setAuthUiState(result.state);
    await refreshCloudflareModels();
    await refreshImageTargets();
    restorePendingProtectedRoute();
  } catch (error) {
    if (await recoverExistingAccount(error, {
      setFormMode: setAuthFormMode,
      setSignedOutMessage: (message) => setAuthUiState({ status: 'signed-out', message }),
    })) {
      return;
    }
    setAuthUiState({
      status: 'signed-out',
      message: userFacingAuthErrorMessage(error, 'signup'),
    });
  }
}

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

targetCameraPresetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (!isCameraPreset(button.dataset.cameraPreset)) {
      return;
    }

    applyTargetCameraView(cameraViewForPreset(button.dataset.cameraPreset));
  });
});

targetAnimationPresetSelect?.addEventListener('change', () => {
  const preset = targetAnimationPresetSelect.value as ImageTargetAnimationPreset;
  const animation = preset === 'custom'
    ? { ...normalizeAnimation(targetAnimation), preset: 'custom' as const }
    : animationForPreset(preset);
  updateSelectedTargetObjectAnimation(animation);
  syncTargetAnimationInputs(animation);
  void updateTargetPreview();
});

addTargetAnimationTrackButton?.addEventListener('click', () => {
  animationTrackEditor?.addTrack();
});

resetTargetAnimationButton?.addEventListener('click', () => {
  const animation = animationForPreset('none');
  updateSelectedTargetObjectAnimation(animation);
  syncTargetAnimationInputs(animation);
  void updateTargetPreview();
});

targetTextPresetSelect?.addEventListener('change', () => {
  applyTargetTextPreset(readTargetTextStylePreset());
  updateSelectedTextObjectFromInput();
});

targetModelSelect?.addEventListener('change', () => {
  handleTargetModelSelectionChange();
});

targetTextLanguageSelect?.addEventListener('change', () => {
  const language = readTargetTextLanguage();
  if (targetTextValueInput) {
    targetTextValueInput.value = languageOption(language).sample;
  }
  if (targetTextFontSelect && language === 'tamil') {
    targetTextFontSelect.value = 'tamil-ui';
  }
  updateSelectedTextObjectFromInput();
});

addTargetTextButton?.addEventListener('click', () => {
  commitTargetTextFromInput();
});

targetTextValueInput?.addEventListener('input', () => {
  updateSelectedTextObjectFromInput();
});

targetTextFontSelect?.addEventListener('change', () => {
  updateSelectedTextObjectFromInput();
});

[
  targetTextColorInput,
  targetTextGradientStartInput,
  targetTextGradientEndInput,
  targetTextSideColorInput,
  targetTextDepthInput,
  targetTextBevelInput,
  targetTextGlossInput,
].forEach((input) => {
  input?.addEventListener('input', () => {
    updateSelectedTextObjectFromInput();
  });
});

[targetTextFillModeSelect, targetTextGradientDirectionSelect].forEach((input) => {
  input?.addEventListener('change', () => {
    updateSelectedTextObjectFromInput();
  });
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
syncTargetTextAction();
syncTargetObjectControlsTab();

async function initializeCloudflareControls(): Promise<void> {
  if (authToken) {
    setAuthUiState({ status: 'checking', message: 'Checking your saved session…' });
    try {
      const user = await getCurrentWebArUser({
        apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
        token: authToken,
      });
      if (user) {
        setAuthUiState({
          status: 'signed-in',
          email: user.email,
          message: 'Image Targets unlocked.',
        });
        restorePendingProtectedRoute();
      } else {
        authToken = null;
        clearWorkerAuthToken();
        setAuthUiState({
          status: 'signed-out',
          message: `Your saved session expired. ${loginIntroMessage}`,
        });
      }
    } catch (error) {
      authToken = null;
      clearWorkerAuthToken();
      setAuthUiState({
        status: 'signed-out',
        message: errorMessage(error, 'Could not verify saved session'),
      });
    }
  }

  await refreshCloudflareModelsAndTargets();
}

async function refreshCloudflareModelsAndTargets(): Promise<void> {
  await refreshCloudflareModels();
  await refreshImageTargets();
}

async function refreshCloudflareModels(): Promise<void> {
  try {
    cloudflareModels = await loadCloudflareModelOptions({
      apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
      authToken,
    });
    renderTargetModelOptions(cloudflareModels);
  } catch {
    cloudflareModels = [];
    if (targetModelSelect) {
      targetModelSelect.innerHTML = '<option value="">Unable to load models</option>';
    }
    renderTargetModelRailOptions([]);
  }
}

function setAuthUiState(state: AuthUiState): void {
  authUiState = state;
  applyAuthUi(shell, state);
}

function setAuthFormMode(mode: AuthFormMode): void {
  authFormMode = mode;
  applyAuthFormMode(shell, mode);
}

function activateRequestedRoute(requestedRoute: AppRoute): void {
  const result = authNavigation.activate(shell, requestedRoute, authUiState);
  if (!result.blocked) {
    return;
  }

  setAuthUiState({
    ...authUiState,
    message: authUiState.status === 'checking'
      ? 'Checking your session before opening Image Targets…'
      : protectedTargetsMessage,
  });
  if (window.location.hash !== hrefForRoute(result.activeRoute)) {
    window.history.replaceState(null, '', hrefForRoute(result.activeRoute));
  }
}

function restorePendingProtectedRoute(): void {
  const route = authNavigation.takePending(authUiState);
  if (!route) {
    return;
  }
  if (window.location.hash === hrefForRoute(route)) {
    activateRequestedRoute(route);
    return;
  }
  window.location.hash = hrefForRoute(route);
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
        syncTargetObjectControlsTab({ activateWhenSelected: true });
      }
      renderTargetObjectList();
    },
    onCameraChange: (cameraView) => {
      targetCameraView = cameraView;
      syncTargetCameraInputs(cameraView);
    },
    onSelectionChange: (objectId) => {
      if (objectId) {
        selectTargetObject(objectId, { refreshPreview: false });
        return;
      }
      clearSelectedTargetObject({ refreshPreview: false });
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

function renderTargetModelRailOptions(models: CloudflareModelOption[]): void {
  if (!targetModelRail) {
    return;
  }

  renderTargetModelRail(targetModelRail, {
    models,
    selectedModelId: targetModelSelect?.value,
    onSelect: addTargetObjectForModel,
  });
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

  addTargetObjectForModel(model);
}

function addTargetObjectForModel(model: CloudflareModelOption): void {
  if (targetModelSelect) {
    targetModelSelect.value = model.id;
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
    text: readTargetTextInput(),
    placement: nextTargetObjectPlacement(),
    animation: DEFAULT_IMAGE_TARGET_ANIMATION,
  });
  targetObjects = [...targetObjects, object];
  selectTargetObject(object.id, { refreshPreview: false });
  renderTargetObjectList();
  updateImageTargetStatus(`Text "${object.text.value}" added locally.`, false);
  void updateTargetPreview();
}

function commitTargetTextFromInput(): void {
  if (updateSelectedTextObjectFromInput({ announce: true })) {
    return;
  }

  addTargetTextFromInput();
}

function createTargetModelObject(model: CloudflareModelOption): CloudImageTargetObject {
  return {
    id: createTargetObjectId(),
    model,
    placement: nextTargetObjectPlacement(),
    animation: normalizeAnimation(DEFAULT_IMAGE_TARGET_ANIMATION),
  };
}

function removeTargetObjectById(objectId: string): void {
  const removeIndex = targetObjects.findIndex((object) => object.id === objectId);
  if (removeIndex < 0) {
    return;
  }

  const removedObject = targetObjects[removeIndex];
  targetObjects = targetObjects.filter((object) => object.id !== objectId);
  if (selectedTargetObjectId === objectId) {
    selectedTargetObjectId = targetObjects[Math.min(removeIndex, targetObjects.length - 1)]?.id;
  }

  const selectedObject = getSelectedTargetObject();
  targetPlacement = selectedObject?.placement ?? DEFAULT_IMAGE_TARGET_PLACEMENT;
  targetAnimation = selectedObject?.animation ?? DEFAULT_IMAGE_TARGET_ANIMATION;
  if (targetModelSelect) {
    targetModelSelect.value = selectedObject && !isTextTargetObject(selectedObject) ? selectedObject.model.id : '';
  }
  if (selectedObject && isTextTargetObject(selectedObject)) {
    syncTargetTextInputs(selectedObject.text);
  }
  syncTargetModelRailSelection();
  syncTargetPlacementInputs(targetPlacement);
  syncTargetAnimationInputs(targetAnimation);
  syncTargetTextAction();
  syncTargetObjectControlsTab({ activateWhenSelected: Boolean(selectedObject) });
  renderTargetObjectList();
  updateImageTargetStatus(
    targetObjects.length > 0
      ? `${isTextTargetObject(removedObject) ? 'Text' : 'Object'} removed. ${targetObjects.length} object${targetObjects.length === 1 ? '' : 's'} placed.`
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
  if (isTextTargetObject(object)) {
    syncTargetTextInputs(object.text);
  }
  syncTargetModelRailSelection();
  syncTargetPlacementInputs(object.placement);
  syncTargetAnimationInputs(targetAnimation);
  syncTargetTextAction();
  syncTargetObjectControlsTab({ activateWhenSelected: true });
  renderTargetObjectList();
  updateImageTargetStatus(
    isTextTargetObject(object) ? `${object.text.value} text selected.` : `${object.model.label} selected.`,
    false,
  );
  if (options?.refreshPreview !== false) {
    void updateTargetPreview();
  }
}

function clearSelectedTargetObject(options?: { refreshPreview?: boolean }): void {
  selectedTargetObjectId = undefined;
  targetPlacement = DEFAULT_IMAGE_TARGET_PLACEMENT;
  targetAnimation = DEFAULT_IMAGE_TARGET_ANIMATION;
  if (targetModelSelect) {
    targetModelSelect.value = '';
  }
  syncTargetModelRailSelection();
  syncTargetPlacementInputs(targetPlacement);
  syncTargetAnimationInputs(targetAnimation);
  syncTargetTextAction();
  syncTargetObjectControlsTab();
  renderTargetObjectList();
  updateImageTargetStatus('No object selected.', false);
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

function syncTargetObjectControlsTab(options?: { activateWhenSelected?: boolean }): void {
  const hasSelection = Boolean(getSelectedTargetObject());
  targetInspectorTabs.setTabEnabled('object-controls', hasSelection);

  if (hasSelection) {
    if (options?.activateWhenSelected) {
      targetInspectorTabs.activate('object-controls');
    }
    return;
  }

  if (targetInspectorTabs.getActiveTab() === 'object-controls') {
    targetInspectorTabs.activate('objects');
  }
}

function getSelectedTextTargetObject(): ReturnType<typeof createLocalTextObject> | undefined {
  const object = getSelectedTargetObject();
  return object && isTextTargetObject(object) ? object : undefined;
}

function renderTargetObjectList(): void {
  if (!targetObjectList) {
    return;
  }

  targetObjectList.innerHTML = '';
  if (targetObjects.length === 0) {
    targetObjectList.textContent = 'No objects placed yet.';
    return;
  }

  for (const [index, object] of targetObjects.entries()) {
    targetObjectList.append(renderTargetObjectListItem({
      object,
      index,
      selectedObjectId: selectedTargetObjectId,
      onSelect: (objectId) => selectTargetObject(objectId),
      onDelete: removeTargetObjectById,
    }));
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

function readTargetTextColor(): string {
  const value = targetTextColorInput?.value;
  return isTargetTextColor(value) ? value.toLowerCase() : DEFAULT_TARGET_TEXT.color ?? '#2563eb';
}

function readTargetTextStylePreset(): TargetTextStylePreset {
  const value = targetTextPresetSelect?.value;
  return isTargetTextStylePreset(value) ? value : DEFAULT_TARGET_TEXT.stylePreset ?? 'blue-shine';
}

function readTargetTextFillMode(): TargetTextFillMode {
  const value = targetTextFillModeSelect?.value;
  return isTargetTextFillMode(value) ? value : DEFAULT_TARGET_TEXT.fillMode ?? 'solid';
}

function readTargetTextGradientStart(): string {
  const value = targetTextGradientStartInput?.value;
  return isTargetTextColor(value) ? value.toLowerCase() : DEFAULT_TARGET_TEXT.gradientStart ?? '#2563eb';
}

function readTargetTextGradientEnd(): string {
  const value = targetTextGradientEndInput?.value;
  return isTargetTextColor(value) ? value.toLowerCase() : DEFAULT_TARGET_TEXT.gradientEnd ?? '#60a5fa';
}

function readTargetTextGradientDirection(): TargetTextGradientDirection {
  const value = targetTextGradientDirectionSelect?.value;
  return isTargetTextGradientDirection(value) ? value : DEFAULT_TARGET_TEXT.gradientDirection ?? 'horizontal';
}

function readTargetTextSideColor(): string {
  const value = targetTextSideColorInput?.value;
  return isTargetTextColor(value) ? value.toLowerCase() : DEFAULT_TARGET_TEXT.sideColor ?? '#1d4ed8';
}

function readTargetTextDepth(): number {
  return readRangeNumber(targetTextDepthInput, DEFAULT_TARGET_TEXT.depth ?? 0.055);
}

function readTargetTextBevel(): number {
  return readRangeNumber(targetTextBevelInput, DEFAULT_TARGET_TEXT.bevel ?? 0.004);
}

function readTargetTextGloss(): number {
  return readRangeNumber(targetTextGlossInput, DEFAULT_TARGET_TEXT.gloss ?? 0.68);
}

function readTargetTextInput(): TargetTextContent {
  return normalizeTargetText({
    value: targetTextValueInput?.value,
    language: readTargetTextLanguage(),
    font: readTargetTextFont(),
    color: readTargetTextColor(),
    fillMode: readTargetTextFillMode(),
    gradientStart: readTargetTextGradientStart(),
    gradientEnd: readTargetTextGradientEnd(),
    gradientDirection: readTargetTextGradientDirection(),
    sideColor: readTargetTextSideColor(),
    depth: readTargetTextDepth(),
    bevel: readTargetTextBevel(),
    gloss: readTargetTextGloss(),
    stylePreset: readTargetTextStylePreset(),
  });
}

function updateSelectedTextObjectFromInput(
  options: { refreshPreview?: boolean; announce?: boolean } = {},
): boolean {
  const object = getSelectedTextTargetObject();
  if (!object) {
    syncTargetTextAction();
    return false;
  }

  const nextText = readTargetTextInput();
  targetObjects = updateTargetTextObject(targetObjects, object.id, nextText);
  renderTargetObjectList();
  syncTargetTextAction();

  if (options.announce) {
    updateImageTargetStatus(`Text "${nextText.value}" updated.`, false);
  }
  if (options.refreshPreview !== false) {
    void updateTargetPreview();
  }
  return true;
}

function applyTargetTextPreset(presetId: TargetTextStylePreset): void {
  const preset = textStylePreset(presetId);
  if (targetTextPresetSelect) {
    targetTextPresetSelect.value = preset.id;
  }
  if (targetTextColorInput) {
    targetTextColorInput.value = preset.color;
  }
  if (targetTextFillModeSelect) {
    targetTextFillModeSelect.value = preset.fillMode;
  }
  if (targetTextGradientStartInput) {
    targetTextGradientStartInput.value = preset.gradientStart;
  }
  if (targetTextGradientEndInput) {
    targetTextGradientEndInput.value = preset.gradientEnd;
  }
  if (targetTextGradientDirectionSelect) {
    targetTextGradientDirectionSelect.value = preset.gradientDirection;
  }
  if (targetTextSideColorInput) {
    targetTextSideColorInput.value = preset.sideColor;
  }
  setRangeInputValue(targetTextDepthInput, preset.depth);
  setRangeInputValue(targetTextBevelInput, preset.bevel);
  setRangeInputValue(targetTextGlossInput, preset.gloss);
}

function syncTargetTextInputs(text: Partial<TargetTextContent>): void {
  const normalized = normalizeTargetText(text);
  if (targetTextValueInput) {
    targetTextValueInput.value = normalized.value;
  }
  if (targetTextLanguageSelect) {
    targetTextLanguageSelect.value = normalized.language;
  }
  if (targetTextFontSelect) {
    targetTextFontSelect.value = normalized.font;
  }
  if (targetTextPresetSelect) {
    targetTextPresetSelect.value = normalized.stylePreset ?? DEFAULT_TARGET_TEXT.stylePreset ?? 'blue-shine';
  }
  if (targetTextColorInput) {
    targetTextColorInput.value = normalized.color ?? DEFAULT_TARGET_TEXT.color ?? '#2563eb';
  }
  if (targetTextFillModeSelect) {
    targetTextFillModeSelect.value = normalized.fillMode ?? DEFAULT_TARGET_TEXT.fillMode ?? 'solid';
  }
  if (targetTextGradientStartInput) {
    targetTextGradientStartInput.value = normalized.gradientStart ?? DEFAULT_TARGET_TEXT.gradientStart ?? '#2563eb';
  }
  if (targetTextGradientEndInput) {
    targetTextGradientEndInput.value = normalized.gradientEnd ?? DEFAULT_TARGET_TEXT.gradientEnd ?? '#60a5fa';
  }
  if (targetTextGradientDirectionSelect) {
    targetTextGradientDirectionSelect.value = normalized.gradientDirection ?? DEFAULT_TARGET_TEXT.gradientDirection ?? 'horizontal';
  }
  if (targetTextSideColorInput) {
    targetTextSideColorInput.value = normalized.sideColor ?? DEFAULT_TARGET_TEXT.sideColor ?? '#1d4ed8';
  }
  setRangeInputValue(targetTextDepthInput, normalized.depth ?? DEFAULT_TARGET_TEXT.depth ?? 0.055);
  setRangeInputValue(targetTextBevelInput, normalized.bevel ?? DEFAULT_TARGET_TEXT.bevel ?? 0.004);
  setRangeInputValue(targetTextGlossInput, normalized.gloss ?? DEFAULT_TARGET_TEXT.gloss ?? 0.68);
}

function syncTargetTextAction(): void {
  const selectedText = getSelectedTextTargetObject();
  syncSelectedTextStyleVisibility(Boolean(selectedText));

  if (!addTargetTextButton) {
    return;
  }

  addTargetTextButton.textContent = selectedText ? 'Update text' : 'Add text';
  addTargetTextButton.dataset.targetTextAction = selectedText ? 'update' : 'add';
}

function syncSelectedTextStyleVisibility(isTextSelected: boolean): void {
  if (!targetTextStylePanel) {
    return;
  }

  targetTextStylePanel.hidden = !isTextSelected;
  if (!isTextSelected) {
    targetTextStylePanel.open = false;
  }
}

function readRangeNumber(input: HTMLInputElement | null, fallback: number): number {
  const value = Number(input?.value);
  return Number.isFinite(value) ? value : fallback;
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
  if (targetAnimationPresetSelect) {
    targetAnimationPresetSelect.value = normalized.preset;
  }
  animationTrackEditor?.render(normalized);
}

function syncTargetCameraInputs(cameraView: PreviewCameraView): void {
  setRangeInputValue(targetCameraDistanceInput, cameraView.distance);
  setRangeInputValue(targetCameraHeightInput, cameraView.height);
  setRangeInputValue(targetCameraYawInput, cameraView.yawDegrees);
  setRangeInputValue(targetCameraTargetInput, cameraView.targetHeight);
}

function applyTargetCameraView(cameraView: PreviewCameraView): void {
  targetCameraView = cameraView;
  syncTargetCameraInputs(cameraView);
  void updateTargetPreview();
}

function syncTargetTransformModeButtons(mode: PreviewTransformMode): void {
  targetTransformModeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.transformMode === mode));
  });
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
    deleteButton.className = 'saved-target-delete';
    deleteButton.dataset.deleteTarget = target.id;
    decorateDeleteIconButton(deleteButton, `Delete target ${target.label}`);
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

import './style.css';
import {
  prepareFloorPlacement,
  type FloorPlacementController,
} from './ar/floorPlacementRuntime';
import { startMarkerAR, type MarkerARSession } from './ar/mindarRuntime';
import { createRuntimeMarkerTargets, createSingleTargetRuntimeMarker } from './ar/markerTargets';
import {
  DEFAULT_GENERATE_MODEL_API_URL,
  loadCloudflareModelOptions,
  type CloudflareModelOption,
} from './app/cloudflareModels';
import {
  createImageTarget,
  deleteImageTarget,
  getImageTargetForScan,
  ImageTargetRequestError,
  listImageTargets,
  updateImageTarget,
  type CloudImageTarget,
  type CloudImageTargetObject,
} from './app/cloudImageTargets';
import {
  DEFAULT_IMAGE_TARGET_ACCESS,
  isImageTargetAccessMode,
  normalizeImageTargetAccess,
  parseAllowedEmails,
  validateImageTargetAccess,
  type ImageTargetAccess,
} from './app/imageTargetAccess';
import {
  DEFAULT_IMAGE_TARGET_ANIMATION,
  animationForPreset,
  normalizeAnimation,
  type ImageTargetAnimation,
  type ImageTargetAnimationPreset,
} from './app/imageTargetAnimation';
import {
  DEFAULT_IMAGE_TARGET_PLACEMENT,
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
  isModelTargetObject,
  isTextTargetObject,
  languageOption,
  normalizeTargetText,
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
  createTargetEditorGroup,
  normalizeLocalPlacement,
  normalizeTargetEditorSelection,
  resolveObjectPlacement,
  resetLocalPlacementTransform,
  selectionPivotPlacement,
  toggleTargetObjectSelection,
  transformSelectionPlacements,
  ungroupTargetEditorGroup,
  type TargetEditorGroup,
  type TargetEditorSelection,
} from './app/targetEditorGroups';
import {
  createEditingTargetSession,
  targetPreviewImageUrl,
  type EditingTargetState,
} from './app/targetEditorSession';
import { savedTargetAuthoringMismatch } from './app/targetPersistence';
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
import {
  applyFloorPlacementUi,
  type FloorPlacementUiState,
} from './ui/floorPlacementUi';
import { renderTargetModelRail } from './ui/modelRail';
import {
  hrefForRoute,
  hrefForTargetScan,
  locationFromHash,
  type AppLocation,
  type AppRoute,
} from './ui/pageRoutes';
import { setupTargetInspectorTabs } from './ui/targetInspectorTabs';
import { renderTargetObjectList as createTargetObjectList } from './ui/targetObjectList';
import { renderSavedTargetList } from './ui/savedTargetList';

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
const floorStage = queryRequired<HTMLDivElement>('#floor-ar-stage');
const floorOverlay = queryRequired<HTMLDivElement>('#floor-ar-overlay');
const floorGestureSurface = queryRequired<HTMLDivElement>('#floor-ar-gesture-surface');
const floorToggle = queryRequired<HTMLButtonElement>('#floor-ar-toggle');
const floorPlace = queryRequired<HTMLButtonElement>('#floor-ar-place');
const floorRotation = queryRequired<HTMLInputElement>('#floor-ar-rotation');
const floorReset = queryRequired<HTMLButtonElement>('#floor-ar-reset');
const floorRestart = queryRequired<HTMLButtonElement>('#floor-ar-restart');
const workerLoginForm = queryRequired<HTMLFormElement>('#worker-login-form');
const workerNameInput = queryRequired<HTMLInputElement>('#worker-name');
const workerEmailInput = queryRequired<HTMLInputElement>('#worker-email');
const workerPasswordInput = queryRequired<HTMLInputElement>('#worker-password');
const workerLogoutButton = queryRequired<HTMLButtonElement>('#worker-logout');
const authModeButtons = shell.querySelectorAll<HTMLButtonElement>('[data-auth-mode]');
const targetImageFile = document.querySelector<HTMLInputElement>('#target-image-file');
const targetLabelInput = document.querySelector<HTMLInputElement>('#target-label');
const targetAccessModeSelect = document.querySelector<HTMLSelectElement>('#target-access-mode');
const targetAccessEmailsField = document.querySelector<HTMLElement>('#target-access-emails-field');
const targetAccessEmailsInput = document.querySelector<HTMLTextAreaElement>('#target-access-emails');
const targetModelSelect = document.querySelector<HTMLSelectElement>('#target-model-select');
const targetPreviewStage = document.querySelector<HTMLElement>('#target-preview-stage');
const targetModelRail = document.querySelector<HTMLElement>('#target-model-rail');
const targetObjectList = document.querySelector<HTMLElement>('#target-object-list');
const groupSelectedObjectsButton = document.querySelector<HTMLButtonElement>('#group-selected-objects');
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
const newImageTargetButton = document.querySelector<HTMLButtonElement>('#new-image-target');
const refreshImageTargetsButton = document.querySelector<HTMLButtonElement>('#refresh-image-targets');
const imageTargetStatus = document.querySelector<HTMLElement>('#image-target-status');
const savedImageTargetList = document.querySelector<HTMLElement>('#saved-image-target-list');
let session: MarkerARSession | undefined;
let focusedScanTarget: CloudImageTarget | undefined;
let activeScanId: string | undefined;
let scanRequestVersion = 0;
let markerStartVersion = 0;
let markerStartAbort: AbortController | undefined;
let activeSharedLinkMode: 'marker' | 'floor' = 'marker';
let floorController: FloorPlacementController | undefined;
let floorControllerRequestVersion = 0;
let floorLaunchVersion = 0;
let floorUiState: FloorPlacementUiState = { state: 'hidden' };
let authToken = loadWorkerAuthToken();
let authUiState: AuthUiState = authToken
  ? { status: 'checking', message: 'Checking your saved session…' }
  : { status: 'signed-out', message: loginIntroMessage };
const authNavigation = new AuthNavigation();
let authFormMode: AuthFormMode = 'login';
let cloudflareModels: CloudflareModelOption[] = [];
let cloudImageTargets: CloudImageTarget[] = [];
let targetImagePayload: ImageTargetImagePayload | undefined;
let editingTarget: EditingTargetState | undefined;
let editingTargetScanId: string | undefined;
let targetAccess: ImageTargetAccess = { ...DEFAULT_IMAGE_TARGET_ACCESS };
let targetPlacement: ImageTargetPlacement = DEFAULT_IMAGE_TARGET_PLACEMENT;
let targetAnimation: ImageTargetAnimation = DEFAULT_IMAGE_TARGET_ANIMATION;
let targetCameraView: PreviewCameraView = DEFAULT_PREVIEW_CAMERA_VIEW;
let targetTransformMode: PreviewTransformMode = 'translate';
let targetObjects: TargetEditorObject[] = [];
let targetGroups: TargetEditorGroup[] = [];
let targetSelection: TargetEditorSelection = { objectIds: [] };
let targetAnimationMixed = false;
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
setFloorPlacementUi({ state: 'hidden' });
activateRequestedLocation(locationFromHash(window.location.hash));
void initializeCloudflareControls();

window.addEventListener('hashchange', () => {
  activateRequestedLocation(locationFromHash(window.location.hash));
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
  await startCurrentArSession();
});

floorToggle.addEventListener('click', () => {
  if (activeSharedLinkMode === 'floor') {
    void returnToFocusedMarkerScan();
    return;
  }
  if (!floorController || !focusedScanTarget) {
    return;
  }

  activeSharedLinkMode = 'floor';
  invalidateMarkerStart();
  session?.stop();
  session = undefined;
  setFloorPlacementUi({
    state: 'floor-scanning',
    message: 'Move your phone until the floor ring appears.',
  });
  launchFocusedFloorPlacement(floorController);
});

floorPlace.addEventListener('click', () => {
  if (activeSharedLinkMode !== 'floor') {
    return;
  }
  floorController?.place();
});

floorRotation.addEventListener('input', () => {
  if (activeSharedLinkMode !== 'floor' || !floorController) {
    return;
  }
  const degrees = Number(floorRotation.value);
  if (Number.isFinite(degrees)) {
    floorController.setRotation(degrees);
  }
});

floorReset.addEventListener('click', () => {
  if (activeSharedLinkMode !== 'floor' || !floorController) {
    return;
  }
  floorController.reset();
  floorRotation.value = '0';
});

floorRestart.addEventListener('click', () => {
  if (activeSharedLinkMode !== 'floor' || !floorController) {
    return;
  }
  setFloorPlacementUi({
    state: 'floor-scanning',
    message: 'Move your phone until the floor ring appears.',
  });
  launchFocusedFloorPlacement(floorController);
});

async function startCurrentArSession(): Promise<void> {
  const startVersion = ++markerStartVersion;
  markerStartAbort?.abort();
  const abortController = new AbortController();
  markerStartAbort = abortController;
  const startTarget = focusedScanTarget;
  startButton.disabled = true;
  status.textContent = 'Preparing marker targets';
  session?.stop();
  session = undefined;
  stage.replaceChildren();

  try {
    const runtimeTargets = startTarget
      ? createSingleTargetRuntimeMarker(startTarget)
      : createRuntimeMarkerTargets({
          cloudTargets: cloudImageTargets,
          draftTarget: createCurrentDraftTarget(),
        });
    const isCurrentStart = () => (
      startVersion === markerStartVersion
      && activeSharedLinkMode === 'marker'
      && focusedScanTarget === startTarget
    );
    const startedSession = await startMarkerAR(stage, {
      targets: runtimeTargets,
      onCompileProgress: (percent) => {
        if (isCurrentStart()) {
          status.textContent = `Compiling targets ${Math.round(percent)}%`;
        }
      },
      onMarkerVisibility: ({ marker, visible }) => {
        if (isCurrentStart()) {
          status.textContent = visible ? `${marker.label} active` : `${marker.label} lost`;
        }
      },
      onReady: () => {
        if (isCurrentStart()) {
          status.textContent = startTarget
            ? `Camera active. Scan ${startTarget.label}.`
            : 'Camera active. Scan a saved cloud image target.';
        }
      },
      signal: abortController.signal,
    });
    if (!isCurrentStart()) {
      startedSession.stop();
      return;
    }
    session = startedSession;
    startButton.textContent = startTarget ? 'Restart camera' : 'Restart AR';
  } catch (error) {
    if (
      isAbortError(error)
      || startVersion !== markerStartVersion
      || activeSharedLinkMode !== 'marker'
      || focusedScanTarget !== startTarget
    ) {
      return;
    }
    const message = error instanceof Error ? error.message : 'Unable to start AR';
    status.textContent = message;
    startButton.textContent = 'Start camera';
  } finally {
    if (
      startVersion === markerStartVersion
      && activeSharedLinkMode === 'marker'
      && focusedScanTarget === startTarget
    ) {
      startButton.disabled = false;
    }
  }
}

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

    clearTargetSpecificScan();
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
  clearTargetSpecificScan();
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

    clearTargetSpecificScan();
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

targetAccessModeSelect?.addEventListener('change', () => {
  if (!isImageTargetAccessMode(targetAccessModeSelect.value)) {
    return;
  }
  targetAccess = normalizeImageTargetAccess({
    accessMode: targetAccessModeSelect.value,
    allowedEmails: parseAllowedEmails(targetAccessEmailsInput?.value ?? ''),
  });
  syncTargetAccessInputs();
});

targetAccessEmailsInput?.addEventListener('input', () => {
  targetAccess = normalizeImageTargetAccess({
    accessMode: targetAccess.accessMode,
    allowedEmails: parseAllowedEmails(targetAccessEmailsInput.value),
  });
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

    const currentPlacement = readTargetPlacement();
    const nextPlacement = getSelectedTargetObject()?.groupId
      ? resetLocalPlacementTransform(currentPlacement, button.dataset.resetTransform, button.dataset.resetAxis)
      : resetPlacementTransform(currentPlacement, button.dataset.resetTransform, button.dataset.resetAxis);
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

groupSelectedObjectsButton?.addEventListener('click', () => {
  groupSelectedTargetObjects();
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

newImageTargetButton?.addEventListener('click', () => {
  resetImageTargetEditor();
});

refreshImageTargetsButton?.addEventListener('click', async () => {
  await refreshImageTargets();
});

renderTargetObjectList();
syncTargetAccessInputs();
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
        clearTargetSpecificScan();
        authToken = null;
        clearWorkerAuthToken();
        setAuthUiState({
          status: 'signed-out',
          message: `Your saved session expired. ${loginIntroMessage}`,
        });
      }
    } catch (error) {
      clearTargetSpecificScan();
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

function activateRequestedLocation(location: AppLocation): void {
  const leavingScan = shell.dataset.activePage === 'scan' && location.route !== 'scan';
  activateRequestedRoute(location.route);
  if (location.route === 'scan' && location.scanId) {
    void openTargetSpecificScan(location.scanId);
    return;
  }
  const hadTargetSpecificScan = Boolean(activeScanId);
  clearTargetSpecificScan();
  if (leavingScan && !hadTargetSpecificScan) {
    stopActiveArSession();
    resetScanControls();
  }
}

async function openTargetSpecificScan(scanId: string): Promise<void> {
  const requestVersion = ++scanRequestVersion;
  disposeFocusedFloorPlacement();
  activeScanId = scanId;
  stopActiveArSession();
  focusedScanTarget = undefined;
  startButton.disabled = true;
  startButton.textContent = 'Loading target';
  status.textContent = 'Loading target...';

  try {
    const target = await getImageTargetForScan({
      apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
      scanId,
      authToken,
    });
    if (requestVersion !== scanRequestVersion) {
      return;
    }
    focusedScanTarget = target;
    startButton.textContent = 'Restart camera';
    startButton.disabled = false;
    setFloorPlacementUi({ state: 'preparing', message: 'Preparing floor placement...' });
    void prepareFocusedFloorPlacement(target, requestVersion);
    await startCurrentArSession();
  } catch (error) {
    if (requestVersion !== scanRequestVersion) {
      return;
    }
    startButton.textContent = 'Start camera';
    startButton.disabled = true;
    if (error instanceof ImageTargetRequestError && error.status === 401) {
      authNavigation.rememberHref(hrefForTargetScan(scanId));
      status.textContent = 'Sign in to open this target.';
      setAuthUiState({ ...authUiState, message: 'Sign in to open this target.' });
      if (window.location.hash !== hrefForRoute('account')) {
        window.location.hash = hrefForRoute('account');
      }
      return;
    }
    if (error instanceof ImageTargetRequestError && error.status === 403) {
      status.textContent = "You don't have access to this target.";
      return;
    }
    if (error instanceof ImageTargetRequestError && error.status === 404) {
      status.textContent = 'Target not found.';
      return;
    }
    status.textContent = errorMessage(error, 'Unable to load target.');
  }
}

async function prepareFocusedFloorPlacement(
  target: CloudImageTarget,
  requestVersion: number,
): Promise<void> {
  let preparedController: FloorPlacementController | undefined;
  const isCurrentPreparation = () => (
    requestVersion === scanRequestVersion
    && focusedScanTarget === target
  );
  const isCurrentFloorHook = () => (
    isCurrentPreparation()
    && activeSharedLinkMode === 'floor'
    && preparedController !== undefined
    && floorController === preparedController
    && floorControllerRequestVersion === requestVersion
  );

  try {
    const preparation = await prepareFloorPlacement({
      stage: floorStage,
      overlayRoot: floorOverlay,
      gestureSurface: floorGestureSurface,
      asset: {
        model: target.model,
        placement: target.placement,
        objects: target.objects,
        groups: target.groups,
      },
      hooks: {
        onSessionStart() {
          if (!isCurrentFloorHook()) {
            return;
          }
          setFloorPlacementUi({
            state: 'floor-scanning',
            message: 'Move your phone until the floor ring appears.',
          });
        },
        onSessionEnd() {
          if (!isCurrentFloorHook()) {
            return;
          }
          setFloorPlacementUi({
            state: 'floor-ended',
            message: 'Floor AR ended. Scan the image or place it again.',
          });
        },
        onStatus(message) {
          if (!isCurrentFloorHook()) {
            return;
          }
          applyFocusedFloorStatus(message);
        },
        onPlacementReady(ready) {
          if (!isCurrentFloorHook()) {
            return;
          }
          setFloorPlacementUi(ready
            ? { state: 'floor-ready', message: 'Floor found. Tap Place.' }
            : {
                state: 'floor-scanning',
                message: 'Move your phone until the floor ring appears.',
              });
        },
        onPlaced() {
          if (!isCurrentFloorHook()) {
            return;
          }
          setFloorPlacementUi({
            state: 'floor-placed',
            message: `${target.label} placed on the floor.`,
          });
        },
      },
    });

    if (!preparation.supported) {
      if (isCurrentPreparation()) {
        setFloorPlacementUi({ state: 'unsupported', message: preparation.message });
      }
      return;
    }

    preparedController = preparation.controller;
    if (!isCurrentPreparation()) {
      preparedController.dispose();
      return;
    }

    floorController = preparedController;
    floorControllerRequestVersion = requestVersion;
    floorRotation.value = '0';
    if (activeSharedLinkMode === 'marker') {
      setFloorPlacementUi({ state: 'marker-ready', message: 'Floor placement is ready.' });
    }
  } catch (error) {
    if (!isCurrentPreparation()) {
      return;
    }
    setFloorPlacementUi({
      state: 'unsupported',
      message: errorMessage(error, 'Floor placement is unavailable. Image scanning is still available.'),
    });
  }
}

function applyFocusedFloorStatus(message: string): void {
  if (message === 'Move your phone until the floor ring appears.') {
    setFloorPlacementUi({ state: 'floor-scanning', message });
    return;
  }
  if (message === 'Floor found. Tap Place.') {
    setFloorPlacementUi({ state: 'floor-ready', message });
    return;
  }
  if (message === 'Floor AR ended. Scan the image or place it again.') {
    setFloorPlacementUi({ state: 'floor-ended', message });
    return;
  }
  setFloorPlacementUi({ state: 'floor-error', message });
}

function launchFocusedFloorPlacement(controller: FloorPlacementController): void {
  const requestVersion = floorControllerRequestVersion;
  const launchVersion = ++floorLaunchVersion;
  try {
    const launch = controller.launch();
    void launch.catch((error) => {
      if (
        launchVersion !== floorLaunchVersion
        || activeSharedLinkMode !== 'floor'
        || floorController !== controller
        || requestVersion !== scanRequestVersion
      ) {
        return;
      }
      if (floorUiState.state !== 'floor-error') {
        setFloorPlacementUi({
          state: 'floor-error',
          message: errorMessage(error, 'Floor AR could not start.'),
        });
      }
    });
  } catch (error) {
    if (
      launchVersion === floorLaunchVersion
      && activeSharedLinkMode === 'floor'
      && floorController === controller
      && requestVersion === scanRequestVersion
    ) {
      setFloorPlacementUi({
        state: 'floor-error',
        message: errorMessage(error, 'Floor AR could not start.'),
      });
    }
  }
}

async function returnToFocusedMarkerScan(): Promise<void> {
  const controller = floorController;
  const target = focusedScanTarget;
  const requestVersion = floorControllerRequestVersion;
  if (!controller || !target || requestVersion !== scanRequestVersion) {
    return;
  }

  activeSharedLinkMode = 'marker';
  floorLaunchVersion += 1;
  try {
    await controller.stop();
  } catch {
    // Marker recovery remains available even if the browser already ended floor AR.
  }
  if (
    activeSharedLinkMode !== 'marker'
    || floorController !== controller
    || focusedScanTarget !== target
    || requestVersion !== scanRequestVersion
  ) {
    return;
  }

  setFloorPlacementUi({ state: 'marker-ready', message: 'Floor placement is ready.' });
  await startCurrentArSession();
}

function disposeFocusedFloorPlacement(): void {
  activeSharedLinkMode = 'marker';
  floorLaunchVersion += 1;
  const controller = floorController;
  floorController = undefined;
  floorControllerRequestVersion = 0;
  if (controller) {
    try {
      void controller.stop().catch(() => undefined);
    } catch {
      // Disposal below remains authoritative for synchronous stop failures.
    }
    controller.dispose();
  }
  floorRotation.value = '0';
  setFloorPlacementUi({ state: 'hidden' });
}

function invalidateMarkerStart(): void {
  markerStartVersion += 1;
  markerStartAbort?.abort();
  markerStartAbort = undefined;
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'AbortError';
}

function setFloorPlacementUi(state: FloorPlacementUiState): void {
  floorUiState = state;
  applyFloorPlacementUi(shell, state);
}

function clearTargetSpecificScan(): void {
  if (!activeScanId) {
    return;
  }
  scanRequestVersion += 1;
  activeScanId = undefined;
  focusedScanTarget = undefined;
  disposeFocusedFloorPlacement();
  stopActiveArSession();
  resetScanControls();
}

function stopActiveArSession(): void {
  invalidateMarkerStart();
  session?.stop();
  session = undefined;
  stage.replaceChildren();
}

function resetScanControls(): void {
  startButton.textContent = 'Start camera';
  startButton.disabled = false;
  status.textContent = 'Camera access starts only after you choose Start camera.';
}

function restorePendingProtectedRoute(): void {
  const href = authNavigation.takePendingHref(authUiState);
  if (href) {
    if (window.location.hash === href) {
      activateRequestedLocation(locationFromHash(href));
      return;
    }
    window.location.hash = href;
    return;
  }
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
        if (object.groupId) {
          object.localPlacement = normalizeLocalPlacement(placement);
          object.placement = resolveObjectPlacement(object, targetGroups);
        } else {
          object.placement = placement;
        }
      }
      targetPlacement = placement;
      if (targetSelection.objectIds.length <= 1 || targetSelection.objectIds.includes(objectId)) {
        targetSelection = { objectIds: [objectId] };
        syncTargetPlacementInputs(placement, { local: Boolean(object?.groupId) });
        syncTargetObjectControlsTab({ activateWhenSelected: true });
      }
      renderTargetObjectList();
    },
    onPlacementsChange: (changes) => {
      for (const { objectId, placement } of changes) {
        const object = targetObjects.find((entry) => entry.id === objectId);
        if (!object) {
          continue;
        }
        if (object.groupId) {
          object.localPlacement = normalizeLocalPlacement(placement);
          object.placement = resolveObjectPlacement(object, targetGroups);
        } else {
          object.placement = normalizePlacement(placement);
        }
      }
      targetPlacement = selectionPivotPlacement(targetObjects, targetGroups, targetSelection.objectIds);
      syncTargetPlacementInputs(targetPlacement);
      renderTargetObjectList();
    },
    onGroupPlacementChange: ({ groupId, placement }) => {
      const group = targetGroups.find((candidate) => candidate.id === groupId);
      if (!group) {
        return;
      }
      group.placement = normalizePlacement(placement);
      targetObjects = targetObjects.map((object) => object.groupId === groupId
        ? { ...object, placement: resolveObjectPlacement(object, targetGroups) }
        : object);
      targetPlacement = group.placement;
      syncTargetPlacementInputs(group.placement);
      renderTargetObjectList();
    },
    onCameraChange: (cameraView) => {
      targetCameraView = cameraView;
      syncTargetCameraInputs(cameraView);
    },
    onSelectionChange: (selection) => {
      targetSelection = normalizeTargetEditorSelection(selection, targetObjects, targetGroups);
      syncSelectionToInspector({ activateWhenSelected: targetSelection.objectIds.length > 0 || Boolean(targetSelection.groupId) });
      renderTargetObjectList();
      updateImageTargetStatus(
        targetSelection.objectIds.length > 1
          ? `${targetSelection.objectIds.length} objects selected.`
          : targetSelection.objectIds.length === 1
            ? 'Object selected.'
            : 'No object selected.',
        false,
      );
    },
    onTransformModeChange: (mode) => {
      targetTransformMode = mode;
      syncTargetTransformModeButtons(mode);
    },
  });
  return imageTargetPreview;
}

function readTargetPlacement(): ImageTargetPlacement {
  const placement = {
    scale: Number(targetScaleInput?.value),
    offsetX: Number(targetOffsetXInput?.value),
    offsetY: Number(targetOffsetYInput?.value),
    height: Number(targetHeightInput?.value),
    rotationX: Number(targetRotationXInput?.value),
    rotationY: Number(targetRotationYInput?.value),
    rotationZ: Number(targetRotationZInput?.value),
  };
  return getSelectedTargetObject()?.groupId ? normalizeLocalPlacement(placement) : normalizePlacement(placement);
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
  targetSelection = normalizeTargetEditorSelection(targetSelection, targetObjects, targetGroups);

  const affectedGroupId = removedObject.groupId;
  if (affectedGroupId && targetObjects.filter((object) => object.groupId === affectedGroupId).length < 2) {
    const ungrouped = ungroupTargetEditorGroup({ groupId: affectedGroupId, objects: targetObjects, groups: targetGroups });
    targetObjects = ungrouped.objects;
    targetGroups = ungrouped.groups;
    targetSelection = normalizeTargetEditorSelection(targetSelection, targetObjects, targetGroups);
  }
  if (targetSelection.objectIds.length === 0 && !targetSelection.groupId) {
    const nextObject = targetObjects[Math.min(removeIndex, targetObjects.length - 1)];
    targetSelection = { objectIds: nextObject ? [nextObject.id] : [] };
  }
  syncSelectionToInspector({ activateWhenSelected: targetSelection.objectIds.length > 0 || Boolean(targetSelection.groupId) });
  renderTargetObjectList();
  updateImageTargetStatus(
    targetObjects.length > 0
      ? `${isTextTargetObject(removedObject) ? 'Text' : 'Object'} removed. ${targetObjects.length} object${targetObjects.length === 1 ? '' : 's'} placed.`
      : 'No objects placed yet.',
    false,
  );
  void updateTargetPreview();
}

function selectTargetObject(
  objectId: string,
  options?: { refreshPreview?: boolean; additive?: boolean },
): void {
  const object = targetObjects.find((entry) => entry.id === objectId);
  if (!object) {
    return;
  }

  targetSelection = options?.additive
    ? toggleTargetObjectSelection(targetSelection, object.id)
    : { objectIds: [object.id] };
  targetSelection = normalizeTargetEditorSelection(targetSelection, targetObjects, targetGroups);
  syncSelectionToInspector({ activateWhenSelected: targetSelection.objectIds.length > 0 });
  renderTargetObjectList();
  updateImageTargetStatus(
    targetSelection.objectIds.length > 1
      ? `${targetSelection.objectIds.length} objects selected.`
      : isTextTargetObject(object) ? `${object.text.value} text selected.` : `${object.model.label} selected.`,
    false,
  );
  if (options?.refreshPreview !== false) {
    void updateTargetPreview();
  }
}

function updateSelectedTargetObjectPlacement(placement: ImageTargetPlacement): void {
  const selectedGroup = getSelectedTargetGroup();
  const selectedObjects = getSelectedTargetObjects();
  const activeObject = selectedObjects.at(-1);
  const nextPlacement = activeObject?.groupId && selectedObjects.length === 1
    ? normalizeLocalPlacement(placement)
    : normalizePlacement(placement);

  if (selectedGroup) {
    selectedGroup.placement = nextPlacement;
    targetObjects = targetObjects.map((object) => object.groupId === selectedGroup.id
      ? { ...object, placement: resolveObjectPlacement(object, targetGroups) }
      : object);
  } else if (selectedObjects.length > 1) {
    targetObjects = transformSelectionPlacements({
      objects: targetObjects,
      groups: targetGroups,
      objectIds: targetSelection.objectIds,
      startPivot: targetPlacement,
      endPivot: nextPlacement,
    });
  } else if (activeObject) {
    if (activeObject.groupId) {
      activeObject.localPlacement = nextPlacement;
      activeObject.placement = resolveObjectPlacement(activeObject, targetGroups);
    } else {
      activeObject.placement = nextPlacement;
    }
  }
  targetPlacement = nextPlacement;
  renderTargetObjectList();
}

function updateSelectedTargetObjectAnimation(animation: ImageTargetAnimation): void {
  targetAnimation = normalizeAnimation(animation);
  targetAnimationMixed = false;
  const selectedGroup = getSelectedTargetGroup();
  if (selectedGroup) {
    selectedGroup.animation = cloneTargetAnimation(targetAnimation);
  } else {
    const selectedIds = new Set(targetSelection.objectIds);
    targetObjects = targetObjects.map((object) => selectedIds.has(object.id)
      ? { ...object, animation: cloneTargetAnimation(targetAnimation) }
      : object);
  }
  renderTargetObjectList();
}

function getSelectedTargetObject(): TargetEditorObject | undefined {
  if (targetSelection.objectIds.length !== 1) {
    return undefined;
  }
  return targetObjects.find((object) => object.id === targetSelection.objectIds[0]);
}

function getSelectedTargetObjects(): TargetEditorObject[] {
  return targetSelection.objectIds
    .map((objectId) => targetObjects.find((object) => object.id === objectId))
    .filter((object): object is TargetEditorObject => Boolean(object));
}

function getSelectedTargetGroup(): TargetEditorGroup | undefined {
  return targetGroups.find((group) => group.id === targetSelection.groupId);
}

function syncTargetObjectControlsTab(options?: { activateWhenSelected?: boolean }): void {
  const hasSelection = targetSelection.objectIds.length > 0 || Boolean(getSelectedTargetGroup());
  targetInspectorTabs.setTabEnabled('object-controls', hasSelection);
  targetInspectorTabs.setTabLabel('object-controls', targetControlsTabLabel());

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
    if (groupSelectedObjectsButton) {
      groupSelectedObjectsButton.disabled = true;
    }
    return;
  }

  const rendered = createTargetObjectList({
    objects: targetObjects,
    groups: targetGroups,
    selection: targetSelection,
    onSelectObject: (objectId, additive) => selectTargetObject(objectId, { additive }),
    onSelectGroup: selectTargetGroup,
    onUngroup: ungroupTargetObjects,
    onDeleteObject: removeTargetObjectById,
  });
  targetObjectList.append(...rendered.children);
  if (groupSelectedObjectsButton) {
    const selectedObjects = getSelectedTargetObjects();
    groupSelectedObjectsButton.disabled = selectedObjects.length < 2 || selectedObjects.some((object) => object.groupId);
  }
}

function groupSelectedTargetObjects(): void {
  const selectedObjects = getSelectedTargetObjects();
  if (selectedObjects.length < 2 || selectedObjects.some((object) => object.groupId)) {
    return;
  }
  const nextNumber = targetGroups.length + 1;
  const created = createTargetEditorGroup({
    id: createTargetGroupId(),
    label: `Group ${nextNumber}`,
    objectIds: targetSelection.objectIds,
    objects: targetObjects,
    groups: targetGroups,
  });
  targetObjects = created.objects;
  targetGroups = created.groups;
  targetSelection = { objectIds: [], groupId: created.group.id };
  syncSelectionToInspector({ activateWhenSelected: true });
  renderTargetObjectList();
  updateImageTargetStatus(`${created.group.label} created with ${selectedObjects.length} objects.`, false);
  void updateTargetPreview();
}

function selectTargetGroup(groupId: string): void {
  const group = targetGroups.find((candidate) => candidate.id === groupId);
  if (!group) {
    return;
  }
  targetSelection = { objectIds: [], groupId };
  syncSelectionToInspector({ activateWhenSelected: true });
  renderTargetObjectList();
  updateImageTargetStatus(`${group.label} selected.`, false);
  void updateTargetPreview();
}

function ungroupTargetObjects(groupId: string): void {
  const group = targetGroups.find((candidate) => candidate.id === groupId);
  if (!group) {
    return;
  }
  const memberIds = targetObjects.filter((object) => object.groupId === groupId).map((object) => object.id);
  const ungrouped = ungroupTargetEditorGroup({ groupId, objects: targetObjects, groups: targetGroups });
  targetObjects = ungrouped.objects;
  targetGroups = ungrouped.groups;
  targetSelection = { objectIds: memberIds };
  syncSelectionToInspector({ activateWhenSelected: memberIds.length > 0 });
  renderTargetObjectList();
  updateImageTargetStatus(`${group.label} ungrouped. Individual properties are preserved.`, false);
  void updateTargetPreview();
}

function syncSelectionToInspector(options?: { activateWhenSelected?: boolean }): void {
  const group = getSelectedTargetGroup();
  const selectedObjects = getSelectedTargetObjects();
  const activeObject = selectedObjects.at(-1);
  targetPlacement = group?.placement
    ?? (selectedObjects.length > 1
      ? selectionPivotPlacement(targetObjects, targetGroups, targetSelection.objectIds)
      : activeObject?.localPlacement ?? activeObject?.placement)
    ?? DEFAULT_IMAGE_TARGET_PLACEMENT;

  const animations = group
    ? [group.animation]
    : selectedObjects.map((object) => normalizeAnimation(object.animation ?? DEFAULT_IMAGE_TARGET_ANIMATION));
  targetAnimationMixed = animations.length > 1 && animations.some((animation) => (
    JSON.stringify(animation) !== JSON.stringify(animations[0])
  ));
  targetAnimation = targetAnimationMixed ? DEFAULT_IMAGE_TARGET_ANIMATION : animations[0] ?? DEFAULT_IMAGE_TARGET_ANIMATION;

  if (targetModelSelect) {
    targetModelSelect.value = activeObject && !isTextTargetObject(activeObject) ? activeObject.model.id : '';
  }
  if (activeObject && selectedObjects.length === 1 && isTextTargetObject(activeObject)) {
    syncTargetTextInputs(activeObject.text);
  }
  syncTargetModelRailSelection();
  syncTargetPlacementInputs(targetPlacement, { local: Boolean(activeObject?.groupId && selectedObjects.length === 1) });
  syncTargetAnimationInputs(targetAnimation, { mixed: targetAnimationMixed });
  syncTargetTextAction();
  syncTargetObjectControlsTab({ activateWhenSelected: options?.activateWhenSelected });
}

function targetControlsTabLabel(): string {
  const group = getSelectedTargetGroup();
  if (group) {
    return group.label;
  }
  if (targetSelection.objectIds.length > 1) {
    return `Selection (${targetSelection.objectIds.length})`;
  }
  const object = getSelectedTargetObject();
  if (object?.groupId) {
    const parent = targetGroups.find((candidate) => candidate.id === object.groupId);
    return parent ? `Child of ${parent.label}` : 'Object';
  }
  return 'Object';
}

function cloneTargetAnimation(animation: ImageTargetAnimation): ImageTargetAnimation {
  return normalizeAnimation({ preset: animation.preset, tracks: animation.tracks.map((track) => ({ ...track })) });
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

function createTargetGroupId(): string {
  const cryptoId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `group-${cryptoId}`;
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

function syncTargetPlacementInputs(placement: ImageTargetPlacement, options?: { local?: boolean }): void {
  const normalized = options?.local ? normalizeLocalPlacement(placement) : normalizePlacement(placement);
  if (targetOffsetXInput) {
    targetOffsetXInput.min = options?.local ? '-2' : '-1';
    targetOffsetXInput.max = options?.local ? '2' : '1';
  }
  if (targetOffsetYInput) {
    targetOffsetYInput.min = options?.local ? '-2' : '-1';
    targetOffsetYInput.max = options?.local ? '2' : '1';
  }
  if (targetHeightInput) {
    targetHeightInput.min = options?.local ? '-2' : '0';
    targetHeightInput.max = options?.local ? '2' : '1';
  }
  setRangeInputValue(targetScaleInput, normalized.scale);
  setRangeInputValue(targetOffsetXInput, normalized.offsetX);
  setRangeInputValue(targetOffsetYInput, normalized.offsetY);
  setRangeInputValue(targetHeightInput, normalized.height);
  setRangeInputValue(targetRotationXInput, normalized.rotationX);
  setRangeInputValue(targetRotationYInput, normalized.rotationY);
  setRangeInputValue(targetRotationZInput, normalized.rotationZ);
}

function syncTargetAnimationInputs(animation: ImageTargetAnimation, options?: { mixed?: boolean }): void {
  const normalized = normalizeAnimation(animation);
  if (targetAnimationPresetSelect) {
    targetAnimationPresetSelect.value = options?.mixed ? 'mixed' : normalized.preset;
  }
  animationTrackEditor?.render(options?.mixed ? DEFAULT_IMAGE_TARGET_ANIMATION : normalized);
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
    imageUrl: targetPreviewImageUrl(editingTarget, targetImagePayload),
    objects: targetObjects,
    groups: targetGroups,
    selection: targetSelection,
    selectedObjectId: targetSelection.objectIds.at(-1),
    camera: targetCameraView,
    transformMode: targetTransformMode,
  });
}

async function saveCurrentImageTarget(): Promise<void> {
  if (!authToken) {
    updateImageTargetStatus('Sign in before saving an image target.', true);
    return;
  }
  if (!editingTarget && !targetImagePayload) {
    updateImageTargetStatus('Choose a target image.', true);
    return;
  }

  if (targetImagePayload) {
    const validationError = validateTargetImagePayload(targetImagePayload);
    if (validationError) {
      updateImageTargetStatus(validationError, true);
      return;
    }
  }

  updateSelectedTargetObjectPlacement(readTargetPlacement());
  let objectsToSave = targetObjects;
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
    updateImageTargetStatus('Add at least one model or text object before saving.', true);
    return;
  }

  const objects = objectsToSave.map((object) => ({
    ...object,
    placement: normalizePlacement(object.placement),
    animation: normalizeAnimation(object.animation ?? DEFAULT_IMAGE_TARGET_ANIMATION),
  }));
  const saveableObjectIds = new Set(objects.map((object) => object.id));
  const groups = targetGroups.filter((group) => targetObjects.some((object) => (
    object.groupId === group.id && saveableObjectIds.has(object.id)
  )));
  const access = readTargetAccess();
  const ownerEmail = authUiState.status === 'signed-in' ? authUiState.email : undefined;
  const accessError = validateImageTargetAccess(access, ownerEmail);
  if (accessError) {
    updateImageTargetStatus(accessError, true);
    return;
  }
  const normalizedOwnerEmail = ownerEmail?.trim().toLowerCase();
  const accessToSave = normalizeImageTargetAccess({
    ...access,
    allowedEmails: access.allowedEmails.filter((email) => email !== normalizedOwnerEmail),
  });
  targetAccess = accessToSave;
  syncTargetAccessInputs();
  updateImageTargetStatus('Saving image target...', false);

  try {
    const wasEditing = Boolean(editingTarget);
    const label = targetLabelInput?.value.trim() || 'Image target';
    let savedTarget: CloudImageTarget;
    if (editingTarget) {
      savedTarget = await updateImageTarget({
        apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
        authToken,
        targetId: editingTarget.targetId,
        label,
        objects,
        groups,
        access: accessToSave,
        ...(targetImagePayload ?? {}),
      });
    } else {
      const imagePayload = targetImagePayload;
      if (!imagePayload) {
        return;
      }
      savedTarget = await createImageTarget({
        apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
        authToken,
        label,
        imageBase64: imagePayload.imageBase64,
        imageMimeType: imagePayload.imageMimeType,
        objects,
        groups,
        access: accessToSave,
      });
    }
    const expectedAccess = { ...accessToSave, ...(editingTargetScanId ? { scanId: editingTargetScanId } : {}) };
    const directMismatch = savedTargetAuthoringMismatch(objects, groups, savedTarget, expectedAccess);
    if (directMismatch) {
      throw new Error(`${directMismatch} Your editor changes were kept.`);
    }
    let refreshedTargets: CloudImageTarget[];
    try {
      refreshedTargets = await refreshImageTargets({ rethrowOnError: true, commit: false }) ?? [];
    } catch (error) {
      await loadSavedImageTarget(savedTarget);
      const savedMessage = wasEditing
        ? 'Image target update was saved in Cloudflare'
        : 'Image target was saved in Cloudflare';
      updateImageTargetStatus(
        `${savedMessage}, but the saved-target list could not refresh. ${errorMessage(error, 'Refresh failed.')}`,
        true,
      );
      return;
    }
    const refreshedTarget = refreshedTargets.find((target) => target.id === savedTarget.id);
    if (!refreshedTarget) {
      throw new Error(`The saved-target refresh did not return target ${savedTarget.id}. Your editor changes were kept.`);
    }
    const refreshedMismatch = savedTargetAuthoringMismatch(objects, groups, refreshedTarget, {
      ...accessToSave,
      scanId: savedTarget.scanId,
    });
    if (refreshedMismatch) {
      throw new Error(`${refreshedMismatch} Your editor changes were kept.`);
    }
    cloudImageTargets = refreshedTargets;
    renderSavedImageTargets();
    await loadSavedImageTarget(refreshedTarget);
    updateImageTargetStatus(wasEditing ? 'Image target updated in Cloudflare.' : 'Image target saved to Cloudflare.', false);
  } catch (error) {
    updateImageTargetStatus(errorMessage(error, 'Unable to save image target'), true);
  }
}

function createCurrentDraftTarget(): LocalImageTargetDraft | undefined {
  const imageUrl = targetPreviewImageUrl(editingTarget, targetImagePayload);
  if (!imageUrl || targetObjects.length === 0) {
    return undefined;
  }

  return {
    id: editingTarget?.targetId ?? 'current-target',
    label: targetLabelInput?.value.trim() || 'Current target',
    imageUrl,
    objects: targetObjects,
    groups: targetGroups,
  };
}

async function refreshImageTargets(options?: {
  rethrowOnError?: boolean;
  commit?: boolean;
}): Promise<CloudImageTarget[] | undefined> {
  try {
    const refreshedTargets = await listImageTargets({
      apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
      authToken,
    });
    if (options?.commit !== false) {
      cloudImageTargets = refreshedTargets;
      renderSavedImageTargets();
      updateImageTargetStatus(
        cloudImageTargets.length > 0
          ? `${cloudImageTargets.length} cloud image target${cloudImageTargets.length === 1 ? '' : 's'} loaded.`
          : 'No cloud image targets saved yet.',
        false,
      );
    }
    return refreshedTargets;
  } catch (error) {
    updateImageTargetStatus(errorMessage(error, 'Unable to load image targets'), true);
    if (options?.rethrowOnError) {
      throw error;
    }
    return undefined;
  }
}

function renderSavedImageTargets(): void {
  if (!savedImageTargetList) {
    return;
  }

  renderSavedTargetList(savedImageTargetList, {
    targets: cloudImageTargets,
    activeTargetId: editingTarget?.targetId,
    currentUrl: window.location.href,
    onCopyLink: async (_target, scanUrl) => {
      try {
        if (!navigator.clipboard?.writeText) {
          throw new Error('Clipboard access is unavailable in this browser.');
        }
        await navigator.clipboard.writeText(scanUrl);
        updateImageTargetStatus('Scan link copied.', false);
      } catch (error) {
        updateImageTargetStatus(errorMessage(error, 'Unable to copy scan link'), true);
      }
    },
    onEdit: (target) => {
      void loadSavedImageTarget(target);
    },
    onDelete: async (target) => {
      try {
        await deleteImageTarget({
          apiUrl: DEFAULT_GENERATE_MODEL_API_URL,
          authToken,
          targetId: target.id,
        });
        if (editingTarget?.targetId === target.id) {
          resetImageTargetEditor();
        }
        await refreshImageTargets();
      } catch (error) {
        updateImageTargetStatus(errorMessage(error, 'Unable to delete image target'), true);
      }
    },
  });
}

async function loadSavedImageTarget(target: CloudImageTarget): Promise<void> {
  const session = createEditingTargetSession(target);
  editingTarget = { targetId: session.targetId, imageUrl: session.imageUrl };
  editingTargetScanId = target.scanId;
  targetAccess = normalizeImageTargetAccess({
    accessMode: target.accessMode,
    allowedEmails: target.allowedEmails,
  }, target.visibility);
  targetImagePayload = undefined;
  if (targetImageFile) {
    targetImageFile.value = '';
  }
  if (targetLabelInput) {
    targetLabelInput.value = session.label;
  }
  targetObjects = session.objects;
  targetGroups = session.groups;
  targetSelection = session.selection;
  syncTargetAccessInputs();

  const firstModel = targetObjects.find(isModelTargetObject);
  if (targetModelSelect) {
    targetModelSelect.value = firstModel?.model.id ?? '';
  }
  syncSelectionToInspector();
  renderTargetObjectList();
  syncTargetSaveMode();
  renderSavedImageTargets();
  updateImageTargetStatus(`Editing ${target.label}.`, false);
  await updateTargetPreview();
}

function resetImageTargetEditor(): void {
  editingTarget = undefined;
  editingTargetScanId = undefined;
  targetAccess = { ...DEFAULT_IMAGE_TARGET_ACCESS };
  targetImagePayload = undefined;
  targetObjects = [];
  targetGroups = [];
  targetSelection = { objectIds: [] };
  targetPlacement = { ...DEFAULT_IMAGE_TARGET_PLACEMENT };
  targetAnimation = normalizeAnimation(DEFAULT_IMAGE_TARGET_ANIMATION);
  targetAnimationMixed = false;
  if (targetImageFile) {
    targetImageFile.value = '';
  }
  if (targetLabelInput) {
    targetLabelInput.value = '';
  }
  if (targetModelSelect) {
    targetModelSelect.value = '';
  }
  syncTargetTextInputs(DEFAULT_TARGET_TEXT);
  syncTargetAccessInputs();
  syncSelectionToInspector();
  renderTargetObjectList();
  syncTargetSaveMode();
  renderSavedImageTargets();
  updateImageTargetStatus('New image target ready.', false);
  void updateTargetPreview();
}

function syncTargetSaveMode(): void {
  if (saveImageTargetButton) {
    saveImageTargetButton.textContent = editingTarget ? 'Update target' : 'Save target';
  }
  if (newImageTargetButton) {
    newImageTargetButton.hidden = !editingTarget;
  }
}

function readTargetAccess(): ImageTargetAccess {
  const accessMode = targetAccessModeSelect && isImageTargetAccessMode(targetAccessModeSelect.value)
    ? targetAccessModeSelect.value
    : targetAccess.accessMode;
  return normalizeImageTargetAccess({
    accessMode,
    allowedEmails: parseAllowedEmails(targetAccessEmailsInput?.value ?? ''),
  });
}

function syncTargetAccessInputs(): void {
  if (targetAccessModeSelect) {
    targetAccessModeSelect.value = targetAccess.accessMode;
  }
  if (targetAccessEmailsInput) {
    targetAccessEmailsInput.value = targetAccess.allowedEmails.join('\n');
  }
  if (targetAccessEmailsField) {
    targetAccessEmailsField.hidden = targetAccess.accessMode !== 'specific_accounts';
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

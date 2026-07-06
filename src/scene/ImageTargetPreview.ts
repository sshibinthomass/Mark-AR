import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Material,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CloudflareModelOption } from '../app/cloudflareModels';
import type { CloudImageTargetObject } from '../app/cloudImageTargets';
import type { ImageTargetAnimation } from '../app/imageTargetAnimation';
import { normalizeAnimation } from '../app/imageTargetAnimation';
import type { ImageTargetPlacement } from '../app/imageTargetPayload';
import { normalizePlacement } from '../app/imageTargetPayload';
import {
  cameraViewForOrbit,
  cameraViewForPan,
  cameraViewForPinchZoom,
  cameraViewForPreset,
  cameraViewForZoom,
  DEFAULT_PREVIEW_CAMERA_VIEW,
  type PreviewCameraView,
} from './previewCamera';

export { DEFAULT_PREVIEW_CAMERA_VIEW, type PreviewCameraView } from './previewCamera';

type PreviewRenderer = Pick<WebGLRenderer, 'setPixelRatio' | 'setSize' | 'render' | 'dispose'> & {
  domElement: HTMLCanvasElement;
};

type PointerPoint = {
  x: number;
  y: number;
};

type CameraDragMode = 'orbit' | 'pan' | 'zoom';
export type PreviewTransformMode = 'translate' | 'rotate' | 'scale';

export type PreviewPlacementChange = {
  objectId: string;
  placement: ImageTargetPlacement;
};

type PreviewDeps = {
  createRenderer?: () => PreviewRenderer;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (frameId: number) => void;
  loadTexture?: (url: string) => Promise<Texture | undefined>;
  loadModel?: (url: string) => Promise<Group | undefined>;
  onPlacementChange?: (change: PreviewPlacementChange) => void;
  onCameraChange?: (camera: PreviewCameraView) => void;
  onSelectionChange?: (objectId: string) => void;
  onTransformModeChange?: (mode: PreviewTransformMode) => void;
};

type PreviewState = {
  imageUrl?: string;
  model?: CloudflareModelOption;
  placement?: ImageTargetPlacement;
  objects?: CloudImageTargetObject[];
  selectedObjectId?: string;
  camera?: Partial<PreviewCameraView>;
  transformMode?: PreviewTransformMode;
};

export class ImageTargetPreview {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(45, 1, 0.01, 100);
  private readonly renderer: PreviewRenderer;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (frameId: number) => void;
  private readonly loadTexture: (url: string) => Promise<Texture | undefined>;
  private readonly loadModel: (url: string) => Promise<Group | undefined>;
  private readonly onPlacementChange?: (change: PreviewPlacementChange) => void;
  private readonly onCameraChange?: (camera: PreviewCameraView) => void;
  private readonly onSelectionChange?: (objectId: string) => void;
  private readonly onTransformModeChange?: (mode: PreviewTransformMode) => void;
  private readonly container: HTMLElement;
  private readonly imageRoot = new Group();
  private readonly modelRoot = new Group();
  private readonly grid = new GridHelper(4, 16, 0x747474, 0x5f5f5f);
  private readonly raycaster = new Raycaster();
  private readonly pointerNdc = new Vector2();
  private readonly transformControls: TransformControls;
  private readonly activePointers = new Map<number, PointerPoint>();
  private readonly loadedModels = new Map<string, Group>();
  private readonly placements = new Map<string, ImageTargetPlacement>();
  private readonly animations = new Map<string, ImageTargetAnimation>();
  private readonly pointerObjectHits = new Map<number, string>();
  private frameId = 0;
  private disposed = false;
  private updateToken = 0;
  private elapsedSeconds = 0;
  private lastFrameTimestamp: number | undefined;
  private cameraView = DEFAULT_PREVIEW_CAMERA_VIEW;
  private selectedObjectId?: string;
  private previewTransformMode: PreviewTransformMode = 'translate';
  private dragStart?: { pointer: PointerPoint; objectId: string; placement: ImageTargetPlacement };
  private rotateDragStart?: { pointer: PointerPoint; objectId: string; placement: ImageTargetPlacement };
  private pinchStart?: { distance: number; objectId: string; placement: ImageTargetPlacement };
  private scaleDragStart?: { pointer: PointerPoint; objectId: string; placement: ImageTargetPlacement };
  private cameraDragStart?: { pointer: PointerPoint; view: PreviewCameraView; mode: CameraDragMode };
  private cameraPinchStart?: { distance: number; centroid: PointerPoint; view: PreviewCameraView };
  private transformControlDragging = false;

  constructor(container: HTMLElement, deps: PreviewDeps = {}) {
    this.container = container;
    this.renderer = deps.createRenderer?.() ?? new WebGLRenderer({ antialias: true, alpha: true });
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.requestFrame = deps.requestFrame ?? window.requestAnimationFrame.bind(window);
    this.cancelFrame = deps.cancelFrame ?? window.cancelAnimationFrame.bind(window);
    this.loadTexture = deps.loadTexture ?? defaultLoadTexture;
    this.loadModel = deps.loadModel ?? defaultLoadModel;
    this.onPlacementChange = deps.onPlacementChange;
    this.onCameraChange = deps.onCameraChange;
    this.onSelectionChange = deps.onSelectionChange;
    this.onTransformModeChange = deps.onTransformModeChange;

    this.applyCameraView();
    this.scene.background = new Color(0x6b6b6b);
    this.scene.add(new AmbientLight(0xffffff, 1.6));

    const keyLight = new DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(1, 2, 2);
    this.transformControls.visible = false;
    this.transformControls.setMode(this.previewTransformMode);
    this.transformControls.addEventListener('objectChange', this.handleTransformControlObjectChange);
    this.transformControls.addEventListener('dragging-changed', this.handleTransformControlDraggingChanged);
    this.scene.add(keyLight, this.grid, this.imageRoot, this.modelRoot, this.transformControls);

    this.container.append(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.cursor = 'grab';
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute('aria-keyshortcuts', '1 3 7 0 F W E R G S Escape');
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown, true);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove, true);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerEnd, true);
    this.renderer.domElement.addEventListener('pointercancel', this.handlePointerEnd, true);
    this.renderer.domElement.addEventListener('wheel', this.handleWheel, { passive: false });
    this.renderer.domElement.addEventListener('keydown', this.handleKeyDown);
    this.renderer.domElement.addEventListener('contextmenu', this.handleContextMenu);
    this.resize();
    this.render = this.render.bind(this);
    this.frameId = this.requestFrame(this.render);
  }

  async update(state: PreviewState): Promise<void> {
    if (this.disposed) {
      return;
    }

    const updateToken = ++this.updateToken;
    const previewObjects = previewObjectsFromState(state);
    this.cameraView = normalizeCameraView(state.camera);
    this.setPreviewTransformMode(state.transformMode ?? this.previewTransformMode, false);
    this.applyCameraView();
    this.transformControls.detach();
    this.transformControls.visible = false;
    this.clearGroup(this.imageRoot);
    this.clearGroup(this.modelRoot);
    this.loadedModels.clear();
    this.placements.clear();
    this.animations.clear();
    this.pointerObjectHits.clear();
    this.activePointers.clear();
    this.dragStart = undefined;
    this.rotateDragStart = undefined;
    this.pinchStart = undefined;
    this.scaleDragStart = undefined;
    this.cameraDragStart = undefined;
    this.cameraPinchStart = undefined;
    this.selectedObjectId = selectPreviewObjectId(previewObjects, state.selectedObjectId);

    for (const object of previewObjects) {
      this.placements.set(object.id, normalizePlacement(object.placement));
      this.animations.set(object.id, normalizeAnimation(object.animation));
    }

    if (state.imageUrl) {
      const texture = await this.loadTexture(state.imageUrl);
      if (this.disposed || updateToken !== this.updateToken) {
        texture?.dispose();
        return;
      }
      const material = new MeshBasicMaterial({ map: texture });
      const plane = new Mesh(new PlaneGeometry(1, 0.7), material);
      plane.rotation.x = -Math.PI / 2;
      this.imageRoot.add(plane);
    }

    for (const object of previewObjects) {
      const model = await this.loadModel(object.model.url);
      if (this.disposed || updateToken !== this.updateToken || !model) {
        if (model) {
          disposeObject3D(model);
        }
        if (this.disposed || updateToken !== this.updateToken) {
          return;
        }
        continue;
      }
      this.loadedModels.set(object.id, model);
      this.applyPlacementToObject(object.id);
      this.modelRoot.add(model);
    }
    this.attachTransformControls();
  }

  setTransformMode(mode: PreviewTransformMode): void {
    if (this.disposed) {
      return;
    }
    this.setPreviewTransformMode(mode);
  }

  dispose(): void {
    this.disposed = true;
    if (this.frameId) {
      this.cancelFrame(this.frameId);
    }
    this.clearGroup(this.imageRoot);
    this.clearGroup(this.modelRoot);
    this.loadedModels.clear();
    this.placements.clear();
    this.animations.clear();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown, true);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove, true);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerEnd, true);
    this.renderer.domElement.removeEventListener('pointercancel', this.handlePointerEnd, true);
    this.renderer.domElement.removeEventListener('wheel', this.handleWheel);
    this.renderer.domElement.removeEventListener('keydown', this.handleKeyDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.handleContextMenu);
    this.transformControls.detach();
    this.transformControls.removeEventListener('objectChange', this.handleTransformControlObjectChange);
    this.transformControls.removeEventListener('dragging-changed', this.handleTransformControlDraggingChanged);
    this.transformControls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize(): void {
    const width = Math.max(320, this.container.clientWidth || 320);
    const height = Math.max(280, this.container.clientHeight || 360);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
  }

  private render(timestamp = 0): void {
    if (this.disposed) {
      return;
    }
    const deltaSeconds = this.frameDeltaSeconds(timestamp);
    this.elapsedSeconds += deltaSeconds;
    this.applyObjectAnimations(deltaSeconds);
    this.renderer.render(this.scene, this.camera);
    this.frameId = this.requestFrame(this.render);
  }

  private clearGroup(group: Group): void {
    for (const child of [...group.children]) {
      disposeObject3D(child);
      group.remove(child);
    }
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!isSupportedPointerButton(event)) {
      return;
    }
    if (!event.altKey && (this.transformControls.axis || this.transformControlDragging)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    this.renderer.domElement.focus();
    this.updateCanvasCursor(true);
    safeSetPointerCapture(this.renderer.domElement, event.pointerId);
    const pointer = pointerFromEvent(event);
    const cameraDragMode = cameraDragModeFromEvent(event);
    const shouldPickObject = !event.altKey && cameraDragMode === 'orbit';
    const pickedObjectId = shouldPickObject ? this.pickObjectIdAtPointer(pointer) : undefined;
    if (pickedObjectId) {
      this.pointerObjectHits.set(event.pointerId, pickedObjectId);
      this.selectObject(pickedObjectId, true);
    }
    this.activePointers.set(event.pointerId, pointer);
    if (this.activePointers.size >= 2) {
      this.startTwoPointerGesture(event);
      return;
    }

    if (this.shouldStartObjectTransform(event, pickedObjectId)) {
      if (this.previewTransformMode === 'scale') {
        this.startScaleDragGesture(pointer);
      } else if (this.previewTransformMode === 'rotate') {
        this.startRotateDragGesture(pointer);
      } else {
        this.startDragGesture(pointer);
      }
      return;
    }

    this.startCameraDragGesture(pointer, cameraDragMode);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.activePointers.has(event.pointerId)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    const pointer = pointerFromEvent(event);
    this.activePointers.set(event.pointerId, pointer);

    if (this.activePointers.size >= 2) {
      if (this.pinchStart) {
        const distance = pinchDistance([...this.activePointers.values()]);
        if (distance > 0 && this.pinchStart.distance > 0) {
          this.updatePlacement(this.pinchStart.objectId, {
            ...this.pinchStart.placement,
            scale: this.pinchStart.placement.scale * (distance / this.pinchStart.distance),
          });
        }
        return;
      }

      if (this.cameraPinchStart) {
        const points = [...this.activePointers.values()];
        const distance = pinchDistance(points);
        const centroid = pointerCentroid(points);
        const zoomedView = cameraViewForPinchZoom(this.cameraPinchStart.view, {
          startDistance: this.cameraPinchStart.distance,
          currentDistance: distance,
        });
        this.updateCameraView(
          cameraViewForPan(zoomedView, {
            deltaX: centroid.x - this.cameraPinchStart.centroid.x,
            deltaY: centroid.y - this.cameraPinchStart.centroid.y,
            ...this.previewViewportSize(),
          }),
        );
      }
      return;
    }

    if (this.cameraDragStart) {
      const movement = {
        deltaX: pointer.x - this.cameraDragStart.pointer.x,
        deltaY: pointer.y - this.cameraDragStart.pointer.y,
      };
      if (this.cameraDragStart.mode === 'pan') {
        this.updateCameraView(
          cameraViewForPan(this.cameraDragStart.view, {
            ...movement,
            ...this.previewViewportSize(),
          }),
        );
      } else if (this.cameraDragStart.mode === 'zoom') {
        this.updateCameraView(cameraViewForZoom(this.cameraDragStart.view, { deltaY: movement.deltaY }));
      } else {
        this.updateCameraView(cameraViewForOrbit(this.cameraDragStart.view, movement));
      }
      return;
    }

    if (this.rotateDragStart) {
      this.updatePlacement(this.rotateDragStart.objectId, {
        ...this.rotateDragStart.placement,
        rotationX: this.rotateDragStart.placement.rotationX + (pointer.y - this.rotateDragStart.pointer.y) * 0.45,
        rotationY: this.rotateDragStart.placement.rotationY + (pointer.x - this.rotateDragStart.pointer.x) * 0.45,
      });
      return;
    }

    if (this.scaleDragStart) {
      this.updatePlacement(this.scaleDragStart.objectId, {
        ...this.scaleDragStart.placement,
        scale: this.scaleDragStart.placement.scale * Math.exp((this.scaleDragStart.pointer.y - pointer.y) * 0.01),
      });
      return;
    }

    if (!this.dragStart) {
      return;
    }

    const { viewportWidth: width, viewportHeight: height } = this.previewViewportSize();
    const nextPlacement = normalizePlacement({
      ...this.dragStart.placement,
      offsetX: this.dragStart.placement.offsetX + ((pointer.x - this.dragStart.pointer.x) / width) * 2,
      offsetY: this.dragStart.placement.offsetY + ((pointer.y - this.dragStart.pointer.y) / height) * 2,
    });
    this.updatePlacement(this.dragStart.objectId, nextPlacement);
  };

  private readonly handlePointerEnd = (event: PointerEvent): void => {
    if (this.activePointers.has(event.pointerId)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    this.activePointers.delete(event.pointerId);
    this.pointerObjectHits.delete(event.pointerId);
    this.dragStart = undefined;
    this.rotateDragStart = undefined;
    this.pinchStart = undefined;
    this.scaleDragStart = undefined;
    this.cameraDragStart = undefined;
    this.cameraPinchStart = undefined;
    safeReleasePointerCapture(this.renderer.domElement, event.pointerId);
    if (this.activePointers.size >= 2) {
      this.startCameraPinchGesture();
      return;
    }
    if (this.activePointers.size === 1) {
      const pointer = [...this.activePointers.values()][0];
      if (this.previewTransformMode === 'translate') {
        this.startDragGesture(pointer);
      } else if (this.previewTransformMode === 'rotate') {
        this.startRotateDragGesture(pointer);
      } else if (this.previewTransformMode === 'scale') {
        this.startScaleDragGesture(pointer);
      } else {
        this.startCameraDragGesture(pointer, 'orbit');
      }
      return;
    }
    if (this.activePointers.size === 0) {
      this.updateCanvasCursor(false);
    }
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.updateCameraView(cameraViewForZoom(this.cameraView, { deltaY: event.deltaY }));
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if ((key === 'w' || key === 'g') && this.selectedLoadedModel()) {
      this.setPreviewTransformMode('translate');
      event.preventDefault();
      return;
    }
    if (key === 'e' && this.selectedLoadedModel()) {
      this.setPreviewTransformMode('rotate');
      event.preventDefault();
      return;
    }
    if ((key === 'r' || key === 's') && this.selectedLoadedModel()) {
      this.setPreviewTransformMode('scale');
      event.preventDefault();
      return;
    }
    if (key === 'escape' || key === 'enter') {
      this.setPreviewTransformMode('translate');
      this.dragStart = undefined;
      this.rotateDragStart = undefined;
      this.pinchStart = undefined;
      this.scaleDragStart = undefined;
      this.updateCanvasCursor(false);
      event.preventDefault();
      return;
    }

    const preset = key === '1'
      ? 'front'
      : key === '3'
        ? 'right'
        : key === '7'
          ? 'top'
          : key === '0' || key === 'f'
            ? 'home'
            : undefined;
    if (preset) {
      this.updateCameraView(cameraViewForPreset(preset));
      event.preventDefault();
    }
  };

  private readonly handleTransformControlObjectChange = (): void => {
    const objectId = this.selectedObjectId;
    const selectedModel = this.selectedLoadedModel();
    if (!objectId || !selectedModel) {
      return;
    }

    this.updatePlacement(objectId, placementFromObject(selectedModel));
  };

  private readonly handleTransformControlDraggingChanged = (event: unknown): void => {
    this.transformControlDragging = Boolean((event as { value?: boolean }).value);
    this.updateCanvasCursor(this.transformControlDragging);
  };

  private readonly handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private startDragGesture(pointer: PointerPoint): void {
    const selected = this.selectedPlacement();
    if (!selected) {
      return;
    }

    this.dragStart = {
      pointer,
      objectId: selected.objectId,
      placement: { ...selected.placement },
    };
    this.pinchStart = undefined;
    this.rotateDragStart = undefined;
    this.scaleDragStart = undefined;
    this.cameraDragStart = undefined;
    this.cameraPinchStart = undefined;
  }

  private startPinchGesture(): void {
    const selected = this.selectedPlacement();
    if (!selected) {
      return;
    }

    this.dragStart = undefined;
    this.rotateDragStart = undefined;
    this.scaleDragStart = undefined;
    this.cameraDragStart = undefined;
    this.cameraPinchStart = undefined;
    this.pinchStart = {
      distance: pinchDistance([...this.activePointers.values()]),
      objectId: selected.objectId,
      placement: { ...selected.placement },
    };
  }

  private startScaleDragGesture(pointer: PointerPoint): void {
    const selected = this.selectedPlacement();
    if (!selected) {
      return;
    }

    this.dragStart = undefined;
    this.pinchStart = undefined;
    this.rotateDragStart = undefined;
    this.cameraDragStart = undefined;
    this.cameraPinchStart = undefined;
    this.scaleDragStart = {
      pointer,
      objectId: selected.objectId,
      placement: { ...selected.placement },
    };
  }

  private startRotateDragGesture(pointer: PointerPoint): void {
    const selected = this.selectedPlacement();
    if (!selected) {
      return;
    }

    this.dragStart = undefined;
    this.pinchStart = undefined;
    this.scaleDragStart = undefined;
    this.cameraDragStart = undefined;
    this.cameraPinchStart = undefined;
    this.rotateDragStart = {
      pointer,
      objectId: selected.objectId,
      placement: { ...selected.placement },
    };
  }

  private startCameraDragGesture(pointer: PointerPoint, mode: CameraDragMode): void {
    this.dragStart = undefined;
    this.pinchStart = undefined;
    this.rotateDragStart = undefined;
    this.scaleDragStart = undefined;
    this.cameraPinchStart = undefined;
    this.cameraDragStart = {
      pointer,
      mode,
      view: { ...this.cameraView },
    };
  }

  private startTwoPointerGesture(event: PointerEvent): void {
    if ((event.altKey || this.previewTransformMode === 'scale') && this.selectedLoadedModel()) {
      this.startPinchGesture();
      return;
    }

    this.startCameraPinchGesture();
  }

  private startCameraPinchGesture(): void {
    const points = [...this.activePointers.values()];
    this.dragStart = undefined;
    this.pinchStart = undefined;
    this.rotateDragStart = undefined;
    this.scaleDragStart = undefined;
    this.cameraDragStart = undefined;
    this.cameraPinchStart = {
      distance: pinchDistance(points),
      centroid: pointerCentroid(points),
      view: { ...this.cameraView },
    };
  }

  private shouldStartObjectTransform(event: PointerEvent, pickedObjectId?: string): boolean {
    return Boolean(
      this.selectedLoadedModel() &&
        (event.altKey || (pickedObjectId && pickedObjectId === this.selectedObjectId)),
    );
  }

  private updatePlacement(objectId: string, placement: ImageTargetPlacement): void {
    const nextPlacement = normalizePlacement(placement);
    this.placements.set(objectId, nextPlacement);
    this.applyPlacementToObject(objectId);
    this.onPlacementChange?.({ objectId, placement: { ...nextPlacement } });
  }

  private applyPlacementToObject(objectId: string): void {
    const loadedModel = this.loadedModels.get(objectId);
    const placement = this.placements.get(objectId);
    if (!loadedModel || !placement) {
      return;
    }

    loadedModel.position.set(placement.offsetX, placement.height, placement.offsetY);
    loadedModel.scale.setScalar(placement.scale);
    loadedModel.rotation.set(
      degreesToRadians(placement.rotationX),
      degreesToRadians(placement.rotationY),
      degreesToRadians(placement.rotationZ),
    );
  }

  private applyObjectAnimations(deltaSeconds: number): void {
    for (const [objectId, loadedModel] of this.loadedModels) {
      const animation = this.animations.get(objectId);
      const placement = this.placements.get(objectId);
      if (!animation || !placement) {
        continue;
      }

      if (animation.spinAxis !== 'none' && animation.spinSpeed !== 0) {
        loadedModel.rotation[animation.spinAxis] += animation.spinSpeed * deltaSeconds;
      }
      loadedModel.position.y =
        placement.height + Math.sin(this.elapsedSeconds * animation.bobSpeed) * animation.bobHeight;
    }
  }

  private frameDeltaSeconds(timestamp: number): number {
    if (this.lastFrameTimestamp === undefined) {
      this.lastFrameTimestamp = timestamp;
      return 0;
    }

    const deltaSeconds = Math.max(0, (timestamp - this.lastFrameTimestamp) / 1000);
    this.lastFrameTimestamp = timestamp;
    return Math.min(deltaSeconds, 1);
  }

  private applyCameraView(): void {
    const yawRadians = (this.cameraView.yawDegrees * Math.PI) / 180;
    this.camera.position.set(
      this.cameraView.targetX + Math.sin(yawRadians) * this.cameraView.distance,
      this.cameraView.height,
      this.cameraView.targetZ + Math.cos(yawRadians) * this.cameraView.distance,
    );
    this.camera.lookAt(this.cameraView.targetX, this.cameraView.targetHeight, this.cameraView.targetZ);
  }

  private updateCameraView(cameraView: PreviewCameraView): void {
    this.cameraView = normalizeCameraView(cameraView);
    this.applyCameraView();
    this.onCameraChange?.({ ...this.cameraView });
  }

  private previewViewportSize(): { viewportWidth: number; viewportHeight: number } {
    return {
      viewportWidth: Math.max(1, this.container.clientWidth || this.renderer.domElement.clientWidth || 1),
      viewportHeight: Math.max(1, this.container.clientHeight || this.renderer.domElement.clientHeight || 1),
    };
  }

  private updateCanvasCursor(isDragging: boolean): void {
    if (isDragging) {
      this.renderer.domElement.style.cursor = 'grabbing';
      return;
    }

    if (this.previewTransformMode === 'translate') {
      this.renderer.domElement.style.cursor = 'move';
      return;
    }

    if (this.previewTransformMode === 'rotate') {
      this.renderer.domElement.style.cursor = 'grab';
      return;
    }

    if (this.previewTransformMode === 'scale') {
      this.renderer.domElement.style.cursor = 'ns-resize';
      return;
    }

    this.renderer.domElement.style.cursor = 'grab';
  }

  private setPreviewTransformMode(mode: PreviewTransformMode, emitChange = true): void {
    this.previewTransformMode = mode;
    this.transformControls.setMode(mode);
    this.updateCanvasCursor(false);
    if (emitChange) {
      this.onTransformModeChange?.(mode);
    }
  }

  private selectObject(objectId: string, emitChange: boolean): void {
    if (this.selectedObjectId === objectId) {
      this.attachTransformControls();
      if (emitChange) {
        this.onSelectionChange?.(objectId);
      }
      return;
    }

    this.selectedObjectId = objectId;
    this.attachTransformControls();
    if (emitChange) {
      this.onSelectionChange?.(objectId);
    }
  }

  private attachTransformControls(): void {
    const selectedModel = this.selectedLoadedModel();
    if (!selectedModel) {
      this.transformControls.detach();
      this.transformControls.visible = false;
      return;
    }

    this.transformControls.attach(selectedModel);
    this.transformControls.setMode(this.previewTransformMode);
    this.transformControls.visible = true;
  }

  private pickObjectIdAtPointer(pointer: PointerPoint): string | undefined {
    const models = [...this.loadedModels.values()];
    if (models.length === 0) {
      return undefined;
    }

    this.pointerNdc.copy(pointerToNdc(pointer, this.renderer.domElement, this.container));
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const intersections = this.raycaster.intersectObjects(models, true);
    const hit = intersections[0]?.object;
    if (!hit) {
      return undefined;
    }

    for (const [objectId, model] of this.loadedModels) {
      if (model === hit || model.children.includes(hit) || isObjectDescendantOf(hit, model)) {
        return objectId;
      }
    }

    return undefined;
  }

  private selectedLoadedModel(): Group | undefined {
    return this.selectedObjectId ? this.loadedModels.get(this.selectedObjectId) : undefined;
  }

  private selectedPlacement(): { objectId: string; placement: ImageTargetPlacement } | undefined {
    const objectId = this.selectedObjectId;
    if (!objectId) {
      return undefined;
    }

    const placement = this.placements.get(objectId);
    return placement ? { objectId, placement } : undefined;
  }
}

function previewObjectsFromState(state: PreviewState): CloudImageTargetObject[] {
  if (state.objects?.length) {
    return state.objects.map((object, index) => ({
      ...object,
      id: object.id || `object-${index + 1}`,
      placement: normalizePlacement(object.placement),
    }));
  }

  if (!state.model) {
    return [];
  }

  return [
    {
      id: 'object-1',
      model: state.model,
      placement: normalizePlacement(state.placement),
    },
  ];
}

function selectPreviewObjectId(objects: CloudImageTargetObject[], requestedId?: string): string | undefined {
  if (requestedId && objects.some((object) => object.id === requestedId)) {
    return requestedId;
  }

  return objects[0]?.id;
}

function normalizeCameraView(value: Partial<PreviewCameraView> | undefined): PreviewCameraView {
  return {
    distance: clampNumber(value?.distance, 0.8, 5, DEFAULT_PREVIEW_CAMERA_VIEW.distance),
    height: clampNumber(value?.height, 0.1, 3, DEFAULT_PREVIEW_CAMERA_VIEW.height),
    yawDegrees: clampNumber(value?.yawDegrees, -180, 180, DEFAULT_PREVIEW_CAMERA_VIEW.yawDegrees),
    targetX: clampNumber(value?.targetX, -2, 2, DEFAULT_PREVIEW_CAMERA_VIEW.targetX),
    targetHeight: clampNumber(value?.targetHeight, -0.5, 1.5, DEFAULT_PREVIEW_CAMERA_VIEW.targetHeight),
    targetZ: clampNumber(value?.targetZ, -2, 2, DEFAULT_PREVIEW_CAMERA_VIEW.targetZ),
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numberValue));
}

function pointerFromEvent(event: PointerEvent): PointerPoint {
  return {
    x: event.clientX,
    y: event.clientY,
  };
}

function pointerCentroid(points: PointerPoint[]): PointerPoint {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }),
    { x: 0, y: 0 },
  );
  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

function pinchDistance(points: PointerPoint[]): number {
  if (points.length < 2) {
    return 0;
  }

  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function isSupportedPointerButton(event: PointerEvent): boolean {
  return event.pointerType === 'touch' || event.button === 0 || event.button === 1 || event.button === 2;
}

function cameraDragModeFromEvent(event: PointerEvent): CameraDragMode {
  if (event.shiftKey || event.button === 2) {
    return 'pan';
  }
  if (event.ctrlKey || event.metaKey) {
    return 'zoom';
  }
  return 'orbit';
}

function pointerToNdc(pointer: PointerPoint, canvas: HTMLCanvasElement, container: HTMLElement): Vector2 {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || container.clientWidth || canvas.clientWidth || 1;
  const height = rect.height || container.clientHeight || canvas.clientHeight || 1;
  const left = rect.width ? rect.left : 0;
  const top = rect.height ? rect.top : 0;
  return new Vector2(((pointer.x - left) / width) * 2 - 1, -(((pointer.y - top) / height) * 2 - 1));
}

function isObjectDescendantOf(object: Object3D, parent: Object3D): boolean {
  let cursor: Object3D | null = object;
  while (cursor) {
    if (cursor === parent) {
      return true;
    }
    cursor = cursor.parent;
  }
  return false;
}

function placementFromObject(object: Object3D): ImageTargetPlacement {
  return normalizePlacement({
    scale: (object.scale.x + object.scale.y + object.scale.z) / 3,
    offsetX: object.position.x,
    offsetY: object.position.z,
    height: object.position.y,
    rotationX: radiansToDegrees(object.rotation.x),
    rotationY: radiansToDegrees(object.rotation.y),
    rotationZ: radiansToDegrees(object.rotation.z),
  });
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function safeSetPointerCapture(element: HTMLElement, pointerId: number): void {
  try {
    element.setPointerCapture?.(pointerId);
  } catch {
    // Synthetic pointer events and some browser edge cases do not have an active pointer to capture.
  }
}

function safeReleasePointerCapture(element: HTMLElement, pointerId: number): void {
  try {
    element.releasePointerCapture?.(pointerId);
  } catch {
    // Capture may not have succeeded, so release should be best effort.
  }
}

function defaultLoadTexture(url: string): Promise<Texture> {
  return new TextureLoader().loadAsync(url);
}

async function defaultLoadModel(url: string): Promise<Group> {
  const gltf = await new GLTFLoader().loadAsync(url);
  return createNormalizedModelGroup(gltf.scene);
}

function createNormalizedModelGroup(scene: Group): Group {
  const wrapper = new Group();
  wrapper.name = 'image-target-preview-model';

  const bounds = new Box3().setFromObject(scene);
  const size = bounds.getSize(new Vector3());
  const largestDimension = Math.max(size.x, size.y, size.z);
  if (Number.isFinite(largestDimension) && largestDimension > 0) {
    scene.scale.setScalar(0.36 / largestDimension);
  }

  const scaledBounds = new Box3().setFromObject(scene);
  const center = scaledBounds.getCenter(new Vector3());
  scene.position.set(-center.x, -scaledBounds.min.y, -center.z);
  wrapper.add(scene);
  return wrapper;
}

function disposeObject3D(object: Object3D): void {
  object.traverse((node) => {
    const mesh = node as Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    disposeMaterial(mesh.material);
  });
}

function disposeMaterial(material: Material | Material[] | undefined): void {
  if (!material) {
    return;
  }

  for (const entry of Array.isArray(material) ? material : [material]) {
    for (const value of Object.values(entry)) {
      if (isDisposableTexture(value)) {
        value.dispose();
      }
    }
    entry.dispose();
  }
}

function isDisposableTexture(value: unknown): value is Texture {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'isTexture' in value &&
    (value as { isTexture?: boolean }).isTexture &&
    'dispose' in value &&
    typeof (value as { dispose?: unknown }).dispose === 'function',
  );
}

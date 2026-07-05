import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Material,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Texture,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CloudflareModelOption } from '../app/cloudflareModels';
import type { CloudImageTargetObject } from '../app/cloudImageTargets';
import type { ImageTargetAnimation } from '../app/imageTargetAnimation';
import { normalizeAnimation } from '../app/imageTargetAnimation';
import type { ImageTargetPlacement } from '../app/imageTargetPayload';
import { normalizePlacement } from '../app/imageTargetPayload';
import { DEFAULT_PREVIEW_CAMERA_VIEW, type PreviewCameraView } from './previewCamera';

export { DEFAULT_PREVIEW_CAMERA_VIEW, type PreviewCameraView } from './previewCamera';

type PreviewRenderer = Pick<WebGLRenderer, 'setPixelRatio' | 'setSize' | 'render' | 'dispose'> & {
  domElement: HTMLCanvasElement;
};

type PointerPoint = {
  x: number;
  y: number;
};

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
};

type PreviewState = {
  imageUrl?: string;
  model?: CloudflareModelOption;
  placement?: ImageTargetPlacement;
  objects?: CloudImageTargetObject[];
  selectedObjectId?: string;
  camera?: Partial<PreviewCameraView>;
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
  private readonly container: HTMLElement;
  private readonly imageRoot = new Group();
  private readonly modelRoot = new Group();
  private readonly activePointers = new Map<number, PointerPoint>();
  private readonly loadedModels = new Map<string, Group>();
  private readonly placements = new Map<string, ImageTargetPlacement>();
  private readonly animations = new Map<string, ImageTargetAnimation>();
  private frameId = 0;
  private disposed = false;
  private updateToken = 0;
  private elapsedSeconds = 0;
  private lastFrameTimestamp: number | undefined;
  private cameraView = DEFAULT_PREVIEW_CAMERA_VIEW;
  private selectedObjectId?: string;
  private dragStart?: { pointer: PointerPoint; objectId: string; placement: ImageTargetPlacement };
  private pinchStart?: { distance: number; objectId: string; placement: ImageTargetPlacement };

  constructor(container: HTMLElement, deps: PreviewDeps = {}) {
    this.container = container;
    this.renderer = deps.createRenderer?.() ?? new WebGLRenderer({ antialias: true, alpha: true });
    this.requestFrame = deps.requestFrame ?? window.requestAnimationFrame.bind(window);
    this.cancelFrame = deps.cancelFrame ?? window.cancelAnimationFrame.bind(window);
    this.loadTexture = deps.loadTexture ?? defaultLoadTexture;
    this.loadModel = deps.loadModel ?? defaultLoadModel;
    this.onPlacementChange = deps.onPlacementChange;

    this.applyCameraView();
    this.scene.add(new AmbientLight(0xffffff, 1.6));

    const keyLight = new DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(1, 2, 2);
    this.scene.add(keyLight, this.imageRoot, this.modelRoot);

    this.container.append(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.cursor = 'grab';
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerEnd);
    this.renderer.domElement.addEventListener('pointercancel', this.handlePointerEnd);
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
    this.applyCameraView();
    this.clearGroup(this.imageRoot);
    this.clearGroup(this.modelRoot);
    this.loadedModels.clear();
    this.placements.clear();
    this.animations.clear();
    this.activePointers.clear();
    this.dragStart = undefined;
    this.pinchStart = undefined;
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
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerEnd);
    this.renderer.domElement.removeEventListener('pointercancel', this.handlePointerEnd);
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
    if (!this.selectedLoadedModel()) {
      return;
    }

    event.preventDefault();
    this.renderer.domElement.style.cursor = 'grabbing';
    safeSetPointerCapture(this.renderer.domElement, event.pointerId);
    const pointer = pointerFromEvent(event);
    this.activePointers.set(event.pointerId, pointer);
    if (this.activePointers.size >= 2) {
      this.startPinchGesture();
      return;
    }
    this.startDragGesture(pointer);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.selectedLoadedModel() || !this.activePointers.has(event.pointerId)) {
      return;
    }

    event.preventDefault();
    const pointer = pointerFromEvent(event);
    this.activePointers.set(event.pointerId, pointer);

    if (this.activePointers.size >= 2 && this.pinchStart) {
      const distance = pinchDistance([...this.activePointers.values()]);
      if (distance > 0 && this.pinchStart.distance > 0) {
        this.updatePlacement(this.pinchStart.objectId, {
          ...this.pinchStart.placement,
          scale: this.pinchStart.placement.scale * (distance / this.pinchStart.distance),
        });
      }
      return;
    }

    if (!this.dragStart) {
      return;
    }

    const width = Math.max(1, this.container.clientWidth || this.renderer.domElement.clientWidth || 1);
    const height = Math.max(1, this.container.clientHeight || this.renderer.domElement.clientHeight || 1);
    const nextPlacement = normalizePlacement({
      ...this.dragStart.placement,
      offsetX: this.dragStart.placement.offsetX + ((pointer.x - this.dragStart.pointer.x) / width) * 2,
      offsetY: this.dragStart.placement.offsetY + ((pointer.y - this.dragStart.pointer.y) / height) * 2,
    });
    this.updatePlacement(this.dragStart.objectId, nextPlacement);
  };

  private readonly handlePointerEnd = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    this.dragStart = undefined;
    this.pinchStart = undefined;
    safeReleasePointerCapture(this.renderer.domElement, event.pointerId);
    if (this.activePointers.size >= 2) {
      this.startPinchGesture();
      return;
    }
    if (this.activePointers.size === 1) {
      this.startDragGesture([...this.activePointers.values()][0]);
      return;
    }
    if (this.activePointers.size === 0) {
      this.renderer.domElement.style.cursor = 'grab';
    }
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
  }

  private startPinchGesture(): void {
    const selected = this.selectedPlacement();
    if (!selected) {
      return;
    }

    this.dragStart = undefined;
    this.pinchStart = {
      distance: pinchDistance([...this.activePointers.values()]),
      objectId: selected.objectId,
      placement: { ...selected.placement },
    };
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
      Math.sin(yawRadians) * this.cameraView.distance,
      this.cameraView.height,
      Math.cos(yawRadians) * this.cameraView.distance,
    );
    this.camera.lookAt(0, this.cameraView.targetHeight, 0);
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
    targetHeight: clampNumber(value?.targetHeight, -0.5, 1.5, DEFAULT_PREVIEW_CAMERA_VIEW.targetHeight),
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

function pinchDistance(points: PointerPoint[]): number {
  if (points.length < 2) {
    return 0;
  }

  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
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

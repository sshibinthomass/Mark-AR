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
import type { ImageTargetPlacement } from '../app/imageTargetPayload';
import { normalizePlacement } from '../app/imageTargetPayload';

type PreviewRenderer = Pick<WebGLRenderer, 'domElement' | 'setPixelRatio' | 'setSize' | 'render' | 'dispose'>;

type PreviewDeps = {
  createRenderer?: () => PreviewRenderer;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (frameId: number) => void;
  loadTexture?: (url: string) => Promise<Texture | undefined>;
  loadModel?: (url: string) => Promise<Group | undefined>;
};

type PreviewState = {
  imageUrl?: string;
  model?: CloudflareModelOption;
  placement?: ImageTargetPlacement;
};

export class ImageTargetPreview {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(45, 1, 0.01, 100);
  private readonly renderer: PreviewRenderer;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (frameId: number) => void;
  private readonly loadTexture: (url: string) => Promise<Texture | undefined>;
  private readonly loadModel: (url: string) => Promise<Group | undefined>;
  private readonly container: HTMLElement;
  private readonly imageRoot = new Group();
  private readonly modelRoot = new Group();
  private frameId = 0;
  private disposed = false;
  private updateToken = 0;

  constructor(container: HTMLElement, deps: PreviewDeps = {}) {
    this.container = container;
    this.renderer = deps.createRenderer?.() ?? new WebGLRenderer({ antialias: true, alpha: true });
    this.requestFrame = deps.requestFrame ?? window.requestAnimationFrame.bind(window);
    this.cancelFrame = deps.cancelFrame ?? window.cancelAnimationFrame.bind(window);
    this.loadTexture = deps.loadTexture ?? defaultLoadTexture;
    this.loadModel = deps.loadModel ?? defaultLoadModel;

    this.camera.position.set(0, 1.1, 2.1);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new AmbientLight(0xffffff, 1.6));

    const keyLight = new DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(1, 2, 2);
    this.scene.add(keyLight, this.imageRoot, this.modelRoot);

    this.container.append(this.renderer.domElement);
    this.resize();
    this.render = this.render.bind(this);
    this.frameId = this.requestFrame(this.render);
  }

  async update(state: PreviewState): Promise<void> {
    if (this.disposed) {
      return;
    }

    const updateToken = ++this.updateToken;
    this.clearGroup(this.imageRoot);
    this.clearGroup(this.modelRoot);
    const placement = normalizePlacement(state.placement);

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

    if (state.model) {
      const model = await this.loadModel(state.model.url);
      if (this.disposed || updateToken !== this.updateToken || !model) {
        if (model) {
          disposeObject3D(model);
        }
        return;
      }
      model.position.set(placement.offsetX, placement.height, placement.offsetY);
      model.scale.setScalar(placement.scale);
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

  private render(): void {
    if (this.disposed) {
      return;
    }
    this.modelRoot.rotation.y += 0.01;
    this.renderer.render(this.scene, this.camera);
    this.frameId = this.requestFrame(this.render);
  }

  private clearGroup(group: Group): void {
    for (const child of [...group.children]) {
      disposeObject3D(child);
      group.remove(child);
    }
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

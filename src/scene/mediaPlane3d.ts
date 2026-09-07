import {
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Texture,
  TextureLoader,
} from 'three';

type MediaPlaneKind = 'image' | 'youtube';

type MediaPlaneInput = {
  objectId: string;
  kind: MediaPlaneKind;
  url: string;
  aspectRatio: number;
};

type PreparedMediaPlane = {
  group: Group;
  mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  ready: Promise<void>;
  dispose(): void;
};

type PrepareMediaPlaneDeps = {
  loadTexture?: (url: string) => Promise<Texture | undefined>;
  loadMode?: 'fallback' | 'strict';
};

export function prepareMediaPlane(
  input: MediaPlaneInput,
  deps: PrepareMediaPlaneDeps = {},
): PreparedMediaPlane {
  const group = new Group();
  group.name = `target-media-object-${input.objectId}`;
  const aspectRatio = clampAspectRatio(input.aspectRatio);
  const material = new MeshBasicMaterial({
    color: input.kind === 'youtube' ? 0x161a20 : 0xd8e3df,
    side: DoubleSide,
  });
  const geometry = new PlaneGeometry(aspectRatio, 1);
  const mesh = new Mesh(geometry, material);
  mesh.name = `target-media-plane-${input.objectId}`;
  mesh.userData.targetObjectId = input.objectId;
  mesh.userData.targetMediaKind = input.kind;
  group.add(mesh);

  let indicatorGeometry: CircleGeometry | undefined;
  let indicatorMaterial: MeshBasicMaterial | undefined;
  if (input.kind === 'youtube') {
    indicatorGeometry = new CircleGeometry(0.14, 3);
    indicatorMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      opacity: 0.92,
      transparent: true,
      side: DoubleSide,
      depthTest: false,
    });
    const indicator = new Mesh(indicatorGeometry, indicatorMaterial);
    indicator.name = 'target-media-play-indicator';
    indicator.position.z = 0.006;
    indicator.rotation.z = -Math.PI / 2;
    indicator.renderOrder = 2;
    group.add(indicator);
  }

  const loadTexture = deps.loadTexture ?? defaultLoadTexture;
  let loadedTexture: Texture | undefined;
  let disposed = false;
  const ready = loadTexture(input.url)
    .then((texture) => {
      if (!texture) {
        if (deps.loadMode === 'strict') {
          throw new Error(`Unable to load media texture ${input.url}.`);
        }
        return;
      }
      if (disposed) {
        texture.dispose();
        return;
      }
      loadedTexture = texture;
      material.map = texture;
      material.color.setHex(0xffffff);
      material.needsUpdate = true;
    })
    .catch((error: unknown) => {
      if (deps.loadMode === 'strict') {
        throw error;
      }
    });

  return {
    group,
    mesh,
    ready,
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      loadedTexture?.dispose();
      material.dispose();
      geometry.dispose();
      indicatorMaterial?.dispose();
      indicatorGeometry?.dispose();
      group.clear();
    },
  };
}

async function defaultLoadTexture(url: string): Promise<Texture> {
  return new TextureLoader().loadAsync(url);
}

function clampAspectRatio(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return Math.min(5, Math.max(0.2, value));
}

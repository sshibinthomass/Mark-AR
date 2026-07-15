import {
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type BufferAttribute,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { Font, FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js';
import droidSansBoldFontJson from 'three/examples/fonts/droid/droid_sans_bold.typeface.json?raw';
import studioMonoFontJson from 'three/examples/fonts/droid/droid_sans_mono_regular.typeface.json?raw';
import studioSansFontJson from 'three/examples/fonts/droid/droid_sans_regular.typeface.json?raw';
import droidSerifBoldFontJson from 'three/examples/fonts/droid/droid_serif_bold.typeface.json?raw';
import droidSerifFontJson from 'three/examples/fonts/droid/droid_serif_regular.typeface.json?raw';
import gentilisBoldFontJson from 'three/examples/fonts/gentilis_bold.typeface.json?raw';
import helvetikerBoldFontJson from 'three/examples/fonts/helvetiker_bold.typeface.json?raw';
import helvetikerFontJson from 'three/examples/fonts/helvetiker_regular.typeface.json?raw';
import optimerBoldFontJson from 'three/examples/fonts/optimer_bold.typeface.json?raw';
import optimerFontJson from 'three/examples/fonts/optimer_regular.typeface.json?raw';
import studioSerifFontJson from 'three/examples/fonts/gentilis_regular.typeface.json?raw';
import {
  normalizeTargetText,
  type LocalTextTargetObject,
  type TargetTextContent,
  type TargetTextFont,
} from '../app/targetEditorObjects';

type TextObjectOptions = {
  loadFont?: (font: TargetTextFont) => Promise<Font>;
};

const TARGET_WIDTH = 0.74;
const TARGET_HEIGHT = 0.3;
const TEXT_SIZE = 0.2;
const MAX_LINE_LENGTH = 18;

const bundledFontJson: Partial<Record<TargetTextFont, string>> = {
  'studio-sans': studioSansFontJson,
  'studio-sans-bold': droidSansBoldFontJson,
  'studio-serif': studioSerifFontJson,
  'studio-serif-bold': gentilisBoldFontJson,
  'droid-serif': droidSerifFontJson,
  'droid-serif-bold': droidSerifBoldFontJson,
  optimer: optimerFontJson,
  'optimer-bold': optimerBoldFontJson,
  helvetiker: helvetikerFontJson,
  'helvetiker-bold': helvetikerBoldFontJson,
  'studio-mono': studioMonoFontJson,
};

const loadedFonts = new Map<TargetTextFont, Promise<Font>>();

export type PreparedTextObject3D = {
  group: Group;
  ready: Promise<void>;
  dispose(): void;
};

export function createTextObject3D(text: TargetTextContent, options: TextObjectOptions = {}): Group {
  return prepareTextObject3D(text, options).group;
}

export function prepareTextObject3D(
  text: LocalTextTargetObject['text'],
  options: TextObjectOptions = {},
): PreparedTextObject3D {
  const normalized = normalizeTargetText(text);
  const group = new Group();
  group.name = 'local-text-3d-object';
  group.userData = {
    ...group.userData,
    text: normalized.value,
    language: normalized.language,
    font: normalized.font,
    color: normalized.color,
    fillMode: normalized.fillMode,
    gradientStart: normalized.gradientStart,
    gradientEnd: normalized.gradientEnd,
    gradientDirection: normalized.gradientDirection,
    sideColor: normalized.sideColor,
    depth: normalized.depth,
    bevel: normalized.bevel,
    gloss: normalized.gloss,
  };

  let disposed = false;
  const ready = buildTextMesh(normalized, options.loadFont ?? loadTextFont).then((mesh) => {
    if (disposed) {
      disposeObjectTree(mesh);
      return;
    }
    group.add(mesh);
  });

  return {
    group,
    ready,
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      disposeObjectTree(group);
      group.clear();
    },
  };
}

async function buildTextMesh(
  text: TargetTextContent,
  loadFont: (font: TargetTextFont) => Promise<Font>,
): Promise<Mesh> {
  let font: Font;
  try {
    font = await loadFont(text.font);
  } catch {
    font = parseBundledFont('studio-sans');
  }

  try {
    return createExtrudedTextMesh(renderableText(text.value), font, text);
  } catch {
    return createExtrudedTextMesh(renderableText('Text'), parseBundledFont('studio-sans'), text);
  }
}

function disposeObjectTree(root: Object3D): void {
  const geometries = new Set<Mesh['geometry']>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();

  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) {
      return;
    }
    if (!geometries.has(mesh.geometry)) {
      geometries.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of meshMaterials) {
      if (materials.has(material)) {
        continue;
      }
      materials.add(material);
      for (const value of Object.values(material)) {
        const texture = value as Texture | null;
        if (texture?.isTexture && !textures.has(texture)) {
          textures.add(texture);
          texture.dispose();
        }
      }
      material.dispose();
    }
  });
}

function createExtrudedTextMesh(value: string, font: Font, text: TargetTextContent): Mesh {
  const depth = text.depth ?? 0.055;
  const bevelSize = text.bevel ?? 0.004;
  const bevelEnabled = bevelSize > 0;
  const geometry = new TextGeometry(value, {
    font,
    size: TEXT_SIZE,
    height: depth,
    curveSegments: 10,
    bevelEnabled,
    bevelThickness: bevelEnabled ? bevelSize * 1.6 : 0,
    bevelSize,
    bevelSegments: bevelEnabled ? 2 : 0,
  });

  centerTextGeometry(geometry);
  if (text.fillMode === 'gradient') {
    applyGradientColors(geometry, text);
  }

  const mesh = new Mesh(geometry, textMaterials(text));
  mesh.name = 'local-text-3d-mesh';
  mesh.scale.setScalar(scaleForTextGeometry(geometry));
  return mesh;
}

function centerTextGeometry(geometry: TextGeometry): void {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) {
    return;
  }
  const center = box.getCenter(new Vector3());
  geometry.translate(-center.x, -center.y, -box.min.z);
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
}

function scaleForTextGeometry(geometry: TextGeometry): number {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) {
    return 1;
  }
  const size = box.getSize(new Vector3());
  const widthScale = size.x > 0 ? TARGET_WIDTH / size.x : 1;
  const heightScale = size.y > 0 ? TARGET_HEIGHT / size.y : 1;
  return Math.min(widthScale, heightScale, 1);
}

function textMaterials(text: TargetTextContent): Material[] {
  const gloss = text.gloss ?? 0.68;
  const roughness = Math.max(0.08, 0.82 - gloss * 0.74);
  const metalness = Math.min(0.24, 0.04 + gloss * 0.16);
  const useGradient = text.fillMode === 'gradient';
  const front = new MeshStandardMaterial({
    color: useGradient ? '#ffffff' : text.color ?? '#2563eb',
    metalness,
    roughness,
    vertexColors: useGradient,
  });
  const sides = new MeshStandardMaterial({
    color: text.sideColor ?? text.color ?? '#2563eb',
    metalness: Math.min(0.28, metalness + 0.04),
    roughness: Math.min(0.92, roughness + 0.1),
  });
  return [front, sides];
}

function applyGradientColors(geometry: TextGeometry, text: TargetTextContent): void {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const position = geometry.getAttribute('position') as BufferAttribute;
  if (!box || !position) {
    return;
  }

  const startColor = new Color(text.gradientStart ?? text.color ?? '#2563eb');
  const endColor = new Color(text.gradientEnd ?? text.color ?? '#60a5fa');
  const color = new Color();
  const colors: number[] = [];

  for (let index = 0; index < position.count; index += 1) {
    const factor = gradientFactor(
      text.gradientDirection ?? 'horizontal',
      position.getX(index),
      position.getY(index),
      position.getZ(index),
      box.min,
      box.max,
    );
    color.copy(startColor).lerp(endColor, factor);
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
}

function gradientFactor(
  direction: TargetTextContent['gradientDirection'],
  x: number,
  y: number,
  z: number,
  min: Vector3,
  max: Vector3,
): number {
  const width = Math.max(0.0001, max.x - min.x);
  const height = Math.max(0.0001, max.y - min.y);
  const depth = Math.max(0.0001, max.z - min.z);

  if (direction === 'vertical') {
    return clamp01((y - min.y) / height);
  }
  if (direction === 'diagonal') {
    return clamp01(((x - min.x) / width + (y - min.y) / height) / 2);
  }
  if (direction === 'depth') {
    return clamp01((z - min.z) / depth);
  }
  return clamp01((x - min.x) / width);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function renderableText(value: string): string {
  const explicitLines = value.replace(/\r\n/g, '\n').split('\n');
  const lines = explicitLines.flatMap((line) => wrapLine(line.trim())).filter(Boolean);
  return lines.slice(0, 4).join('\n') || 'Text';
}

function wrapLine(value: string): string[] {
  if (value.length <= MAX_LINE_LENGTH) {
    return [value];
  }

  const words = value.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [value];
  }

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= MAX_LINE_LENGTH || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function loadTextFont(font: TargetTextFont): Promise<Font> {
  const cached = loadedFonts.get(font);
  if (cached) {
    return cached;
  }

  const loaded = font === 'tamil-ui' ? loadTamilFont() : Promise.resolve(parseBundledFont(font));
  loadedFonts.set(font, loaded);
  return loaded;
}

function loadTamilFont(): Promise<Font> {
  const loader = new TTFLoader();
  return loader.loadAsync(`${import.meta.env.BASE_URL}fonts/NotoSansTamil.ttf`).then((json) => new Font(json));
}

function parseBundledFont(font: TargetTextFont): Font {
  const rawJson = bundledFontJson[font] ?? bundledFontJson['studio-sans'];
  if (!rawJson) {
    throw new Error('Missing bundled 3D text font');
  }
  return new FontLoader().parse(JSON.parse(rawJson));
}

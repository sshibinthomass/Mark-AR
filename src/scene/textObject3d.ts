import { Group, Mesh, MeshStandardMaterial, Vector3, type Material } from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { Font, FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js';
import studioMonoFontJson from 'three/examples/fonts/droid/droid_sans_mono_regular.typeface.json?raw';
import studioSansFontJson from 'three/examples/fonts/droid/droid_sans_regular.typeface.json?raw';
import studioSerifFontJson from 'three/examples/fonts/gentilis_regular.typeface.json?raw';
import { normalizeTargetText, type TargetTextContent, type TargetTextFont } from '../app/targetEditorObjects';

type TextObjectOptions = {
  loadFont?: (font: TargetTextFont) => Promise<Font>;
};

const TARGET_WIDTH = 0.74;
const TARGET_HEIGHT = 0.3;
const TEXT_SIZE = 0.2;
const TEXT_DEPTH = 0.055;
const MAX_LINE_LENGTH = 18;

const bundledFontJson: Partial<Record<TargetTextFont, string>> = {
  'studio-sans': studioSansFontJson,
  'studio-serif': studioSerifFontJson,
  'studio-mono': studioMonoFontJson,
};

const loadedFonts = new Map<TargetTextFont, Promise<Font>>();

export function createTextObject3D(text: TargetTextContent, options: TextObjectOptions = {}): Group {
  const normalized = normalizeTargetText(text);
  const group = new Group();
  group.name = 'local-text-3d-object';
  group.userData = {
    ...group.userData,
    text: normalized.value,
    language: normalized.language,
    font: normalized.font,
    color: normalized.color,
  };

  void buildTextMesh(group, normalized, options.loadFont ?? loadTextFont);
  return group;
}

async function buildTextMesh(
  group: Group,
  text: TargetTextContent,
  loadFont: (font: TargetTextFont) => Promise<Font>,
): Promise<void> {
  let font: Font;
  try {
    font = await loadFont(text.font);
  } catch {
    font = parseBundledFont('studio-sans');
  }

  try {
    group.add(createExtrudedTextMesh(renderableText(text.value), font, text.color ?? '#2563eb'));
  } catch {
    group.add(createExtrudedTextMesh(renderableText('Text'), parseBundledFont('studio-sans'), text.color ?? '#2563eb'));
  }
}

function createExtrudedTextMesh(value: string, font: Font, color: string): Mesh {
  const geometry = new TextGeometry(value, {
    font,
    size: TEXT_SIZE,
    height: TEXT_DEPTH,
    curveSegments: 10,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.004,
    bevelSegments: 2,
  });

  centerTextGeometry(geometry);

  const mesh = new Mesh(geometry, textMaterials(color));
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

function textMaterials(color: string): Material[] {
  const front = new MeshStandardMaterial({
    color,
    metalness: 0.04,
    roughness: 0.32,
  });
  const sides = new MeshStandardMaterial({
    color,
    metalness: 0.08,
    roughness: 0.4,
  });
  return [front, sides];
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

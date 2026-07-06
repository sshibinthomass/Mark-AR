import {
  BoxGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Material,
} from 'three';
import {
  fontOption,
  normalizeTargetText,
  type TargetTextContent,
} from '../app/targetEditorObjects';

type TextObjectOptions = {
  createCanvas?: () => HTMLCanvasElement;
};

export function createTextObject3D(text: TargetTextContent, options: TextObjectOptions = {}): Group {
  const normalized = normalizeTargetText(text);
  const canvas = options.createCanvas?.() ?? document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;

  const texture = drawTextTexture(canvas, normalized);
  const frontMaterial = texture
    ? new MeshBasicMaterial({ map: texture, transparent: true, side: DoubleSide })
    : new MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.9, side: DoubleSide });
  const sideMaterial = new MeshBasicMaterial({ color: 0x102326, transparent: true, opacity: 0.82 });
  const backMaterial = frontMaterial.clone();
  const mesh = new Mesh(
    new BoxGeometry(0.74, 0.28, 0.035),
    [sideMaterial, sideMaterial, sideMaterial, sideMaterial, frontMaterial, backMaterial] as Material[],
  );
  mesh.name = 'local-text-3d-mesh';

  const group = new Group();
  group.name = 'local-text-3d-object';
  group.userData = {
    ...group.userData,
    text: normalized.value,
    language: normalized.language,
    font: normalized.font,
  };
  group.add(mesh);
  return group;
}

function drawTextTexture(canvas: HTMLCanvasElement, text: TargetTextContent): CanvasTexture | undefined {
  const context = canvas.getContext('2d');
  if (!context) {
    return undefined;
  }

  const fontStack = fontOption(text.font).stack;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(255, 255, 255, 0.94)';
  roundRect(context, 52, 58, canvas.width - 104, canvas.height - 116, 32);
  context.fill();
  context.strokeStyle = 'rgba(15, 118, 110, 0.34)';
  context.lineWidth = 8;
  context.stroke();

  const lines = wrappedTextLines(context, text.value, fontStack);
  const fontSize = lines.length > 1 ? 82 : 104;
  const lineHeight = fontSize * 1.08;
  const firstBaseline = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

  context.font = `900 ${fontSize}px ${fontStack}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.strokeStyle = 'rgba(255, 255, 255, 0.82)';
  context.lineWidth = 12;
  context.fillStyle = '#102326';

  lines.forEach((line, index) => {
    const y = firstBaseline + index * lineHeight;
    context.strokeText(line, canvas.width / 2, y);
    context.fillText(line, canvas.width / 2, y);
  });

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function wrappedTextLines(context: CanvasRenderingContext2D, value: string, fontStack: string): string[] {
  const maxWidth = 760;
  const words = value.split(/\s+/).filter(Boolean);
  const sourceLines = words.length ? words : [value];
  const lines: string[] = [];
  let current = '';

  context.font = `900 92px ${fontStack}`;
  for (const word of sourceLines) {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 3);
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

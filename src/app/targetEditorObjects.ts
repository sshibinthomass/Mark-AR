import type { CloudImageTargetObject } from './cloudImageTargets';
import {
  DEFAULT_IMAGE_TARGET_ANIMATION,
  normalizeAnimation,
  type ImageTargetAnimation,
} from './imageTargetAnimation';
import {
  DEFAULT_IMAGE_TARGET_PLACEMENT,
  normalizePlacement,
  type ImageTargetPlacement,
} from './imageTargetPayload';

export const TEXT_LANGUAGE_OPTIONS = [
  { id: 'english', label: 'English', sample: 'Hello AR' },
  { id: 'german', label: 'German', sample: 'Hallo AR' },
  { id: 'tamil', label: 'Tamil', sample: 'வணக்கம் AR' },
] as const;

export const TEXT_FONT_OPTIONS = [
  {
    id: 'studio-sans',
    label: 'Studio Sans',
    stack: 'Inter, "Segoe UI", Arial, sans-serif',
  },
  {
    id: 'studio-sans-bold',
    label: 'Studio Sans Bold',
    stack: 'Inter, "Segoe UI", Arial, sans-serif',
  },
  {
    id: 'studio-serif',
    label: 'Serif',
    stack: 'Georgia, "Times New Roman", serif',
  },
  {
    id: 'studio-serif-bold',
    label: 'Serif Bold',
    stack: 'Georgia, "Times New Roman", serif',
  },
  {
    id: 'droid-serif',
    label: 'Droid Serif',
    stack: 'Georgia, "Times New Roman", serif',
  },
  {
    id: 'droid-serif-bold',
    label: 'Droid Serif Bold',
    stack: 'Georgia, "Times New Roman", serif',
  },
  {
    id: 'optimer',
    label: 'Optimer',
    stack: 'Georgia, "Times New Roman", serif',
  },
  {
    id: 'optimer-bold',
    label: 'Optimer Bold',
    stack: 'Georgia, "Times New Roman", serif',
  },
  {
    id: 'helvetiker',
    label: 'Helvetiker',
    stack: 'Arial, sans-serif',
  },
  {
    id: 'helvetiker-bold',
    label: 'Helvetiker Bold',
    stack: 'Arial, sans-serif',
  },
  {
    id: 'studio-mono',
    label: 'Mono',
    stack: '"Cascadia Mono", Consolas, "Courier New", monospace',
  },
  {
    id: 'tamil-ui',
    label: 'Tamil UI',
    stack: '"Nirmala UI", Latha, "Arial Unicode MS", sans-serif',
  },
] as const;

export const TEXT_FILL_MODE_OPTIONS = [
  { id: 'solid', label: 'Solid' },
  { id: 'gradient', label: 'Gradient' },
] as const;

export const TEXT_GRADIENT_DIRECTION_OPTIONS = [
  { id: 'horizontal', label: 'Horizontal' },
  { id: 'vertical', label: 'Vertical' },
  { id: 'diagonal', label: 'Diagonal' },
  { id: 'depth', label: 'Depth' },
] as const;

export const TEXT_STYLE_PRESETS = [
  {
    id: 'blue-shine',
    label: 'Blue shine',
    fillMode: 'solid',
    color: '#2563eb',
    gradientStart: '#2563eb',
    gradientEnd: '#60a5fa',
    gradientDirection: 'horizontal',
    sideColor: '#1d4ed8',
    depth: 0.055,
    bevel: 0.004,
    gloss: 0.68,
  },
  {
    id: 'gold-bevel',
    label: 'Gold bevel',
    fillMode: 'gradient',
    color: '#f59e0b',
    gradientStart: '#fef3c7',
    gradientEnd: '#f59e0b',
    gradientDirection: 'diagonal',
    sideColor: '#92400e',
    depth: 0.09,
    bevel: 0.012,
    gloss: 0.82,
  },
  {
    id: 'neon-cyan',
    label: 'Neon cyan',
    fillMode: 'gradient',
    color: '#06b6d4',
    gradientStart: '#67e8f9',
    gradientEnd: '#0891b2',
    gradientDirection: 'vertical',
    sideColor: '#155e75',
    depth: 0.07,
    bevel: 0.008,
    gloss: 0.9,
  },
  {
    id: 'red-gloss',
    label: 'Red gloss',
    fillMode: 'gradient',
    color: '#ef4444',
    gradientStart: '#fecaca',
    gradientEnd: '#ef4444',
    gradientDirection: 'horizontal',
    sideColor: '#7f1d1d',
    depth: 0.08,
    bevel: 0.01,
    gloss: 0.95,
  },
  {
    id: 'tamil-classic',
    label: 'Tamil classic',
    fillMode: 'gradient',
    color: '#14b8a6',
    gradientStart: '#ccfbf1',
    gradientEnd: '#14b8a6',
    gradientDirection: 'vertical',
    sideColor: '#0f766e',
    depth: 0.08,
    bevel: 0.01,
    gloss: 0.72,
  },
] as const;

export type TargetTextLanguage = (typeof TEXT_LANGUAGE_OPTIONS)[number]['id'];
export type TargetTextFont = (typeof TEXT_FONT_OPTIONS)[number]['id'];
export type TargetTextFillMode = (typeof TEXT_FILL_MODE_OPTIONS)[number]['id'];
export type TargetTextGradientDirection = (typeof TEXT_GRADIENT_DIRECTION_OPTIONS)[number]['id'];
export type TargetTextStylePreset = (typeof TEXT_STYLE_PRESETS)[number]['id'];

export type TargetTextContent = {
  value: string;
  language: TargetTextLanguage;
  font: TargetTextFont;
  color?: string;
  fillMode?: TargetTextFillMode;
  gradientStart?: string;
  gradientEnd?: string;
  gradientDirection?: TargetTextGradientDirection;
  sideColor?: string;
  depth?: number;
  bevel?: number;
  gloss?: number;
  stylePreset?: TargetTextStylePreset;
};

export type LocalTextTargetObject = {
  kind: 'text';
  id: string;
  text: TargetTextContent;
  placement: ImageTargetPlacement;
  animation?: ImageTargetAnimation;
};

export type TargetEditorObject = CloudImageTargetObject | LocalTextTargetObject;

export type LocalImageTargetDraft = {
  id: string;
  label: string;
  imageUrl: string;
  objects: TargetEditorObject[];
};

export const DEFAULT_TARGET_TEXT: TargetTextContent = {
  value: TEXT_LANGUAGE_OPTIONS[0].sample,
  language: TEXT_LANGUAGE_OPTIONS[0].id,
  font: TEXT_FONT_OPTIONS[0].id,
  color: TEXT_STYLE_PRESETS[0].color,
  fillMode: TEXT_STYLE_PRESETS[0].fillMode,
  gradientStart: TEXT_STYLE_PRESETS[0].gradientStart,
  gradientEnd: TEXT_STYLE_PRESETS[0].gradientEnd,
  gradientDirection: TEXT_STYLE_PRESETS[0].gradientDirection,
  sideColor: TEXT_STYLE_PRESETS[0].sideColor,
  depth: TEXT_STYLE_PRESETS[0].depth,
  bevel: TEXT_STYLE_PRESETS[0].bevel,
  gloss: TEXT_STYLE_PRESETS[0].gloss,
  stylePreset: TEXT_STYLE_PRESETS[0].id,
};

export function normalizeTargetText(value: Partial<TargetTextContent> = {}): TargetTextContent {
  const language = isTargetTextLanguage(value.language) ? value.language : DEFAULT_TARGET_TEXT.language;
  const font = isTargetTextFont(value.font) ? value.font : DEFAULT_TARGET_TEXT.font;
  const color = isTargetTextColor(value.color) ? value.color.toLowerCase() : DEFAULT_TARGET_TEXT.color;
  const fillMode = isTargetTextFillMode(value.fillMode) ? value.fillMode : DEFAULT_TARGET_TEXT.fillMode;
  const gradientStart = isTargetTextColor(value.gradientStart)
    ? value.gradientStart.toLowerCase()
    : DEFAULT_TARGET_TEXT.gradientStart;
  const gradientEnd = isTargetTextColor(value.gradientEnd)
    ? value.gradientEnd.toLowerCase()
    : DEFAULT_TARGET_TEXT.gradientEnd;
  const gradientDirection = isTargetTextGradientDirection(value.gradientDirection)
    ? value.gradientDirection
    : DEFAULT_TARGET_TEXT.gradientDirection;
  const sideColor = isTargetTextColor(value.sideColor) ? value.sideColor.toLowerCase() : DEFAULT_TARGET_TEXT.sideColor;
  const depth = clampNumber(value.depth, 0.02, 0.16, DEFAULT_TARGET_TEXT.depth ?? 0.055);
  const bevel = clampNumber(value.bevel, 0, 0.024, DEFAULT_TARGET_TEXT.bevel ?? 0.004);
  const gloss = clampNumber(value.gloss, 0, 1, DEFAULT_TARGET_TEXT.gloss ?? 0.68);
  const stylePreset = isTargetTextStylePreset(value.stylePreset) ? value.stylePreset : DEFAULT_TARGET_TEXT.stylePreset;
  const textValue = value.value?.trim() || languageOption(language).sample;

  return {
    value: textValue,
    language,
    font,
    color,
    fillMode,
    gradientStart,
    gradientEnd,
    gradientDirection,
    sideColor,
    depth,
    bevel,
    gloss,
    stylePreset,
  };
}

export function createLocalTextObject({
  id,
  text,
  placement,
  animation,
}: {
  id: string;
  text?: Partial<TargetTextContent>;
  placement?: Partial<ImageTargetPlacement>;
  animation?: Partial<ImageTargetAnimation>;
}): LocalTextTargetObject {
  return {
    kind: 'text',
    id,
    text: normalizeTargetText(text),
    placement: normalizePlacement(placement ?? DEFAULT_IMAGE_TARGET_PLACEMENT),
    animation: normalizeAnimation(animation ?? DEFAULT_IMAGE_TARGET_ANIMATION),
  };
}

export function isTextTargetObject(object: unknown): object is LocalTextTargetObject {
  return Boolean(
    object &&
      typeof object === 'object' &&
      'kind' in object &&
      (object as { kind?: unknown }).kind === 'text',
  );
}

export function isModelTargetObject(object: TargetEditorObject): object is CloudImageTargetObject {
  return !isTextTargetObject(object);
}

export function saveableModelObjects(objects: TargetEditorObject[]): CloudImageTargetObject[] {
  return objects.filter(isModelTargetObject);
}

export function languageOption(language: TargetTextLanguage): (typeof TEXT_LANGUAGE_OPTIONS)[number] {
  return TEXT_LANGUAGE_OPTIONS.find((option) => option.id === language) ?? TEXT_LANGUAGE_OPTIONS[0];
}

export function fontOption(font: TargetTextFont): (typeof TEXT_FONT_OPTIONS)[number] {
  return TEXT_FONT_OPTIONS.find((option) => option.id === font) ?? TEXT_FONT_OPTIONS[0];
}

export function fillModeOption(mode: TargetTextFillMode): (typeof TEXT_FILL_MODE_OPTIONS)[number] {
  return TEXT_FILL_MODE_OPTIONS.find((option) => option.id === mode) ?? TEXT_FILL_MODE_OPTIONS[0];
}

export function gradientDirectionOption(
  direction: TargetTextGradientDirection,
): (typeof TEXT_GRADIENT_DIRECTION_OPTIONS)[number] {
  return TEXT_GRADIENT_DIRECTION_OPTIONS.find((option) => option.id === direction) ?? TEXT_GRADIENT_DIRECTION_OPTIONS[0];
}

export function textStylePreset(preset: TargetTextStylePreset): (typeof TEXT_STYLE_PRESETS)[number] {
  return TEXT_STYLE_PRESETS.find((option) => option.id === preset) ?? TEXT_STYLE_PRESETS[0];
}

export function isTargetTextLanguage(value: unknown): value is TargetTextLanguage {
  return TEXT_LANGUAGE_OPTIONS.some((option) => option.id === value);
}

export function isTargetTextFont(value: unknown): value is TargetTextFont {
  return TEXT_FONT_OPTIONS.some((option) => option.id === value);
}

export function isTargetTextColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function isTargetTextFillMode(value: unknown): value is TargetTextFillMode {
  return TEXT_FILL_MODE_OPTIONS.some((option) => option.id === value);
}

export function isTargetTextGradientDirection(value: unknown): value is TargetTextGradientDirection {
  return TEXT_GRADIENT_DIRECTION_OPTIONS.some((option) => option.id === value);
}

export function isTargetTextStylePreset(value: unknown): value is TargetTextStylePreset {
  return TEXT_STYLE_PRESETS.some((option) => option.id === value);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numericValue));
}

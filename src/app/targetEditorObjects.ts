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
    id: 'studio-serif',
    label: 'Serif',
    stack: 'Georgia, "Times New Roman", serif',
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

export type TargetTextLanguage = (typeof TEXT_LANGUAGE_OPTIONS)[number]['id'];
export type TargetTextFont = (typeof TEXT_FONT_OPTIONS)[number]['id'];

export type TargetTextContent = {
  value: string;
  language: TargetTextLanguage;
  font: TargetTextFont;
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
};

export function normalizeTargetText(value: Partial<TargetTextContent> = {}): TargetTextContent {
  const language = isTargetTextLanguage(value.language) ? value.language : DEFAULT_TARGET_TEXT.language;
  const font = isTargetTextFont(value.font) ? value.font : DEFAULT_TARGET_TEXT.font;
  const textValue = value.value?.trim() || languageOption(language).sample;

  return {
    value: textValue,
    language,
    font,
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

export function isTargetTextLanguage(value: unknown): value is TargetTextLanguage {
  return TEXT_LANGUAGE_OPTIONS.some((option) => option.id === value);
}

export function isTargetTextFont(value: unknown): value is TargetTextFont {
  return TEXT_FONT_OPTIONS.some((option) => option.id === value);
}

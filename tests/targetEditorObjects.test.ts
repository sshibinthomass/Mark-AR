import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TARGET_TEXT,
  TEXT_FONT_OPTIONS,
  TEXT_LANGUAGE_OPTIONS,
  createLocalTextObject,
  isModelTargetObject,
  normalizeTargetText,
  saveableModelObjects,
} from '../src/app/targetEditorObjects';

describe('target editor object helpers', () => {
  it('provides English, German, and Tamil text presets plus font options', () => {
    expect(TEXT_LANGUAGE_OPTIONS.map((option) => option.id)).toEqual(['english', 'german', 'tamil']);
    expect(TEXT_LANGUAGE_OPTIONS.find((option) => option.id === 'tamil')?.sample).toBe('வணக்கம் AR');
    expect(TEXT_FONT_OPTIONS.map((option) => option.id)).toEqual([
      'studio-sans',
      'studio-serif',
      'studio-mono',
      'tamil-ui',
    ]);
  });

  it('normalizes text content with safe language and font defaults', () => {
    expect(normalizeTargetText({ value: '  Willkommen  ', language: 'german', font: 'studio-serif' })).toEqual({
      value: 'Willkommen',
      language: 'german',
      font: 'studio-serif',
    });
    expect(normalizeTargetText({ value: '', language: 'unknown' as never, font: 'missing' as never })).toEqual(
      DEFAULT_TARGET_TEXT,
    );
  });

  it('creates local text objects and filters them out of saveable Cloudflare model objects', () => {
    const modelObject = {
      id: 'object-chair',
      model: { id: 'chair', label: 'Chair', url: 'https://example.com/chair.glb' },
      placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 0, rotationZ: 0 },
    };
    const textObject = createLocalTextObject({
      id: 'text-1',
      text: { value: 'வணக்கம் AR', language: 'tamil', font: 'tamil-ui' },
      placement: { scale: 1.4, offsetX: 0.2, offsetY: -0.1, height: 0.3, rotationX: 0, rotationY: 30, rotationZ: 0 },
    });

    expect(textObject.kind).toBe('text');
    expect(isModelTargetObject(modelObject)).toBe(true);
    expect(isModelTargetObject(textObject)).toBe(false);
    expect(saveableModelObjects([textObject, modelObject])).toEqual([modelObject]);
  });
});

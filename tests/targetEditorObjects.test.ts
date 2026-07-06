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

const TAMIL_HELLO = '\u0bb5\u0ba3\u0b95\u0bcd\u0b95\u0bae\u0bcd AR';

describe('target editor object helpers', () => {
  it('provides English, German, and Tamil text presets plus font options', () => {
    expect(TEXT_LANGUAGE_OPTIONS.map((option) => option.id)).toEqual(['english', 'german', 'tamil']);
    expect(TEXT_LANGUAGE_OPTIONS.find((option) => option.id === 'tamil')?.sample).toBe(TAMIL_HELLO);
    expect(TEXT_FONT_OPTIONS.map((option) => option.id)).toEqual([
      'studio-sans',
      'studio-serif',
      'studio-mono',
      'tamil-ui',
    ]);
  });

  it('normalizes text content with safe language, font, and color defaults', () => {
    expect(normalizeTargetText({ value: '  Willkommen  ', language: 'german', font: 'studio-serif' })).toEqual({
      value: 'Willkommen',
      language: 'german',
      font: 'studio-serif',
      color: '#2563eb',
    });
    expect(normalizeTargetText({ value: '', language: 'unknown' as never, font: 'missing' as never })).toEqual(
      DEFAULT_TARGET_TEXT,
    );
    expect(normalizeTargetText({ color: '#ef4444' }).color).toBe('#ef4444');
    expect(normalizeTargetText({ color: 'tomato' }).color).toBe(DEFAULT_TARGET_TEXT.color);
  });

  it('creates local text objects and filters them out of saveable Cloudflare model objects', () => {
    const modelObject = {
      id: 'object-chair',
      model: { id: 'chair', label: 'Chair', url: 'https://example.com/chair.glb' },
      placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 0, rotationZ: 0 },
    };
    const textObject = createLocalTextObject({
      id: 'text-1',
      text: { value: TAMIL_HELLO, language: 'tamil', font: 'tamil-ui', color: '#14b8a6' },
      placement: { scale: 1.4, offsetX: 0.2, offsetY: -0.1, height: 0.3, rotationX: 0, rotationY: 30, rotationZ: 0 },
    });

    expect(textObject.kind).toBe('text');
    expect(textObject.text.color).toBe('#14b8a6');
    expect(isModelTargetObject(modelObject)).toBe(true);
    expect(isModelTargetObject(textObject)).toBe(false);
    expect(saveableModelObjects([textObject, modelObject])).toEqual([modelObject]);
  });
});

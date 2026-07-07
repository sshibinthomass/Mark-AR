import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TARGET_TEXT,
  TEXT_FILL_MODE_OPTIONS,
  TEXT_FONT_OPTIONS,
  TEXT_GRADIENT_DIRECTION_OPTIONS,
  TEXT_LANGUAGE_OPTIONS,
  TEXT_STYLE_PRESETS,
  createLocalTextObject,
  isModelTargetObject,
  normalizeTargetText,
  saveableModelObjects,
  updateTargetTextObject,
} from '../src/app/targetEditorObjects';

const TAMIL_HELLO = '\u0bb5\u0ba3\u0b95\u0bcd\u0b95\u0bae\u0bcd AR';

describe('target editor object helpers', () => {
  it('provides English, German, and Tamil text presets plus font options', () => {
    expect(TEXT_LANGUAGE_OPTIONS.map((option) => option.id)).toEqual(['english', 'german', 'tamil']);
    expect(TEXT_LANGUAGE_OPTIONS.find((option) => option.id === 'tamil')?.sample).toBe(TAMIL_HELLO);
    expect(TEXT_FONT_OPTIONS.map((option) => option.id)).toEqual([
      'studio-sans',
      'studio-sans-bold',
      'studio-serif',
      'studio-serif-bold',
      'droid-serif',
      'droid-serif-bold',
      'optimer',
      'optimer-bold',
      'helvetiker',
      'helvetiker-bold',
      'studio-mono',
      'tamil-ui',
    ]);
    expect(TEXT_FILL_MODE_OPTIONS.map((option) => option.id)).toEqual(['solid', 'gradient']);
    expect(TEXT_GRADIENT_DIRECTION_OPTIONS.map((option) => option.id)).toEqual([
      'horizontal',
      'vertical',
      'diagonal',
      'depth',
    ]);
    expect(TEXT_STYLE_PRESETS.map((preset) => preset.id)).toEqual([
      'blue-shine',
      'gold-bevel',
      'neon-cyan',
      'red-gloss',
      'tamil-classic',
    ]);
  });

  it('normalizes text content with safe language, font, and color defaults', () => {
    expect(normalizeTargetText({ value: '  Willkommen  ', language: 'german', font: 'studio-serif' })).toEqual({
      value: 'Willkommen',
      language: 'german',
      font: 'studio-serif',
      color: '#2563eb',
      fillMode: 'solid',
      gradientStart: '#2563eb',
      gradientEnd: '#60a5fa',
      gradientDirection: 'horizontal',
      sideColor: '#1d4ed8',
      depth: 0.055,
      bevel: 0.004,
      gloss: 0.68,
      stylePreset: 'blue-shine',
    });
    expect(normalizeTargetText({ value: '', language: 'unknown' as never, font: 'missing' as never })).toEqual(
      DEFAULT_TARGET_TEXT,
    );
    expect(
      normalizeTargetText({
        color: '#ef4444',
        fillMode: 'gradient',
        gradientStart: '#ef4444',
        gradientEnd: '#facc15',
        gradientDirection: 'diagonal',
        sideColor: '#111827',
        depth: 0.11,
        bevel: 0.012,
        gloss: 0.95,
        stylePreset: 'red-gloss',
      }),
    ).toMatchObject({
      color: '#ef4444',
      fillMode: 'gradient',
      gradientStart: '#ef4444',
      gradientEnd: '#facc15',
      gradientDirection: 'diagonal',
      sideColor: '#111827',
      depth: 0.11,
      bevel: 0.012,
      gloss: 0.95,
      stylePreset: 'red-gloss',
    });
    expect(
      normalizeTargetText({
        color: 'tomato',
        fillMode: 'rainbow' as never,
        gradientDirection: 'spiral' as never,
        sideColor: 'blue',
        depth: 9,
        bevel: -1,
        gloss: 2,
        stylePreset: 'missing' as never,
      }),
    ).toMatchObject({
      color: DEFAULT_TARGET_TEXT.color,
      fillMode: DEFAULT_TARGET_TEXT.fillMode,
      gradientDirection: DEFAULT_TARGET_TEXT.gradientDirection,
      sideColor: DEFAULT_TARGET_TEXT.sideColor,
      depth: 0.16,
      bevel: 0,
      gloss: 1,
      stylePreset: DEFAULT_TARGET_TEXT.stylePreset,
    });
  });

  it('creates local text objects and filters them out of saveable Cloudflare model objects', () => {
    const modelObject = {
      id: 'object-chair',
      model: { id: 'chair', label: 'Chair', url: 'https://example.com/chair.glb' },
      placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 0, rotationZ: 0 },
    };
    const textObject = createLocalTextObject({
      id: 'text-1',
      text: {
        value: TAMIL_HELLO,
        language: 'tamil',
        font: 'tamil-ui',
        color: '#14b8a6',
        fillMode: 'gradient',
        gradientStart: '#14b8a6',
        gradientEnd: '#a7f3d0',
        gradientDirection: 'vertical',
        sideColor: '#0f766e',
        depth: 0.08,
        bevel: 0.01,
        gloss: 0.72,
        stylePreset: 'tamil-classic',
      },
      placement: { scale: 1.4, offsetX: 0.2, offsetY: -0.1, height: 0.3, rotationX: 0, rotationY: 30, rotationZ: 0 },
    });

    expect(textObject.kind).toBe('text');
    expect(textObject.text).toMatchObject({
      color: '#14b8a6',
      fillMode: 'gradient',
      gradientEnd: '#a7f3d0',
      gradientDirection: 'vertical',
      sideColor: '#0f766e',
      depth: 0.08,
      bevel: 0.01,
      gloss: 0.72,
      stylePreset: 'tamil-classic',
    });
    expect(isModelTargetObject(modelObject)).toBe(true);
    expect(isModelTargetObject(textObject)).toBe(false);
    expect(saveableModelObjects([textObject, modelObject])).toEqual([modelObject]);
  });

  it('updates an existing local text object while preserving placement and model objects', () => {
    const modelObject = {
      id: 'object-chair',
      model: { id: 'chair', label: 'Chair', url: 'https://example.com/chair.glb' },
      placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 0, rotationZ: 0 },
    };
    const textObject = createLocalTextObject({
      id: 'text-1',
      text: { value: 'Hello AR', language: 'english', font: 'studio-sans' },
      placement: { scale: 1.4, offsetX: 0.2, offsetY: -0.1, height: 0.3, rotationX: 0, rotationY: 30, rotationZ: 0 },
    });

    const updatedObjects = updateTargetTextObject([modelObject, textObject], 'text-1', {
      value: 'Edited AR',
      fillMode: 'gradient',
      gradientStart: '#ef4444',
      gradientEnd: '#facc15',
      gradientDirection: 'diagonal',
      sideColor: '#7f1d1d',
      depth: 0.12,
      bevel: 0.018,
      gloss: 0.9,
    });

    expect(updatedObjects[0]).toBe(modelObject);
    expect(updatedObjects[1]).toMatchObject({
      kind: 'text',
      id: 'text-1',
      text: {
        value: 'Edited AR',
        fillMode: 'gradient',
        gradientStart: '#ef4444',
        gradientEnd: '#facc15',
        gradientDirection: 'diagonal',
        sideColor: '#7f1d1d',
        depth: 0.12,
        bevel: 0.018,
        gloss: 0.9,
      },
      placement: textObject.placement,
    });
  });
});

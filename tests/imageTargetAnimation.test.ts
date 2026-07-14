import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMAGE_TARGET_ANIMATION,
  animationForPreset,
  evaluateAnimationFrame,
  normalizeAnimation,
} from '../src/app/imageTargetAnimation';

describe('image target animation helpers', () => {
  it('keeps animation off by default', () => {
    expect(DEFAULT_IMAGE_TARGET_ANIMATION).toEqual({ preset: 'none', tracks: [] });
    expect(normalizeAnimation()).toEqual(DEFAULT_IMAGE_TARGET_ANIMATION);
  });

  it('creates configured tracks for every named preset', () => {
    expect(animationForPreset('gentle-float')).toEqual({
      preset: 'gentle-float',
      tracks: [
        { property: 'positionY', motion: 'smooth', amount: 0.12, speed: 0.5, phase: 0 },
      ],
    });
    expect(animationForPreset('turntable').tracks).toEqual([
      { property: 'rotationY', motion: 'spin', amount: 360, speed: 0.15, phase: 0 },
    ]);
    expect(animationForPreset('showcase').tracks).toHaveLength(2);
    expect(animationForPreset('sway').tracks[0]).toMatchObject({
      property: 'rotationZ', motion: 'smooth', amount: 12,
    });
    expect(animationForPreset('pulse').tracks[0]).toMatchObject({
      property: 'scale', motion: 'smooth', amount: 0.12,
    });
    expect(animationForPreset('orbit').tracks).toEqual([
      { property: 'positionX', motion: 'smooth', amount: 0.18, speed: 0.3, phase: 0 },
      { property: 'positionZ', motion: 'smooth', amount: 0.18, speed: 0.3, phase: 90 },
    ]);
    expect(animationForPreset('bounce').tracks[0]).toMatchObject({
      property: 'positionY', motion: 'triangle', amount: 0.18, speed: 0.65,
    });
  });

  it('returns defensive preset copies', () => {
    const first = animationForPreset('orbit');
    first.tracks[0].amount = 2;

    expect(animationForPreset('orbit').tracks[0].amount).toBe(0.18);
  });

  it('normalizes tracks with property-specific bounds and valid motion combinations', () => {
    expect(normalizeAnimation({
      preset: 'custom',
      tracks: [
        { property: 'positionX', motion: 'spin', amount: 8, speed: 10, phase: -90 },
        { property: 'rotationZ', motion: 'spin', amount: 900, speed: -10, phase: 450 },
        { property: 'scale', motion: 'smooth', amount: -5, speed: 0.5, phase: 0 },
      ],
    })).toEqual({
      preset: 'custom',
      tracks: [
        { property: 'positionX', motion: 'smooth', amount: 2, speed: 4, phase: 270 },
        { property: 'rotationZ', motion: 'spin', amount: 720, speed: -4, phase: 90 },
        { property: 'scale', motion: 'smooth', amount: -0.9, speed: 0.5, phase: 0 },
      ],
    });
  });

  it('limits custom configurations to sixteen valid tracks', () => {
    const tracks = Array.from({ length: 20 }, (_, index) => ({
      property: index % 2 ? 'positionX' : 'not-a-property',
      motion: 'smooth',
      amount: 0.2,
      speed: 1,
      phase: 0,
    }));

    expect(normalizeAnimation({ preset: 'custom', tracks } as never).tracks).toHaveLength(10);
  });

  it('migrates legacy spin and bob fields without changing their timing', () => {
    const migrated = normalizeAnimation({
      spinAxis: 'y',
      spinSpeed: Math.PI,
      bobHeight: 0.1,
      bobSpeed: 2 * Math.PI,
    });

    expect(migrated.preset).toBe('custom');
    expect(migrated.tracks).toEqual([
      { property: 'rotationY', motion: 'spin', amount: 360, speed: 0.5, phase: 0 },
      { property: 'positionY', motion: 'smooth', amount: 0.1, speed: 1, phase: 0 },
    ]);
  });
});

describe('animation frame evaluation', () => {
  it('returns an identity frame when animation is off', () => {
    expect(evaluateAnimationFrame(DEFAULT_IMAGE_TARGET_ANIMATION, 12)).toEqual({
      position: { x: 0, y: 0, z: 0 },
      rotationRadians: { x: 0, y: 0, z: 0 },
      scaleMultiplier: 1,
    });
  });

  it('evaluates smooth motion and phase offsets', () => {
    const frame = evaluateAnimationFrame({
      preset: 'custom',
      tracks: [
        { property: 'positionX', motion: 'smooth', amount: 2, speed: 1, phase: 0 },
        { property: 'positionZ', motion: 'smooth', amount: 3, speed: 1, phase: 90 },
      ],
    }, 0.25);

    expect(frame.position.x).toBeCloseTo(2);
    expect(frame.position.z).toBeCloseTo(0);
  });

  it('evaluates centered triangle motion', () => {
    const animation = {
      preset: 'custom' as const,
      tracks: [
        { property: 'positionY' as const, motion: 'triangle' as const, amount: 2, speed: 1, phase: 0 },
      ],
    };

    expect(evaluateAnimationFrame(animation, 0).position.y).toBeCloseTo(0);
    expect(evaluateAnimationFrame(animation, 0.25).position.y).toBeCloseTo(2);
    expect(evaluateAnimationFrame(animation, 0.5).position.y).toBeCloseTo(0);
  });

  it('evaluates continuous spin in radians', () => {
    const frame = evaluateAnimationFrame({
      preset: 'custom',
      tracks: [
        { property: 'rotationY', motion: 'spin', amount: 360, speed: 0.5, phase: 90 },
      ],
    }, 1);

    expect(frame.rotationRadians.y).toBeCloseTo(1.5 * Math.PI);
  });

  it('adds tracks targeting the same property and keeps scale positive', () => {
    const frame = evaluateAnimationFrame({
      preset: 'custom',
      tracks: [
        { property: 'positionX', motion: 'smooth', amount: 1, speed: 1, phase: 90 },
        { property: 'positionX', motion: 'smooth', amount: 0.5, speed: 1, phase: 90 },
        { property: 'scale', motion: 'smooth', amount: -0.9, speed: 1, phase: 90 },
        { property: 'scale', motion: 'smooth', amount: -0.9, speed: 1, phase: 90 },
      ],
    }, 0);

    expect(frame.position.x).toBeCloseTo(1.5);
    expect(frame.scaleMultiplier).toBe(0.05);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { animationForPreset } from '../src/app/imageTargetAnimation';
import { createAnimationTrackEditor } from '../src/ui/animationTrackEditor';

describe('animation track editor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders editable track cards with accessible transform properties', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const editor = createAnimationTrackEditor(container, { onChange: vi.fn() });

    editor.render(animationForPreset('orbit'));

    expect(container.querySelectorAll('[data-animation-track]')).toHaveLength(2);
    expect(container.querySelectorAll('label')).toHaveLength(10);
    expect(Array.from(container.querySelectorAll('[data-animation-field="property"] option'))
      .map((option) => option.textContent)).toEqual([
      'Position X', 'Position Y', 'Position Z',
      'Rotation X', 'Rotation Y', 'Rotation Z',
      'Overall scale',
      'Position X', 'Position Y', 'Position Z',
      'Rotation X', 'Rotation Y', 'Rotation Z',
      'Overall scale',
    ]);
    expect(container.querySelector('[data-animation-value="amount"]')?.textContent).toContain('units');
  });

  it('emits custom animation when a track is edited', () => {
    const container = document.createElement('div');
    const onChange = vi.fn();
    const editor = createAnimationTrackEditor(container, { onChange });
    editor.render(animationForPreset('gentle-float'));

    const amount = container.querySelector<HTMLInputElement>('[data-animation-field="amount"]')!;
    amount.value = '0.4';
    amount.dispatchEvent(new Event('input', { bubbles: true }));

    expect(onChange).toHaveBeenLastCalledWith({
      preset: 'custom',
      tracks: [
        { property: 'positionY', motion: 'smooth', amount: 0.4, speed: 0.5, phase: 0 },
      ],
    });
    expect(container.querySelector('[data-animation-value="amount"]')?.textContent).toBe('0.4 units');
  });

  it('adds and removes motion tracks', () => {
    const container = document.createElement('div');
    const onChange = vi.fn();
    const editor = createAnimationTrackEditor(container, { onChange });
    editor.render(animationForPreset('orbit'));

    editor.addTrack();

    expect(container.querySelectorAll('[data-animation-track]')).toHaveLength(3);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      preset: 'custom',
      tracks: expect.arrayContaining([
        { property: 'positionY', motion: 'smooth', amount: 0.12, speed: 0.5, phase: 0 },
      ]),
    }));

    container.querySelector<HTMLButtonElement>('[data-remove-animation-track]')?.click();

    expect(container.querySelectorAll('[data-animation-track]')).toHaveLength(2);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ preset: 'custom' }));
  });

  it('does not offer continuous spin for position or scale tracks', () => {
    const container = document.createElement('div');
    const editor = createAnimationTrackEditor(container, { onChange: vi.fn() });
    editor.render(animationForPreset('gentle-float'));

    expect(Array.from(container.querySelectorAll('[data-animation-field="motion"] option'))
      .map((option) => (option as HTMLOptionElement).value)).toEqual(['smooth', 'triangle']);
  });
});

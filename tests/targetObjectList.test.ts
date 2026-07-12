import { describe, expect, it, vi } from 'vitest';
import { renderTargetObjectListItem } from '../src/ui/targetObjectList';

describe('renderTargetObjectListItem', () => {
  it('renders a text row with a separate delete button next to the text', () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    const row = renderTargetObjectListItem({
      object: {
        kind: 'text',
        id: 'text-1',
        text: {
          value: 'Hello AR',
          language: 'english',
          font: 'studio-sans',
          color: '#ef4444',
          fillMode: 'gradient',
          gradientStart: '#ef4444',
          gradientEnd: '#facc15',
          gradientDirection: 'horizontal',
          sideColor: '#7f1d1d',
          depth: 0.08,
          bevel: 0.01,
          gloss: 0.86,
          stylePreset: 'red-gloss',
        },
        placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 0, rotationZ: 0 },
      },
      index: 0,
      selectedObjectId: 'text-1',
      onSelect,
      onDelete,
    });

    const selectButton = row.querySelector<HTMLButtonElement>('[data-select-target-object="text-1"]');
    const deleteButton = row.querySelector<HTMLButtonElement>('[data-delete-target-object="text-1"]');
    const swatch = row.querySelector<HTMLElement>('[data-text-color-swatch]');

    expect(row.getAttribute('role')).toBe('listitem');
    expect(selectButton?.textContent).toContain('Hello AR');
    expect(selectButton?.textContent).toContain('Gradient');
    expect(deleteButton?.getAttribute('aria-label')).toBe('Delete text Hello AR');
    expect(deleteButton?.getAttribute('title')).toBe('Delete text Hello AR');
    expect(deleteButton?.textContent?.trim()).toBe('');
    const icon = deleteButton?.querySelector('svg.trash-icon');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(icon?.querySelectorAll('path')).toHaveLength(3);
    expect(swatch?.getAttribute('style')).toContain('linear-gradient');
    expect(swatch?.getAttribute('style')).toContain('#ef4444');
    expect(swatch?.getAttribute('style')).toContain('#facc15');

    deleteButton?.click();

    expect(onDelete).toHaveBeenCalledWith('text-1');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders a model row with its own delete button', () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    const row = renderTargetObjectListItem({
      object: {
        id: 'model-1',
        model: { id: 'chair', label: 'Chair', url: 'https://example.com/chair.glb' },
        placement: { scale: 1.25, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 0, rotationZ: 0 },
      },
      index: 1,
      selectedObjectId: undefined,
      onSelect,
      onDelete,
    });

    expect(row.querySelector('[data-delete-text-object]')).toBeNull();
    const deleteButton = row.querySelector<HTMLButtonElement>('[data-delete-target-object="model-1"]');
    expect(deleteButton?.getAttribute('aria-label')).toBe('Delete object Chair');
    expect(deleteButton?.getAttribute('title')).toBe('Delete object Chair');
    expect(deleteButton?.textContent?.trim()).toBe('');
    const icon = deleteButton?.querySelector('svg.trash-icon');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(icon?.querySelectorAll('path')).toHaveLength(3);

    row.querySelector<HTMLButtonElement>('[data-select-target-object="model-1"]')?.click();
    expect(onSelect).toHaveBeenCalledWith('model-1');

    deleteButton?.click();
    expect(onDelete).toHaveBeenCalledWith('model-1');
  });
});

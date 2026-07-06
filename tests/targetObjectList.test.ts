import { describe, expect, it, vi } from 'vitest';
import { renderTargetObjectListItem } from '../src/ui/targetObjectList';

describe('renderTargetObjectListItem', () => {
  it('renders a text row with a separate delete button next to the text', () => {
    const onSelect = vi.fn();
    const onDeleteText = vi.fn();
    const row = renderTargetObjectListItem({
      object: {
        kind: 'text',
        id: 'text-1',
        text: { value: 'Hello AR', language: 'english', font: 'studio-sans', color: '#ef4444' },
        placement: { scale: 1, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 0, rotationZ: 0 },
      },
      index: 0,
      selectedObjectId: 'text-1',
      onSelect,
      onDeleteText,
    });

    const selectButton = row.querySelector<HTMLButtonElement>('[data-select-target-object="text-1"]');
    const deleteButton = row.querySelector<HTMLButtonElement>('[data-delete-text-object="text-1"]');
    const swatch = row.querySelector<HTMLElement>('[data-text-color-swatch]');

    expect(row.getAttribute('role')).toBe('listitem');
    expect(selectButton?.textContent).toContain('Hello AR');
    expect(deleteButton?.getAttribute('aria-label')).toBe('Delete text Hello AR');
    expect(swatch?.style.backgroundColor).toBe('#ef4444');

    deleteButton?.click();

    expect(onDeleteText).toHaveBeenCalledWith('text-1');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps model rows selectable without adding a text delete button', () => {
    const onSelect = vi.fn();
    const row = renderTargetObjectListItem({
      object: {
        id: 'model-1',
        model: { id: 'chair', label: 'Chair', url: 'https://example.com/chair.glb' },
        placement: { scale: 1.25, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 0, rotationZ: 0 },
      },
      index: 1,
      selectedObjectId: undefined,
      onSelect,
      onDeleteText: vi.fn(),
    });

    expect(row.querySelector('[data-delete-text-object]')).toBeNull();

    row.querySelector<HTMLButtonElement>('[data-select-target-object="model-1"]')?.click();

    expect(onSelect).toHaveBeenCalledWith('model-1');
  });
});

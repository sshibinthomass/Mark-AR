import { describe, expect, it, vi } from 'vitest';
import { renderTargetObjectList, renderTargetObjectListItem } from '../src/ui/targetObjectList';

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
    expect(onSelect).toHaveBeenCalledWith('model-1', false);

    deleteButton?.click();
    expect(onDelete).toHaveBeenCalledWith('model-1');
  });
});

describe('renderTargetObjectList', () => {
  const placement = { scale: 1, offsetX: 0, offsetY: 0, height: 0.12, rotationX: 0, rotationY: 0, rotationZ: 0 };
  const objects = [
    { id: 'chair', model: { id: 'chair', label: 'Chair', url: 'https://example.com/chair.glb' }, placement, groupId: 'group-1', localPlacement: placement },
    { id: 'lamp', model: { id: 'lamp', label: 'Lamp', url: 'https://example.com/lamp.glb' }, placement, groupId: 'group-1', localPlacement: placement },
    { id: 'plant', model: { id: 'plant', label: 'Plant', url: 'https://example.com/plant.glb' }, placement },
  ];
  const groups = [{ id: 'group-1', label: 'Group 1', placement, animation: { preset: 'none' as const, tracks: [] } }];

  it('renders collapsible group rows, indented children, and an ungroup action', () => {
    const onSelectGroup = vi.fn();
    const onUngroup = vi.fn();
    const list = renderTargetObjectList({
      objects,
      groups,
      selection: { objectIds: [], groupId: 'group-1' },
      onSelectObject: vi.fn(),
      onSelectGroup,
      onUngroup,
      onDeleteObject: vi.fn(),
    });

    const group = list.querySelector<HTMLElement>('[data-target-object-group="group-1"]');
    expect(group?.getAttribute('aria-selected')).toBe('true');
    expect(group?.querySelector('[data-select-target-group="group-1"]')?.textContent).toContain('Group 1');
    expect(group?.querySelector('[data-select-target-group="group-1"]')?.textContent).toContain('2 objects');
    expect(group?.querySelector('details')?.open).toBe(true);
    expect(group?.querySelectorAll('.target-object-group-children > .target-object-row')).toHaveLength(2);
    expect(group?.querySelector('[data-object-id="chair"]')?.getAttribute('aria-selected')).toBe('false');

    group?.querySelector<HTMLButtonElement>('[data-select-target-group="group-1"]')?.click();
    group?.querySelector<HTMLButtonElement>('[data-ungroup-target-group="group-1"]')?.click();
    expect(onSelectGroup).toHaveBeenCalledWith('group-1');
    expect(onUngroup).toHaveBeenCalledWith('group-1');
    expect(list.querySelector('[data-object-id="plant"]')?.closest('[data-target-object-group]')).toBeNull();
  });

  it('marks multiple child rows and forwards Ctrl/Command additive selection', () => {
    const onSelectObject = vi.fn();
    const list = renderTargetObjectList({
      objects,
      groups,
      selection: { objectIds: ['chair', 'plant'] },
      onSelectObject,
      onSelectGroup: vi.fn(),
      onUngroup: vi.fn(),
      onDeleteObject: vi.fn(),
    });

    expect(list.querySelector('[data-object-id="chair"]')?.getAttribute('aria-selected')).toBe('true');
    expect(list.querySelector('[data-object-id="plant"]')?.getAttribute('aria-selected')).toBe('true');
    expect(list.querySelector('[data-object-id="lamp"]')?.getAttribute('aria-selected')).toBe('false');

    list.querySelector<HTMLButtonElement>('[data-select-target-object="chair"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    list.querySelector<HTMLButtonElement>('[data-select-target-object="lamp"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true }));
    expect(onSelectObject).toHaveBeenNthCalledWith(1, 'chair', true);
    expect(onSelectObject).toHaveBeenNthCalledWith(2, 'lamp', true);
  });
});

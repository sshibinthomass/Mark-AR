import { describe, expect, it } from 'vitest';
import type { CloudflareModelOption } from '../src/app/cloudflareModels';
import { renderTargetModelRail } from '../src/ui/modelRail';

describe('renderTargetModelRail', () => {
  it('renders selectable model thumbnail tiles and marks the selected model', () => {
    const models: CloudflareModelOption[] = [
      {
        id: 'generated-chair',
        label: 'Chair',
        url: 'https://worker.example/models/chair.glb',
        previewUrl: 'https://worker.example/previews/chair.png',
      },
      {
        id: 'static-lamp',
        label: 'Lamp shade',
        url: 'https://worker.example/models/lamp.glb',
      },
    ];
    const selectedIds: string[] = [];
    const container = document.createElement('div');

    renderTargetModelRail(container, {
      models,
      selectedModelId: 'generated-chair',
      onSelect: (model) => selectedIds.push(model.id),
    });

    const options = container.querySelectorAll<HTMLButtonElement>('[role="option"]');
    expect(options).toHaveLength(2);
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    expect(options[0].getAttribute('aria-label')).toBe('Chair');
    expect(options[0].querySelector('img')?.src).toBe('https://worker.example/previews/chair.png');
    expect(options[0].querySelector('.target-model-card-label')?.getAttribute('aria-hidden')).toBe('true');
    expect(options[1].querySelector('.target-model-thumb-fallback')?.textContent).toBe('LS');

    options[1].click();

    expect(selectedIds).toEqual(['static-lamp']);
  });

  it('marks the downloading model card busy and exposes loading status', () => {
    const model: CloudflareModelOption = {
      id: 'generated-chair',
      label: 'Chair',
      url: 'https://worker.example/models/chair.glb',
      previewUrl: 'https://worker.example/previews/chair.png',
    };
    const container = document.createElement('div');

    renderTargetModelRail(container, {
      models: [model],
      loadingModelId: model.id,
      onSelect: () => undefined,
    });

    const card = container.querySelector<HTMLButtonElement>('.target-model-card');
    expect(card?.disabled).toBe(true);
    expect(card?.getAttribute('aria-busy')).toBe('true');
    expect(card?.querySelector('[role="status"]')?.textContent).toBe('Loading Chair…');
  });
});

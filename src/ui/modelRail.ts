import type { CloudflareModelOption } from '../app/cloudflareModels';

type RenderTargetModelRailInput = {
  models: CloudflareModelOption[];
  selectedModelId?: string;
  onSelect: (model: CloudflareModelOption) => void;
};

export function renderTargetModelRail(
  container: HTMLElement,
  { models, selectedModelId, onSelect }: RenderTargetModelRailInput,
): void {
  container.replaceChildren();

  if (models.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'target-model-rail-empty';
    empty.textContent = 'No models loaded';
    container.append(empty);
    return;
  }

  for (const model of models) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'target-model-card';
    option.dataset.modelId = model.id;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(model.id === selectedModelId));
    option.setAttribute('aria-label', model.label);
    option.title = model.label;
    option.addEventListener('click', () => onSelect(model));

    const thumb = document.createElement('span');
    thumb.className = 'target-model-thumb';
    if (model.previewUrl) {
      const image = document.createElement('img');
      image.className = 'target-model-thumb-image';
      image.src = model.previewUrl;
      image.alt = '';
      image.loading = 'lazy';
      thumb.append(image);
    } else {
      const fallback = document.createElement('span');
      fallback.className = 'target-model-thumb-fallback';
      fallback.textContent = modelInitials(model.label);
      thumb.append(fallback);
    }

    const label = document.createElement('span');
    label.className = 'target-model-card-label';
    label.setAttribute('aria-hidden', 'true');
    label.textContent = model.label;

    option.append(thumb, label);
    container.append(option);
  }
}

function modelInitials(label: string): string {
  const initials = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return initials || '3D';
}

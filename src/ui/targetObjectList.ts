import {
  fontOption,
  fillModeOption,
  gradientDirectionOption,
  isTextTargetObject,
  languageOption,
  normalizeTargetText,
  type TargetEditorObject,
} from '../app/targetEditorObjects';

export type TargetObjectListItemOptions = {
  object: TargetEditorObject;
  index: number;
  selectedObjectId?: string;
  onSelect: (objectId: string) => void;
  onDelete: (objectId: string) => void;
};

export function renderTargetObjectListItem({
  object,
  index,
  selectedObjectId,
  onSelect,
  onDelete,
}: TargetObjectListItemOptions): HTMLElement {
  const row = document.createElement('div');
  row.className = 'target-object-row';
  row.dataset.objectId = object.id;
  row.setAttribute('role', 'listitem');
  row.setAttribute('aria-selected', String(object.id === selectedObjectId));

  const selectButton = document.createElement('button');
  selectButton.type = 'button';
  selectButton.className = 'target-object-select';
  selectButton.dataset.selectTargetObject = object.id;
  selectButton.addEventListener('click', () => onSelect(object.id));

  const label = document.createElement('strong');
  const meta = document.createElement('small');
  if (isTextTargetObject(object)) {
    row.classList.add('target-object-row-text');
    const text = normalizeTargetText(object.text);
    const swatch = document.createElement('span');
    swatch.className = 'target-object-color-swatch';
    swatch.dataset.textColorSwatch = '';
    if (text.fillMode === 'gradient') {
      swatch.style.background = `linear-gradient(90deg, ${text.gradientStart}, ${text.gradientEnd})`;
    } else {
      swatch.style.backgroundColor = text.color ?? '';
    }
    swatch.setAttribute('aria-hidden', 'true');
    label.textContent = text.value;
    const fillLabel = fillModeOption(text.fillMode ?? 'solid').label;
    const directionLabel = gradientDirectionOption(text.gradientDirection ?? 'horizontal').label;
    meta.textContent = text.fillMode === 'gradient'
      ? `${languageOption(text.language).label} / ${fontOption(text.font).label} / ${fillLabel} ${directionLabel}`
      : `${languageOption(text.language).label} / ${fontOption(text.font).label} / ${fillLabel}`;
    selectButton.append(swatch, label, meta);

    row.append(selectButton, createDeleteButton(object.id, `Delete text ${text.value}`, onDelete));
    return row;
  }

  row.classList.add('target-object-row-model');
  label.textContent = object.model.label;
  meta.textContent = `${index + 1} / ${Number(object.placement.scale.toFixed(2))}x`;
  selectButton.append(label, meta);
  row.append(selectButton, createDeleteButton(object.id, `Delete object ${object.model.label}`, onDelete));
  return row;
}

function createDeleteButton(
  objectId: string,
  label: string,
  onDelete: (objectId: string) => void,
): HTMLButtonElement {
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'target-object-delete';
  deleteButton.dataset.deleteTargetObject = objectId;
  deleteButton.textContent = 'Delete';
  deleteButton.setAttribute('aria-label', label);
  deleteButton.addEventListener('click', () => onDelete(objectId));
  return deleteButton;
}

import {
  fontOption,
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
  onDeleteText: (objectId: string) => void;
};

export function renderTargetObjectListItem({
  object,
  index,
  selectedObjectId,
  onSelect,
  onDeleteText,
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
    swatch.style.backgroundColor = text.color ?? '';
    swatch.setAttribute('aria-hidden', 'true');
    label.textContent = text.value;
    meta.textContent = `${languageOption(text.language).label} / ${fontOption(text.font).label}`;
    selectButton.append(swatch, label, meta);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'target-object-delete';
    deleteButton.dataset.deleteTextObject = object.id;
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', `Delete text ${text.value}`);
    deleteButton.addEventListener('click', () => onDeleteText(object.id));
    row.append(selectButton, deleteButton);
    return row;
  }

  row.classList.add('target-object-row-model');
  label.textContent = object.model.label;
  meta.textContent = `${index + 1} / ${Number(object.placement.scale.toFixed(2))}x`;
  selectButton.append(label, meta);
  row.append(selectButton);
  return row;
}

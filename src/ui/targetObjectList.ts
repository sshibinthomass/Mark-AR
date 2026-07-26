import {
  fontOption,
  fillModeOption,
  gradientDirectionOption,
  isTextTargetObject,
  languageOption,
  normalizeTargetText,
  targetObjectLabel,
  type TargetEditorObject,
} from '../app/targetEditorObjects';
import type { TargetEditorGroup, TargetEditorSelection } from '../app/targetEditorGroups';
import { decorateDeleteIconButton } from './deleteIconButton';

export type TargetObjectListItemOptions = {
  object: TargetEditorObject;
  index: number;
  selectedObjectId?: string;
  selectedObjectIds?: string[];
  hidden?: boolean;
  locked?: boolean;
  onSelect: (objectId: string, additive: boolean) => void;
  onDelete: (objectId: string) => void;
};

export type TargetObjectListOptions = {
  objects: TargetEditorObject[];
  groups: TargetEditorGroup[];
  selection: TargetEditorSelection;
  onSelectObject: (objectId: string, additive: boolean) => void;
  onSelectGroup: (groupId: string) => void;
  onUngroup: (groupId: string) => void;
  onDeleteObject: (objectId: string) => void;
  hiddenKeys?: ReadonlySet<string>;
  lockedKeys?: ReadonlySet<string>;
};

export function renderTargetObjectListItem({
  object,
  index,
  selectedObjectId,
  selectedObjectIds = selectedObjectId ? [selectedObjectId] : [],
  hidden = false,
  locked = false,
  onSelect,
  onDelete,
}: TargetObjectListItemOptions): HTMLElement {
  const row = document.createElement('div');
  row.className = 'target-object-row';
  row.dataset.objectId = object.id;
  row.dataset.hidden = String(hidden);
  row.dataset.locked = String(locked);
  row.setAttribute('role', 'listitem');
  row.setAttribute('aria-selected', String(selectedObjectIds.includes(object.id)));

  const selectButton = document.createElement('button');
  selectButton.type = 'button';
  selectButton.className = 'target-object-select';
  selectButton.dataset.selectTargetObject = object.id;
  selectButton.addEventListener('click', (event) => onSelect(object.id, event.ctrlKey || event.metaKey));

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
    selectButton.append(swatch, label, meta, ...createStateBadges(hidden, locked));

    row.append(selectButton, createDeleteButton(object.id, `Delete text ${text.value}`, onDelete, locked));
    return row;
  }

  row.classList.add(`target-object-row-${object.kind ?? 'model'}`);
  label.textContent = targetObjectLabel(object);
  meta.textContent = `${index + 1} / ${Number(object.placement.scale.toFixed(2))}x`;
  selectButton.append(label, meta, ...createStateBadges(hidden, locked));
  row.append(selectButton, createDeleteButton(object.id, `Delete object ${targetObjectLabel(object)}`, onDelete, locked));
  return row;
}

export function renderTargetObjectList({
  objects,
  groups,
  selection,
  onSelectObject,
  onSelectGroup,
  onUngroup,
  onDeleteObject,
  hiddenKeys = new Set(),
  lockedKeys = new Set(),
}: TargetObjectListOptions): HTMLElement {
  const list = document.createElement('div');
  list.className = 'target-object-list-content';
  const validGroupIds = new Set(groups.map((group) => group.id));
  const groupedObjectIds = new Set<string>();

  for (const group of groups) {
    const members = objects.filter((object) => object.groupId === group.id);
    if (members.length === 0) {
      continue;
    }
    members.forEach((object) => groupedObjectIds.add(object.id));
    list.append(createGroupRow({
      group,
      members,
      objects,
      selection,
      onSelectObject,
      onSelectGroup,
      onUngroup,
      onDeleteObject,
      hiddenKeys,
      lockedKeys,
    }));
  }

  objects.forEach((object, index) => {
    if (groupedObjectIds.has(object.id) || (object.groupId && validGroupIds.has(object.groupId))) {
      return;
    }
    list.append(renderTargetObjectListItem({
      object,
      index,
      selectedObjectIds: selection.objectIds,
      hidden: hiddenKeys.has(`object:${object.id}`),
      locked: lockedKeys.has(`object:${object.id}`),
      onSelect: onSelectObject,
      onDelete: onDeleteObject,
    }));
  });
  return list;
}

function createGroupRow({
  group,
  members,
  objects,
  selection,
  onSelectObject,
  onSelectGroup,
  onUngroup,
  onDeleteObject,
  hiddenKeys = new Set(),
  lockedKeys = new Set(),
}: Omit<TargetObjectListOptions, 'groups'> & { group: TargetEditorGroup; members: TargetEditorObject[] }): HTMLElement {
  const row = document.createElement('section');
  row.className = 'target-object-group';
  row.dataset.targetObjectGroup = group.id;
  row.setAttribute('role', 'listitem');
  row.setAttribute('aria-selected', String(selection.groupId === group.id));

  const details = document.createElement('details');
  details.open = true;
  const summary = document.createElement('summary');
  summary.className = 'target-object-group-summary';

  const selectButton = document.createElement('button');
  selectButton.type = 'button';
  selectButton.className = 'target-object-group-select';
  selectButton.dataset.selectTargetGroup = group.id;
  selectButton.setAttribute('aria-expanded', 'true');
  const label = document.createElement('strong');
  label.textContent = group.label;
  const count = document.createElement('small');
  count.textContent = `${members.length} object${members.length === 1 ? '' : 's'}`;
  const groupHidden = hiddenKeys.has(`group:${group.id}`);
  const groupLocked = lockedKeys.has(`group:${group.id}`);
  row.dataset.hidden = String(groupHidden);
  row.dataset.locked = String(groupLocked);
  selectButton.append(label, count, ...createStateBadges(groupHidden, groupLocked));
  selectButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectGroup(group.id);
  });

  const ungroupButton = document.createElement('button');
  ungroupButton.type = 'button';
  ungroupButton.className = 'target-object-ungroup';
  ungroupButton.dataset.ungroupTargetGroup = group.id;
  ungroupButton.textContent = 'Ungroup';
  ungroupButton.disabled = groupLocked;
  ungroupButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onUngroup(group.id);
  });
  summary.append(selectButton, ungroupButton);

  const children = document.createElement('div');
  children.className = 'target-object-group-children';
  members.forEach((object) => {
    const index = objects.findIndex((candidate) => candidate.id === object.id);
    children.append(renderTargetObjectListItem({
      object,
      index,
      selectedObjectIds: selection.objectIds,
      hidden: groupHidden || hiddenKeys.has(`object:${object.id}`),
      locked: groupLocked || lockedKeys.has(`object:${object.id}`),
      onSelect: onSelectObject,
      onDelete: onDeleteObject,
    }));
  });
  details.addEventListener('toggle', () => selectButton.setAttribute('aria-expanded', String(details.open)));
  details.append(summary, children);
  row.append(details);
  return row;
}

function createStateBadges(hidden: boolean, locked: boolean): HTMLElement[] {
  const badges: HTMLElement[] = [];
  if (hidden) {
    badges.push(createStateBadge('hidden', 'Hidden'));
  }
  if (locked) {
    badges.push(createStateBadge('locked', 'Locked'));
  }
  return badges;
}

function createStateBadge(state: 'hidden' | 'locked', label: string): HTMLElement {
  const badge = document.createElement('span');
  badge.className = `target-object-state target-object-state-${state}`;
  badge.dataset.objectState = state;
  badge.textContent = label;
  return badge;
}

function createDeleteButton(
  objectId: string,
  label: string,
  onDelete: (objectId: string) => void,
  disabled = false,
): HTMLButtonElement {
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'target-object-delete';
  deleteButton.dataset.deleteTargetObject = objectId;
  deleteButton.disabled = disabled;
  decorateDeleteIconButton(deleteButton, label);
  deleteButton.addEventListener('click', () => onDelete(objectId));
  return deleteButton;
}

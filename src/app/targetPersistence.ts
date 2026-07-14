import type { CloudImageTarget } from './cloudImageTargets';
import { normalizeAnimation } from './imageTargetAnimation';
import { normalizePlacement } from './imageTargetPayload';
import { normalizeLocalPlacement, type TargetEditorGroup } from './targetEditorGroups';
import {
  isTextTargetObject,
  normalizeTargetText,
  type TargetEditorObject,
} from './targetEditorObjects';

export function savedTargetAuthoringMismatch(
  expectedObjects: TargetEditorObject[],
  expectedGroups: TargetEditorGroup[],
  savedTarget: CloudImageTarget,
): string | undefined {
  const objectMismatch = compareById(
    expectedObjects,
    savedTarget.objects,
    canonicalObject,
    'object',
  );
  if (objectMismatch) {
    return objectMismatch;
  }

  const usedGroupIds = new Set(expectedObjects.flatMap((object) => object.groupId ? [object.groupId] : []));
  const usedExpectedGroups = expectedGroups.filter((group) => usedGroupIds.has(group.id));
  return compareById(
    usedExpectedGroups,
    savedTarget.groups,
    canonicalGroup,
    'group',
  );
}

function compareById<T extends { id: string }>(
  expectedItems: T[],
  savedItems: T[],
  canonicalize: (item: T) => unknown,
  itemLabel: 'object' | 'group',
): string | undefined {
  const duplicateExpectedId = duplicateId(expectedItems);
  if (duplicateExpectedId) {
    return `The editor contains duplicate ${itemLabel} id ${duplicateExpectedId}.`;
  }
  const duplicateSavedId = duplicateId(savedItems);
  if (duplicateSavedId) {
    return `The saved target returned duplicate ${itemLabel} id ${duplicateSavedId}.`;
  }

  const expectedById = new Map(expectedItems.map((item) => [item.id, item]));
  const savedById = new Map(savedItems.map((item) => [item.id, item]));
  for (const [id, expected] of expectedById) {
    const saved = savedById.get(id);
    if (!saved) {
      return `The saved target did not preserve ${itemLabel} ${id}.`;
    }
    if (JSON.stringify(canonicalize(expected)) !== JSON.stringify(canonicalize(saved))) {
      return `The saved target changed ${itemLabel} ${id}.`;
    }
  }

  for (const id of savedById.keys()) {
    if (!expectedById.has(id)) {
      return `The saved target returned unexpected ${itemLabel} ${id}.`;
    }
  }
  return undefined;
}

function duplicateId(items: Array<{ id: string }>): string | undefined {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      return item.id;
    }
    seen.add(item.id);
  }
  return undefined;
}

function canonicalObject(object: TargetEditorObject): unknown {
  const shared = {
    id: object.id,
    placement: normalizePlacement(object.placement),
    animation: normalizeAnimation(object.animation),
    groupId: object.groupId ?? null,
    localPlacement: object.localPlacement ? normalizeLocalPlacement(object.localPlacement) : null,
  };
  if (isTextTargetObject(object)) {
    return {
      ...shared,
      kind: 'text',
      text: normalizeTargetText(object.text),
    };
  }
  return {
    ...shared,
    kind: 'model',
    model: {
      id: object.model.id,
      label: object.model.label,
      url: object.model.url,
      previewUrl: object.model.previewUrl ?? null,
    },
  };
}

function canonicalGroup(group: TargetEditorGroup): unknown {
  return {
    id: group.id,
    label: group.label,
    placement: normalizePlacement(group.placement),
    animation: normalizeAnimation(group.animation),
  };
}

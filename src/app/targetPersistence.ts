import type { CloudImageTarget } from './cloudImageTargets';
import { normalizeAnimation } from './imageTargetAnimation';
import { normalizePlacement } from './imageTargetPayload';
import { normalizeLocalPlacement, type TargetEditorGroup } from './targetEditorGroups';
import {
  isTextTargetObject,
  normalizeTargetText,
  type TargetEditorObject,
} from './targetEditorObjects';
import { normalizeImageTargetAccess, type ImageTargetAccess } from './imageTargetAccess';

type ExpectedTargetAccess = ImageTargetAccess & {
  scanId?: string;
};

export function savedTargetAuthoringMismatch(
  expectedObjects: TargetEditorObject[],
  expectedGroups: TargetEditorGroup[],
  savedTarget: CloudImageTarget,
  expectedAccess?: ExpectedTargetAccess,
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
  const groupMismatch = compareById(
    usedExpectedGroups,
    savedTarget.groups,
    canonicalGroup,
    'group',
  );
  if (groupMismatch) {
    return groupMismatch;
  }
  if (!expectedAccess) {
    return undefined;
  }
  if (!savedTarget.scanId) {
    return 'The saved target did not return a scan link.';
  }
  if (expectedAccess.scanId && savedTarget.scanId !== expectedAccess.scanId) {
    return 'The saved target changed the scan link.';
  }
  const expected = normalizeImageTargetAccess(expectedAccess);
  const saved = normalizeImageTargetAccess({
    accessMode: savedTarget.accessMode,
    allowedEmails: savedTarget.allowedEmails,
  }, savedTarget.visibility);
  if (saved.accessMode !== expected.accessMode) {
    return 'The saved target changed the access mode.';
  }
  if (JSON.stringify([...saved.allowedEmails].sort()) !== JSON.stringify([...expected.allowedEmails].sort())) {
    return 'The saved target changed the account access list.';
  }
  return undefined;
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

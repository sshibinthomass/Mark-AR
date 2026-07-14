import type { CloudImageTarget } from './cloudImageTargets';
import type { TargetEditorGroup, TargetEditorSelection } from './targetEditorGroups';
import type { ImageTargetImagePayload } from './imageTargetPayload';
import { imageTargetDataUrl } from './imageTargetPayload';
import type { TargetEditorObject } from './targetEditorObjects';

export type EditingTargetState = {
  targetId: string;
  imageUrl: string;
};

export type EditableTargetSession = EditingTargetState & {
  label: string;
  objects: TargetEditorObject[];
  groups: TargetEditorGroup[];
  selection: TargetEditorSelection;
};

export function createEditingTargetSession(target: CloudImageTarget): EditableTargetSession {
  const objects = structuredClone(target.objects);
  const groups = structuredClone(target.groups);
  return {
    targetId: target.id,
    imageUrl: target.imageUrl,
    label: target.label,
    objects,
    groups,
    selection: { objectIds: objects[0] ? [objects[0].id] : [] },
  };
}

export function targetPreviewImageUrl(
  editingTarget: EditingTargetState | undefined,
  replacementImage?: ImageTargetImagePayload,
): string | undefined {
  return replacementImage ? imageTargetDataUrl(replacementImage) : editingTarget?.imageUrl;
}

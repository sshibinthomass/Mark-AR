import type { CloudImageTarget } from '../app/cloudImageTargets';
import { isTextTargetObject } from '../app/targetEditorObjects';
import { decorateDeleteIconButton } from './deleteIconButton';
import { absoluteTargetScanUrl, hrefForTargetScan } from './pageRoutes';

type SavedTargetListOptions = {
  targets: CloudImageTarget[];
  activeTargetId?: string;
  onEdit: (target: CloudImageTarget) => void;
  onDelete: (target: CloudImageTarget) => void | Promise<void>;
  currentUrl?: string;
  onCopyLink?: (target: CloudImageTarget, url: string) => void | Promise<void>;
};

export function renderSavedTargetList(
  container: HTMLElement,
  options: SavedTargetListOptions,
): void {
  container.replaceChildren();
  if (options.targets.length === 0) {
    container.textContent = 'No cloud image targets saved yet.';
    return;
  }

  for (const target of options.targets) {
    const active = target.id === options.activeTargetId;
    const row = document.createElement('article');
    row.className = 'saved-target-row';
    row.classList.toggle('is-active', active);

    const openButton = document.createElement('button');
    openButton.type = 'button';
    openButton.className = 'saved-target-open';
    openButton.dataset.editTarget = target.id;
    openButton.setAttribute('aria-label', `Edit target ${target.label}`);
    openButton.setAttribute('aria-current', active ? 'true' : 'false');

    const previewImage = document.createElement('img');
    previewImage.src = target.imageUrl;
    previewImage.alt = '';

    const meta = document.createElement('span');
    meta.className = 'saved-target-meta';
    const label = document.createElement('strong');
    label.textContent = target.label;
    const summary = document.createElement('span');
    summary.textContent = savedTargetSummary(target);
    meta.append(label, summary);
    openButton.append(previewImage, meta);
    openButton.addEventListener('click', () => options.onEdit(target));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'saved-target-delete';
    deleteButton.dataset.deleteTarget = target.id;
    decorateDeleteIconButton(deleteButton, `Delete target ${target.label}`);
    deleteButton.addEventListener('click', () => void options.onDelete(target));

    const content = document.createElement('div');
    content.className = 'saved-target-content';
    content.append(openButton);
    if (target.scanId) {
      const scanHref = hrefForTargetScan(target.scanId);
      const scanUrl = absoluteTargetScanUrl(
        target.scanId,
        options.currentUrl ?? window.location.href,
      );
      const links = document.createElement('div');
      links.className = 'saved-target-links';
      const urlLabel = document.createElement('code');
      urlLabel.className = 'saved-target-url';
      urlLabel.textContent = scanUrl;
      urlLabel.title = scanUrl;
      const actions = document.createElement('span');
      actions.className = 'saved-target-link-actions';
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.dataset.copyTargetLink = target.id;
      copyButton.textContent = 'Copy link';
      copyButton.addEventListener('click', () => void options.onCopyLink?.(target, scanUrl));
      const openLink = document.createElement('a');
      openLink.dataset.openTargetScan = target.id;
      openLink.href = scanHref;
      openLink.textContent = 'Open scanner';
      actions.append(copyButton, openLink);
      links.append(urlLabel, actions);
      content.append(links);
    }

    row.append(content, deleteButton);
    container.append(row);
  }
}

function savedTargetSummary(target: CloudImageTarget): string {
  if (target.objects.length !== 1) {
    return `${target.objects.length} objects`;
  }
  const object = target.objects[0];
  return isTextTargetObject(object) ? object.text.value : object.model.label;
}

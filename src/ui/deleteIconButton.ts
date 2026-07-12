export function decorateDeleteIconButton(button: HTMLButtonElement, label: string): HTMLButtonElement {
  button.classList.add('icon-delete-button');
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.replaceChildren(createTrashIcon());
  return button;
}

const svgNamespace = 'http://www.w3.org/2000/svg';

function createTrashIcon(): SVGSVGElement {
  const icon = document.createElementNS(svgNamespace, 'svg');
  icon.classList.add('trash-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('focusable', 'false');

  for (const pathData of [
    'M3 6h18',
    'M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6',
    'M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14',
  ]) {
    const path = document.createElementNS(svgNamespace, 'path');
    path.setAttribute('d', pathData);
    icon.append(path);
  }

  return icon;
}

const scannerGuideSelector = '[data-scanner-guide]';

export function prepareScannerStage(stage: HTMLElement): HTMLElement {
  const guide = document.createElement('div');
  guide.className = 'scanner-guide';
  guide.dataset.scannerGuide = '';
  guide.setAttribute('aria-hidden', 'true');

  const frame = document.createElement('span');
  frame.className = 'scanner-guide-frame';

  const line = document.createElement('span');
  line.className = 'scanner-guide-line';

  frame.append(line);
  guide.append(frame);
  stage.replaceChildren(guide);
  return guide;
}

export function setScannerGuideVisible(stage: HTMLElement, visible: boolean): void {
  const guide = stage.querySelector<HTMLElement>(scannerGuideSelector);
  if (guide) {
    guide.hidden = !visible;
  }
}

export function resetScannerStage(stage: HTMLElement): void {
  const idle = document.createElement('div');
  idle.className = 'stage-idle';

  const label = document.createElement('span');
  label.textContent = 'Scan an experience';

  idle.append(label);
  stage.replaceChildren(idle);
}

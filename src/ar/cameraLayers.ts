export function normalizeMindARCameraLayers(container: HTMLElement): void {
  const video = container.querySelector('video');
  const canvases = container.querySelectorAll('canvas');
  const rendererLayers = Array.from(container.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child.tagName !== 'VIDEO' &&
      child.tagName !== 'CANVAS' &&
      !child.classList.contains('stage-idle'),
  );

  if (video) {
    video.style.zIndex = '0';
    video.style.pointerEvents = 'none';
  }

  for (const canvas of canvases) {
    canvas.style.zIndex = '1';
    canvas.style.pointerEvents = 'none';
  }

  for (const layer of rendererLayers) {
    layer.style.zIndex = layer.hasAttribute('data-scanner-guide') ? '3' : '2';
    layer.style.pointerEvents = 'none';
  }
}

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
    /*
     * The CSS3D layer keeps its own pointer handling: it routes taps that land
     * on the layer rather than on a deeply scaled transport button, which is
     * the only way those presses are recovered. Every other layer here is
     * decoration and must not eat input meant for the stage.
     */
    if (!layer.classList.contains('youtube-css3d-layer')) {
      layer.style.pointerEvents = 'none';
    }
  }
}

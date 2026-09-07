import { describe, expect, it } from 'vitest';
import { normalizeMindARCameraLayers } from '../src/ar/cameraLayers';

describe('normalizeMindARCameraLayers', () => {
  it('moves MindAR video above the stage background and below AR canvases', () => {
    const stage = document.createElement('div');
    const webglCanvas = document.createElement('canvas');
    const cssRenderer = document.createElement('div');
    const scannerGuide = document.createElement('div');
    const video = document.createElement('video');

    cssRenderer.style.position = 'absolute';
    scannerGuide.dataset.scannerGuide = '';
    video.style.position = 'absolute';
    video.style.zIndex = '-2';

    stage.append(webglCanvas, cssRenderer, scannerGuide, video);

    normalizeMindARCameraLayers(stage);

    expect(video.style.zIndex).toBe('0');
    expect(video.style.pointerEvents).toBe('none');
    expect(webglCanvas.style.zIndex).toBe('1');
    expect(cssRenderer.style.zIndex).toBe('2');
    expect(scannerGuide.style.zIndex).toBe('3');
  });

  it('leaves the YouTube CSS3D layer able to receive taps', () => {
    const stage = document.createElement('div');
    const webglCanvas = document.createElement('canvas');
    const youtubeLayer = document.createElement('div');
    const scannerGuide = document.createElement('div');

    youtubeLayer.classList.add('youtube-css3d-layer');
    youtubeLayer.style.pointerEvents = 'auto';
    scannerGuide.dataset.scannerGuide = '';
    stage.append(webglCanvas, youtubeLayer, scannerGuide);

    normalizeMindARCameraLayers(stage);

    /* Without this the transport's projected-tap fallback is unreachable. */
    expect(youtubeLayer.style.pointerEvents).toBe('auto');
    expect(youtubeLayer.style.zIndex).toBe('2');
    expect(scannerGuide.style.pointerEvents).toBe('none');
    expect(webglCanvas.style.pointerEvents).toBe('none');
  });
});

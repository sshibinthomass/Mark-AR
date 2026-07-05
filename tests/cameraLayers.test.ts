import { describe, expect, it } from 'vitest';
import { normalizeMindARCameraLayers } from '../src/ar/cameraLayers';

describe('normalizeMindARCameraLayers', () => {
  it('moves MindAR video above the stage background and below AR canvases', () => {
    const stage = document.createElement('div');
    const webglCanvas = document.createElement('canvas');
    const cssRenderer = document.createElement('div');
    const video = document.createElement('video');

    cssRenderer.style.position = 'absolute';
    video.style.position = 'absolute';
    video.style.zIndex = '-2';

    stage.append(webglCanvas, cssRenderer, video);

    normalizeMindARCameraLayers(stage);

    expect(video.style.zIndex).toBe('0');
    expect(video.style.pointerEvents).toBe('none');
    expect(webglCanvas.style.zIndex).toBe('1');
    expect(cssRenderer.style.zIndex).toBe('2');
  });
});

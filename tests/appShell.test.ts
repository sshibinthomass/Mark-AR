import { describe, expect, it } from 'vitest';
import { AR_MARKERS } from '../src/ar/markerCatalog';
import { renderAppShell } from '../src/ui/appShell';

describe('renderAppShell', () => {
  it('renders route navigation, separate workflow pages, and both marker images', () => {
    const container = document.createElement('div');
    container.innerHTML = renderAppShell(AR_MARKERS);
    const html = container.innerHTML;

    expect(html).toContain('href="#/scan"');
    expect(html).toContain('href="#/base"');
    expect(html).toContain('href="#/models"');
    expect(html).toContain('href="#/targets"');
    expect(html).toContain('href="#/markers"');
    expect(html).toContain('href="#/account"');
    expect(html).toContain('data-page="home"');
    expect(html).toContain('data-page="scan"');
    expect(html).toContain('data-page="base"');
    expect(html).toContain('data-page="models"');
    expect(container.querySelector('[data-page="targets"]')).toBeTruthy();
    expect(html).toContain('data-page="markers"');
    expect(html).toContain('data-page="account"');
    expect(html).toContain('id="ar-stage"');
    expect(html).toContain('id="start-ar"');
    expect(html).toContain('id="worker-email"');
    expect(html).toContain('id="base-capture-video"');
    expect(html).toContain('id="process-base-image"');
    expect(html).toContain('id="cloudflare-model-select"');
    expect(container.querySelector('#target-image-file')).toBeTruthy();
    expect(container.querySelector('#target-model-select')).toBeTruthy();
    expect(container.querySelector('#add-target-object')).toBeTruthy();
    expect(container.querySelector('#remove-target-object')).toBeTruthy();
    expect(container.querySelector('#target-object-list')).toBeTruthy();
    expect(container.querySelector('#target-preview-stage')).toBeTruthy();
    expect(container.querySelector('#save-image-target')).toBeTruthy();
    expect(container.querySelector('#saved-image-target-list')).toBeTruthy();
    expect(html).toContain('id="reload-cloudflare-models"');
    expect(html).toContain('Marker AR studio');
    expect(html).toContain('Web-AR Worker');

    for (const marker of AR_MARKERS) {
      expect(html).toContain(marker.label);
      expect(html).toContain(marker.imagePath);
      expect(html).toContain(`download="${marker.id}.svg"`);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { AR_MARKERS } from '../src/ar/markerCatalog';
import { renderAppShell } from '../src/ui/appShell';

describe('renderAppShell', () => {
  it('renders route navigation, separate workflow pages, and both marker images', () => {
    const html = renderAppShell(AR_MARKERS);

    expect(html).toContain('href="#/scan"');
    expect(html).toContain('href="#/base"');
    expect(html).toContain('href="#/models"');
    expect(html).toContain('href="#/markers"');
    expect(html).toContain('href="#/account"');
    expect(html).toContain('data-page="home"');
    expect(html).toContain('data-page="scan"');
    expect(html).toContain('data-page="base"');
    expect(html).toContain('data-page="models"');
    expect(html).toContain('data-page="markers"');
    expect(html).toContain('data-page="account"');
    expect(html).toContain('id="ar-stage"');
    expect(html).toContain('id="start-ar"');
    expect(html).toContain('id="worker-email"');
    expect(html).toContain('id="base-capture-video"');
    expect(html).toContain('id="process-base-image"');
    expect(html).toContain('id="cloudflare-model-select"');
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

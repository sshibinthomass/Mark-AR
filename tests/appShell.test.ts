import { describe, expect, it } from 'vitest';
import { AR_MARKERS } from '../src/ar/markerCatalog';
import { renderAppShell } from '../src/ui/appShell';

describe('renderAppShell', () => {
  it('renders the AR stage, start control, cloud controls, and both marker images', () => {
    const html = renderAppShell(AR_MARKERS);

    expect(html).toContain('id="ar-stage"');
    expect(html).toContain('id="start-ar"');
    expect(html).toContain('id="worker-email"');
    expect(html).toContain('id="base-capture-video"');
    expect(html).toContain('id="process-base-image"');
    expect(html).toContain('id="cloudflare-model-select"');
    expect(html).toContain('id="reload-cloudflare-models"');
    expect(html).toContain('Scan marker');

    for (const marker of AR_MARKERS) {
      expect(html).toContain(marker.label);
      expect(html).toContain(marker.imagePath);
      expect(html).toContain(`download="${marker.id}.svg"`);
    }
  });
});

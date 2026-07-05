import { describe, expect, it } from 'vitest';
import { AR_MARKERS } from '../src/ar/markerCatalog';
import { renderAppShell } from '../src/ui/appShell';

describe('renderAppShell', () => {
  it('renders the AR stage, start control, and both marker images', () => {
    const html = renderAppShell(AR_MARKERS);

    expect(html).toContain('id="ar-stage"');
    expect(html).toContain('id="start-ar"');
    expect(html).toContain('Scan marker');

    for (const marker of AR_MARKERS) {
      expect(html).toContain(marker.label);
      expect(html).toContain(marker.imagePath);
      expect(html).toContain(`download="${marker.id}.svg"`);
    }
  });
});

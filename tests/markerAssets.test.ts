import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AR_MARKERS } from '../src/ar/markerCatalog';

const publicDir = join(process.cwd(), 'public');

describe('generated marker assets', () => {
  it('stores each marker image in the public markers folder', () => {
    for (const marker of AR_MARKERS) {
      const localPath = join(publicDir, marker.imagePath);
      const svg = readFileSync(localPath, 'utf8');

      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain(marker.label);
      expect(svg).toContain('viewBox="0 0 1024 1024"');
    }
  });
});

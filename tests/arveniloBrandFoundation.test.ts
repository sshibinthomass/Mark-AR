import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readOrEmpty = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : '';
const tokens = readOrEmpty('src/styles/arvenilo-tokens.css');
const html = readFileSync('index.html', 'utf8');

describe('Arvenilo brand foundation', () => {
  it('uses AnchorAR metadata and the approved compact mark', () => {
    expect(html).toContain('<title>AnchorAR by Arvenilo</title>');
    expect(html).toContain('Interactive web-based augmented reality experiences');
    expect(html).toContain('%BASE_URL%brand/anchorar/anchorar-mark.png');
    expect(html).not.toContain('<title>Mark AR</title>');
  });

  it('bundles the approved logos, fonts, and licenses', () => {
    [
      'public/brand/anchorar/anchorar-mark.png',
      'public/brand/arvenilo/arvenilo-lockup.png',
      'public/brand/qr/04-anchorar-platform-transparent-QR.png',
      'src/assets/fonts/sora-latin-wght-normal.woff2',
      'src/assets/fonts/inter-latin-wght-normal.woff2',
      'src/assets/fonts/inter-latin-wght-italic.woff2',
      'src/assets/fonts/ibm-plex-mono-latin-400-normal.woff2',
      'src/assets/fonts/ibm-plex-mono-latin-500-normal.woff2',
      'src/assets/fonts/LICENSE-Sora.txt',
      'src/assets/fonts/LICENSE-Inter.txt',
      'src/assets/fonts/LICENSE-IBM-Plex-Mono.txt',
    ].forEach((path) => expect(existsSync(path), path).toBe(true));
  });

  it('declares the canonical Arvenilo token contract', () => {
    expect(tokens).toContain('font-family: "Sora Variable"');
    expect(tokens).toContain('font-family: "Inter Variable"');
    expect(tokens).toContain('font-family: "IBM Plex Mono"');
    expect(tokens).toContain('--color-spatial-ink: #081d21');
    expect(tokens).toContain('--color-signal-mint: #5eead4');
    expect(tokens).toContain('--color-reality-mist: #f4fbfa');
    expect(tokens).toContain('--color-digital-violet: #7456f1');
    expect(tokens).toContain('--color-anchor-gold: #f4b942');
    expect(tokens).toContain('--radius-control: 10px');
    expect(tokens).toContain('--radius-card: 16px');
    expect(tokens).toContain('--radius-stage: 24px');
    expect(tokens).toContain('--content-max: 1600px');
  });
});

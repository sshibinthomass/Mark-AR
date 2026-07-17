import { describe, expect, it } from 'vitest';
import { brandAssetUrls } from '../src/app/brandAssets';

describe('brandAssetUrls', () => {
  it('keeps approved assets under the active deployment base', () => {
    expect(brandAssetUrls('/Mark-AR/')).toEqual({
      productLockup: '/Mark-AR/brand/qr/04-anchorar-platform-transparent-QR.png',
      productMark: '/Mark-AR/brand/anchorar/anchorar-mark.png',
      companyLockup: '/Mark-AR/brand/arvenilo/arvenilo-lockup.png',
    });
    expect(brandAssetUrls('/').productMark).toBe('/brand/anchorar/anchorar-mark.png');
  });
});

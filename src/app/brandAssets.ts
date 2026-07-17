export type BrandAssetUrls = {
  productLockup: string;
  productMark: string;
  companyLockup: string;
};

export function brandAssetUrls(baseUrl = import.meta.env.BASE_URL): BrandAssetUrls {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return {
    productLockup: `${base}brand/qr/04-anchorar-platform-transparent-QR.png`,
    productMark: `${base}brand/anchorar/anchorar-mark.png`,
    companyLockup: `${base}brand/arvenilo/arvenilo-lockup.png`,
  };
}

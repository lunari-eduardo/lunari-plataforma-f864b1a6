import { getPublicShareBaseUrl } from '@/utils/domainUtils';

const PRODUCTION_GALLERY_DOMAIN = 'https://app.lunarihub.com';

const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : 'https://tlnjspsywycbudhewsfv.supabase.co/functions/v1';

/**
 * Generates a gallery URL for the client using the canonical public domain.
 */
export function getGalleryUrl(publicToken: string, type: 'select' | 'deliver' = 'select', photographerDomain?: string): string {
  if (!publicToken) return '';
  const baseDomain = photographerDomain || getPublicShareBaseUrl();
  const prefix = type === 'deliver' ? 'c' : 'g';
  return `${baseDomain}/${prefix}/${publicToken}`;
}

/**
 * Generates a delivery gallery URL using the canonical public domain.
 */
export function getDeliverGalleryUrl(publicToken: string, photographerDomain?: string): string {
  return getGalleryUrl(publicToken, 'deliver', photographerDomain);
}

/**
 * Generates a gallery URL that goes through the OG edge function.
 * This URL serves dynamic Open Graph meta tags for WhatsApp/social previews,
 * then redirects normal users to the actual gallery.
 */
export function getGalleryOgUrl(publicToken: string, type: 'select' | 'deliver' = 'select'): string {
  if (!publicToken) return '';
  const typeParam = type === 'deliver' ? '&type=deliver' : '';
  return `${SUPABASE_FUNCTIONS_URL}/gallery-og?token=${publicToken}${typeParam}`;
}

/**
 * Checks if the current window is on a production domain
 */
export function isProductionDomain(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'app.lunarihub.com' ||
         window.location.hostname.endsWith('.app.lunarihub.com');
}

/**
 * Generates a referral URL using the production domain in prod,
 * or the current origin in dev/preview environments.
 */
export function getReferralUrl(referralCode: string): string {
  if (!referralCode) return '';
  const baseDomain = isProductionDomain()
    ? PRODUCTION_GALLERY_DOMAIN
    : window.location.origin;
  return `${baseDomain}/auth?ref=${referralCode}`;
}

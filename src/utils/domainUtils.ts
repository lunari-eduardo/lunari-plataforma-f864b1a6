/**
 * Utilitários para detecção de domínio e URLs de redirect
 * Domínio canônico de produção: app.lunarihub.com (via Vercel)
 */

/** Domínio canônico de produção — fonte única de verdade */
const CANONICAL_PRODUCTION_URL = import.meta.env.VITE_SITE_URL || 'https://app.lunarihub.com';

/**
 * Detecta se está em ambiente de produção (novos ou antigos domínios)
 */
export function isProductionDomain(): boolean {
  const hostname = window.location.hostname;
  return hostname.includes('lunarihub') || 
         hostname.includes('lunariplataforma') ||
         hostname.includes('lovable.app');
}

/**
 * Obtém a URL base do app Gestão baseado no domínio atual
 */
export function getAppBaseUrl(): string {
  const hostname = window.location.hostname;
  
  if (hostname.includes('lunarihub')) {
    return 'https://app.lunarihub.com';
  }
  
  if (hostname.includes('lunariplataforma')) {
    return 'https://www.lunariplataforma.com.br';
  }
  
  // Preview/desenvolvimento — usa origem atual para navegação interna
  if (hostname.includes('lovable.app')) {
    return window.location.origin;
  }
  
  return window.location.origin;
}

/**
 * Obtém a URL de redirect para OAuth (MP, Google Calendar)
 * OAuth callbacks DEVEM usar a origem real do navegador, não o canônico
 */
export function getOAuthRedirectUri(): string {
  return `${getAppBaseUrl()}/app/integracoes`;
}

/**
 * Obtém a URL base do Gallery baseado no domínio atual
 */
export function getGalleryBaseUrl(): string {
  const hostname = window.location.hostname;
  
  if (hostname.includes('lunarihub')) {
    return 'https://gallery.lunarihub.com';
  }
  
  return 'https://lunari-gallery.lovable.app';
}

/**
 * Obtém URL canônica para SEO baseado no domínio atual
 */
export function getCanonicalBaseUrl(): string {
  return CANONICAL_PRODUCTION_URL;
}

/**
 * Obtém a URL base para links públicos compartilháveis (formulários, checkout).
 * SEMPRE usa o domínio canônico de produção, independente do ambiente atual.
 * Isso garante que links enviados a clientes funcionem em qualquer contexto.
 */
export function getPublicShareBaseUrl(): string {
  return CANONICAL_PRODUCTION_URL;
}

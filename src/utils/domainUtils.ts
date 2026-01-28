/**
 * Utilitários para detecção de domínio e URLs de redirect
 * Suporta migração de domínios: lunariplataforma.com.br -> lunarihub.com
 */

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
 * Prioriza novos domínios, mantém fallback para antigos
 */
export function getAppBaseUrl(): string {
  const hostname = window.location.hostname;
  
  // Novos domínios têm prioridade
  if (hostname.includes('lunarihub')) {
    return 'https://app.lunarihub.com';
  }
  
  // Domínios antigos (transição)
  if (hostname.includes('lunariplataforma')) {
    return 'https://www.lunariplataforma.com.br';
  }
  
  // Preview/desenvolvimento
  if (hostname.includes('lovable.app')) {
    return window.location.origin;
  }
  
  // Localhost ou outros
  return window.location.origin;
}

/**
 * Obtém a URL de redirect para OAuth (MP, Google Calendar)
 * Retorna URL completa para página de integrações
 */
export function getOAuthRedirectUri(): string {
  return `${getAppBaseUrl()}/app/integracoes`;
}

/**
 * Obtém a URL base do Gallery baseado no domínio atual
 */
export function getGalleryBaseUrl(): string {
  const hostname = window.location.hostname;
  
  // Novos domínios
  if (hostname.includes('lunarihub')) {
    return 'https://gallery.lunarihub.com';
  }
  
  // Antigo domínio do Gallery
  return 'https://lunari-gallery.lovable.app';
}

/**
 * Obtém URL canônica para SEO baseado no domínio atual
 */
export function getCanonicalBaseUrl(): string {
  const hostname = window.location.hostname;
  
  // Novos domínios
  if (hostname.includes('lunarihub')) {
    return 'https://app.lunarihub.com';
  }
  
  // Domínios antigos ou produção
  return 'https://www.lunariplataforma.com.br';
}

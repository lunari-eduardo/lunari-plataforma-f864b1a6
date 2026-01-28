/**
 * Configuração centralizada de URLs externas
 * Suporta migração de domínios: lunarihub.com
 */
export const EXTERNAL_URLS = {
  GALLERY: {
    // Novo domínio principal
    BASE: 'https://gallery.lunarihub.com',
    // Subdomínios dinâmicos: *.gallery.lunarihub.com
    NEW: '/gallery/new'
  },
  // Domínios antigos (para referência durante transição)
  LEGACY: {
    GALLERY: 'https://lunari-gallery.lovable.app',
    APP: 'https://www.lunariplataforma.com.br'
  }
} as const;

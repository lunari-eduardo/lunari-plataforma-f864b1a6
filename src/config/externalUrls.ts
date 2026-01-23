/**
 * Configuração centralizada de URLs externas
 * Facilita mudança de domínios no futuro
 */
export const EXTERNAL_URLS = {
  GALLERY: {
    BASE: 'https://lunari-gallery.lovable.app',
    // Futuro: 'https://lunarigallery.com.br'
    NEW: '/gallery/new'
  }
} as const;

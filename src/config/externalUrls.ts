/**
 * Configuração centralizada de URLs externas
 * Suporta migração de domínios: lunarihub.com
 */
export const EXTERNAL_URLS = {
  GALLERY: {
    // Novo domínio principal (Unificado no Studio)
    BASE: 'https://app.lunarihub.com',
    // Subdomínios dinâmicos: *.gallery.lunarihub.com
    NEW: '/app/gallery/new/select',
    DELIVER_NEW: '/app/gallery/new/transfer'
  }
} as const;

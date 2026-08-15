// Gallery Theme Tokens — Lunari v1.0
// Centraliza todos os tokens CSS --gallery-* com valores padrão da paleta oficial Lunari

export interface GalleryThemeTokens {
  '--gallery-bg': string;
  '--gallery-bg-elevated': string;
  '--gallery-surface': string;
  '--gallery-primary': string;
  '--gallery-primary-fg': string;
  '--gallery-accent': string;
  '--gallery-text': string;
  '--gallery-text-muted': string;
  '--gallery-border': string;
  '--gallery-success': string;
  '--gallery-gap': string;
  '--gallery-radius': string;
  '--gallery-row-unit': string;
}

// Paleta oficial Lunari para galerias no modo LIGHT
export const LUNARI_GALLERY_TOKENS_LIGHT: Omit<GalleryThemeTokens, '--gallery-gap' | '--gallery-radius' | '--gallery-row-unit'> = {
  '--gallery-bg': '#FAF9F7',           // off-white aquecido
  '--gallery-bg-elevated': '#F0EDE9',  // superfície levemente elevada
  '--gallery-surface': '#F5F3F0',      // cards e overlays
  '--gallery-primary': '#C6A36A',      // dourado Lunari (botões de ação)
  '--gallery-primary-fg': '#1A1614',   // texto escuro sobre o dourado
  '--gallery-accent': '#B08F55',       // dourado hover / destaque
  '--gallery-text': '#1A1614',         // texto principal
  '--gallery-text-muted': '#6B6560',   // texto secundário / labels
  '--gallery-border': '#DAD6D1',       // bordas
  '--gallery-success': '#347A57',      // verde sucesso
};

// Paleta oficial Lunari para galerias no modo DARK (Preto Grafite Elegante)
export const LUNARI_GALLERY_TOKENS_DARK: Omit<GalleryThemeTokens, '--gallery-gap' | '--gallery-radius' | '--gallery-row-unit'> = {
  '--gallery-bg': '#0E0E0E',           // preto grafite elegante
  '--gallery-bg-elevated': '#171717',  // superfície elevada dark
  '--gallery-surface': '#1A1A1A',      // cards e overlays dark
  '--gallery-primary': '#C6A36A',      // dourado permanece (funciona nos dois modos)
  '--gallery-primary-fg': '#0E0E0E',   // texto escuro sobre o dourado
  '--gallery-accent': '#D0B581',       // dourado mais luminoso no dark
  '--gallery-text': '#F2F2F2',         // off-white nítido neutro
  '--gallery-text-muted': '#8A8A8A',   // texto secundário neutro grafite
  '--gallery-border': '#242424',       // bordas neutras grafite
  '--gallery-success': '#56B485',      // verde sucesso luminoso
};

/**
 * Resolve os tokens base de cor para um dado backgroundMode.
 * Os tokens de layout (--gallery-gap, --gallery-radius, --gallery-row-unit) 
 * são sempre injetados pelo GalleryThemeProvider.
 */
export function resolveGalleryColorTokens(
  backgroundMode: 'light' | 'dark',
  customPrimaryColor?: string
): Omit<GalleryThemeTokens, '--gallery-gap' | '--gallery-radius' | '--gallery-row-unit'> {
  const base = backgroundMode === 'dark' ? LUNARI_GALLERY_TOKENS_DARK : LUNARI_GALLERY_TOKENS_LIGHT;

  if (!customPrimaryColor) return base;

  // Calcula o foreground: claro em cores escuras, escuro em cores claras
  const primaryFg = isColorDark(customPrimaryColor) ? '#F0EDE9' : '#1A1614';

  return {
    ...base,
    '--gallery-primary': customPrimaryColor,
    '--gallery-primary-fg': primaryFg,
  };
}

/**
 * Heurística simples para determinar se uma cor hex é escura.
 * Retorna true se a luminância percebida for < 0.4.
 */
export function isColorDark(hex: string): boolean {
  try {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    // Luminância percebida (rec. 709)
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance < 0.4;
  } catch {
    return false;
  }
}

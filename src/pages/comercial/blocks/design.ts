import React from 'react';

// ============================================================
// DESIGN TOKENS DA PROPOSTA
// Paleta/tipografia declaradas no template (proposal_templates.design_tokens)
// e aplicadas como CSS variables no root da arte. Renderers usam
// var(--pa-*) com fallback para as cores padrão.
// ============================================================

export interface ProposalDesignTokens {
  colors?: {
    cream?: string;
    linen?: string;
    stone?: string;
    taupe?: string;
    accent?: string;
    ink?: string;
    white?: string;
  };
  typography?: {
    display?: string;
    body?: string;
  };
  spacing?: {
    section_padding?: string;
    max_width?: string;
    inner_pad?: string;
  };
}

export const DEFAULT_DESIGN_TOKENS: Required<Pick<ProposalDesignTokens, 'colors'>> = {
  colors: {
    cream: '#F3F0EA',
    linen: '#E8E3DA',
    stone: '#C9BFB2',
    taupe: '#8C7B6E',
    accent: '#7A5C42',
    ink: '#1A1714',
    white: '#FFFFFF',
  },
};

/** Converte tokens em CSS variables para injetar no container da arte. */
export function tokensToCssVars(tokens?: ProposalDesignTokens): React.CSSProperties {
  const c = { ...DEFAULT_DESIGN_TOKENS.colors, ...(tokens?.colors ?? {}) };
  const displayFont = tokens?.typography?.display || 'Playfair Display';
  const bodyFont = tokens?.typography?.body || 'Inter';
  
  // Garante carregamento das fontes caso não sejam as padrão
  ensureFontLoaded(displayFont);
  ensureFontLoaded(bodyFont);
  
  return {
    ['--pa-cream' as any]: c.cream,
    ['--pa-linen' as any]: c.linen,
    ['--pa-stone' as any]: c.stone,
    ['--pa-taupe' as any]: c.taupe,
    ['--pa-accent' as any]: c.accent,
    ['--pa-ink' as any]: c.ink,
    ['--pa-white' as any]: c.white,
    ['--pa-font-display' as any]: displayFont,
    ['--pa-font-body' as any]: bodyFont,
  };
}

const loadedFonts = new Set<string>();

/**
 * Garante que uma fonte do Google Fonts esteja carregada (usada quando o
 * template declara tipografia própria, ex.: Cormorant Garamond / Jost).
 */
export function ensureFontLoaded(fontFamily?: string): void {
  if (!fontFamily || typeof document === 'undefined') return;
  const key = fontFamily.toLowerCase().replace(/\s+/g, '-');
  if (loadedFonts.has(key)) return;
  loadedFonts.add(key);

  const defaultFonts = ['playfair-display', 'inter', 'manrope'];
  if (defaultFonts.includes(key)) return; // já carregadas pelo app

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily).replace(/%20/g, '+')}:wght@300;400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

export function fontDisplayCss(): string {
  return "var(--pa-font-display, 'Playfair Display'), 'Playfair Display', Georgia, serif";
}

export function fontBodyCss(): string {
  return "var(--pa-font-body, 'Inter'), 'Inter', system-ui, sans-serif";
}

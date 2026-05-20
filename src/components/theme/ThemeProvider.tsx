import React from 'react'

/**
 * ThemeProvider — placeholder histórico.
 *
 * Toda a paleta visual (brand, surfaces, glass, sombras, charts, etc.)
 * agora é controlada pelos design tokens definidos em src/index.css.
 *
 * Para alterar a identidade global, edite as variáveis:
 *   --brand-h / --brand-s / --brand-l   (cor principal)
 *   --surface-0..5                       (camadas de superfície)
 *   --chart-1..10                        (paleta de gráficos)
 *
 * O VisualThemeProvider (Fase 3) injeta overrides em runtime a partir
 * das preferências do usuário ou da configuração global do admin.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

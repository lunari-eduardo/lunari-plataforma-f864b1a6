import { useMemo } from 'react';

/**
 * Motor tipográfico editorial contínuo.
 * Calcula o tamanho ideal da fonte baseado na largura do viewport,
 * no número de caracteres da maior linha e no breakpoint,
 * garantindo uma escala monumental sem quebras involuntárias e sem encolhimento excessivo.
 */
export function useFittedTitle(
  line1: string,
  line2: string,
  viewportWidth: number,
  breakpoint: 'desktop' | 'compact' | 'mobile' = 'desktop'
): number {
  const maxLineLength = Math.max(line1.length, line2.length, 1);

  const fontSize = useMemo(() => {
    if (viewportWidth <= 0) return 64;

    if (breakpoint === 'desktop') {
      // Escala monumental para Desktop (≥ 1024px)
      // Ex: "MARIANA" (7 chars) -> ~9.5vw (135px em 1440px)
      // Ex: "TESTE DE" (8 chars) -> ~8.0vw (115px em 1440px)
      // Ex: "MARIANA & RAFAEL" (16 chars) -> ~6.2vw (90px em 1440px)
      if (maxLineLength <= 7) {
        const vwSize = viewportWidth * 0.095;
        return Math.round(Math.min(Math.max(vwSize, 90), 180));
      } else if (maxLineLength <= 11) {
        const vwSize = viewportWidth * 0.08;
        return Math.round(Math.min(Math.max(vwSize, 75), 150));
      } else if (maxLineLength <= 16) {
        const vwSize = viewportWidth * 0.065;
        return Math.round(Math.min(Math.max(vwSize, 60), 125));
      } else {
        const vwSize = viewportWidth * 0.05;
        return Math.round(Math.min(Math.max(vwSize, 48), 100));
      }
    } else if (breakpoint === 'compact') {
      // Telas intermediárias / Tablets (640px - 1023px)
      if (maxLineLength <= 7) {
        return Math.round(Math.min(Math.max(viewportWidth * 0.095, 60), 96));
      } else if (maxLineLength <= 11) {
        return Math.round(Math.min(Math.max(viewportWidth * 0.08, 50), 80));
      } else if (maxLineLength <= 16) {
        return Math.round(Math.min(Math.max(viewportWidth * 0.065, 42), 66));
      } else {
        return Math.round(Math.min(Math.max(viewportWidth * 0.05, 34), 54));
      }
    } else {
      // Mobile (< 640px)
      // Ex: 390px tela -> 390 * 0.11 = 43px (escala imponente sobre a foto)
      if (maxLineLength <= 7) {
        return Math.round(Math.min(Math.max(viewportWidth * 0.115, 38), 54));
      } else if (maxLineLength <= 11) {
        return Math.round(Math.min(Math.max(viewportWidth * 0.095, 32), 46));
      } else if (maxLineLength <= 16) {
        return Math.round(Math.min(Math.max(viewportWidth * 0.08, 26), 38));
      } else {
        return Math.round(Math.min(Math.max(viewportWidth * 0.065, 22), 32));
      }
    }
  }, [line1, line2, maxLineLength, viewportWidth, breakpoint]);

  return fontSize;
}

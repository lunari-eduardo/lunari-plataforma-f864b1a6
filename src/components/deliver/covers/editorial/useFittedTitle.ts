import { useMemo } from 'react';

// Cache de medição para evitar múltiplas renderizações em canvas idênticos
const measurementCache = new Map<string, number>();

// Variável estática para reaproveitar o mesmo canvas off-screen
let sharedCanvas: HTMLCanvasElement | null = null;

function measureTextWidth(text: string, font: string): number {
  if (!text) return 0;
  if (typeof window === 'undefined') return 0; // SSR safe

  const cacheKey = `${text}-${font}`;
  if (measurementCache.has(cacheKey)) {
    return measurementCache.get(cacheKey)!;
  }

  if (!sharedCanvas) {
    sharedCanvas = document.createElement('canvas');
  }
  
  const context = sharedCanvas.getContext('2d');
  if (!context) return 0;

  context.font = font;
  const width = context.measureText(text).width;
  measurementCache.set(cacheKey, width);
  
  // Mantemos o cache com limite para evitar memory leak em trocas de fontes excessivas
  if (measurementCache.size > 100) {
    const firstKey = measurementCache.keys().next().value;
    if (firstKey) measurementCache.delete(firstKey);
  }

  return width;
}

/**
 * Motor tipográfico contínuo.
 * Calcula o tamanho ideal da fonte para que a maior linha caiba perfeitamente no container.
 */
export function useFittedTitle(
  line1: string,
  line2: string,
  boxWidthPx: number,
  fontFamily: string,
  minFontPx: number = 24,
  maxFontPx: number = 280
) {
  const REF_FONT_SIZE = 100;

  const fittedFontSize = useMemo(() => {
    if (boxWidthPx <= 0) return minFontPx;

    // Mede usando um tamanho de referência padrão
    const fontStr = `normal ${REF_FONT_SIZE}px ${fontFamily}`;
    
    const width1 = measureTextWidth(line1, fontStr);
    const width2 = measureTextWidth(line2, fontStr);
    
    const maxWidthAtRef = Math.max(width1, width2);
    
    // Se não há texto, retorna o máximo (ou mínimo)
    if (maxWidthAtRef === 0) return maxFontPx;
    
    // Calculamos a proporção necessária para preencher o boxWidth.
    // Usamos 100% da largura, pois o tracking -0.04em do CSS de destino já garante folga, 
    // mas por segurança aplicamos um levíssimo buffer de 1% para evitar quebra de linha por arredondamento de subpixels do browser.
    const targetWidth = boxWidthPx * 0.99; 
    const ratio = targetWidth / maxWidthAtRef;
    
    const calculatedFontSize = REF_FONT_SIZE * ratio;
    
    return Math.floor(Math.min(Math.max(calculatedFontSize, minFontPx), maxFontPx));
  }, [line1, line2, boxWidthPx, fontFamily, minFontPx, maxFontPx]);

  return fittedFontSize;
}

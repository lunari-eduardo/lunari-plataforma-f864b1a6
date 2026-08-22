import { useState, useEffect, useCallback } from 'react';

export function useFittedTitle(
  line1: string,
  line2: string,
  containerWidthPx: number,
  containerHeightPx: number,
  fontFamily: string,
  maxFontSizeVw = 12,
  minFontSizePx = 24
) {
  const calculate = useCallback(
    (w: number, h: number) => {
      if (w <= 0 || h <= 0) return minFontSizePx;

      try {
        if (typeof document === 'undefined') return minFontSizePx;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return minFontSizePx;

        // We use a high test size for precision
        const testFontSize = 100;
        ctx.font = `normal ${testFontSize}px ${fontFamily || 'serif'}`;

        const metrics1 = ctx.measureText((line1 || '').toUpperCase());
        const metrics2 = line2 ? ctx.measureText(line2.toUpperCase()) : { width: 0 };

        const maxWidthRatio = Math.max(metrics1.width, metrics2.width) / testFontSize;
        if (maxWidthRatio <= 0) return minFontSizePx;

        // Total height ratio: (line1 + line2 + spacing)
        // 0.84 is the line-height, 0.05 is the margin
        const totalHeightRatio = line2 ? 0.84 + 0.05 + 0.84 : 0.84;

        // Size that fits the width
        let calculatedSize = w / maxWidthRatio;

        // Size that fits the height (max 80% of container height for safety)
        const sizeFromHeight = (h * 0.8) / totalHeightRatio;

        calculatedSize = Math.min(calculatedSize, sizeFromHeight);

        // Limit by viewport-based maximum to maintain "Editorial" look
        const winW = typeof window !== 'undefined' ? window.innerWidth : w;
        const maxVwPx = (winW * maxFontSizeVw) / 100;
        const finalSize = Math.min(calculatedSize, maxVwPx);

        return Math.max(finalSize, minFontSizePx);
      } catch {
        return minFontSizePx;
      }
    },
    [line1, line2, fontFamily, maxFontSizeVw, minFontSizePx]
  );

  const [fontSize, setFontSize] = useState(() => calculate(containerWidthPx, containerHeightPx));

  useEffect(() => {
    setFontSize(calculate(containerWidthPx, containerHeightPx));
  }, [calculate, containerWidthPx, containerHeightPx]);

  return fontSize;
}

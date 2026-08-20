import { useState, useEffect } from 'react';

export function useFittedTitle(
  line1: string,
  line2: string,
  containerWidthPx: number,
  containerHeightPx: number,
  fontFamily: string,
  maxFontSizeVw = 12,
  minFontSizePx = 24
) {
  const [fontSize, setFontSize] = useState(minFontSizePx);

  useEffect(() => {
    if (containerWidthPx <= 0 || containerHeightPx <= 0) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // We use a high test size for precision
    const testFontSize = 100;
    ctx.font = `normal ${testFontSize}px ${fontFamily}`;

    const metrics1 = ctx.measureText(line1.toUpperCase());
    const metrics2 = line2 ? ctx.measureText(line2.toUpperCase()) : { width: 0 };

    const maxWidthRatio = Math.max(metrics1.width, metrics2.width) / testFontSize;
    
    // Total height ratio: (line1 + line2 + spacing)
    // 0.84 is the line-height, 0.05 is the margin
    const totalHeightRatio = line2 
      ? (0.84 + 0.05 + 0.84) 
      : 0.84;
    
    // Size that fits the width
    let calculatedSize = containerWidthPx / maxWidthRatio;
    
    // Size that fits the height (max 80% of container height for safety)
    const sizeFromHeight = (containerHeightPx * 0.8) / totalHeightRatio;
    
    calculatedSize = Math.min(calculatedSize, sizeFromHeight);
    
    // Limit by viewport-based maximum to maintain "Editorial" look
    const maxVwPx = (window.innerWidth * maxFontSizeVw) / 100;
    const finalSize = Math.min(calculatedSize, maxVwPx);

    setFontSize(Math.max(finalSize, minFontSizePx));
  }, [line1, line2, containerWidthPx, containerHeightPx, fontFamily, maxFontSizeVw, minFontSizePx]);

  return fontSize;
}

import { useState, useEffect } from 'react';

export function useFittedTitle(
  line1: string,
  line2: string,
  containerWidthPx: number,
  fontFamily: string,
  maxFontSizeVw = 12,
  minFontSizePx = 32
) {
  const [fontSize, setFontSize] = useState(minFontSizePx);

  useEffect(() => {
    if (containerWidthPx <= 0) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const testFontSize = 100;
    ctx.font = `normal ${testFontSize}px ${fontFamily}`;

    const metrics1 = ctx.measureText(line1.toUpperCase());
    const metrics2 = line2 ? ctx.measureText(line2.toUpperCase()) : { width: 0 };

    const maxWidthRatio = Math.max(metrics1.width, metrics2.width) / testFontSize;
    
    // Calculate size that fits the box width
    let calculatedSize = containerWidthPx / maxWidthRatio;
    
    // Limit by viewport-based maximum to maintain "Editorial" look
    const maxVwPx = (window.innerWidth * maxFontSizeVw) / 100;
    const finalSize = Math.min(calculatedSize, maxVwPx);

    setFontSize(Math.max(finalSize, minFontSizePx));
  }, [line1, line2, containerWidthPx, fontFamily, maxFontSizeVw, minFontSizePx]);

  return fontSize;
}

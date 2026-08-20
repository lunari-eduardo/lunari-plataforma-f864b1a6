import { useState, useEffect } from 'react';
import type { Rect } from './composition';

export function useSeamContrast(
  imageUrl: string | null | undefined,
  photoRect: Rect,
  titleIntersectionRect: Rect, // The part of the title that IS over the photo
  ctaRect: Rect,
  isDark = false
) {
  const [titleColor, setTitleColor] = useState(isDark ? '#F5F2EC' : '#171513');
  const [ctaColor, setCtaColor] = useState(isDark ? '#F5F2EC' : '#171513');
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    if (!imageUrl || imageUrl.includes('placeholder.svg')) return;

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 64; // Higher resolution for better sampling
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        // Simulate background-size: cover mapping
        // We draw the image such that it covers the 64x64 sampling canvas
        const imgRatio = img.width / img.height;
        const canvasRatio = 1;
        let drawW, drawH, drawX, drawY;

        if (imgRatio > canvasRatio) {
          drawH = size;
          drawW = size * imgRatio;
          drawX = (size - drawW) / 2;
          drawY = 0;
        } else {
          drawW = size;
          drawH = size / imgRatio;
          drawX = 0;
          drawY = (size - drawH) / 2;
        }

        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        const getAvgLuminance = (targetRect: Rect) => {
          // Intersection is already in screen pixels. We need relative to photoRect.
          // photoRect is the container for the image.
          const relX = (targetRect.x - photoRect.x) / photoRect.width;
          const relY = (targetRect.y - photoRect.y) / photoRect.height;
          const relW = targetRect.width / photoRect.width;
          const relH = targetRect.height / photoRect.height;

          const startX = Math.max(0, Math.floor(relX * size));
          const startY = Math.max(0, Math.floor(relY * size));
          const width = Math.min(size - startX, Math.max(1, Math.floor(relW * size)));
          const height = Math.min(size - startY, Math.max(1, Math.floor(relH * size)));

          if (width <= 0 || height <= 0) return isDark ? 0 : 255;

          try {
            const data = ctx.getImageData(startX, startY, width, height).data;
            let total = 0;
            let count = 0;
            for (let i = 0; i < data.length; i += 4) {
              // Standard luminance formula
              total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
              count++;
            }
            return count > 0 ? total / count : (isDark ? 0 : 255);
          } catch (e) {
            return 128;
          }
        };

        const titleLum = getAvgLuminance(titleIntersectionRect);
        const ctaLum = getAvgLuminance(ctaRect);

        if (isMounted) {
          // Threshold 140/255 for deciding between black/white text
          const titleIsLight = titleLum > 140;
          setIsLight(titleIsLight);
          setTitleColor(titleIsLight ? '#171513' : '#FFFFFF');
          setCtaColor(ctaLum > 140 ? '#171513' : '#FFFFFF');
        }
      } catch (e) {
        // Fallback on error
        if (isMounted) {
          setTitleColor('#FFFFFF');
          setCtaColor('#FFFFFF');
        }
      }
    };

    img.src = imageUrl;
    return () => { isMounted = false; };
  }, [imageUrl, titleIntersectionRect.x, titleIntersectionRect.y, titleIntersectionRect.width, titleIntersectionRect.height, photoRect.x, photoRect.y, photoRect.width, photoRect.height, ctaRect.x, ctaRect.y, isDark]);

  return { titleColor, ctaColor, isLight };
}

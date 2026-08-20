import { useState, useEffect } from 'react';
import type { Rect } from './composition';

export function useSeamContrast(
  imageUrl: string | null | undefined,
  titleBox: Rect,
  photoRect: Rect,
  ctaPos: { x: number; y: number },
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
        const size = 32;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, size, size);

        const getAvgLuminance = (targetRect: Rect) => {
          // Calculate intersection in relative coordinates [0, 1] relative to photo
          const relX = Math.max(0, (targetRect.x - photoRect.x) / photoRect.width);
          const relY = Math.max(0, (targetRect.y - photoRect.y) / photoRect.height);
          const relW = Math.min(1, targetRect.width / photoRect.width);
          const relH = Math.min(1, targetRect.height / photoRect.height);

          const startX = Math.floor(relX * size);
          const startY = Math.floor(relY * size);
          const width = Math.max(1, Math.floor(relW * size));
          const height = Math.max(1, Math.floor(relH * size));

          try {
            const data = ctx.getImageData(startX, startY, width, height).data;
            let total = 0;
            for (let i = 0; i < data.length; i += 4) {
              total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
            }
            return total / (data.length / 4);
          } catch (e) {
            return 128; // fallback
          }
        };

        const titleLum = getAvgLuminance(titleBox);
        const ctaLum = getAvgLuminance({ ...ctaPos, width: 100, height: 20 }); // approximate CTA size

        if (isMounted) {
          const titleIsLight = titleLum > 140;
          setIsLight(titleIsLight);
          setTitleColor(titleIsLight ? '#171513' : '#FFFFFF');
          setCtaColor(ctaLum > 140 ? '#171513' : '#FFFFFF');
        }
      } catch (e) {
        // CORS or other error
      }
    };

    img.src = imageUrl;
    return () => { isMounted = false; };
  }, [imageUrl, titleBox.x, titleBox.y, titleBox.width, titleBox.height, photoRect.x, photoRect.y, photoRect.width, photoRect.height, ctaPos.x, ctaPos.y, isDark]);

  return { titleColor, ctaColor, isLight };
}

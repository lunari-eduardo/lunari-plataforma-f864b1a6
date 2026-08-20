import { useState, useEffect, useRef } from 'react';
import type { Rect } from './composition';

export function useSeamContrast(
  imageUrl: string | null | undefined,
  photoRect: Rect,
  titleIntersectionRect: Rect,
  ctaRect: Rect,
  isDark = false
) {
  const [titleColor, setTitleColor] = useState('#FFFFFF');
  const [ctaColor, setCtaColor] = useState('#FFFFFF');
  const [isLight, setIsLight] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageUrl || imageUrl.includes('placeholder.svg')) return;
    if (photoRect.width <= 0 || titleIntersectionRect.width <= 0) return;

    let isMounted = true;
    
    const sample = (img: HTMLImageElement) => {
      try {
        const canvas = document.createElement('canvas');
        const size = 64; 
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const imgRatio = img.width / img.height;
        const targetRatio = photoRect.width / photoRect.height;
        
        let drawW, drawH, drawX, drawY;
        if (imgRatio > targetRatio) {
          drawH = size;
          drawW = size * (imgRatio / targetRatio);
          drawX = (size - drawW) / 2;
          drawY = 0;
        } else {
          drawW = size;
          drawH = size / (imgRatio / targetRatio);
          drawX = 0;
          drawY = (size - drawH) / 2;
        }

        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        const getAvgLuminance = (targetRect: Rect) => {
          const relX = (targetRect.x - photoRect.x) / photoRect.width;
          const relY = (targetRect.y - photoRect.y) / photoRect.height;
          const relW = targetRect.width / photoRect.width;
          const relH = targetRect.height / photoRect.height;

          const startX = Math.max(0, Math.floor(relX * size));
          const startY = Math.max(0, Math.floor(relY * size));
          const width = Math.min(size - startX, Math.max(1, Math.floor(relW * size)));
          const height = Math.min(size - startY, Math.max(1, Math.floor(relH * size)));

          if (width <= 0 || height <= 0) return 0;

          const data = ctx.getImageData(startX, startY, width, height).data;
          let total = 0;
          let count = 0;
          for (let i = 0; i < data.length; i += 4) {
            total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
            count++;
          }
          return count > 0 ? total / count : 0;
        };

        const titleLum = getAvgLuminance(titleIntersectionRect);
        const ctaLum = getAvgLuminance(ctaRect);

        if (isMounted) {
          const titleIsLight = titleLum > 160;
          setIsLight(titleIsLight);
          setTitleColor(titleIsLight ? '#171513' : '#FFFFFF');
          setCtaColor(ctaLum > 160 ? '#171513' : '#FFFFFF');
        }
      } catch (e) {
        if (isMounted) {
          setTitleColor('#FFFFFF');
          setCtaColor('#FFFFFF');
        }
      }
    };

    if (imageRef.current && imageRef.current.src === imageUrl) {
      sample(imageRef.current);
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
      img.onload = () => {
        imageRef.current = img;
        sample(img);
      };
      img.onerror = () => {
        if (isMounted) {
          setTitleColor('#FFFFFF');
          setCtaColor('#FFFFFF');
        }
      };
    }

    return () => { isMounted = false; };
  }, [imageUrl, titleIntersectionRect.x, titleIntersectionRect.y, titleIntersectionRect.width, titleIntersectionRect.height, photoRect.x, photoRect.y, photoRect.width, photoRect.height, ctaRect.x, ctaRect.y, isDark]);

  return { titleColor, ctaColor, isLight };
}
import { useState, useEffect } from 'react';

interface ImageLuminanceResult {
  isLight: boolean;
  luminance: number;
  overlayColor: string;
  isReady: boolean;
}

/**
 * Hook para analisar a luminância da imagem na região de sobreposição do texto.
 * Utiliza um canvas off-screen minúsculo para cálculo instantâneo sem bloquear a UI.
 */
export function useImageLuminance(
  imageUrl: string | null | undefined,
  targetRegion: 'left' | 'bottom' | 'full' = 'left'
): ImageLuminanceResult {
  const [result, setResult] = useState<ImageLuminanceResult>({
    isLight: false,
    luminance: 0,
    overlayColor: '#FFFFFF',
    isReady: false,
  });

  useEffect(() => {
    if (!imageUrl || imageUrl.includes('placeholder.svg')) {
      setResult({
        isLight: false,
        luminance: 60,
        overlayColor: '#FFFFFF',
        isReady: true,
      });
      return;
    }

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

        if (!ctx) {
          if (isMounted) {
            setResult({ isLight: false, luminance: 60, overlayColor: '#FFFFFF', isReady: true });
          }
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);

        // Define a região de amostragem onde o texto incide
        let startX = 0;
        let endX = size;
        let startY = 0;
        let endY = size;

        if (targetRegion === 'left') {
          endX = Math.floor(size * 0.45); // 45% esquerdos da foto
        } else if (targetRegion === 'bottom') {
          startY = Math.floor(size * 0.5); // 50% inferiores da foto
        }

        const imgData = ctx.getImageData(startX, startY, endX - startX, endY - startY).data;
        let totalLuminance = 0;
        let pixelCount = 0;

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          // Fórmula ITU-R BT.709 para luminância percebida
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          totalLuminance += lum;
          pixelCount++;
        }

        const avgLuminance = pixelCount > 0 ? totalLuminance / pixelCount : 60;
        const isLight = avgLuminance > 140;

        if (isMounted) {
          setResult({
            isLight,
            luminance: avgLuminance,
            overlayColor: isLight ? '#171513' : '#FFFFFF',
            isReady: true,
          });
        }
      } catch (err) {
        // Fallback em caso de restrição de CORS em desenvolvimento
        if (isMounted) {
          setResult({ isLight: false, luminance: 60, overlayColor: '#FFFFFF', isReady: true });
        }
      }
    };

    img.onerror = () => {
      if (isMounted) {
        setResult({ isLight: false, luminance: 60, overlayColor: '#FFFFFF', isReady: true });
      }
    };

    img.src = imageUrl;

    return () => {
      isMounted = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl, targetRegion]);

  return result;
}

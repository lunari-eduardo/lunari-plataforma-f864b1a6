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

export interface RegionRect {
  x: number; // Fração (0..1) - Posição X relativa ao container da foto
  y: number; // Fração (0..1) - Posição Y relativa ao container da foto
  w: number; // Fração (0..1) - Largura relativa ao container da foto
  h: number; // Fração (0..1) - Altura relativa ao container da foto
}

/**
 * Hook avançado para calcular a luminância de uma sub-região exata de uma imagem.
 * Considera o comportamento de `object-fit: cover` (ou `background-size: cover`)
 * para garantir que a região amostrada corresponda visualmente ao que o usuário vê.
 */
export function useRegionLuminance(
  imageUrl: string | null | undefined,
  regionInContainer: RegionRect | null,
  containerAspectRatio: number // width / height do container da foto
): ImageLuminanceResult {
  const [result, setResult] = useState<ImageLuminanceResult>({
    isLight: false,
    luminance: 60,
    overlayColor: '#FFFFFF',
    isReady: false,
  });

  useEffect(() => {
    if (!imageUrl || imageUrl.includes('placeholder.svg') || !regionInContainer || !containerAspectRatio) {
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
        const size = 64; // Maior precisão
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          if (isMounted) setResult({ isLight: false, luminance: 60, overlayColor: '#FFFFFF', isReady: true });
          return;
        }

        // --- MATEMÁTICA DO OBJECT-FIT: COVER ---
        const imgAspect = img.width / img.height;
        let drawWidth, drawHeight, drawX, drawY;

        if (imgAspect > containerAspectRatio) {
          // Imagem é mais larga que o container: corta as laterais
          drawHeight = size;
          drawWidth = size * (imgAspect / containerAspectRatio);
          drawX = (size - drawWidth) / 2;
          drawY = 0;
        } else {
          // Imagem é mais alta que o container: corta topo/base
          drawWidth = size;
          drawHeight = size * (containerAspectRatio / imgAspect);
          drawX = 0;
          drawY = (size - drawHeight) / 2;
        }

        // Desenha a imagem simulando o cover (o canvas representa o container)
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

        // Define a região de amostragem solicitada
        const startX = Math.max(0, Math.floor(regionInContainer.x * size));
        const startY = Math.max(0, Math.floor(regionInContainer.y * size));
        const sampleW = Math.max(1, Math.floor(regionInContainer.w * size));
        const sampleH = Math.max(1, Math.floor(regionInContainer.h * size));
        
        // Garante que não ultrapasse os limites do canvas
        const endX = Math.min(size, startX + sampleW);
        const endY = Math.min(size, startY + sampleH);
        const finalW = endX - startX;
        const finalH = endY - startY;

        if (finalW <= 0 || finalH <= 0) {
           if (isMounted) setResult({ isLight: false, luminance: 60, overlayColor: '#FFFFFF', isReady: true });
           return;
        }

        const imgData = ctx.getImageData(startX, startY, finalW, finalH).data;
        let totalLuminance = 0;
        let pixelCount = 0;

        // Amostragem
        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
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
            // Mantemos a cor exata conforme a instrução: '#171513' para fundo claro, '#F5F2EC' para escuro
            overlayColor: isLight ? '#171513' : '#F5F2EC',
            isReady: true,
          });
        }
      } catch (err) {
        if (isMounted) {
          setResult({ isLight: false, luminance: 60, overlayColor: '#FFFFFF', isReady: true });
        }
      }
    };

    img.onerror = () => {
      if (isMounted) setResult({ isLight: false, luminance: 60, overlayColor: '#FFFFFF', isReady: true });
    };

    img.src = imageUrl;

    return () => {
      isMounted = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl, regionInContainer, containerAspectRatio]);

  return result;
}


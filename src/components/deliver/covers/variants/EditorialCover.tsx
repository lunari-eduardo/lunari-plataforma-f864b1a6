import { useState, useMemo, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPhotoUrl } from '@/lib/photoUrl';
import { applyTitleCase } from '@/lib/textTransform';
import { useRegionLuminance, RegionRect } from '@/hooks/useImageLuminance';
import type { CoverVariantProps } from '../types';

import { resolveSpec, ResolvedSpec } from '../editorial/composition';
import { splitTitle } from '../editorial/splitTitle';
import { useFittedTitle } from '../editorial/useFittedTitle';
import { TitleComposition } from '../editorial/TitleComposition';

export default function EditorialCover({
  coverPhoto,
  sessionName,
  subtitle,
  sessionDate,
  sessionFont,
  titleCaseMode = 'normal',
  isDark = false,
  textColor,
  textOverlayColor,
  onEnter,
  settings,
}: CoverVariantProps) {
  // 1. Tratamento de Dados
  const coverUrl = coverPhoto ? getPhotoUrl(coverPhoto, 'preview') : '/placeholder.svg';
  const rawDisplayName = applyTitleCase(sessionName, titleCaseMode);
  const { line1, line2 } = useMemo(() => splitTitle(rawDisplayName), [rawDisplayName]);
  const displaySubtitle = subtitle ? subtitle.trim().toUpperCase() : undefined;

  // Formatação de data (ex: "20 · AGOSTO · 2026")
  const formattedDate = useMemo(() => {
    if (sessionDate) {
      try {
        const d = typeof sessionDate === 'string' ? new Date(sessionDate) : sessionDate;
        if (!isNaN(d.getTime())) {
          return `${format(d, 'dd')} · ${format(d, 'MMMM', { locale: ptBR }).toUpperCase()} · ${format(d, 'yyyy')}`;
        }
      } catch { /* fallback */ }
    }
    const now = new Date();
    return `${format(now, 'dd')} · ${format(now, 'MMMM', { locale: ptBR }).toUpperCase()} · ${format(now, 'yyyy')}`;
  }, [sessionDate]);

  const serifStyle = sessionFont
    ? { fontFamily: sessionFont }
    : { fontFamily: "'Bodoni Moda', 'Cormorant Garamond', 'Playfair Display', 'Instrument Serif', Didot, 'Times New Roman', serif" };

  // 2. Motor Geométrico (Resize Observer)
  const containerRef = useRef<HTMLElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setViewport({
          width: containerRef.current.clientWidth || window.innerWidth,
          height: containerRef.current.clientHeight || window.innerHeight,
        });
      } else if (typeof window !== 'undefined') {
        setViewport({ width: window.innerWidth, height: window.innerHeight });
      }
    };

    updateDimensions();

    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewport({
          width: entry.contentRect.width || window.innerWidth,
          height: entry.contentRect.height || window.innerHeight,
        });
      }
    });
    observer.observe(containerRef.current);
    window.addEventListener('resize', updateDimensions);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  const overrides = settings?.editorialCover;

  const spec: ResolvedSpec | null = useMemo(() => {
    const w = viewport.width || (typeof window !== 'undefined' ? window.innerWidth : 1200);
    const h = viewport.height || (typeof window !== 'undefined' ? window.innerHeight : 800);
    return resolveSpec(w, h, overrides);
  }, [viewport.width, viewport.height, overrides]);

  // 3. Motor Tipográfico
  const titleFontSize = useFittedTitle(
    line1,
    line2,
    viewport.width || (typeof window !== 'undefined' ? window.innerWidth : 1200),
    spec?.breakpoint || 'desktop'
  );

  // 4. Análise de Contraste Inteligente (Interseção Exata)
  const regionInPhoto: RegionRect | null = useMemo(() => {
    if (!spec || titleFontSize === 0) return null;
    
    // Estimativa da caixa delimitadora do texto
    const textHeight = line2 ? titleFontSize * 2.2 : titleFontSize * 1.2;
    const titleTop = spec.title.centerY - (textHeight / 2);
    const titleBottom = spec.title.centerY + (textHeight / 2);
    const titleLeft = spec.title.x;
    // Largura aproximada baseada nos caracteres
    const approxTextWidth = Math.max(line1.length, line2.length) * (titleFontSize * 0.58);
    const titleRight = spec.title.x + approxTextWidth;

    const { x, y, w, h } = spec.photo;
    
    // Interseção no espaço absoluto do viewport
    const interLeft = Math.max(titleLeft, x);
    const interRight = Math.min(titleRight, x + w);
    const interTop = Math.max(titleTop, y);
    const interBottom = Math.min(titleBottom, y + h);

    if (interLeft >= interRight || interTop >= interBottom) return null;

    // Normalização para fração do container da foto
    return {
      x: Math.max(0, (interLeft - x) / w),
      y: Math.max(0, (interTop - y) / h),
      w: Math.min(1, (interRight - interLeft) / w),
      h: Math.min(1, (interBottom - interTop) / h)
    };
  }, [spec, titleFontSize, line1, line2]);

  const photoAspectRatio = spec ? spec.photo.w / spec.photo.h : 1;
  const luminance = useRegionLuminance(coverUrl, regionInPhoto, photoAspectRatio);

  const baseTextColor = textColor || (isDark ? '#F5F2EC' : '#171513');
  const overlayTextColor = textOverlayColor || luminance.overlayColor;

  const handleScroll = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const gallerySection = document.getElementById('deliver-gallery');
    if (gallerySection) {
      gallerySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
    }
    onEnter?.();
  };

  const actualWidth = viewport.width || (typeof window !== 'undefined' ? window.innerWidth : 1200);
  const actualHeight = viewport.height || (typeof window !== 'undefined' ? window.innerHeight : 800);

  return (
    <section
      ref={containerRef}
      className={`relative w-full h-[100dvh] overflow-hidden select-none antialiased transition-colors duration-500 ${
        isDark ? 'bg-[#12100E] text-[#F5F2EC]' : 'bg-[#F7F4EE] text-[#171513]'
      }`}
    >
      {spec && (
        <>
          {/* CAMADA 1 (z-10): Título Base */}
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              left: `${spec.title.x}px`,
              top: `${spec.title.centerY}px`,
            }}
          >
            <div className="relative -translate-y-1/2">
              <TitleComposition
                line1={line1}
                line2={line2}
                subtitle={displaySubtitle}
                fontSizePx={titleFontSize}
                color={baseTextColor}
                fontFamily={serifStyle.fontFamily}
              />
            </div>
          </div>

          {/* CAMADA 2 (z-20): Fotografia Base */}
          <div
            className="absolute z-20 overflow-hidden shadow-2xl rounded-none group cursor-pointer"
            style={{
              left: `${spec.photo.x}px`,
              top: `${spec.photo.y}px`,
              width: `${spec.photo.w}px`,
              height: `${spec.photo.h}px`,
            }}
            onClick={handleScroll}
            role="button"
            tabIndex={0}
          >
            <div
              className="w-full h-full bg-cover bg-center transition-transform duration-1000 ease-out group-hover:scale-[1.03]"
              style={{
                backgroundImage: `url(${coverUrl})`,
                backgroundColor: isDark ? '#1C1917' : '#EAE6DD',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 pointer-events-none transition-opacity duration-500 group-hover:opacity-30" />
          </div>

          {/* CAMADA 3 (z-30): Título Sobreposto & Recortado pela Geometria da Foto */}
          <div
            className="absolute inset-0 z-30 pointer-events-none"
            style={{
              clipPath: `inset(${spec.photo.y}px ${Math.max(0, actualWidth - (spec.photo.x + spec.photo.w))}px ${Math.max(0, actualHeight - (spec.photo.y + spec.photo.h))}px ${spec.photo.x}px)`,
            }}
          >
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${spec.title.x}px`,
                top: `${spec.title.centerY}px`,
              }}
            >
              <div className="relative -translate-y-1/2">
                <TitleComposition
                  line1={line1}
                  line2={line2}
                  subtitle={displaySubtitle}
                  fontSizePx={titleFontSize}
                  color={overlayTextColor}
                  fontFamily={serifStyle.fontFamily}
                />
              </div>
            </div>
          </div>

          {/* CAMADA 4 (z-40): Footer com Data e Botão "Ver Galeria" */}
          <footer 
            className="absolute z-40 flex items-end justify-between pointer-events-auto w-full"
            style={{
              bottom: `${actualWidth < 640 ? actualHeight * 0.04 : actualHeight * 0.05}px`,
              paddingLeft: `${spec.title.x}px`,
              paddingRight: `${Math.max(spec.title.x, actualWidth - (spec.photo.x + spec.photo.w))}px`,
            }}
          >
            <p className="text-[10px] sm:text-xs lg:text-sm font-sans tracking-[0.25em] md:tracking-[0.32em] font-light opacity-80" style={{ color: baseTextColor }}>
              {formattedDate}
            </p>

            <button
              type="button"
              onClick={handleScroll}
              className="group inline-flex items-center gap-2 md:gap-3 text-[10px] sm:text-xs lg:text-sm font-sans tracking-[0.25em] md:tracking-[0.28em] font-light uppercase pb-1 md:pb-1.5 border-b border-current transition-all duration-300 hover:opacity-75 hover:gap-3 md:hover:gap-4.5 cursor-pointer"
              style={{ color: baseTextColor }}
            >
              <span>Ver Galeria</span>
              <span className="inline-block transition-transform duration-300 group-hover:translate-x-1 md:group-hover:translate-x-1.5">
                →
              </span>
            </button>
          </footer>
        </>
      )}
    </section>
  );
}

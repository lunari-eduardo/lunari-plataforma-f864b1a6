import React, { useMemo, useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPhotoUrl } from '@/lib/photoUrl';
import { applyTitleCase } from '@/lib/textTransform';
import type { CoverVariantProps } from '../types';
import { resolveEditorialSpec } from '../editorial/composition';
import { splitTitle } from '../editorial/splitTitle';
import { useFittedTitle } from '../editorial/useFittedTitle';
import { useSeamContrast } from '../editorial/useSeamContrast';
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
  onEnter,
}: CoverVariantProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(() => ({
    width: typeof window !== 'undefined' ? (window.innerWidth || document.documentElement.clientWidth || 390) : 390,
    height: typeof window !== 'undefined' ? (window.innerHeight || document.documentElement.clientHeight || 844) : 844,
  }));

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth || window.innerWidth || document.documentElement.clientWidth;
        const h = containerRef.current.clientHeight || window.innerHeight || document.documentElement.clientHeight;
        if (w > 0 && h > 0) {
          setSize({ width: w, height: h });
        }
      }
    };
    update();

    let observer: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update, { passive: true });

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const spec = useMemo(() => resolveEditorialSpec(size.width, size.height), [size]);
  const { line1, line2 } = useMemo(() => splitTitle(applyTitleCase(sessionName, titleCaseMode)), [sessionName, titleCaseMode]);
  
  const isSingleLine = !line2;
  const maxFontSizeVw = spec.orientation === 'vertical'
    ? (isSingleLine ? 18 : 12)
    : (isSingleLine ? 30 : 22);

  const coverUrl = coverPhoto ? getPhotoUrl(coverPhoto, 'preview') : '/placeholder.svg';
  
  const fontSize = useFittedTitle(
    line1,
    line2,
    spec.title.width,
    spec.title.height,
    sessionFont || 'serif',
    maxFontSizeVw,
    spec.orientation === 'vertical' ? 24 : 32
  );

  const titleIntersection = useMemo(() => {
    if (size.width === 0) return { x: 0, y: 0, width: 0, height: 0 };
    if (spec.orientation === 'vertical') {
      const intersectX = Math.max(spec.title.x, spec.seamPx);
      const intersectWidth = Math.max(0, (spec.title.x + spec.title.width) - intersectX);
      return { 
        x: intersectX, 
        y: spec.title.y - (spec.title.height / 2), 
        width: intersectWidth, 
        height: spec.title.height 
      };
    } else {
      const intersectY = Math.max(spec.title.y - (spec.title.height / 2), spec.seamPx);
      const intersectHeight = Math.max(0, (spec.title.y + (spec.title.height / 2)) - intersectY);
      return { 
        x: spec.title.x - (spec.title.width / 2), 
        y: intersectY, 
        width: spec.title.width, 
        height: intersectHeight 
      };
    }
  }, [spec, size.width]);

  const ctaRect = useMemo(() => ({
    x: spec.cta.x - 100,
    y: spec.cta.y,
    width: 100,
    height: 40
  }), [spec]);

  const baseColor = textColor || (isDark ? '#F5F2EC' : '#171513');

  const { titleColor: overlayColor, isLight: isPhotoLight } = useSeamContrast(
    coverUrl,
    spec.photo,
    titleIntersection,
    ctaRect,
    isDark,
    baseColor
  );
  const formattedSubtitle = subtitle?.toUpperCase();

  const formattedDate = useMemo(() => {
    const d = sessionDate ? (typeof sessionDate === 'string' ? new Date(sessionDate) : sessionDate) : new Date();
    return format(d, "dd '·' MMMM '·' yyyy", { locale: ptBR }).toUpperCase();
  }, [sessionDate]);

  const handleScroll = () => {
    const el = document.getElementById('deliver-gallery');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
    }
    onEnter?.();
  };

  const clipPhoto = spec.orientation === 'vertical'
    ? `inset(0 0 0 ${spec.seamPx}px)`
    : `inset(${spec.seamPx}px 0 0 0)`;

  const clipTheme = spec.orientation === 'vertical'
    ? `inset(0 ${size.width - spec.seamPx}px 0 0)`
    : `inset(0 0 ${size.height - spec.seamPx}px 0)`;

  // Posicionamento preciso do título sobre a costura da foto
  const titleBoxStyle: React.CSSProperties = spec.orientation === 'vertical' ? {
    left: `${spec.title.x}px`,
    top: `${spec.title.y}px`,
    width: `${spec.title.width}px`,
    height: `${spec.title.height}px`,
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center'
  } : {
    left: `${spec.title.x}px`,
    top: isSingleLine
      ? `${spec.seamPx - (fontSize * 0.44)}px` // Centraliza o nome de 1 linha no corte
      : `${spec.seamPx - (fontSize * 0.65)}px`, // Linha 1 cruza a costura e Linha 2 fica na foto
    width: `${spec.title.width}px`,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    textAlign: 'left'
  };

  return (
    <section
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative w-full h-[100svh] overflow-hidden antialiased select-none transition-colors duration-700 ${
        isDark ? 'bg-[#12100E]' : 'bg-[#F7F4EE]'
      }`}
      style={{ touchAction: 'pan-y' }}
    >
      {/* 1. PHOTO LAYER - REPOSITIONED TO REAL RECTANGLE */}
      <div
        className="absolute z-10 overflow-hidden pointer-events-none"
        style={{ 
          left: `${spec.photo.x}px`,
          top: `${spec.photo.y}px`,
          width: `${spec.photo.width}px`,
          height: `${spec.photo.height}px`,
        }}
      >
        <div
          className={`w-full h-full bg-cover transition-transform duration-[2000ms] ease-out scale-100 ${spec.orientation === 'vertical' ? 'hover:scale-105 bg-center' : 'bg-[center_top_15%]'}`}
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: spec.orientation === 'vertical'
              ? `linear-gradient(to right, ${isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.12)'}, transparent 20%)`
              : `linear-gradient(to bottom, ${isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.12)'}, transparent 20%)`
          }}
        />
        {/* Vinheta gradiente de proteção de contraste para a Data e CTA no rodapé */}
        <div 
          className="absolute inset-x-0 bottom-0 h-44 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 40%, transparent 100%)'
          }}
        />
      </div>

      {/* 2. BASE TITLE LAYER (FULL SCREEN CLIPPED TO THEME SIDE) */}
      <div
        className="absolute inset-0 z-20 pointer-events-none"
        style={{ clipPath: clipTheme }}
      >
        {/* Subtítulo no topo no modo mobile */}
        {spec.orientation === 'horizontal' && formattedSubtitle && (
          <div
            className="absolute z-20 flex flex-col gap-1.5"
            style={{
              left: `${spec.title.x}px`,
              top: 'max(20px, env(safe-area-inset-top) + 12px)',
            }}
          >
            <span
              className="tracking-[0.35em] font-sans opacity-60 uppercase text-[11px] sm:text-xs"
              style={{ color: baseColor }}
            >
              {formattedSubtitle}
            </span>
            <div className="w-10 h-px bg-current opacity-40" style={{ color: baseColor }} />
          </div>
        )}

        <div className="absolute" style={titleBoxStyle}>
          <div className="flex flex-col">
            {/* Subtítulo inline no modo desktop */}
            {spec.orientation === 'vertical' && formattedSubtitle && (
              <div
                className="flex flex-col gap-1.5 mb-[0.6em]"
                style={{ fontSize: `${fontSize * 0.1}px` }}
              >
                <span 
                  className="tracking-[0.35em] font-sans opacity-60 uppercase"
                  style={{ color: baseColor, fontSize: 'inherit' }}
                >
                  {formattedSubtitle}
                </span>
                <div className="w-[20%] h-px bg-current opacity-40" style={{ color: baseColor }} />
              </div>
            )}
            <TitleComposition
              line1={line1}
              line2={line2}
              fontSize={fontSize}
              color={baseColor}
              fontFamily={sessionFont}
            />
          </div>
        </div>
      </div>

      {/* 3. OVERLAY TITLE LAYER (FULL SCREEN CLIPPED TO PHOTO SIDE) */}
      <div
        className="absolute inset-0 z-30 pointer-events-none"
        style={{ clipPath: clipPhoto }}
      >
        <div className="absolute" style={titleBoxStyle}>
           <div className="flex flex-col">
            {/* Subtítulo inline no modo desktop */}
            {spec.orientation === 'vertical' && formattedSubtitle && (
              <div
                className="flex flex-col gap-1.5 mb-[0.6em]"
                style={{ fontSize: `${fontSize * 0.1}px` }}
              >
                <span 
                  className="tracking-[0.35em] font-sans opacity-60 uppercase"
                  style={{ color: overlayColor, fontSize: 'inherit' }}
                >
                  {formattedSubtitle}
                </span>
                <div className="w-[20%] h-px bg-current opacity-40" style={{ color: overlayColor }} />
              </div>
            )}
            <TitleComposition
              line1={line1}
              line2={line2}
              fontSize={fontSize}
              color={overlayColor}
              fontFamily={sessionFont}
            />
          </div>
        </div>
      </div>

      {/* 4. DETAILS LAYER (DATE & CTA) */}
      <div className="absolute inset-0 z-40 pointer-events-none select-none">
        {/* Date */}
        <div
          className="absolute"
          style={{ 
            left: `${spec.date.x}px`, 
            top: `${spec.date.y}px`,
            transform: 'translateY(-50%)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)'
          }}
        >
          <span 
            className="text-[10px] sm:text-xs tracking-[0.25em] font-sans uppercase font-medium text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          >
            {formattedDate}
          </span>
        </div>

        {/* CTA Button */}
        <div
          className="absolute pointer-events-auto"
          style={{ 
            left: `${spec.cta.x}px`, 
            top: `${spec.cta.y}px`,
            transform: 'translate(-100%, -50%)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingRight: 'env(safe-area-inset-right)'
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleScroll();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleScroll();
            }}
            className="group flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-black/45 hover:bg-black/70 active:scale-95 backdrop-blur-md border border-white/25 text-white text-[11px] sm:text-xs tracking-[0.25em] font-sans uppercase transition-all duration-300 shadow-xl cursor-pointer"
          >
            <span>Ver Galeria</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
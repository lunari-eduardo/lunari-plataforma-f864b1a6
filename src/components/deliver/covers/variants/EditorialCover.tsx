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
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const spec = useMemo(() => resolveEditorialSpec(size.width, size.height), [size]);
  const { line1, line2 } = useMemo(() => splitTitle(applyTitleCase(sessionName, titleCaseMode)), [sessionName, titleCaseMode]);
  
  const coverUrl = coverPhoto ? getPhotoUrl(coverPhoto, 'preview') : '/placeholder.svg';
  
  const fontSize = useFittedTitle(
    line1,
    line2,
    spec.title.width,
    spec.title.height,
    sessionFont || 'serif',
    spec.orientation === 'vertical' ? 12 : 18,
    spec.orientation === 'vertical' ? 24 : 34
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

  const { titleColor: overlayColor, ctaColor, isLight: isPhotoLight } = useSeamContrast(
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
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    onEnter?.();
  };

  const clipPhoto = spec.orientation === 'vertical'
    ? `inset(0 0 0 ${spec.seamPx}px)`
    : `inset(${spec.seamPx}px 0 0 0)`;

  const clipTheme = spec.orientation === 'vertical'
    ? `inset(0 ${size.width - spec.seamPx}px 0 0)`
    : `inset(0 0 ${size.height - spec.seamPx}px 0)`;

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
    top: `${spec.title.y}px`,
    width: `${spec.title.width}px`,
    height: `${spec.title.height}px`,
    transform: 'translateY(-50%)', // Anchor center of text block to the seam
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    textAlign: 'left'
  };

  return (
    <section
      ref={containerRef}
      className={`relative w-full h-[100svh] overflow-hidden antialiased transition-colors duration-700 ${
        isDark ? 'bg-[#12100E]' : 'bg-[#F7F4EE]'
      }`}
    >
      {/* 1. PHOTO LAYER - REPOSITIONED TO REAL RECTANGLE */}
      <div
        className="absolute z-10 overflow-hidden"
        style={{ 
          left: `${spec.photo.x}px`,
          top: `${spec.photo.y}px`,
          width: `${spec.photo.width}px`,
          height: `${spec.photo.height}px`,
        }}
      >
        <div
          className={`w-full h-full bg-cover bg-center transition-transform duration-[2000ms] ease-out scale-100 ${spec.orientation === 'vertical' ? 'hover:scale-105' : ''}`}
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: spec.orientation === 'vertical'
              ? `linear-gradient(to right, ${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)'}, transparent 20%)`
              : `linear-gradient(to bottom, ${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)'}, transparent 20%)`
          }}
        />
      </div>

      {/* 2. BASE TITLE LAYER (FULL SCREEN CLIPPED TO THEME SIDE) */}
      <div
        className="absolute inset-0 z-20 pointer-events-none"
        style={{ clipPath: clipTheme }}
      >
        <div className="absolute" style={titleBoxStyle}>
          <div className="flex flex-col">
            {/* Anchored Subtitle */}
            {formattedSubtitle && (
              <div
                className={`flex flex-col gap-1.5 mb-[0.6em] ${spec.orientation === 'horizontal' ? 'items-start w-full' : ''}`}
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
            {/* Anchor spacing matching theme side */}
            {formattedSubtitle && (
              <div
                className={`flex flex-col gap-1.5 mb-[0.6em] ${spec.orientation === 'horizontal' ? 'items-start w-full' : ''}`}
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
      <div className="absolute inset-0 z-40 pointer-events-none">
        {/* Date */}
        <div
          className="absolute"
          style={{ 
            left: `${spec.date.x}px`, 
            top: `${spec.date.y}px`,
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)'
          }}
        >
          <span 
            className="text-[10px] sm:text-xs tracking-[0.25em] font-sans opacity-70"
            style={{ color: spec.orientation === 'vertical' ? baseColor : (isPhotoLight ? '#171513' : '#FFFFFF') }}
          >
            {formattedDate}
          </span>
        </div>

        {/* CTA */}
        <div
          className="absolute pointer-events-auto"
          style={{ 
            left: `${spec.cta.x}px`, 
            top: `${spec.cta.y}px`,
            transform: 'translateX(-100%)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingRight: 'env(safe-area-inset-right)'
          }}
        >
          <button
            onClick={handleScroll}
            className="group flex items-center gap-2 text-[10px] sm:text-xs tracking-[0.25em] font-sans uppercase border-b border-current pb-1 transition-opacity hover:opacity-60 min-h-[44px] min-w-[44px]"
            style={{ color: ctaColor }}
          >
            <span>Ver Galeria</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
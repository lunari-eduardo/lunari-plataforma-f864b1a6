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
    spec.orientation === 'vertical' ? 24 : 32
  );

  // Calculate real screen rectangles for sampling
  // Title intersection rect: Part of the title box that is over the photo
  const titleIntersection = useMemo(() => {
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
  }, [spec]);

  const ctaRect = useMemo(() => ({
    x: spec.cta.x - 100, // Anchor right, approx width
    y: spec.cta.y,
    width: 100,
    height: 40
  }), [spec]);

  const { titleColor: overlayColor, ctaColor } = useSeamContrast(
    coverUrl,
    spec.photo,
    titleIntersection,
    ctaRect,
    isDark
  );

  const baseColor = textColor || (isDark ? '#F5F2EC' : '#171513');
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

  // Title Box positioning:
  // Desktop: Anchor left, centered vertically
  // Mobile: Anchor top, centered horizontally
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
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center'
  };

  return (
    <section
      ref={containerRef}
      className={`relative w-full h-[100dvh] overflow-hidden antialiased transition-colors duration-700 ${
        isDark ? 'bg-[#12100E]' : 'bg-[#F7F4EE]'
      }`}
    >
      {/* 1. PHOTO LAYER */}
      <div
        className="absolute inset-0 z-10"
        style={{ clipPath: clipPhoto }}
      >
        <div
          className="w-full h-full bg-cover bg-center transition-transform duration-[2000ms] ease-out scale-100 hover:scale-105"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
        {/* Subtle Vignette for contrast near seam */}
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
          <TitleComposition
            line1={line1}
            line2={line2}
            fontSize={fontSize}
            color={baseColor}
            fontFamily={sessionFont}
          />
        </div>
      </div>

      {/* 3. OVERLAY TITLE LAYER (FULL SCREEN CLIPPED TO PHOTO SIDE) */}
      <div
        className="absolute inset-0 z-30 pointer-events-none"
        style={{ clipPath: clipPhoto }}
      >
        <div className="absolute" style={titleBoxStyle}>
          <TitleComposition
            line1={line1}
            line2={line2}
            fontSize={fontSize}
            color={overlayColor}
            fontFamily={sessionFont}
          />
        </div>
      </div>

      {/* 4. DETAILS LAYER */}
      <div className="absolute inset-0 z-40 pointer-events-none">
        {/* Subtitle */}
        {formattedSubtitle && (
          <div
            className="absolute"
            style={{ 
              left: `${spec.subtitle.x}px`, 
              top: `${spec.subtitle.y}px`,
              transform: spec.orientation === 'horizontal' ? 'translateY(-100%)' : 'none'
            }}
          >
            <div className={`flex flex-col gap-2 ${spec.orientation === 'horizontal' ? 'items-center w-full' : ''}`}>
              <span 
                className="text-[10px] tracking-[0.3em] font-sans opacity-60 uppercase"
                style={{ color: baseColor }}
              >
                {formattedSubtitle}
              </span>
              <div className="w-6 h-px bg-current opacity-40" style={{ color: baseColor }} />
            </div>
          </div>
        )}

        {/* Date */}
        <div
          className="absolute"
          style={{ left: `${spec.date.x}px`, top: `${spec.date.y}px` }}
        >
          <span 
            className="text-[10px] sm:text-xs tracking-[0.25em] font-sans opacity-70"
            style={{ color: spec.orientation === 'vertical' ? baseColor : ctaColor }}
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
            transform: 'translateX(-100%)' 
          }}
        >
          <button
            onClick={handleScroll}
            className="group flex items-center gap-2 text-[10px] sm:text-xs tracking-[0.25em] font-sans uppercase border-b border-current pb-1 transition-opacity hover:opacity-60"
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

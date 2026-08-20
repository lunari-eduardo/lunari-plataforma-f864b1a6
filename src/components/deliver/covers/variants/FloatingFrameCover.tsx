import React, { useMemo, useState, useEffect, useRef } from 'react';
import { getPhotoUrl } from '@/lib/photoUrl';
import { applyTitleCase } from '@/lib/textTransform';
import { ChevronDown } from 'lucide-react';
import type { CoverVariantProps } from '../types';
import { resolveFloatingSpec } from '../editorial/floatingSpec';
import { useFittedTitle } from '../editorial/useFittedTitle';
import { splitTitle } from '../editorial/splitTitle';
import { TitleComposition } from '../editorial/TitleComposition';

export default function FloatingFrameCover({
  coverPhoto,
  sessionName,
  subtitle,
  sessionFont,
  titleCaseMode = 'normal',
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

  const spec = useMemo(() => resolveFloatingSpec(size.width, size.height), [size]);
  const { line1, line2 } = useMemo(() => splitTitle(applyTitleCase(sessionName, titleCaseMode)), [sessionName, titleCaseMode]);
  
  const coverUrl = coverPhoto ? getPhotoUrl(coverPhoto, 'preview') : '/placeholder.svg';
  
  const fontSize = useFittedTitle(
    line1,
    line2,
    spec.title.width,
    spec.title.height,
    sessionFont || 'serif',
    spec.isMobile ? 18 : 24,
    spec.isMobile ? 32 : 56
  );

  const handleScroll = () => {
    const el = document.getElementById('deliver-gallery');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    onEnter?.();
  };

  const formattedSubtitle = subtitle?.toUpperCase();

  return (
    <section
      ref={containerRef}
      className="relative w-full h-[100svh] overflow-hidden antialiased bg-[#F7F4EE] flex flex-col items-center"
    >
      {/* 1. PHOTO - FLOATING FRAME */}
      <div
        className="relative z-10 transition-all duration-1000 ease-out"
        style={{ 
          marginTop: `${spec.photo.y}px`,
          width: `${spec.photo.width}px`,
          height: `${spec.photo.height}px`,
        }}
      >
        <div 
          className="w-full h-full bg-cover bg-center shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      </div>

      {/* 2. TEXT CONTENT BLOCK */}
      <div className="flex flex-col items-center w-full px-6 mt-12 sm:mt-16 text-center max-w-4xl">
        {/* Title */}
        <div className="mb-4 sm:mb-6">
          <TitleComposition
            line1={line1}
            line2={line2}
            fontSize={fontSize}
            color="#171513"
            fontFamily={sessionFont}
            align="center"
          />
        </div>

        {/* Subtitle */}
        {formattedSubtitle && (
          <div className="mb-10 sm:mb-12">
            <span 
              className="text-[10px] sm:text-xs tracking-[0.4em] font-sans opacity-60 uppercase text-[#171513]"
            >
              {formattedSubtitle}
            </span>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleScroll}
          className="group flex items-center gap-3 px-8 py-3 border border-[#171513]/20 text-[10px] sm:text-xs tracking-[0.3em] font-sans uppercase text-[#171513] transition-all hover:bg-[#171513] hover:text-[#F7F4EE] hover:border-[#171513]"
        >
          <span>Ver Galeria</span>
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </button>
      </div>

      {/* Scroll Indicator */}
      <button
        onClick={handleScroll}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-[#171513]/30 hover:text-[#171513] transition-colors"
        aria-label="Rolar"
      >
        <ChevronDown className="w-6 h-6" />
      </button>
    </section>
  );
}

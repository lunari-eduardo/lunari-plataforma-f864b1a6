import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPhotoUrl } from '@/lib/photoUrl';
import { applyTitleCase } from '@/lib/textTransform';
import { useImageLuminance } from '@/hooks/useImageLuminance';
import type { CoverVariantProps } from '../types';

interface TitleCompositionProps {
  line1: string;
  line2: string;
  subtitle?: string;
  color: string;
  serifStyle: React.CSSProperties;
  maxLineLength: number;
  isLightOnPhoto?: boolean;
}

/**
 * Componente de composição tipográfica com proporções monumentais.
 * Renderizado de forma perfeitamente idêntica na Camada Base e na Camada Sobreposta da Foto.
 */
function DesktopTitleComposition({
  line1,
  line2,
  subtitle,
  color,
  serifStyle,
  maxLineLength,
  isLightOnPhoto = false,
}: TitleCompositionProps) {
  return (
    <div className="w-[68vw] max-w-[950px] pointer-events-none select-none">
      <div
        className="font-normal tracking-[-0.04em] leading-[0.85] transition-colors duration-300"
        style={{ ...serifStyle, color }}
      >
        <h1
          className={`block break-words transition-all duration-500 ${
            isLightOnPhoto ? 'drop-shadow-[0_1px_6px_rgba(255,255,255,0.6)]' : 'drop-shadow-sm'
          } ${
            maxLineLength > 15
              ? 'text-5xl lg:text-[4.75rem] xl:text-[6rem] 2xl:text-[7.5rem]'
              : maxLineLength > 10
              ? 'text-6xl lg:text-[6.5rem] xl:text-[8rem] 2xl:text-[9.5rem]'
              : 'text-7xl lg:text-[8rem] xl:text-[9.5rem] 2xl:text-[11.5rem]'
          }`}
        >
          {line1}
        </h1>
        {line2 && (
          <h1
            className={`block mt-1 lg:mt-2 break-words transition-all duration-500 ${
              isLightOnPhoto ? 'drop-shadow-[0_1px_6px_rgba(255,255,255,0.6)]' : 'drop-shadow-sm'
            } ${
              maxLineLength > 15
                ? 'text-5xl lg:text-[4.75rem] xl:text-[6rem] 2xl:text-[7.5rem]'
                : maxLineLength > 10
                ? 'text-6xl lg:text-[6.5rem] xl:text-[8rem] 2xl:text-[9.5rem]'
                : 'text-7xl lg:text-[8rem] xl:text-[9.5rem] 2xl:text-[11.5rem]'
            }`}
          >
            {line2}
          </h1>
        )}
      </div>

      {subtitle && (
        <div className="mt-8 lg:mt-10">
          <p
            className="text-[11px] lg:text-xs font-sans tracking-[0.34em] font-light uppercase opacity-75 transition-colors duration-300"
            style={{ color }}
          >
            {subtitle}
          </p>
        </div>
      )}
    </div>
  );
}

function MobileTitleComposition({
  line1,
  line2,
  subtitle,
  color,
  serifStyle,
  maxLineLength,
  isLightOnPhoto = false,
}: TitleCompositionProps) {
  return (
    <div className="w-full px-2 pointer-events-none select-none">
      <div
        className="font-normal tracking-[-0.04em] leading-[0.84] transition-colors duration-300"
        style={{ ...serifStyle, color }}
      >
        <h1
          className={`font-normal block break-words ${
            isLightOnPhoto ? 'drop-shadow-[0_1px_5px_rgba(255,255,255,0.6)]' : ''
          } ${
            maxLineLength > 14
              ? 'text-[2.75rem] sm:text-5xl'
              : maxLineLength > 10
              ? 'text-[3.25rem] sm:text-6xl'
              : 'text-[3.75rem] sm:text-7xl'
          }`}
        >
          {line1}
        </h1>
        {line2 && (
          <h1
            className={`font-normal block mt-1 break-words ${
              isLightOnPhoto ? 'drop-shadow-[0_1px_5px_rgba(255,255,255,0.6)]' : ''
            } ${
              maxLineLength > 14
                ? 'text-[2.75rem] sm:text-5xl'
                : maxLineLength > 10
                ? 'text-[3.25rem] sm:text-6xl'
                : 'text-[3.75rem] sm:text-7xl'
            }`}
          >
            {line2}
          </h1>
        )}
      </div>

      {subtitle && (
        <div className="mt-5">
          <p
            className="text-[10px] sm:text-xs font-sans tracking-[0.28em] font-light uppercase opacity-75 transition-colors duration-300"
            style={{ color }}
          >
            {subtitle}
          </p>
        </div>
      )}
    </div>
  );
}

export default function EditorialCover({
  coverPhoto,
  sessionName,
  subtitle,
  sessionDate,
  studioName,
  sessionFont,
  titleCaseMode = 'normal',
  isDark = false,
  textColor,
  textOverlayColor,
  onEnter,
}: CoverVariantProps) {
  const sectionRefDesktop = useRef<HTMLElement>(null);
  const photoRefDesktop = useRef<HTMLDivElement>(null);
  const sectionRefMobile = useRef<HTMLElement>(null);
  const photoRefMobile = useRef<HTMLDivElement>(null);

  const [desktopBounds, setDesktopBounds] = useState<{
    top: number;
    left: number;
    sectionWidth: number;
    sectionHeight: number;
  } | null>(null);

  const [mobileBounds, setMobileBounds] = useState<{
    top: number;
    left: number;
    sectionWidth: number;
    sectionHeight: number;
  } | null>(null);

  const coverUrl = coverPhoto ? getPhotoUrl(coverPhoto, 'preview') : '/placeholder.svg';
  const rawDisplayName = applyTitleCase(sessionName, titleCaseMode);

  // Detecção inteligente de luminância da imagem na região do texto
  const luminanceDesktop = useImageLuminance(coverUrl, 'left');
  const luminanceMobile = useImageLuminance(coverUrl, 'bottom');

  // Cores de contraste automáticas
  const resolvedTextColor = textColor || (isDark ? '#F5F2EC' : '#171513');
  const resolvedOverlayColorDesktop = textOverlayColor || luminanceDesktop.overlayColor;
  const resolvedOverlayColorMobile = textOverlayColor || luminanceMobile.overlayColor;

  // Formatação de data estilo editorial (ex: "19 · AGOSTO · 2026")
  const formattedDate = (() => {
    if (sessionDate) {
      try {
        const d = typeof sessionDate === 'string' ? new Date(sessionDate) : sessionDate;
        if (!isNaN(d.getTime())) {
          const day = format(d, 'dd');
          const month = format(d, 'MMMM', { locale: ptBR }).toUpperCase();
          const year = format(d, 'yyyy');
          return `${day} · ${month} · ${year}`;
        }
      } catch {
        /* fallback */
      }
    }
    const now = new Date();
    return `${format(now, 'dd')} · ${format(now, 'MMMM', { locale: ptBR }).toUpperCase()} · ${format(now, 'yyyy')}`;
  })();

  const displaySubtitle = subtitle ? subtitle.trim().toUpperCase() : undefined;

  // Decomposição harmônica do título (ex: "NATÁLIA" / "KNAK" ou "MARIANA" / "& RAFAEL")
  const { line1, line2 } = (() => {
    const text = rawDisplayName.trim();
    if (!text) return { line1: 'EDITORIAL', line2: '' };

    // Se contém '&', 'e' isolado ou '+', divide no conector
    const connectorMatch = text.match(/^(.*?)(?:\s+(&|e|\+)\s+)(.*)$/i);
    if (connectorMatch) {
      const p1 = connectorMatch[1].trim().toUpperCase();
      const conn = connectorMatch[2].trim().toUpperCase() === 'E' ? '&' : connectorMatch[2].trim().toUpperCase();
      const p2 = connectorMatch[3].trim().toUpperCase();
      return { line1: p1, line2: `${conn} ${p2}` };
    }

    // Se tem 2 palavras, divide em linha 1 e linha 2
    const parts = text.split(/\s+/);
    if (parts.length === 2) {
      return { line1: parts[0].toUpperCase(), line2: parts[1].toUpperCase() };
    }

    // Se tem 3 ou mais palavras, divide equilibradamente
    if (parts.length >= 3) {
      const mid = Math.ceil(parts.length / 2);
      return {
        line1: parts.slice(0, mid).join(' ').toUpperCase(),
        line2: parts.slice(mid).join(' ').toUpperCase(),
      };
    }

    // Palavra única
    return { line1: text.toUpperCase(), line2: '' };
  })();

  const maxLineLength = Math.max(line1.length, line2.length);

  // Rolagem suave determinística até a galeria de fotos
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

  // Medição geométrica com proteção total contra dimensões 0x0 ao minimizar
  const updateMeasurements = () => {
    if (sectionRefDesktop.current && photoRefDesktop.current) {
      const sRect = sectionRefDesktop.current.getBoundingClientRect();
      const pRect = photoRefDesktop.current.getBoundingClientRect();
      // Ignora medições colapsadas quando a janela está minimizada ou em segundo plano
      if (sRect.width > 50 && sRect.height > 50 && pRect.width > 50) {
        setDesktopBounds({
          top: pRect.top - sRect.top,
          left: pRect.left - sRect.left,
          sectionWidth: sRect.width,
          sectionHeight: sRect.height,
        });
      }
    }

    if (sectionRefMobile.current && photoRefMobile.current) {
      const msRect = sectionRefMobile.current.getBoundingClientRect();
      const mpRect = photoRefMobile.current.getBoundingClientRect();
      if (msRect.width > 50 && msRect.height > 50 && mpRect.width > 50) {
        setMobileBounds({
          top: mpRect.top - msRect.top,
          left: mpRect.left - msRect.left,
          sectionWidth: msRect.width,
          sectionHeight: msRect.height,
        });
      }
    }
  };

  useLayoutEffect(() => {
    updateMeasurements();
  }, [sessionName, displaySubtitle, isDark]);

  useEffect(() => {
    updateMeasurements();
    const handleResize = () => updateMeasurements();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Recalcula imediatamente ao restaurar o foco na aba
        setTimeout(updateMeasurements, 30);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const observer = new ResizeObserver(() => updateMeasurements());
    if (sectionRefDesktop.current) observer.observe(sectionRefDesktop.current);
    if (photoRefDesktop.current) observer.observe(photoRefDesktop.current);
    if (sectionRefMobile.current) observer.observe(sectionRefMobile.current);
    if (photoRefMobile.current) observer.observe(photoRefMobile.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      observer.disconnect();
    };
  }, []);

  const serifStyle = sessionFont
    ? { fontFamily: sessionFont }
    : { fontFamily: "'Bodoni Moda', 'Cormorant Garamond', 'Playfair Display', 'Instrument Serif', Didot, 'Times New Roman', serif" };

  return (
    <section
      className={`relative min-h-screen w-full overflow-hidden select-none antialiased transition-colors duration-500 ${
        isDark ? 'bg-[#12100E] text-[#F5F2EC]' : 'bg-[#F7F4EE] text-[#171513]'
      }`}
    >
      {/* ============================================================ */}
      {/* DESKTOP LAYOUT (md+) — Zero-Drift Subpixel Coordinate Anchor  */}
      {/* ============================================================ */}
      <div
        ref={sectionRefDesktop}
        className="hidden md:flex flex-col justify-between min-h-screen w-full relative p-10 md:p-14 lg:p-20"
      >
        {/* Top Spacer para respiro superior */}
        <div className="w-full h-8" />

        {/* CAMADA 1: Título Base (Cor escura sobre o fundo off-white) */}
        {/* Ancorado no centro vertical absoluto, atravessando para trás da foto */}
        <div className="absolute top-1/2 -translate-y-1/2 left-10 md:left-14 lg:left-20 z-10 pointer-events-none">
          <DesktopTitleComposition
            line1={line1}
            line2={line2}
            subtitle={displaySubtitle}
            color={resolvedTextColor}
            serifStyle={serifStyle}
            maxLineLength={maxLineLength}
          />
        </div>

        {/* Center-Right Editorial Photography (Frame OPACO com Clipping da Camada 2) */}
        <div
          ref={photoRefDesktop}
          className="absolute top-12 md:top-14 lg:top-16 bottom-20 md:bottom-24 right-10 md:right-14 lg:right-20 w-[54%] lg:w-[50%] xl:w-[48%] z-20 overflow-hidden group cursor-pointer shadow-2xl transition-all duration-700"
          onClick={handleScroll}
          title="Ver galeria"
          role="button"
          tabIndex={0}
        >
          {/* Imagem Fotográfica Principal */}
          <div
            className="w-full h-full bg-cover bg-center transition-transform duration-1000 ease-out group-hover:scale-[1.03]"
            style={{
              backgroundImage: `url(${coverUrl})`,
              backgroundColor: isDark ? '#1C1917' : '#EAE6DD',
            }}
          />
          {/* Sutil vinheta cinematográfica que garante leitura perfeita em qualquer imagem */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 pointer-events-none transition-opacity duration-500 group-hover:opacity-40" />

          {/* CAMADA 2: Cópia Idêntica em Cor de Contraste, Recortada com Precisão Subpixel */}
          {desktopBounds && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-30">
              <div
                style={{
                  position: 'absolute',
                  top: -desktopBounds.top,
                  left: -desktopBounds.left,
                  width: desktopBounds.sectionWidth,
                  height: desktopBounds.sectionHeight,
                }}
              >
                {/* Âncora Absoluta IDÊNTICA à Camada 1 para Trava Subpixel Perfeita */}
                <div className="absolute top-1/2 -translate-y-1/2 left-10 md:left-14 lg:left-20">
                  <DesktopTitleComposition
                    line1={line1}
                    line2={line2}
                    subtitle={displaySubtitle}
                    color={resolvedOverlayColorDesktop}
                    serifStyle={serifStyle}
                    maxLineLength={maxLineLength}
                    isLightOnPhoto={luminanceDesktop.isLight}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Bar: Data Editorial & CTA Alinhado com Rolagem Suave */}
        <footer className="flex items-end justify-between z-30 relative pt-6 animate-fade-in">
          <div>
            <p className="text-xs lg:text-sm font-sans tracking-[0.32em] font-light opacity-80">
              {formattedDate}
            </p>
          </div>

          <button
            type="button"
            onClick={handleScroll}
            className="group inline-flex items-center gap-3 text-xs lg:text-sm font-sans tracking-[0.28em] font-light uppercase pb-1.5 border-b border-current transition-all duration-300 hover:opacity-75 hover:gap-4.5 cursor-pointer"
          >
            <span>Ver Galeria</span>
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">
              →
            </span>
          </button>
        </footer>
      </div>

      {/* ============================================================ */}
      {/* MOBILE LAYOUT (<md) — Recomposição Monumental com Overlap     */}
      {/* ============================================================ */}
      <div
        ref={sectionRefMobile}
        className="flex md:hidden flex-col justify-between min-h-screen w-full px-6 py-8 relative overflow-hidden"
      >
        {/* Espaço superior de respiro */}
        <div className="w-full h-3" />

        {/* Centro: Foto com Sobreposição Vertical Monumental */}
        <div className="relative my-auto flex flex-col items-center w-full">
          {/* Moldura da Foto */}
          <div
            ref={photoRefMobile}
            className="relative w-full aspect-[3/4] max-h-[48vh] rounded-none overflow-hidden group shadow-xl cursor-pointer z-20"
            onClick={handleScroll}
            role="button"
            tabIndex={0}
          >
            <div
              className="w-full h-full bg-cover bg-center"
              style={{
                backgroundImage: `url(${coverUrl})`,
                backgroundColor: isDark ? '#1C1917' : '#EAE6DD',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 pointer-events-none" />

            {/* CAMADA 2 (MOBILE): Cópia Idêntica em Cor Clara Recortada pela Foto */}
            {mobileBounds && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-30">
                <div
                  style={{
                    position: 'absolute',
                    top: -mobileBounds.top,
                    left: -mobileBounds.left,
                    width: mobileBounds.sectionWidth,
                    height: mobileBounds.sectionHeight,
                  }}
                  className="px-6 py-8 flex flex-col justify-between"
                >
                  <div className="w-full h-3" />
                  <div className="my-auto flex flex-col items-center w-full">
                    <div className="w-full aspect-[3/4] max-h-[48vh]" />
                    <div className="w-full -mt-20 sm:-mt-24 px-1">
                      <MobileTitleComposition
                        line1={line1}
                        line2={line2}
                        subtitle={displaySubtitle}
                        color={resolvedOverlayColorMobile}
                        serifStyle={serifStyle}
                        maxLineLength={maxLineLength}
                        isLightOnPhoto={luminanceMobile.isLight}
                      />
                    </div>
                  </div>
                  <div className="pt-8 pb-2" />
                </div>
              </div>
            )}
          </div>

          {/* CAMADA 1 (MOBILE): Título Base em Cor Escura Sobreposto na Base da Foto */}
          <div className="w-full -mt-20 sm:-mt-24 relative z-10 px-1 pointer-events-none">
            <MobileTitleComposition
              line1={line1}
              line2={line2}
              subtitle={displaySubtitle}
              color={resolvedTextColor}
              serifStyle={serifStyle}
              maxLineLength={maxLineLength}
            />
          </div>
        </div>

        {/* Bottom Bar: Data e CTA com Espaçamento Confortável e Rolagem Suave */}
        <footer className="pt-8 pb-2 flex items-center justify-between z-30 border-t border-current/10">
          <p className="text-[10px] sm:text-xs font-sans tracking-[0.25em] font-light opacity-80">
            {formattedDate}
          </p>

          <button
            type="button"
            onClick={handleScroll}
            className="group inline-flex items-center gap-2 text-[11px] sm:text-xs font-sans tracking-[0.25em] font-light uppercase pb-1 border-b border-current transition-all duration-300 hover:opacity-75 cursor-pointer"
          >
            <span>Ver Galeria</span>
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
          </button>
        </footer>
      </div>
    </section>
  );
}

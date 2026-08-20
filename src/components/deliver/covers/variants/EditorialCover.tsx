import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPhotoUrl } from '@/lib/photoUrl';
import { applyTitleCase } from '@/lib/textTransform';
import { useImageLuminance } from '@/hooks/useImageLuminance';
import type { CoverVariantProps } from '../types';

interface TitleTypographyProps {
  line1: string;
  line2: string;
  subtitle?: string;
  color: string;
  serifStyle: React.CSSProperties;
  maxLineLength: number;
  isLightOnPhoto?: boolean;
}

/**
 * Composição tipográfica Desktop com escala monumental e proteção total contra quebra de palavras.
 */
function DesktopTitleBlock({
  line1,
  line2,
  subtitle,
  color,
  serifStyle,
  maxLineLength,
  isLightOnPhoto = false,
}: TitleTypographyProps) {
  const fontSizeClass =
    maxLineLength <= 7
      ? 'text-7xl lg:text-[7.5rem] xl:text-[9.5rem] 2xl:text-[11.5rem]'
      : maxLineLength <= 11
      ? 'text-6xl lg:text-[6.25rem] xl:text-[7.75rem] 2xl:text-[9rem]'
      : maxLineLength <= 16
      ? 'text-5xl lg:text-[5rem] xl:text-[6.25rem] 2xl:text-[7.5rem]'
      : 'text-4xl lg:text-[4.25rem] xl:text-[5.25rem] 2xl:text-[6.25rem]';

  return (
    <div className="w-[66vw] max-w-[1000px] pointer-events-none select-none">
      <div
        className="font-normal tracking-[-0.04em] leading-[0.88] transition-colors duration-300"
        style={{ ...serifStyle, color }}
      >
        <h1
          className={`block whitespace-nowrap transition-all duration-300 ${fontSizeClass} ${
            isLightOnPhoto ? 'drop-shadow-[0_1px_8px_rgba(255,255,255,0.7)]' : 'drop-shadow-sm'
          }`}
        >
          {line1}
        </h1>
        {line2 && (
          <h2
            className={`block mt-2 lg:mt-3.5 whitespace-nowrap transition-all duration-300 ${fontSizeClass} ${
              isLightOnPhoto ? 'drop-shadow-[0_1px_8px_rgba(255,255,255,0.7)]' : 'drop-shadow-sm'
            }`}
          >
            {line2}
          </h2>
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

/**
 * Composição tipográfica Mobile com espaçamento vertical seguro e sem sobreposição.
 */
function MobileTitleBlock({
  line1,
  line2,
  subtitle,
  color,
  serifStyle,
  maxLineLength,
  isLightOnPhoto = false,
}: TitleTypographyProps) {
  const fontSizeClass =
    maxLineLength <= 7
      ? 'text-[2.75rem] sm:text-5xl'
      : maxLineLength <= 11
      ? 'text-[2.25rem] sm:text-[2.75rem]'
      : maxLineLength <= 16
      ? 'text-[1.85rem] sm:text-[2.25rem]'
      : 'text-[1.5rem] sm:text-[1.85rem]';

  return (
    <div className="w-full px-2 pointer-events-none select-none">
      <div
        className="font-normal tracking-[-0.04em] leading-[0.95] transition-colors duration-300"
        style={{ ...serifStyle, color }}
      >
        <h1
          className={`font-normal block break-words sm:whitespace-nowrap ${fontSizeClass} ${
            isLightOnPhoto ? 'drop-shadow-[0_1px_6px_rgba(255,255,255,0.7)]' : ''
          }`}
        >
          {line1}
        </h1>
        {line2 && (
          <h2
            className={`font-normal block mt-1.5 sm:mt-2.5 break-words sm:whitespace-nowrap ${fontSizeClass} ${
              isLightOnPhoto ? 'drop-shadow-[0_1px_6px_rgba(255,255,255,0.7)]' : ''
            }`}
          >
            {line2}
          </h2>
        )}
      </div>

      {subtitle && (
        <div className="mt-3 sm:mt-4">
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
  const coverUrl = coverPhoto ? getPhotoUrl(coverPhoto, 'preview') : '/placeholder.svg';
  const rawDisplayName = applyTitleCase(sessionName, titleCaseMode);

  // Detecção inteligente de luminância da imagem na região onde o texto incide
  const luminanceDesktop = useImageLuminance(coverUrl, 'left');
  const luminanceMobile = useImageLuminance(coverUrl, 'bottom');

  // Matriz de Contraste Inteligente Bidirecional
  const baseTextColor = textColor || (isDark ? '#F5F2EC' : '#171513');
  const overlayTextColorDesktop =
    textOverlayColor || (luminanceDesktop.isLight ? '#171513' : '#FFFFFF');
  const overlayTextColorMobile =
    textOverlayColor || (luminanceMobile.isLight ? '#171513' : '#FFFFFF');

  // Formatação de data estilo editorial (ex: "19 · AGOSTO · 2026")
  const formattedDate = useMemo(() => {
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
  }, [sessionDate]);

  const displaySubtitle = subtitle ? subtitle.trim().toUpperCase() : undefined;

  // Decomposição harmônica do título sem quebra forçada de palavras
  const { line1, line2 } = useMemo(() => {
    const text = rawDisplayName.trim();
    if (!text) return { line1: 'EDITORIAL', line2: '' };

    // Se contém conector ('&', 'e', '+'), divide no conector
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
  }, [rawDisplayName]);

  const maxLineLength = Math.max(line1.length, line2.length);

  // Rolagem suave determinística até o início da galeria
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
      {/* DESKTOP LAYOUT (md+) — Pure GPU CSS clip-path Architecture   */}
      {/* ============================================================ */}
      <div className="hidden md:block min-h-screen w-full relative">
        {/* CAMADA 1: Título Base (Cor escura/clara do tema sobre o fundo) */}
        <div className="absolute top-1/2 -translate-y-1/2 left-[5vw] lg:left-[6vw] z-10 pointer-events-none select-none">
          <DesktopTitleBlock
            line1={line1}
            line2={line2}
            subtitle={displaySubtitle}
            color={baseTextColor}
            serifStyle={serifStyle}
            maxLineLength={maxLineLength}
          />
        </div>

        {/* CAMADA 2: Frame da Fotografia (Opaco: bloqueia o texto que está atrás) */}
        {/* Geometria unificada: top-[8vh] bottom-[16vh] right-[5vw] w-[48vw] */}
        <div
          className="absolute top-[8vh] bottom-[16vh] right-[5vw] w-[48vw] z-20 overflow-hidden shadow-2xl rounded-none group cursor-pointer"
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
          {/* Vinheta cinematográfica sutil */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 pointer-events-none transition-opacity duration-500 group-hover:opacity-30" />
        </div>

        {/* CAMADA 3: Título Sobreposto (Cor inteligente, recortada pelo clip-path exato da foto) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-[5vw] lg:left-[6vw] z-30 pointer-events-none select-none"
          style={{
            clipPath: 'inset(8vh 5vw 16vh 47vw)',
          }}
        >
          <DesktopTitleBlock
            line1={line1}
            line2={line2}
            subtitle={displaySubtitle}
            color={overlayTextColorDesktop}
            serifStyle={serifStyle}
            maxLineLength={maxLineLength}
            isLightOnPhoto={luminanceDesktop.isLight}
          />
        </div>

        {/* FOOTER DESKTOP: Data na esquerda e "Ver Galeria →" na direita (com folga limpa de 11vh abaixo da foto) */}
        <footer className="absolute bottom-[5vh] left-[5vw] right-[5vw] flex items-end justify-between z-40 pointer-events-auto">
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
      {/* MOBILE LAYOUT (<md) — Recomposição Estável (1 única instância)*/}
      {/* ============================================================ */}
      <div className="flex md:hidden flex-col justify-between min-h-screen w-full px-5 py-6 relative overflow-hidden">
        {/* Espaço superior de respiro */}
        <div className="w-full h-2" />

        {/* Centro: Foto e Título em fluxo vertical sem duplicação */}
        <div className="relative my-auto flex flex-col items-center w-full">
          {/* Moldura da Foto */}
          <div
            className="relative w-full aspect-[3/4] max-h-[46vh] rounded-none overflow-hidden shadow-xl cursor-pointer z-20 group"
            onClick={handleScroll}
            role="button"
            tabIndex={0}
          >
            <div
              className="w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-[1.02]"
              style={{
                backgroundImage: `url(${coverUrl})`,
                backgroundColor: isDark ? '#1C1917' : '#EAE6DD',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 pointer-events-none" />
          </div>

          {/* Única Instância do Título Mobile */}
          <div className="w-full mt-5 relative z-10 px-1 pointer-events-none">
            <MobileTitleBlock
              line1={line1}
              line2={line2}
              subtitle={displaySubtitle}
              color={baseTextColor}
              serifStyle={serifStyle}
              maxLineLength={maxLineLength}
            />
          </div>
        </div>

        {/* Bottom Bar Mobile: Data e CTA com Rolagem Suave */}
        <footer className="pt-6 pb-2 flex items-center justify-between z-40 border-t border-current/10 w-full">
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

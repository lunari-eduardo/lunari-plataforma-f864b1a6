import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPhotoUrl } from '@/lib/photoUrl';
import { applyTitleCase } from '@/lib/textTransform';
import type { CoverVariantProps } from '../types';

export default function EditorialCover({
  coverPhoto,
  sessionName,
  subtitle,
  sessionDate,
  category,
  issueNumber = '01',
  studioName,
  sessionFont,
  titleCaseMode = 'normal',
  isDark = false,
  onEnter,
}: CoverVariantProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const coverUrl = coverPhoto ? getPhotoUrl(coverPhoto, 'preview') : '/placeholder.svg';
  const rawDisplayName = applyTitleCase(sessionName, titleCaseMode);

  // Formatação de data estilo editorial (ex: "18 · AGOSTO · 2026")
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

  const currentYear = (() => {
    if (sessionDate) {
      try {
        const d = typeof sessionDate === 'string' ? new Date(sessionDate) : sessionDate;
        if (!isNaN(d.getTime())) return format(d, 'yyyy');
      } catch {}
    }
    return new Date().getFullYear().toString();
  })();

  const displayCategory = (category || 'WEDDING').toUpperCase();
  const displaySubtitle = (subtitle || 'WEDDING STORY').toUpperCase();
  const displayBrand = (studioName || 'LUNARI GALLERY').toUpperCase();

  // Decomposição harmônica do título (ex: "MARIANA" / "& RAFAEL")
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

    // Se tem 2 palavras, linha 1 e linha 2
    const parts = text.split(/\s+/);
    if (parts.length === 2) {
      return { line1: parts[0].toUpperCase(), line2: parts[1].toUpperCase() };
    }

    // Se tem 3 ou mais palavras, divide no meio
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

  const handleScroll = () => {
    const gallerySection = document.getElementById('deliver-gallery');
    if (gallerySection) {
      gallerySection.scrollIntoView({ behavior: 'smooth' });
    }
    onEnter();
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
      {/* DESKTOP LAYOUT (md+)                                         */}
      {/* ============================================================ */}
      <div className="hidden md:flex flex-col justify-between min-h-screen w-full relative p-8 md:p-12 lg:p-16">
        
        {/* Top Information Bar */}
        <header className="flex items-start justify-between z-30 relative animate-fade-in">
          <div>
            <span className="text-[11px] lg:text-xs font-mono tracking-[0.28em] font-light opacity-75">
              {displayCategory} / {currentYear}
            </span>
            <div className="h-px w-6 bg-current opacity-40 mt-1.5" />
          </div>

          <div className="text-right">
            <span className="text-xs lg:text-sm font-mono tracking-[0.25em] font-light opacity-75">
              {issueNumber}
            </span>
            <div className="h-px w-6 bg-current opacity-40 mt-1.5 ml-auto" />
          </div>
        </header>

        {/* Left Margin Vertical Brand Mark */}
        <aside className="absolute left-6 lg:left-10 top-1/2 -translate-y-1/2 z-30 hidden xl:flex flex-col items-center gap-6 pointer-events-none">
          <span
            className="text-[9px] font-mono tracking-[0.45em] opacity-40 uppercase"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {displayBrand}
          </span>
          <div className="w-px h-12 bg-current opacity-25" />
        </aside>

        {/* Center-Right Editorial Photography */}
        <div
          className="absolute top-12 md:top-14 lg:top-16 bottom-20 md:bottom-24 right-8 md:right-12 lg:right-16 w-[56%] lg:w-[52%] xl:w-[50%] z-10 overflow-hidden group cursor-pointer shadow-2xl transition-all duration-700"
          onClick={handleScroll}
          title="Clique para ver a galeria"
        >
          <div
            className="w-full h-full bg-cover bg-center transition-transform duration-1000 ease-out group-hover:scale-[1.03]"
            style={{
              backgroundImage: `url(${coverUrl})`,
              backgroundColor: isDark ? '#1C1917' : '#EAE6DD',
            }}
          />
          {/* Subtle cinematic gradient vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-60 pointer-events-none transition-opacity duration-500 group-hover:opacity-40" />
        </div>

        {/* Foreground Typography Overlap (The Signature Magazine Feature) */}
        <div className="relative z-20 my-auto pt-16 pb-8 max-w-[85%] pointer-events-none">
          <div
            className="relative font-normal tracking-[-0.035em] leading-[0.88] transition-all duration-700"
            style={serifStyle}
          >
            {/* Layer com mix-blend-mode: difference que inverte sobre a foto e sobre o fundo */}
            <div className="mix-blend-difference text-white">
              <h1
                className={`block drop-shadow-sm break-words transition-all duration-500 ${
                  maxLineLength > 15
                    ? 'text-5xl lg:text-[4.5rem] xl:text-[5.75rem] 2xl:text-[7rem]'
                    : maxLineLength > 10
                    ? 'text-6xl lg:text-[5.5rem] xl:text-[7rem] 2xl:text-[8.5rem]'
                    : 'text-6xl md:text-7xl lg:text-[6.5rem] xl:text-[8rem] 2xl:text-[9.5rem]'
                }`}
              >
                {line1}
              </h1>
              {line2 && (
                <h1
                  className={`block mt-1 lg:mt-2 drop-shadow-sm break-words transition-all duration-500 ${
                    maxLineLength > 15
                      ? 'text-5xl lg:text-[4.5rem] xl:text-[5.75rem] 2xl:text-[7rem]'
                      : maxLineLength > 10
                      ? 'text-6xl lg:text-[5.5rem] xl:text-[7rem] 2xl:text-[8.5rem]'
                      : 'text-6xl md:text-7xl lg:text-[6.5rem] xl:text-[8rem] 2xl:text-[9.5rem]'
                  }`}
                >
                  {line2}
                </h1>
              )}
            </div>
          </div>

          {/* Subtítulo posicionado abaixo do título */}
          <div className="mt-8 lg:mt-10 pointer-events-auto">
            <p className="text-[11px] lg:text-xs font-sans tracking-[0.32em] font-light uppercase opacity-75">
              {displaySubtitle}
            </p>
            <div className="h-px w-6 bg-current opacity-40 mt-2" />
          </div>
        </div>

        {/* Bottom Bar: Data & CTA */}
        <footer className="flex items-end justify-between z-30 relative pt-4 animate-fade-in">
          <div>
            <p className="text-xs lg:text-sm font-sans tracking-[0.32em] font-light opacity-80">
              {formattedDate}
            </p>
          </div>

          <button
            onClick={handleScroll}
            className="group inline-flex items-center gap-3 text-xs lg:text-sm font-sans tracking-[0.28em] font-light uppercase pb-1.5 border-b border-current transition-all duration-300 hover:opacity-75 hover:gap-4.5"
          >
            <span>Ver Galeria</span>
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">
              →
            </span>
          </button>
        </footer>
      </div>

      {/* ============================================================ */}
      {/* MOBILE LAYOUT (<md) — Recomposição Vertical Autoral         */}
      {/* ============================================================ */}
      <div className="flex md:hidden flex-col justify-between min-h-screen w-full px-5 py-6 relative">
        
        {/* Top Header */}
        <header className="flex items-center justify-between z-20 pb-4">
          <div>
            <span className="text-[10px] font-mono tracking-[0.25em] font-light opacity-75 uppercase">
              {displayCategory} / {currentYear}
            </span>
            <div className="h-px w-4 bg-current opacity-40 mt-1" />
          </div>
          <div className="text-right">
            <span className="text-xs font-mono tracking-[0.25em] font-light opacity-75">
              {issueNumber}
            </span>
            <div className="h-px w-4 bg-current opacity-40 mt-1 ml-auto" />
          </div>
        </header>

        {/* Center Photo with Overlapping Typography */}
        <div className="relative my-auto flex flex-col items-center w-full">
          {/* Main Photo Frame */}
          <div
            className="relative w-full aspect-[3/4] max-h-[52vh] rounded-none overflow-hidden group shadow-lg cursor-pointer"
            onClick={handleScroll}
          >
            <div
              className="w-full h-full bg-cover bg-center"
              style={{
                backgroundImage: `url(${coverUrl})`,
                backgroundColor: isDark ? '#1C1917' : '#EAE6DD',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-60 pointer-events-none" />
          </div>

          {/* Overlapping Title (Entering bottom of photo and continuing down) */}
          <div className="w-full -mt-14 sm:-mt-18 relative z-20 px-1">
            <div
              className="relative font-normal tracking-[-0.035em] leading-[0.88] mix-blend-difference text-white"
              style={serifStyle}
            >
              <h1
                className={`font-normal block break-words ${
                  maxLineLength > 14
                    ? 'text-4xl sm:text-5xl'
                    : maxLineLength > 10
                    ? 'text-[2.65rem] sm:text-5xl'
                    : 'text-5xl sm:text-6xl'
                }`}
              >
                {line1}
              </h1>
              {line2 && (
                <h1
                  className={`font-normal block mt-1 break-words ${
                    maxLineLength > 14
                      ? 'text-4xl sm:text-5xl'
                      : maxLineLength > 10
                      ? 'text-[2.65rem] sm:text-5xl'
                      : 'text-5xl sm:text-6xl'
                  }`}
                >
                  {line2}
                </h1>
              )}
            </div>

            {/* Subtítulo */}
            <div className="mt-5">
              <p className="text-[10px] sm:text-xs font-sans tracking-[0.28em] font-light uppercase opacity-75">
                {displaySubtitle}
              </p>
              <div className="h-px w-5 bg-current opacity-40 mt-1.5" />
            </div>
          </div>
        </div>

        {/* Bottom Bar: Data e Botão */}
        <footer className="pt-6 pb-2 flex items-center justify-between z-20 border-t border-current/10">
          <p className="text-[10px] sm:text-xs font-sans tracking-[0.25em] font-light opacity-80">
            {formattedDate}
          </p>

          <button
            onClick={handleScroll}
            className="group inline-flex items-center gap-2 text-[11px] sm:text-xs font-sans tracking-[0.25em] font-light uppercase pb-1 border-b border-current transition-all"
          >
            <span>Ver Galeria</span>
            <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </button>
        </footer>
      </div>
    </section>
  );
}


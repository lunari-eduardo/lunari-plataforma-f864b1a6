import { useMemo } from 'react';
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
  sessionFont,
  titleCaseMode = 'normal',
  isDark = false,
  textColor,
  onEnter,
}: CoverVariantProps) {
  const coverUrl = coverPhoto ? getPhotoUrl(coverPhoto, 'preview') : '/placeholder.svg';
  const rawDisplayName = applyTitleCase(sessionName, titleCaseMode);
  const displaySubtitle = subtitle ? subtitle.trim().toUpperCase() : undefined;

  const formattedDate = useMemo(() => {
    if (sessionDate) {
      try {
        const d = typeof sessionDate === 'string' ? new Date(sessionDate) : sessionDate;
        if (!isNaN(d.getTime())) return `${format(d, 'dd')} · ${format(d, 'MMMM', { locale: ptBR }).toUpperCase()} · ${format(d, 'yyyy')}`;
      } catch { /* fallback */ }
    }
    return format(new Date(), "dd '·' MMMM '·' yyyy", { locale: ptBR }).toUpperCase();
  }, [sessionDate]);

  const serifStyle = sessionFont
    ? { fontFamily: sessionFont }
    : { fontFamily: "'Bodoni Moda', 'Playfair Display', serif" };

  const baseTextColor = textColor || (isDark ? '#F5F2EC' : '#171513');
  const bgColor = isDark ? '#12100E' : '#F7F4EE';

  const handleScroll = () => {
    const gallerySection = document.getElementById('deliver-gallery');
    if (gallerySection) gallerySection.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
    onEnter?.();
  };

  // Divisão simples de título
  const { line1, line2 } = useMemo(() => {
    const words = rawDisplayName.trim().split(/\s+/);
    if (words.length > 2) {
      const mid = Math.ceil(words.length / 2);
      return { line1: words.slice(0, mid).join(' '), line2: words.slice(mid).join(' ') };
    } else if (words.length === 2) {
      return { line1: words[0], line2: words[1] };
    }
    return { line1: rawDisplayName, line2: '' };
  }, [rawDisplayName]);

  // Sombra leve para garantir leitura quando o texto sobrepor a foto
  const shadow = isDark 
    ? '0 4px 32px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.6)' 
    : '0 4px 32px rgba(255,255,255,0.9), 0 1px 4px rgba(255,255,255,0.8)';

  return (
    <section 
      className="relative w-full h-[100dvh] overflow-hidden select-none"
      style={{ backgroundColor: bgColor, color: baseTextColor }}
    >
      {/* 
        MODELO SIMPLIFICADO ESTÁTICO
        Sem cálculos JS, sem observers, responsividade nativa usando CSS.
      */}

      {/* FOTO */}
      <div 
        className="absolute z-10 overflow-hidden shadow-2xl cursor-pointer
                   top-[8vh] right-[5vw] w-[85vw] h-[50vh]
                   md:top-[10vh] md:right-[5vw] md:w-[48vw] md:h-[75vh]"
        onClick={handleScroll}
      >
        <div 
          className="w-full h-full bg-cover bg-center transition-transform duration-1000 hover:scale-[1.03]"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />
      </div>

      {/* TÍTULO E SUBTÍTULO */}
      <div 
        className="absolute z-30 flex flex-col justify-center pointer-events-none
                   top-[48vh] left-[5vw] w-[90vw]
                   md:top-1/2 md:-translate-y-1/2 md:left-[5vw] md:w-[75vw]"
      >
        <div 
          className="uppercase tracking-tight leading-[0.9]"
          style={{ 
            ...serifStyle,
            // Escala nativa CSS que garante tamanho grande contínuo
            fontSize: 'clamp(3rem, 11vw, 12rem)',
            color: baseTextColor,
            textShadow: shadow
          }}
        >
          <h1 className="break-words m-0 p-0">{line1}</h1>
          {line2 && <h2 className="break-words m-0 p-0 mt-2">{line2}</h2>}
        </div>

        {displaySubtitle && (
          <p 
            className="mt-4 md:mt-8 text-[10px] md:text-xs font-sans tracking-[0.3em] font-light uppercase opacity-90"
            style={{ textShadow: shadow }}
          >
            {displaySubtitle}
          </p>
        )}
      </div>

      {/* RODAPÉ */}
      <footer className="absolute bottom-[4vh] left-[5vw] right-[5vw] flex items-end justify-between z-40">
        <p className="text-[10px] sm:text-xs font-sans tracking-[0.2em] md:tracking-[0.3em] uppercase opacity-80">
          {formattedDate}
        </p>

        <button
          onClick={handleScroll}
          className="group flex items-center gap-2 text-[10px] sm:text-xs font-sans tracking-[0.2em] uppercase pb-1 border-b border-current opacity-90 hover:opacity-100 transition-opacity"
        >
          Ver Galeria
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </button>
      </footer>
    </section>
  );
}

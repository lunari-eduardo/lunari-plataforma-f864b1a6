import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useInlineEdit } from './inlineContext';
import { EditableText } from './EditableText';
import { EditableImage } from './EditableImage';
import { fontDisplayCss, fontBodyCss } from './design';

interface EditorialCompositionProps {
  content: any;
  props: any;
}

/**
 * EditorialComposition: Bloco de composição gráfica avançada.
 * Arquitetura "Seam" para sobreposição de tipografia com inversão de cor.
 */
export function EditorialComposition({ content, props }: EditorialCompositionProps) {
  const inline = useInlineEdit();
  const editable = inline?.editable ?? false;
  
  const et = (path: string, value: string | undefined) => ({
    editable,
    value: value ?? '',
    onCommit: (v: string) => inline?.set(path, v),
  });

  const c = content || {};
  const p = props || {};

  const fd = useMemo(() => ({ fontFamily: fontDisplayCss() }), []);
  const fb = useMemo(() => ({ fontFamily: fontBodyCss() }), []);
  
  const layout = p.layout || 'split-left'; // split-left, split-right, full-overlap
  const isDark = p.background === 'dark';
  
  // Cores semânticas baseadas nos tokens
  const bgTextColor = isDark ? 'text-white' : 'text-[var(--pa-ink,#1A1714)]';
  const photoTextColor = 'text-white'; 

  const TitleLayer = ({ layerType, className }: { layerType: 'bg' | 'photo', className?: string }) => {
    const clipClass = layout === 'split-left' 
      ? (layerType === 'bg' ? 'clip-seam-left-bg' : 'clip-seam-left-photo')
      : layout === 'split-right'
      ? (layerType === 'bg' ? 'clip-seam-right-bg' : 'clip-seam-right-photo')
      : (layerType === 'photo' ? 'clip-none' : 'clip-hide');

    return (
      <div 
        className={cn(
          "absolute inset-0 z-20 flex flex-col justify-center pointer-events-none transition-all duration-700",
          layout === 'full-overlap' ? "items-center text-center px-8" : "p-8 @md:p-20",
          layout === 'split-left' && "items-center @md:items-end @md:pr-[10%]",
          layout === 'split-right' && "items-center @md:items-start @md:pl-[10%]",
          clipClass,
          className
        )}
      >
        <div className="max-w-[90%] md:max-w-[80%]">
          <h2 
            className="text-5xl @md:text-7xl @lg:text-[10rem] leading-[0.85] tracking-tight pointer-events-auto"
            style={fd}
          >
            <EditableText {...et('title', c.title)} placeholder="Título" />
            {c.title_italic && (
              <em className="block italic opacity-90 -mt-2 @md:-mt-4">
                <EditableText {...et('title_italic', c.title_italic)} placeholder="Itálico" />
              </em>
            )}
          </h2>
        </div>
      </div>
    );
  };

  return (
    <section className={cn(
      "relative min-h-[600px] @md:min-h-[800px] overflow-hidden flex flex-col @md:flex-row editorial-seam-container",
      p.background === 'cream' && "bg-[var(--pa-cream,#FDFBF7)]",
      p.background === 'linen' && "bg-[var(--pa-linen,#F0E9E1)]",
      p.background === 'stone' && "bg-[var(--pa-stone,#D8C7B8)]",
      p.background === 'dark' && "bg-[var(--pa-ink,#2C2825)]",
      layout === 'split-right' && "flex-col-reverse @md:flex-row-reverse"
    )}>
      
      {/* 1. LAYER DE IMAGEM */}
      <div className={cn(
        "relative w-full @md:w-1/2 min-h-[400px] @md:min-h-[800px] z-0",
        layout === 'full-overlap' && "absolute inset-0 @md:w-full"
      )}>
        <EditableImage
          editable={editable}
          value={c.image_url}
          label="Imagem Principal"
          onCommit={(url) => inline?.set('image_url', url)}
          className="absolute inset-0 w-full h-full"
          imgClassName="object-cover w-full h-full"
        />
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />
      </div>

      {/* 2. LAYER DE CONTEÚDO (TEXTOS DE APOIO) */}
      <div className={cn(
        "relative w-full @md:w-1/2 p-8 @md:p-20 flex flex-col justify-center z-10",
        layout === 'full-overlap' && "h-full @md:w-full items-center text-center",
        layout === 'split-left' && "bg-inherit",
        layout === 'split-right' && "bg-inherit"
      )}>
        <EditableText
          as="span"
          {...et('eyebrow', c.eyebrow)}
          className={cn(
            "text-[10px] font-medium tracking-[0.3em] uppercase opacity-60 mb-8 block",
            bgTextColor
          )}
        />

        <div className="h-32 @md:h-48 @lg:h-64 mb-10" />

        <div className={cn("max-w-[40ch] space-y-6", layout === 'full-overlap' && "max-w-[60ch]")}>
          <EditableText
            as="p"
            {...et('body', c.body)}
            multiline
            className={cn(
              "text-lg @md:text-xl font-light leading-relaxed opacity-80",
              bgTextColor
            )}
            style={fb}
          />
        </div>

        {c.side_label && (
          <div className={cn(
            "hidden @lg:block absolute right-8 top-1/2 -translate-y-1/2 rotate-90 origin-right text-[10px] tracking-[0.5em] uppercase opacity-30 whitespace-nowrap",
            bgTextColor
          )}>
            {c.side_label}
          </div>
        )}
      </div>

      {/* 3. COMPOSIÇÃO DE TÍTULO (SEAM ARCHITECTURE) */}
      <TitleLayer layerType="bg" className={bgTextColor} />
      <TitleLayer layerType="photo" className={photoTextColor} />

      <style dangerouslySetInnerHTML={{ __html: `
        .editorial-seam-container {
          container-type: inline-size;
        }
        .clip-seam-left-bg { clip-path: inset(50% 0 0 0); }
        .clip-seam-left-photo { clip-path: inset(0 0 50% 0); }
        .clip-seam-right-bg { clip-path: inset(0 0 50% 0); }
        .clip-seam-right-photo { clip-path: inset(50% 0 0 0); }
        
        @container (min-width: 768px) {
          .clip-seam-left-bg { clip-path: inset(0 0 0 50%); }
          .clip-seam-left-photo { clip-path: inset(0 50% 0 0); }
          .clip-seam-right-bg { clip-path: inset(0 50% 0 0); }
          .clip-seam-right-photo { clip-path: inset(0 0 0 50%); }
        }
        .clip-hide { clip-path: inset(0 0 0 100%); }
        .clip-none { clip-path: none; }
      `}} />
    </section>
  );
}

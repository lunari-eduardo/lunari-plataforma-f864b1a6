import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useInlineEdit } from './inlineContext';
import { EditableText } from './EditableText';
import { EditableImage } from './EditableImage';
import { fontDisplayCss } from './design';

interface EditorialCompositionProps {
  content: any;
  props: any;
}

/**
 * EditorialComposition: Bloco de composição gráfica avançada.
 * Suporta sobreposição de texto em imagens, orientação dinâmica e split-screen.
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

  // Tokens de design e layout
  const fd = useMemo(() => ({ fontFamily: fontDisplayCss() }), []);
  
  const layout = p.layout || 'split-left'; // split-left, split-right, full-overlap
  const isDark = p.background === 'dark';
  const textColor = isDark ? 'text-white' : 'text-[var(--pa-ink,#1A1714)]';
  
  return (
    <section className={cn(
      "relative min-h-[600px] overflow-hidden flex flex-col @md:flex-row",
      p.background === 'cream' && "bg-[var(--pa-cream,#FDFBF7)]",
      p.background === 'linen' && "bg-[var(--pa-linen,#F0E9E1)]",
      p.background === 'stone' && "bg-[var(--pa-stone,#D8C7B8)]",
      p.background === 'dark' && "bg-[var(--pa-ink,#2C2825)]",
      layout === 'split-right' && "flex-col-reverse @md:flex-row-reverse"
    )}>
      
      {/* Container de Imagem */}
      <div className={cn(
        "relative w-full @md:w-1/2 min-h-[400px] @md:min-h-[700px] z-0",
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
        {/* Overlay para legibilidade se necessário */}
        {layout === 'full-overlap' && (
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />
        )}
      </div>

      {/* Container de Conteúdo */}
      <div className={cn(
        "relative w-full @md:w-1/2 p-8 @md:p-20 flex flex-col justify-center z-10",
        layout === 'full-overlap' && "h-full @md:w-full items-center text-center",
        layout === 'split-left' && "bg-inherit",
        layout === 'split-right' && "bg-inherit"
      )}>
        
        {/* Eyebrow */}
        <EditableText
          as="span"
          {...et('eyebrow', c.eyebrow)}
          className={cn(
            "text-[10px] font-medium tracking-[0.3em] uppercase opacity-60 mb-8 block",
            textColor
          )}
        />

        {/* Título Principal - Gigante e Editorial */}
        <h2 
          className={cn(
            "text-5xl @md:text-7xl @lg:text-8xl leading-[0.9] tracking-tight mb-10",
            textColor
          )}
          style={fd}
        >
          <EditableText {...et('title', c.title)} placeholder="Título" />
          {c.title_italic && (
            <em className="block italic opacity-80 mt-2">
              <EditableText {...et('title_italic', c.title_italic)} placeholder="Itálico" />
            </em>
          )}
        </h2>

        {/* Divisor Visual */}
        <div className={cn("w-12 h-px mb-10", isDark ? "bg-white/20" : "bg-black/10")} />

        {/* Corpo de Texto */}
        <div className={cn("max-w-[40ch] space-y-6", layout === 'full-overlap' && "max-w-[60ch]")}>
          <EditableText
            as="p"
            {...et('body', c.body)}
            multiline
            className={cn(
              "text-lg @md:text-xl font-light leading-relaxed opacity-80",
              textColor
            )}
          />
        </div>

        {/* Assinatura Vertical / Detalhe Lateral */}
        {c.side_label && (
          <div className={cn(
            "hidden @lg:block absolute right-8 top-1/2 -translate-y-1/2 rotate-90 origin-right text-[10px] tracking-[0.5em] uppercase opacity-30 whitespace-nowrap",
            textColor
          )}>
            {c.side_label}
          </div>
        )}
      </div>

      {/* Efeito de Sobreposição de Título (Seam) */}
      {/* Nota: Implementação simplificada para a Fase 2, focada na estrutura do bloco. 
          A lógica de clip-path avançada da Fase 3 será integrada após validação desta estrutura. */}
    </section>
  );
}

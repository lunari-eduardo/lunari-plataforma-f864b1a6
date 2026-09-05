import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EditableText } from '../../../blocks/EditableText';
import { EditableImage } from '../../../blocks/EditableImage';
import { useInlineEdit } from '../../../blocks/inlineContext';
import { fd, fb, alignClass, sectionBg, textColorClass, CtaHandler } from './helpers';

export function CoverMinimalCenter({
  data,
  props,
  onCtaClick,
}: {
  data?: any;
  props?: any;
  onCtaClick?: CtaHandler;
}) {
  const inline = useInlineEdit();
  const editable = inline?.editable ?? false;
  const et = (path: string, value: string | undefined) => ({
    editable,
    value: value ?? '',
    onCommit: (v: string) => inline?.set(path, v),
  });

  // V1 usa title/subtitle/btnText; V2 (CoverBlock) usa eyebrow/title_regular/title_italic/photographer_name
  const eyebrow = data?.eyebrow;
  const title = data?.title ?? data?.title_regular;
  const titleItalic = data?.title_italic;
  const subtitle = data?.subtitle ?? data?.photographer_name;
  const btnText = data?.btnText;
  const hasTitle = !!title || !!titleItalic;

  const align = alignClass(props?.align, 'left');
  const colAlign =
    props?.align === 'center'
      ? 'items-center'
      : props?.align === 'right'
      ? 'items-end'
      : 'items-start';

  return (
    <section
      className={cn(
        'relative flex flex-col @md:flex-row items-center min-h-[500px] p-8 @md:p-16 gap-12 overflow-hidden',
        sectionBg(props?.background, 'white'),
        textColorClass(props?.text_color, props?.background, 'white')
      )}
    >
      {/* Texto */}
      <div className={cn('flex-1 flex flex-col z-10', colAlign, align)}>
        <EditableText
          as="p"
          {...et('eyebrow', eyebrow)}
          multiline
          className="text-[10px] font-medium tracking-[0.28em] uppercase opacity-60 mb-4"
        />
        <h1
          className="text-4xl @md:text-5xl @lg:text-6xl text-current leading-[1.1] tracking-tight max-w-[15ch] mb-6"
          style={fd()}
        >
          {hasTitle || editable ? (
            <>
              <EditableText {...et('title', title)} placeholder="Título da capa" />
              <em className="italic opacity-60">
                <EditableText {...et('title_italic', titleItalic)} placeholder="continuação em itálico" />
              </em>
            </>
          ) : (
            'Seu momento merece ser vivido e lembrado para sempre.'
          )}
        </h1>
        <EditableText
          as="p"
          {...et('subtitle', subtitle)}
          multiline
          className="text-[var(--pa-taupe,#6D655E)] text-lg max-w-[40ch] mb-10 leading-relaxed font-light"
          style={fb()}
        />
        {btnText &&
          (editable ? (
            <div
              className="bg-[var(--pa-accent,#C86A46)] text-white rounded-none px-8 py-6 text-sm font-medium tracking-wide cursor-text"
              onClick={(e) => e.stopPropagation()}
            >
              <EditableText {...et('btnText', btnText)} placeholder="Texto do botão" />
            </div>
          ) : (
            <Button
              className="bg-[var(--pa-accent,#C86A46)] hover:bg-[var(--pa-accent,#C86A46)]/90 text-white rounded-none px-8 py-6 h-auto text-sm font-medium tracking-wide"
              onClick={() => onCtaClick?.({ blockType: 'cover', label: btnText })}
            >
              {btnText}
            </Button>
          ))}
      </div>

      {/* Imagem */}
      <div className="flex-1 w-full h-[400px] @md:h-[600px] relative rounded-[2rem] overflow-hidden shadow-2xl">
        <EditableImage
          editable={editable}
          value={data?.image_url || null}
          label="Capa"
          alt="Capa"
          onCommit={(url) => inline?.set('image_url', url)}
          className="absolute inset-0 w-full h-full bg-gradient-to-br from-[var(--pa-linen,#E8DCCB)] to-[var(--pa-stone,#C9B7A2)]"
          publicEmptyClassName="w-full h-full"
        />
      </div>
    </section>
  );
}

export function CoverPosterSplit({ data, props }: { data?: any; props?: any }) {
  const inline = useInlineEdit();
  const editable = inline?.editable ?? false;
  const et = (path: string, value: string | undefined) => ({
    editable,
    value: value ?? '',
    onCommit: (v: string) => inline?.set(path, v),
  });

  const eyebrow = data?.eyebrow;
  const title = data?.title;
  const titleItalic = data?.title_italic;
  const subtitle = data?.subtitle;
  const photographerName = data?.photographer_name;

  return (
    <section className="relative min-h-[700px] @md:min-h-[900px] flex flex-col overflow-hidden">
      {/* Foto full-bleed como fundo */}
      <EditableImage
        editable={editable}
        value={data?.image_url || null}
        label="Capa"
        alt="Capa"
        onCommit={(url) => inline?.set('image_url', url)}
        className="absolute inset-0 w-full h-full"
        imgClassName="object-cover w-full h-full"
        publicEmptyClassName="w-full h-full"
      />

      {/* Gradiente cream → transparente no topo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, var(--pa-cream, #F3F0EA) 0%, var(--pa-cream, #F3F0EA) 15%, transparent 55%)`,
        }}
      />

      {/* Conteúdo sobre o gradiente */}
      <div className="relative z-10 flex flex-col items-center text-center flex-1 px-6 @md:px-16 pt-12 @md:pt-20">
        {/* Ornamento vertical */}
        <div className="w-[1px] h-8 bg-[var(--pa-accent,#7A5C42)] mb-6" />

        {/* Eyebrow */}
        <EditableText
          as="p"
          {...et('eyebrow', eyebrow)}
          className="text-[9px] @md:text-[10px] font-medium tracking-[0.35em] uppercase text-[var(--pa-taupe,#8C7B6E)] mb-6 @md:mb-10"
        />

        {/* Título gigante */}
        <h1
          className={cn(
            'text-5xl @md:text-7xl @lg:text-8xl uppercase tracking-[0.12em] leading-[1.05] mb-4 @md:mb-6 max-w-[12ch]',
            textColorClass(props?.text_color, props?.background, 'white')
          )}
          style={fd()}
        >
          <EditableText {...et('title', title)} placeholder="TÍTULO" />
          {titleItalic && (
            <em className="italic opacity-70 block text-[0.6em] tracking-[0.06em] mt-1">
              <EditableText {...et('title_italic', titleItalic)} />
            </em>
          )}
        </h1>

        {/* Subtítulo */}
        <EditableText
          as="p"
          {...et('subtitle', subtitle)}
          multiline
          className="text-[10px] @md:text-xs tracking-[0.25em] uppercase text-[var(--pa-taupe,#8C7B6E)] max-w-[40ch] leading-relaxed"
          style={fb()}
        />
      </div>

      {/* Assinatura do fotógrafo no rodapé */}
      <div className="relative z-10 pb-8 @md:pb-12 text-center mt-auto">
        <EditableText
          as="p"
          {...et('photographer_name', photographerName)}
          className="text-[9px] @md:text-[10px] tracking-[0.3em] uppercase text-white/80"
          style={fb()}
        />
      </div>
    </section>
  );
}

export function CoverRenderer({
  data,
  props,
  onCtaClick,
}: {
  data?: any;
  props?: any;
  onCtaClick?: CtaHandler;
}) {
  const variant = props?.variant || 'minimal-center';
  switch (variant) {
    case 'poster-split':
      return <CoverPosterSplit data={data} props={props} />;
    default:
      return <CoverMinimalCenter data={data} props={props} onCtaClick={onCtaClick} />;
  }
}

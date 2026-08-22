import React from 'react';
import { BlockData } from '@/hooks/useMaterialEditor';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { ProposalDesignTokens, tokensToCssVars, ensureFontLoaded, fontDisplayCss } from '../../blocks/design';
import { EditableText } from '../../blocks/EditableText';
import { EditableImage, AddImageTile } from '../../blocks/EditableImage';
import { InlineEditContext, useInlineEdit } from '../../blocks/inlineContext';

interface VisualRendererProps {
  blocks: BlockData[];
  activeIndex: number;
  onSelectBlock: (index: number) => void;
  viewMode: 'desktop' | 'mobile';
  onSectionView?: (blockId: string, blockType: string, position: number) => void;
  /** 'edit' (padrão): chrome de edição. 'public': sem chrome, CTAs funcionais. */
  mode?: 'edit' | 'public';
  /** Acionado em modo público quando o cliente clica num CTA interno da proposta. */
  onCtaClick?: (ctx: { blockType: string; label?: string }) => void;
  /** Paleta/tipografia do template (proposal_templates.design_tokens). */
  designTokens?: ProposalDesignTokens;
  /** Edição de textos/imagens direto na arte (duplo clique) — desktop do editor. */
  inlineEditing?: boolean;
  /** Edição granular de campo por camada pontuada ("details.0.label", "props.photo_a.image_ref"). */
  onUpdateField?: (index: number, path: string, value: any) => void;
}

// ---------------------------------------------------------
// Componentes Individuais de Renderização
// Nota: breakpoints usam container queries (@md:, @lg:) — respondem à
// largura da MOLDURA (canvas desktop ou frame mobile), não da janela.
// Cores vêm das CSS variables --pa-* injetadas pelo design tokens.
// Textos editam com duplo clique (EditableText); imagens trocam com
// duplo clique (EditableImage) — ambos apenas no editor.
// ---------------------------------------------------------

const fd = () => ({ fontFamily: fontDisplayCss() });

type CtaHandler = (ctx: { blockType: string; label?: string }) => void;

// ---- Helpers de layout (props.align / props.background) ----

const ALIGN_CLASS: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
  justify: 'text-justify',
};

const alignClass = (align?: string, fallback = 'left') => ALIGN_CLASS[align ?? ''] ?? fallback;

function sectionBg(bg: string | undefined, fallback: string): string {
  switch (bg ?? fallback) {
    case 'cream':
      return 'bg-[var(--pa-cream,#F3F0EA)] text-[var(--pa-ink,#1A1714)]';
    case 'linen':
      return 'bg-[var(--pa-linen,#E8DCCB)] text-[var(--pa-ink,#1A1714)]';
    case 'dark':
      return 'bg-[var(--pa-ink,#1A1714)] text-white';
    default:
      return 'bg-white text-[var(--pa-ink,#1A1714)]';
  }
}

function CoverRenderer({ data, props, onCtaClick }: { data?: any; props?: any; onCtaClick?: CtaHandler }) {
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
  const colAlign = props?.align === 'center'
    ? 'items-center'
    : props?.align === 'right'
      ? 'items-end'
      : 'items-start';

  return (
    <section className="relative flex flex-col @md:flex-row items-center min-h-[500px] bg-[var(--pa-white,#FDFBF7)] p-8 @md:p-16 gap-12 overflow-hidden">
      {/* Texto */}
      <div className={cn('flex-1 flex flex-col z-10', colAlign, align)}>
        <EditableText as="p" {...et('eyebrow', eyebrow)} multiline
          className="text-[10px] font-medium tracking-[0.28em] uppercase text-[var(--pa-taupe,#8C7B6E)] mb-4" />
        <h1 className="text-4xl @md:text-5xl @lg:text-6xl text-[var(--pa-ink,#2C2825)] leading-[1.1] tracking-tight max-w-[15ch] mb-6" style={fd()}>
          {hasTitle || editable ? (
            <>
              <EditableText {...et('title', title)} placeholder="Título da capa" />
              <em className="italic text-[var(--pa-ink,#2C2825)]/60">
                <EditableText {...et('title_italic', titleItalic)} placeholder="continuação em itálico" />
              </em>
            </>
          ) : (
            'Seu momento merece ser vivido e lembrado para sempre.'
          )}
        </h1>
        <EditableText as="p" {...et('subtitle', subtitle)} multiline
          className="text-[var(--pa-taupe,#6D655E)] text-lg max-w-[40ch] mb-10 leading-relaxed font-light" />
        {btnText && (
          editable ? (
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
          )
        )}
      </div>

      {/* Imagem (duplo clique troca; sem foto = placeholder elegante, nunca imagem de terceiros) */}
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

function PackageRenderer({ data, onCtaClick }: { data: any; onCtaClick?: CtaHandler }) {
  return (
    <section className="py-16 px-8 bg-white flex flex-col items-center">
      <div className="w-full max-w-md bg-white border border-[var(--pa-linen,#EBE5DF)] rounded-2xl p-8 shadow-sm flex flex-col relative transition-all hover:shadow-md">
        {data?.highlight && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--pa-cream,#F3EBE1)] text-[var(--pa-accent,#A67C52)] text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
            Mais Escolhido
          </div>
        )}

        <h3 className="text-2xl text-[var(--pa-ink,#2C2825)] mb-2" style={fd()}>{data?.title || 'Essencial'}</h3>
        <p className="text-sm text-[var(--pa-taupe,#6D655E)] mb-6">{data?.subtitle || 'Para quem deseja registros leves e naturais.'}</p>

        <div className="flex-1">
          <p className="text-sm text-[var(--pa-ink,#4A4541)] whitespace-pre-line leading-loose">
            {data?.description || '10 fotos digitais\n1h de ensaio\nGaleria online'}
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--pa-cream,#F2EFEA)] flex items-center justify-between">
          <span className="text-2xl font-medium text-[var(--pa-ink,#2C2825)]">
            R$ {((data?.price_cents || 129000) / 100).toLocaleString('pt-BR')}
          </span>
          <Button
            variant="outline"
            className="border-[var(--pa-stone,#D8D2CB)] text-[var(--pa-ink,#2C2825)] hover:bg-[var(--pa-white,#FDFBF7)] rounded-none"
            onClick={() => onCtaClick?.({ blockType: 'package', label: data?.title || 'Pacote' })}
          >
            Escolher pacote
          </Button>
        </div>
      </div>
    </section>
  );
}

function DefaultRenderer({ block }: { block: BlockData }) {
  const inline = useInlineEdit();
  const et = (path: string, value: string | undefined) => ({
    editable: inline?.editable ?? false,
    value: value ?? '',
    onCommit: (v: string) => inline?.set(path, v),
  });
  const v = block.content ?? block.data ?? {};
  const align = alignClass(block.props?.align, 'center');
  const bg = sectionBg(block.props?.background, 'white');
  return (
    <section className={cn('py-16 px-8', bg, align)}>
      <div className="max-w-2xl mx-auto">
        <EditableText as="h2" {...et('title', v.title)} multiline
          className="text-3xl text-current mb-4" style={fd()} />
        <EditableText as="p" {...et('body', v.body ?? v.content ?? v.description)} multiline
          className="opacity-70 whitespace-pre-line" />
      </div>
    </section>
  );
}

function EditorialRenderer({ data, content, props }: { data?: any; content?: any; props?: any }) {
  const inline = useInlineEdit();
  const editable = inline?.editable ?? false;
  const et = (path: string, value: string | undefined) => ({
    editable,
    value: value ?? '',
    onCommit: (v: string) => inline?.set(path, v),
  });

  const c = content || data || {};
  const p = props || {};

  const isDark = (p.background ?? 'dark') === 'dark';
  const borderColor = isDark ? 'border-white/10' : 'border-[var(--pa-ink,#1A1714)]/10';
  const align = alignClass(p.align, 'left');

  const hasA = !!p.photo_a?.image_ref;
  const hasB = !!p.photo_b?.image_ref;
  const blend = hasA && hasB && p.blend_mode !== false;

  const imgSlot = (slotKey: 'photo_a' | 'photo_b', label: string, style: React.CSSProperties) => (
    <EditableImage
      editable={editable}
      value={p[slotKey]?.image_ref || null}
      label={label}
      alt={label}
      onCommit={(url) => inline?.set(`props.${slotKey}.image_ref`, url)}
      className="rounded-[3px] overflow-hidden"
      style={style}
    />
  );

  return (
    <section className={cn('py-16 @md:py-28 px-6 @md:px-14 overflow-hidden', sectionBg(p.background, 'dark'))}>
      <div className="max-w-[900px] mx-auto">
        <div className="grid grid-cols-1 @md:grid-cols-2 gap-10 @md:gap-24 items-center">

          {/* Visual (Photos) — duplo clique para enviar/trocar */}
          <div className="relative h-[280px] @md:h-[520px]">
            {imgSlot('photo_a', 'Foto A', {
              position: 'absolute', top: 0, left: 0,
              width: `${p.photo_a?.width_pct || 72}%`,
              height: `${p.photo_a?.height_pct || 80}%`,
            })}
            {imgSlot('photo_b', 'Foto B', {
              position: 'absolute', bottom: 0, right: 0,
              width: `${p.photo_b?.width_pct || 62}%`,
              height: `${p.photo_b?.height_pct || 66}%`,
              mixBlendMode: blend ? 'screen' : undefined,
            })}
            {c.vertical_label && (
              <p
                className="hidden @md:block absolute bottom-8 -left-5 text-[10px] tracking-[0.35em] uppercase text-white/20"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
              >
                {c.vertical_label}
              </p>
            )}
          </div>

          {/* Text Content */}
          <div className={cn('flex flex-col', align)}>
            <EditableText as="span" {...et('eyebrow', c.eyebrow)}
              className="text-[10px] font-medium tracking-[0.28em] uppercase opacity-50 mb-4 block" />

            <h2 className="text-4xl @md:text-5xl @lg:text-[4rem] font-light leading-[1.02] tracking-[0.03em] mb-10" style={fd()}>
              <EditableText {...et('title', c.title)} placeholder="Título" />
              <em className="italic opacity-60"><EditableText {...et('title_italic', c.title_italic)} placeholder="em itálico" /></em>
            </h2>

            {c.details && c.details.length > 0 && (
              <div className="flex flex-col gap-0 mb-9">
                {c.details.map((detail: any, idx: number) => (
                  <div key={detail.id || idx} className={cn('flex justify-between items-baseline gap-6 py-3 border-b', borderColor, idx === 0 && 'border-t')}>
                    <EditableText as="span" {...et(`details.${idx}.label`, detail.label)}
                      className="text-[10px] font-medium tracking-[0.24em] uppercase opacity-50 whitespace-nowrap" />
                    <EditableText as="span" {...et(`details.${idx}.value`, detail.value)}
                      className="text-base font-light text-right opacity-75" style={fd()} />
                  </div>
                ))}
              </div>
            )}

            <EditableText as="p" {...et('body', c.body)} multiline
              className="italic text-base @md:text-[1.1rem] font-light leading-[1.7] opacity-60" style={fd()} />
          </div>

        </div>
      </div>
    </section>
  );
}

function PricingTableRenderer({ content, data, props, onCtaClick }: { content?: any; data?: any; props?: any; onCtaClick?: CtaHandler }) {
  const inline = useInlineEdit();
  const editable = inline?.editable ?? false;
  const et = (path: string, value: string | undefined) => ({
    editable,
    value: value ?? '',
    onCommit: (v: string) => inline?.set(path, v),
  });
  const c = content || data || {};
  const packages: any[] = c.packages || [];
  const align = alignClass(props?.align, 'center');

  // Colunas conforme a quantidade de pacotes (1 pacote não fica "perdido" na grade)
  const colsClass = packages.length === 1
    ? 'grid-cols-1 max-w-md mx-auto'
    : packages.length === 2
      ? 'grid-cols-1 @md:grid-cols-2 max-w-[680px] mx-auto'
      : 'grid-cols-1 @md:grid-cols-3';

  return (
    <section className={cn('py-16 @md:py-24 px-6 @md:px-14', sectionBg(props?.background, 'white'), align)}>
      <div className="max-w-[900px] mx-auto">
        <EditableText as="p" {...et('eyebrow', c.eyebrow)}
          className="text-[10px] font-medium tracking-[0.28em] uppercase opacity-50 mb-4" />
        <EditableText as="h2" {...et('title', c.title)}
          className="text-4xl @md:text-5xl mb-12" style={fd()} />
        <div className={cn('grid gap-8 text-left', colsClass)}>
          {packages.map((pkg: any, idx: number) => (
            <div key={pkg.id || idx} className="border border-current/10 p-8 rounded-sm bg-[var(--pa-white,#FDFBF7)] flex flex-col relative overflow-hidden">
              {pkg.badge && (
                <div className="absolute top-0 right-0 bg-[var(--pa-cream,#F3F0EA)] text-[10px] font-medium tracking-[0.28em] uppercase text-[var(--pa-taupe,#8C7B6E)] px-3 py-1 border-b border-l border-current/10">
                  <EditableText {...et(`packages.${idx}.badge`, pkg.badge)} />
                </div>
              )}
              <EditableText as="h3" {...et(`packages.${idx}.name`, pkg.name)}
                className="text-2xl mb-2 pr-6" style={fd()} />
              <p className="text-xl text-[var(--pa-accent,#7A5C42)] mb-6">
                <EditableText {...et(`packages.${idx}.price`, pkg.price)} placeholder="R$" />
                <span className="text-sm opacity-50 font-light">/<EditableText {...et(`packages.${idx}.price_unit`, pkg.price_unit)} placeholder="un." /></span>
              </p>

              {/* Imagem do pacote (duplo clique troca) */}
              {(pkg.image_ref || editable) && (
                <div className="h-36 w-full mb-6 rounded-sm overflow-hidden relative bg-black/5">
                  <EditableImage
                    editable={editable}
                    value={pkg.image_ref || null}
                    label="Foto do pacote"
                    alt={pkg.name || 'Pacote'}
                    onCommit={(url) => inline?.set(`packages.${idx}.image_ref`, url)}
                  />
                </div>
              )}

              <ul className="space-y-3 flex-1 mb-8">
                {(pkg.features || []).map((feat: string, i: number) => (
                  <li key={i} className="text-sm font-light opacity-70 border-b border-current/10 pb-2 last:border-0">
                    <EditableText {...et(`packages.${idx}.features.${i}`, feat)} placeholder="Item incluso" />
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="w-full border-current rounded-none hover:bg-current/90 transition-colors"
                onClick={() => onCtaClick?.({ blockType: 'PricingTable', label: pkg.name })}
              >
                Selecionar
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialRenderer({ content, data, props }: { content?: any; data?: any; props?: any }) {
  const inline = useInlineEdit();
  const et = (path: string, value: string | undefined) => ({
    editable: inline?.editable ?? false,
    value: value ?? '',
    onCommit: (v: string) => inline?.set(path, v),
  });
  const c = content || data || {};
  const align = alignClass(props?.align, 'center');
  return (
    <section className={cn('py-16 @md:py-24 px-6 @md:px-14', sectionBg(props?.background, 'cream'), align)}>
      <div className="max-w-[900px] mx-auto">
        <EditableText as="p" {...et('eyebrow', c.eyebrow)}
          className="text-[10px] font-medium tracking-[0.28em] uppercase opacity-50 mb-4" />
        <EditableText as="h2" {...et('title', c.title)}
          className="text-4xl @md:text-5xl mb-12" style={fd()} />
        <div className="flex flex-nowrap overflow-x-auto gap-8 pb-8 snap-x text-left">
          {(c.items || []).map((item: any, idx: number) => (
            <div key={item.id || idx} className="min-w-[80%] @md:min-w-[400px] snap-center bg-white/80 p-8 rounded-sm flex flex-col shadow-sm">
              <span className="text-4xl text-[var(--pa-stone,#C9BFB2)] leading-none mb-4" style={fd()}>"</span>
              <EditableText as="p" {...et(`items.${idx}.quote`, item.quote)} multiline
                className="italic text-lg leading-relaxed mb-6 flex-1 opacity-80" style={fd()} />
              <div>
                <EditableText as="p" {...et(`items.${idx}.author`, item.author)}
                  className="font-bold text-sm uppercase tracking-wider" />
                <EditableText as="p" {...et(`items.${idx}.service`, item.service)}
                  className="text-xs opacity-50 uppercase tracking-widest mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQRenderer({ content, data, props }: { content?: any; data?: any; props?: any }) {
  const inline = useInlineEdit();
  const et = (path: string, value: string | undefined) => ({
    editable: inline?.editable ?? false,
    value: value ?? '',
    onCommit: (v: string) => inline?.set(path, v),
  });
  const c = content || data || {};
  const isDark = (props?.background ?? 'cream') === 'dark';
  const cardClass = isDark
    ? 'border-white/10 bg-white/5'
    : 'border-[var(--pa-ink,#1A1714)]/10 bg-white/70';
  return (
    <section className={cn('py-16 @md:py-24 px-6 @md:px-14', sectionBg(props?.background, 'cream'), alignClass(props?.align, 'center'))}>
      <div className="max-w-[800px] mx-auto">
        <EditableText as="p" {...et('eyebrow', c.eyebrow)}
          className="text-[10px] font-medium tracking-[0.28em] uppercase opacity-50 mb-4" />
        <EditableText as="h2" {...et('title', c.title)}
          className="text-4xl @md:text-5xl mb-12" style={fd()} />

        <div className="mt-4 space-y-3 text-left">
          {(c.items || []).map((item: any, idx: number) => (
            <details key={item.id || idx} className={cn('group border rounded-sm', cardClass)}>
              <summary className="flex cursor-pointer list-none [&::-webkit-details-marker]:hidden items-center justify-between gap-4 px-6 py-4 text-sm font-medium">
                <EditableText as="span" {...et(`items.${idx}.question`, item.question)} className="flex-1" placeholder="Pergunta" />
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50 transition-transform group-open:rotate-180" />
              </summary>
              <EditableText as="p" {...et(`items.${idx}.answer`, item.answer)} multiline
                className="block px-6 pb-5 text-sm font-light opacity-70 whitespace-pre-line" />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTABlockRenderer({ content, data, props, onCtaClick }: { content?: any; data?: any; props?: any; onCtaClick?: CtaHandler }) {
  const inline = useInlineEdit();
  const editable = inline?.editable ?? false;
  const et = (path: string, value: string | undefined) => ({
    editable,
    value: value ?? '',
    onCommit: (v: string) => inline?.set(path, v),
  });
  const c = content || data || {};
  const buttonLabel = c.button_label || 'Entrar em contato';
  const align = alignClass(props?.align, 'center');
  return (
    <section className={cn('py-24 @md:py-32 px-6 @md:px-14 flex flex-col items-center', sectionBg(props?.background, 'white'), align)}>
      <EditableText as="h2" {...et('cta_text', c.cta_text)} multiline
        className="text-4xl @md:text-6xl mb-12 max-w-2xl whitespace-pre-line leading-tight" style={fd()} />

      {editable ? (
        <div
          className="bg-[var(--pa-ink,#1A1714)] text-[var(--pa-white,#FDFBF7)] rounded-none px-12 py-6 text-sm font-bold tracking-widest uppercase mb-12 cursor-text"
          onClick={(e) => e.stopPropagation()}
        >
          <EditableText {...et('button_label', c.button_label)} placeholder="Texto do botão" />
        </div>
      ) : (
        <Button
          className="bg-[var(--pa-ink,#1A1714)] hover:bg-[var(--pa-ink,#1A1714)]/90 text-white rounded-none px-12 py-6 text-sm font-bold tracking-widest uppercase mb-12"
          onClick={() => onCtaClick?.({ blockType: 'CTABlock', label: buttonLabel })}
        >
          {buttonLabel}
        </Button>
      )}

      <div className="flex flex-wrap justify-center gap-6">
        {(c.links || []).map((link: any, idx: number) => (
          <a
            key={link.id || idx}
            href={link.href}
            onClick={(e) => { if (editable) { e.preventDefault(); } }}
            className="text-xs font-medium tracking-widest uppercase opacity-60 hover:opacity-100 transition-opacity"
          >
            <EditableText {...et(`links.${idx}.label`, link.label)} placeholder="Rótulo do link" />
          </a>
        ))}
      </div>
    </section>
  );
}

function GalleryRenderer({ content, data, props }: { content?: any; data?: any; props?: any }) {
  const inline = useInlineEdit();
  const editable = inline?.editable ?? false;
  const et = (path: string, value: string | undefined) => ({
    editable,
    value: value ?? '',
    onCommit: (v: string) => inline?.set(path, v),
  });
  const c = content || data || {};
  const images: any[] = c.images || [];
  const layout = props?.layout ?? 'masonry';
  const align = alignClass(props?.align, 'center');

  const addImage = (url: string) => {
    inline?.set('images', [...images, { id: crypto.randomUUID(), image_ref: url, span: 'normal', ratio: 'auto' }]);
  };

  const ratioStyle = (img: any): React.CSSProperties | undefined => {
    if (!img.ratio || img.ratio === 'auto') return undefined;
    return { aspectRatio: img.ratio.replace('/', ' / ') };
  };

  return (
    <section className={cn('py-16 @md:py-24 px-6 @md:px-14', sectionBg(props?.background, 'dark'), align)}>
      <div className="max-w-[1000px] mx-auto">
        <EditableText as="p" {...et('eyebrow', c.eyebrow)}
          className="text-[10px] font-medium tracking-[0.28em] uppercase opacity-40 mb-4" />
        <EditableText as="h2" {...et('title', c.title)}
          className="text-4xl @md:text-5xl mb-4" style={fd()} />
        <EditableText as="p" {...et('caption', c.caption)}
          className="italic opacity-50 mb-12" style={fd()} />

        {layout === 'masonry' ? (
          // Masonry: colunas CSS com proporção NATURAL das fotos — nada é cortado
          <div className="columns-2 @md:columns-3 @lg:columns-4 gap-2">
            {images.map((img: any, idx: number) => (
              <div key={img.id || idx} className="mb-2 break-inside-avoid rounded-sm overflow-hidden bg-white/5 relative">
                <EditableImage
                  editable={editable}
                  value={img.image_ref || null}
                  label="Foto"
                  alt="Foto do portfólio"
                  fill={false}
                  imgClassName="w-full h-auto"
                  onCommit={(url) => inline?.set(`images.${idx}.image_ref`, url)}
                />
              </div>
            ))}
            {editable && (
              <div className="mb-2 break-inside-avoid">
                <AddImageTile onAdd={addImage} />
              </div>
            )}
          </div>
        ) : (
          // Grade: proporção controlada por imagem + spans (sem alturas fixas)
          <div className="grid grid-cols-2 @md:grid-cols-4 gap-2">
            {images.map((img: any, idx: number) => {
              const ratio = img.ratio && img.ratio !== 'auto' ? img.ratio : null;
              return (
                <div
                  key={img.id || idx}
                  className={cn(
                    'rounded-sm overflow-hidden bg-white/5 relative',
                    img.span === 'tall_2rows' && 'row-span-2',
                    img.span === 'wide_2cols' && 'col-span-2',
                  )}
                  style={ratio ? ratioStyle(img) : undefined}
                >
                  <EditableImage
                    editable={editable}
                    value={img.image_ref || null}
                    label="Foto"
                    alt="Foto do portfólio"
                    fill={!!ratio}
                    imgClassName={ratio ? 'object-cover' : 'w-full h-auto'}
                    className={ratio ? 'absolute inset-0 w-full h-full' : 'w-full'}
                    publicEmptyClassName={ratio ? undefined : 'w-full py-16'}
                    onCommit={(url) => inline?.set(`images.${idx}.image_ref`, url)}
                  />
                </div>
              );
            })}
            {editable && (
              <AddImageTile onAdd={addImage} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function FooterTermsRenderer({ content, data, props }: { content?: any; data?: any; props?: any }) {
  const inline = useInlineEdit();
  const c = content || data || {};
  return (
    <footer className={cn('py-8 px-6 text-[10px] font-medium tracking-widest uppercase border-t border-current/10', sectionBg(props?.background, 'cream'), alignClass(props?.align, 'center'))}>
      <EditableText
        editable={inline?.editable ?? false}
        value={c.copyright || ''}
        onCommit={(v) => inline?.set('copyright', v)}
        placeholder="© Seu estúdio — Todos os direitos reservados"
      />
    </footer>
  );
}


// ---------------------------------------------------------
// Observer de Blocos para Rastreio
// ---------------------------------------------------------

function BlockObserver({
  children,
  blockId,
  blockType,
  position,
  onView
}:
  {
    children: React.ReactNode,
    blockId: string,
    blockType: string,
    position: number,
    onView?: (blockId: string, blockType: string, position: number) => void
  }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [viewed, setViewed] = React.useState(false);

  React.useEffect(() => {
    if (!ref.current || viewed || !onView) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        onView(blockId, blockType, position);
        setViewed(true);
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [viewed, onView, blockId, blockType, position]);

  return <div ref={ref} className="h-full w-full">{children}</div>;
}

// ---------------------------------------------------------
// Orquestrador Principal
// ---------------------------------------------------------

export function VisualRenderer({
  blocks,
  activeIndex,
  onSelectBlock,
  viewMode,
  onSectionView,
  mode = 'edit',
  onCtaClick,
  designTokens,
  inlineEditing = false,
  onUpdateField,
}: VisualRendererProps) {
  const isEditing = mode === 'edit';
  // Bloco sintético de configurações nunca é renderizado como seção
  const visibleBlocks = blocks.filter(b => b.type !== 'global_settings');

  React.useEffect(() => {
    ensureFontLoaded(designTokens?.typography?.display);
    ensureFontLoaded(designTokens?.typography?.body);
  }, [designTokens?.typography?.display, designTokens?.typography?.body]);

  return (
    <div className="w-full h-full p-4 md:p-8 flex items-start justify-center transition-all duration-300">
      <div
        className={cn(
          "@container bg-white shadow-2xl overflow-y-auto overflow-x-hidden relative transition-all duration-500 origin-top flex flex-col w-full",
          viewMode === 'desktop' ? "max-w-5xl rounded-sm min-h-full" : "max-w-[375px] h-[812px] rounded-[3rem] border-[12px] border-zinc-900"
        )}
        style={tokensToCssVars(designTokens)}
      >
        {visibleBlocks.map((block, index) => {
          const isActive = index === activeIndex;
          const inlineHandle = {
            editable: isEditing && inlineEditing,
            set: (path: string, value: any) => onUpdateField?.(index, path, value),
          };

          const content = (
            <InlineEditContext.Provider value={inlineHandle}>
              <BlockObserver
                blockId={block.id}
                blockType={block.type}
                position={index}
                onView={onSectionView}
              >
                {block.type === 'cover' && <CoverRenderer data={block.data} props={block.props} onCtaClick={onCtaClick} />}
                {block.type === 'CoverBlock' && <CoverRenderer data={block.content || block.data} props={block.props} onCtaClick={onCtaClick} />}
                {block.type === 'package' && <PackageRenderer data={block.data} onCtaClick={onCtaClick} />}
                {block.type === 'EditorialBlock' && <EditorialRenderer content={block.content} data={block.data} props={block.props} />}
                {block.type === 'PricingTable' && <PricingTableRenderer content={block.content} data={block.data} props={block.props} onCtaClick={onCtaClick} />}
                {block.type === 'TestimonialBlock' && <TestimonialRenderer content={block.content} data={block.data} props={block.props} />}
                {block.type === 'FAQBlock' && <FAQRenderer content={block.content} data={block.data} props={block.props} />}
                {block.type === 'Gallery' && <GalleryRenderer content={block.content} data={block.data} props={block.props} />}
                {block.type === 'CTABlock' && <CTABlockRenderer content={block.content} data={block.data} props={block.props} onCtaClick={onCtaClick} />}
                {block.type === 'FooterTerms' && <FooterTermsRenderer content={block.content} data={block.data} props={block.props} />}
                {block.type === 'text' && <DefaultRenderer block={block} />}
              </BlockObserver>
            </InlineEditContext.Provider>
          );

          if (!isEditing) {
            // Modo público/preview: sem chrome de edição, conteúdo interativo (CTAs funcionam)
            return (
              <div key={block.id || `block-${index}`}>
                {content}
              </div>
            );
          }

          return (
            <div
              key={block.id || `block-${index}`}
              onClick={() => onSelectBlock(index)}
              className={cn(
                "relative group cursor-pointer transition-all duration-200 outline outline-2 outline-transparent outline-offset-[-2px]",
                isActive ? "outline-primary z-10 shadow-[0_0_0_4px_rgba(200,106,70,0.1)]" : "hover:outline-primary/30"
              )}
            >
              {/* Tinta de hover (não bloqueia cliques) */}
              <div className={cn(
                "absolute inset-0 z-0 pointer-events-none transition-colors",
                !isActive && "group-hover:bg-primary/5"
              )} />

              {content}

              {/* Dica de edição no bloco ativo */}
              {isActive && inlineEditing && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none rounded-full bg-primary px-3 py-1 text-[10px] font-medium tracking-wide text-primary-foreground shadow-lg whitespace-nowrap">
                  Duplo clique: edita textos · troca imagens
                </div>
              )}
            </div>
          );
        })}

        {visibleBlocks.length === 0 && (
          <div className="flex-1 flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground font-medium">A proposta está vazia. Adicione seções.</p>
          </div>
        )}
      </div>
    </div>
  );
}

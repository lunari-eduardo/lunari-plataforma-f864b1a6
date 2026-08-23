import React from 'react';
import { BlockData } from '@/hooks/useMaterialEditor';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { ProposalDesignTokens, tokensToCssVars, ensureFontLoaded, fontDisplayCss, fontBodyCss } from '../../blocks/design';
import { EditableText } from '../../blocks/EditableText';
import { EditableImage, AddImageTile } from '../../blocks/EditableImage';
import { InlineEditContext, useInlineEdit } from '../../blocks/inlineContext';
import { EditorialComposition } from '../../blocks/EditorialComposition';

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
const fb = () => ({ fontFamily: fontBodyCss() });

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
      return 'bg-[var(--pa-cream,#F3F0EA)] text-neutral-900';
    case 'linen':
      return 'bg-[var(--pa-linen,#E8DCCB)] text-neutral-900';
    case 'dark':
      return 'bg-[var(--pa-stone,#C9BFB2)] text-white';
    case 'white':
    default:
      return 'bg-[var(--pa-white,#FDFBF7)] text-neutral-900';
  }
}

function CoverMinimalCenter({ data, props, onCtaClick }: { data?: any; props?: any; onCtaClick?: CtaHandler }) {
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
          className="text-[var(--pa-taupe,#6D655E)] text-lg max-w-[40ch] mb-10 leading-relaxed font-light" style={fb()} />
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

function CoverPosterSplit({ data, props }: { data?: any; props?: any }) {
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
        <EditableText as="p" {...et('eyebrow', eyebrow)}
          className="text-[9px] @md:text-[10px] font-medium tracking-[0.35em] uppercase text-[var(--pa-taupe,#8C7B6E)] mb-6 @md:mb-10" />

        {/* Título gigante */}
        <h1
          className="text-5xl @md:text-7xl @lg:text-8xl uppercase tracking-[0.12em] leading-[1.05] text-[var(--pa-ink,#2C2825)] mb-4 @md:mb-6 max-w-[12ch]"
          style={fd()}
        >
          <EditableText {...et('title', title)} placeholder="TÍTULO" />
          {titleItalic && (
            <em className="italic text-[var(--pa-ink,#2C2825)]/70 block text-[0.6em] tracking-[0.06em] mt-1">
              <EditableText {...et('title_italic', titleItalic)} />
            </em>
          )}
        </h1>

        {/* Subtítulo */}
        <EditableText as="p" {...et('subtitle', subtitle)} multiline
          className="text-[10px] @md:text-xs tracking-[0.25em] uppercase text-[var(--pa-taupe,#8C7B6E)] max-w-[40ch] leading-relaxed" style={fb()} />
      </div>

      {/* Assinatura do fotógrafo no rodapé */}
      <div className="relative z-10 pb-8 @md:pb-12 text-center mt-auto">
        <EditableText as="p" {...et('photographer_name', photographerName)}
          className="text-[9px] @md:text-[10px] tracking-[0.3em] uppercase text-white/80" style={fb()} />
      </div>
    </section>
  );
}

function CoverRenderer({ data, props, onCtaClick }: { data?: any; props?: any; onCtaClick?: CtaHandler }) {
  const variant = props?.variant || 'minimal-center';
  switch (variant) {
    case 'poster-split':
      return <CoverPosterSplit data={data} props={props} />;
    default:
      return <CoverMinimalCenter data={data} props={props} onCtaClick={onCtaClick} />;
  }
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

function EditorialOverlapBlend({ data, content, props }: { data?: any; content?: any; props?: any }) {
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

function EditorialSplitPortrait({ data, content, props }: { data?: any; content?: any; props?: any }) {
  const inline = useInlineEdit();
  const editable = inline?.editable ?? false;
  const et = (path: string, value: string | undefined) => ({
    editable,
    value: value ?? '',
    onCommit: (v: string) => inline?.set(path, v),
  });

  const c = content || data || {};
  const p = props || {};
  const isDark = (p.background ?? 'cream') === 'dark';
  const borderColor = isDark ? 'border-white/10' : 'border-[var(--pa-ink,#1A1714)]/10';

  // Use photo_a image_ref if available, or a standalone image field
  const photoRef = p.photo_a?.image_ref || null;

  return (
    <section className={cn('py-16 @md:py-24 px-6 @md:px-14 overflow-hidden', sectionBg(p.background, 'cream'))}>
      <div className="max-w-[900px] mx-auto">
        <div className="grid grid-cols-1 @md:grid-cols-[1fr_minmax(0,42%)] gap-10 @md:gap-16 items-start">
          {/* Coluna de texto */}
          <div className="flex flex-col">
            <EditableText as="h2" {...et('title', c.title)}
              className="text-2xl @md:text-3xl tracking-[0.15em] uppercase mb-8 @md:mb-12" style={fd()} />

            <EditableText as="div" {...et('body', c.body)} multiline
              className="text-sm @md:text-base font-light leading-[2] tracking-[0.02em] text-justify whitespace-pre-line opacity-80 mb-8" style={fb()} />

            {/* Detalhes key-value */}
            {c.details && c.details.length > 0 && (
              <div className="flex flex-col gap-0 mt-4">
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
          </div>

          {/* Coluna da foto */}
          <div className="aspect-[4/5] overflow-hidden">
            <EditableImage
              editable={editable}
              value={photoRef}
              label="Foto"
              alt="Foto editorial"
              onCommit={(url) => inline?.set('props.photo_a.image_ref', url)}
              className="relative w-full h-full"
              imgClassName="object-cover w-full h-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function EditorialRenderer({ data, content, props }: { data?: any; content?: any; props?: any }) {
  const variant = props?.variant || 'overlap-blend';
  switch (variant) {
    case 'split-portrait':
      return <EditorialSplitPortrait data={data} content={content} props={props} />;
    default:
      return <EditorialOverlapBlend data={data} content={content} props={props} />;
  }
}

function PricingClassic({ content, data, props, onCtaClick }: { content?: any; data?: any; props?: any; onCtaClick?: CtaHandler }) {
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
            <div key={pkg.id || idx} className="border border-black/5 shadow-sm p-8 rounded-2xl bg-[var(--pa-white,#FDFBF7)] text-neutral-900 flex flex-col relative overflow-hidden">
              {pkg.badge && (
                <div className="absolute top-0 right-0 bg-[var(--pa-cream,#F3F0EA)] text-[10px] font-medium tracking-[0.28em] uppercase text-[var(--pa-taupe,#8C7B6E)] px-3 py-1 border-b border-l border-black/5 rounded-bl-xl">
                  <EditableText {...et(`packages.${idx}.badge`, pkg.badge)} />
                </div>
              )}
              <EditableText as="h3" {...et(`packages.${idx}.name`, pkg.name)}
                className="text-2xl mb-2 pr-6" style={fd()} />
              <p className="text-xl text-[var(--pa-accent,#7A5C42)] mb-6">
                <EditableText {...et(`packages.${idx}.price`, pkg.price)} placeholder="R$" />
                <span className="text-sm opacity-50 font-light">/<EditableText {...et(`packages.${idx}.price_unit`, pkg.price_unit)} placeholder="un." /></span>
              </p>

              {/* Imagem do pacote */}
              {!props?.hide_images && (pkg.image_ref || editable) && (
                <div className="h-36 w-full mb-6 rounded-xl overflow-hidden relative bg-black/5">
                  <EditableImage
                    editable={editable}
                    value={pkg.image_ref || null}
                    label="Foto do pacote"
                    alt={pkg.name || 'Pacote'}
                    onCommit={(url) => inline?.set(`packages.${idx}.image_ref`, url)}
                    publicEmptyClassName="hidden"
                  />
                </div>
              )}

              <ul className="space-y-3 flex-1 mb-8">
                {(pkg.features || []).map((feat: string, i: number) => (
                  <li key={i} className="text-sm font-light opacity-70 border-b border-black/5 pb-2 last:border-0">
                    <EditableText {...et(`packages.${idx}.features.${i}`, feat)} placeholder="Item incluso" />
                  </li>
                ))}
              </ul>

              {!props?.hide_cta && (
                <Button
                  variant="outline"
                  className="w-full bg-[#2C2825] border-transparent text-white hover:bg-[#2C2825]/80 hover:text-white rounded-xl transition-colors"
                  onClick={() => onCtaClick?.({ blockType: 'PricingTable', label: pkg.name })}
                >
                  Selecionar
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingCardsMinimal({ content, data, props, onCtaClick }: { content?: any; data?: any; props?: any; onCtaClick?: CtaHandler }) {
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

  const colsClass = packages.length === 1
    ? 'grid-cols-1 max-w-sm mx-auto'
    : packages.length === 2
      ? 'grid-cols-1 @md:grid-cols-2 max-w-[700px] mx-auto'
      : 'grid-cols-1 @md:grid-cols-3';

  return (
    <section className={cn('py-16 @md:py-24 px-6 @md:px-14', sectionBg(props?.background, 'white'), align)}>
      <div className="max-w-[1000px] mx-auto">
        <EditableText as="p" {...et('eyebrow', c.eyebrow)}
          className="text-[10px] font-medium tracking-[0.28em] uppercase opacity-50 mb-4 text-center" />
        <EditableText as="h2" {...et('title', c.title)}
          className="text-4xl @md:text-5xl mb-16 text-center" style={fd()} />
        
        <div className={cn('grid gap-10 @md:gap-14 text-center', colsClass)}>
          {packages.map((pkg: any, idx: number) => (
            <div key={pkg.id || idx} className="flex flex-col relative text-neutral-900">
              
              {!props?.hide_images && (pkg.image_ref || editable) && (
                <div className="aspect-[4/5] w-full mb-8 rounded-3xl overflow-hidden relative bg-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] group/card">
                  <EditableImage
                    editable={editable}
                    value={pkg.image_ref || null}
                    label="Foto do pacote"
                    alt={pkg.name || 'Pacote'}
                    onCommit={(url) => inline?.set(`packages.${idx}.image_ref`, url)}
                    className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover/card:scale-105"
                    imgClassName="object-cover w-full h-full"
                    publicEmptyClassName="hidden"
                  />
                  {pkg.badge && (
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-[9px] font-medium tracking-[0.2em] uppercase text-neutral-900 px-3 py-1.5 rounded-full shadow-sm">
                      <EditableText {...et(`packages.${idx}.badge`, pkg.badge)} />
                    </div>
                  )}
                </div>
              )}

              {(!pkg.image_ref && !editable) && pkg.badge && (
                <div className="inline-block mx-auto bg-black/5 text-[9px] font-medium tracking-[0.2em] uppercase text-neutral-900 px-3 py-1 mb-4 rounded-full">
                  <EditableText {...et(`packages.${idx}.badge`, pkg.badge)} />
                </div>
              )}

              <EditableText as="h3" {...et(`packages.${idx}.name`, pkg.name)}
                className="text-2xl @md:text-3xl mb-3" style={fd()} />
              
              <p className="text-xl text-[var(--pa-accent,#7A5C42)] mb-8 font-light">
                <EditableText {...et(`packages.${idx}.price`, pkg.price)} placeholder="R$" />
                <span className="text-sm opacity-50">/<EditableText {...et(`packages.${idx}.price_unit`, pkg.price_unit)} placeholder="un." /></span>
              </p>

              <ul className="space-y-4 flex-1 mb-10 text-sm font-light opacity-75">
                {(pkg.features || []).map((feat: string, i: number) => (
                  <li key={i}>
                    <EditableText {...et(`packages.${idx}.features.${i}`, feat)} placeholder="Item incluso" />
                  </li>
                ))}
              </ul>

              {!props?.hide_cta && (
                <Button
                  variant="outline"
                  className="w-[80%] mx-auto bg-transparent border-black/20 text-neutral-900 hover:bg-neutral-900 hover:text-white rounded-full transition-all"
                  onClick={() => onCtaClick?.({ blockType: 'PricingTable', label: pkg.name })}
                >
                  Selecionar
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingNumberedEditorial({ content, data, props }: { content?: any; data?: any; props?: any }) {
  const inline = useInlineEdit();
  const editable = inline?.editable ?? false;
  const et = (path: string, value: string | undefined) => ({
    editable,
    value: value ?? '',
    onCommit: (v: string) => inline?.set(path, v),
  });
  const c = content || data || {};
  const packages: any[] = c.packages || [];

  return (
    <section className={cn('py-16 @md:py-24 px-6 @md:px-14', sectionBg(props?.background, 'cream'))}>
      <div className="max-w-[900px] mx-auto text-center">
        {/* Header */}
        <EditableText as="p" {...et('eyebrow', c.eyebrow)}
          className="text-[9px] @md:text-[10px] font-medium tracking-[0.35em] uppercase text-[var(--pa-taupe,#8C7B6E)] mb-4" />
        <EditableText as="h2" {...et('title', c.title)}
          className="text-5xl @md:text-7xl @lg:text-8xl uppercase tracking-[0.1em] leading-[1.05] mb-6" style={fd()} />

        {/* Pacotes */}
        <div className="mt-12 @md:mt-16 space-y-0 text-left">
          {packages.map((pkg: any, idx: number) => {
            const num = String(idx + 1).padStart(2, '0');
            const isEven = idx % 2 === 1;

            return (
              <div
                key={pkg.id || idx}
                className={cn(
                  'border-t border-[var(--pa-stone,#C9BFB2)]/30 py-10 @md:py-14',
                  idx === packages.length - 1 && 'border-b'
                )}
              >
                <div className={cn(
                  'grid gap-8 @md:gap-12 items-start',
                  (!props?.hide_images && (pkg.image_ref || editable)) ? 'grid-cols-1 @md:grid-cols-[1fr_1fr]' : 'grid-cols-1',
                  isEven && '@md:direction-rtl'
                )}>
                  {/* Lado do conteúdo */}
                  <div className={cn(isEven && '@md:order-2')}>
                    <div className="flex items-baseline gap-4 mb-4">
                      <span className="text-5xl @md:text-6xl opacity-15 leading-none" style={fd()}>{num}</span>
                      <div>
                        <EditableText as="h3" {...et(`packages.${idx}.name`, pkg.name)}
                          className="text-sm @md:text-base tracking-[0.2em] uppercase font-medium" style={fb()} />
                      </div>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 mb-8 ml-0">
                      {(pkg.features || []).map((feat: string, i: number) => (
                        <li key={i} className="flex items-start gap-3 text-sm font-light opacity-70">
                          <span className="text-[var(--pa-accent,#7A5C42)] mt-0.5 text-xs">•</span>
                          <EditableText {...et(`packages.${idx}.features.${i}`, feat)} placeholder="Item incluso" />
                        </li>
                      ))}
                    </ul>

                    {/* Preço */}
                    <div className="mt-auto">
                      <p className="text-[9px] tracking-[0.3em] uppercase text-[var(--pa-taupe,#8C7B6E)] mb-1">À VISTA</p>
                      <p className="text-2xl @md:text-3xl tracking-[0.05em]" style={fd()}>
                        <EditableText {...et(`packages.${idx}.price_cash`, pkg.price_cash || pkg.price)} placeholder="R$ 250,00" />
                      </p>
                      {(pkg.price_installments || editable) && (
                        <p className="text-[10px] tracking-[0.15em] uppercase text-[var(--pa-taupe,#8C7B6E)] mt-1">
                          OU <EditableText {...et(`packages.${idx}.price_installments`, pkg.price_installments)} placeholder="3x de R$ 89,62" />
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Lado da foto */}
                  {!props?.hide_images && (pkg.image_ref || editable) && (
                    <div className={cn('aspect-[4/5] @md:aspect-[3/4] overflow-hidden', isEven && '@md:order-1')}>
                      <EditableImage
                        editable={editable}
                        value={pkg.image_ref || null}
                        label={`Foto ${pkg.name || 'Pacote'}`}
                        alt={pkg.name || 'Pacote'}
                        onCommit={(url) => inline?.set(`packages.${idx}.image_ref`, url)}
                        className="relative w-full h-full"
                        imgClassName="object-cover w-full h-full"
                        publicEmptyClassName="hidden"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PricingTableRenderer({ content, data, props, onCtaClick }: { content?: any; data?: any; props?: any; onCtaClick?: CtaHandler }) {
  const variant = props?.variant || 'cards-classic';
  switch (variant) {
    case 'numbered-editorial':
      return <PricingNumberedEditorial content={content} data={data} props={props} />;
    case 'cards-minimal':
      return <PricingCardsMinimal content={content} data={data} props={props} onCtaClick={onCtaClick} />;
    default:
      return <PricingClassic content={content} data={data} props={props} onCtaClick={onCtaClick} />;
  }
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

  const addMultipleImages = (urls: string[]) => {
    const newImages = urls.map(url => ({
      id: crypto.randomUUID(),
      image_ref: url,
      span: 'normal',
      ratio: 'auto'
    }));
    inline?.set('images', [...images, ...newImages]);
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
                <AddImageTile onAdd={addImage} onAddMultiple={addMultipleImages} />
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
              <AddImageTile onAdd={addImage} onAddMultiple={addMultipleImages} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}


function DividerRenderer({ content, data, props }: { content?: any; data?: any; props?: any }) {
  const inline = useInlineEdit();
  const editable = inline?.editable ?? false;
  const et = (path: string, value: string | undefined) => ({
    editable,
    value: value ?? '',
    onCommit: (v: string) => inline?.set(path, v),
  });
  const c = content || data || {};
  const style = props?.style || 'hairline';

  if (style === 'spaced') {
    return (
      <section className={cn('py-12 @md:py-20', sectionBg(props?.background, 'cream'))} />
    );
  }

  if (style === 'ornament') {
    return (
      <section className={cn('py-10 @md:py-16 flex flex-col items-center gap-4', sectionBg(props?.background, 'cream'))}>
        <div className="flex items-center gap-4 w-full max-w-[200px]">
          <div className="flex-1 h-[0.5px] bg-current opacity-20" />
          <div className="w-2 h-2 rotate-45 border border-current opacity-20" />
          <div className="flex-1 h-[0.5px] bg-current opacity-20" />
        </div>
        {c.label && (
          <EditableText as="p" {...et('label', c.label)}
            className="text-[9px] tracking-[0.35em] uppercase opacity-40 mt-2" style={fb()} />
        )}
      </section>
    );
  }

  // hairline (default)
  return (
    <section className={cn('py-6 @md:py-10 px-6 @md:px-14', sectionBg(props?.background, 'cream'))}>
      <div className="max-w-[900px] mx-auto">
        <div className="flex items-center gap-6">
          <div className="flex-1 h-[0.5px] bg-current opacity-15" />
          {(c.label || editable) && (
            <EditableText as="span" {...et('label', c.label)}
              className="text-[9px] tracking-[0.35em] uppercase opacity-40 shrink-0" style={fb()}
              placeholder="Rótulo" />
          )}
          <div className="flex-1 h-[0.5px] bg-current opacity-15" />
        </div>
      </div>
    </section>
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
                {block.type === 'EditorialComposition' && <EditorialComposition content={block.content} props={block.props} />}
                {block.type === 'Gallery' && <GalleryRenderer content={block.content} data={block.data} props={block.props} />}
                {block.type === 'DividerBlock' && <DividerRenderer content={block.content} data={block.data} props={block.props} />}
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

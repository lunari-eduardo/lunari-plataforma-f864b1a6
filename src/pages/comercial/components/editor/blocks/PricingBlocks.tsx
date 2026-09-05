import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EditableText } from '../../../blocks/EditableText';
import { EditableImage } from '../../../blocks/EditableImage';
import { useInlineEdit } from '../../../blocks/inlineContext';
import { fd, fb, alignClass, sectionBg, textColorClass, CtaHandler } from './helpers';

export function PackageRenderer({ data, onCtaClick }: { data: any; onCtaClick?: CtaHandler }) {
  return (
    <section className="py-16 px-8 bg-white flex flex-col items-center">
      <div className="w-full max-w-md bg-white border border-[var(--pa-linen,#EBE5DF)] rounded-2xl p-8 shadow-sm flex flex-col relative transition-all hover:shadow-md">
        {data?.highlight && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--pa-cream,#F3EBE1)] text-[var(--pa-accent,#A67C52)] text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
            Mais Escolhido
          </div>
        )}

        <h3 className="text-2xl text-[var(--pa-ink,#2C2825)] mb-2" style={fd()}>
          {data?.title || 'Essencial'}
        </h3>
        <p className="text-sm text-[var(--pa-taupe,#6D655E)] mb-6">
          {data?.subtitle || 'Para quem deseja registros leves e naturais.'}
        </p>

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

export function PricingClassic({
  content,
  data,
  props,
  onCtaClick,
}: {
  content?: any;
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
  const c = content || data || {};
  const packages: any[] = c.packages || [];
  const align = alignClass(props?.align, 'center');

  const colsClass =
    packages.length === 1
      ? 'grid-cols-1 max-w-md mx-auto'
      : packages.length === 2
      ? 'grid-cols-1 @md:grid-cols-2 max-w-[680px] mx-auto'
      : 'grid-cols-1 @md:grid-cols-3';

  return (
    <section
      className={cn(
        'py-16 @md:py-24 px-6 @md:px-14',
        sectionBg(props?.background, 'white'),
        textColorClass(props?.text_color, props?.background, 'white')
      )}
    >
      <div className={cn('max-w-[900px] mx-auto', align)}>
        <EditableText
          as="p"
          {...et('eyebrow', c.eyebrow)}
          className="text-[10px] font-medium tracking-[0.28em] uppercase opacity-50 mb-4"
        />
        <EditableText as="h2" {...et('title', c.title)} className="text-4xl @md:text-5xl mb-12" style={fd()} />
        <div className={cn('grid gap-8', align, colsClass)}>
          {packages.map((pkg: any, idx: number) => (
            <div
              key={pkg.id || idx}
              className={cn(
                'border border-black/5 shadow-sm p-8 rounded-2xl bg-[var(--pa-white,#FDFBF7)] text-current flex flex-col relative overflow-hidden',
                align
              )}
            >
              {pkg.badge && (
                <div className="absolute top-0 right-0 bg-[var(--pa-cream,#F3F0EA)] text-[10px] font-medium tracking-[0.28em] uppercase text-[var(--pa-taupe,#8C7B6E)] px-3 py-1 border-b border-l border-black/5 rounded-bl-xl">
                  <EditableText {...et(`packages.${idx}.badge`, pkg.badge)} />
                </div>
              )}
              <EditableText
                as="h3"
                {...et(`packages.${idx}.name`, pkg.name)}
                className="text-2xl mb-2 pr-6"
                style={fd()}
              />
              <p className="text-xl text-[var(--pa-accent,#7A5C42)] mb-6">
                <EditableText {...et(`packages.${idx}.price`, pkg.price)} placeholder="R$" />
                <span className="text-sm opacity-50 font-light">
                  /<EditableText {...et(`packages.${idx}.price_unit`, pkg.price_unit)} placeholder="un." />
                </span>
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

              <ul className={cn('space-y-3 flex-1 mb-8', align)}>
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

export function PricingCardsMinimal({
  content,
  data,
  props,
  onCtaClick,
}: {
  content?: any;
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
  const c = content || data || {};
  const packages: any[] = c.packages || [];
  const align = alignClass(props?.align, 'center');

  const colsClass =
    packages.length === 1
      ? 'grid-cols-1 max-w-sm mx-auto'
      : packages.length === 2
      ? 'grid-cols-1 @md:grid-cols-2 max-w-[700px] mx-auto'
      : 'grid-cols-1 @md:grid-cols-3';

  return (
    <section
      className={cn(
        'py-16 @md:py-24 px-6 @md:px-14',
        sectionBg(props?.background, 'white'),
        textColorClass(props?.text_color, props?.background, 'white')
      )}
    >
      <div className={cn('max-w-[1000px] mx-auto', align)}>
        <EditableText
          as="p"
          {...et('eyebrow', c.eyebrow)}
          className="text-[10px] font-medium tracking-[0.28em] uppercase opacity-50 mb-4"
        />
        <EditableText as="h2" {...et('title', c.title)} className="text-4xl @md:text-5xl mb-16" style={fd()} />

        <div className={cn('grid gap-10 @md:gap-14', align, colsClass)}>
          {packages.map((pkg: any, idx: number) => (
            <div key={pkg.id || idx} className={cn('flex flex-col relative text-current', align)}>
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

              {!pkg.image_ref && !editable && pkg.badge && (
                <div className="inline-block mx-auto bg-black/5 text-[9px] font-medium tracking-[0.2em] uppercase text-neutral-900 px-3 py-1 mb-4 rounded-full">
                  <EditableText {...et(`packages.${idx}.badge`, pkg.badge)} />
                </div>
              )}

              <EditableText
                as="h3"
                {...et(`packages.${idx}.name`, pkg.name)}
                className="text-2xl @md:text-3xl mb-3"
                style={fd()}
              />

              <p className="text-xl text-[var(--pa-accent,#7A5C42)] mb-8 font-light">
                <EditableText {...et(`packages.${idx}.price`, pkg.price)} placeholder="R$" />
                <span className="text-sm opacity-50">
                  /<EditableText {...et(`packages.${idx}.price_unit`, pkg.price_unit)} placeholder="un." />
                </span>
              </p>

              <ul className={cn('space-y-4 flex-1 mb-10 text-sm font-light opacity-75', align)}>
                {(pkg.features || []).map((feat: string, i: number) => (
                  <li key={i}>
                    <EditableText {...et(`packages.${idx}.features.${i}`, feat)} placeholder="Item incluso" />
                  </li>
                ))}
              </ul>

              {!props?.hide_cta && (
                <Button
                  variant="outline"
                  className={cn(
                    'w-[80%] bg-transparent border-current/20 text-current hover:bg-current hover:text-white rounded-full transition-all',
                    align === 'text-center' ? 'mx-auto' : align === 'text-right' ? 'ml-auto' : 'mr-auto'
                  )}
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

export function PricingNumberedEditorial({
  content,
  data,
  props,
}: {
  content?: any;
  data?: any;
  props?: any;
}) {
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

  return (
    <section
      className={cn(
        'py-16 @md:py-24 px-6 @md:px-14',
        sectionBg(props?.background, 'cream'),
        textColorClass(props?.text_color, props?.background, 'cream')
      )}
    >
      <div className={cn('max-w-[900px] mx-auto', align)}>
        {/* Header */}
        <EditableText
          as="p"
          {...et('eyebrow', c.eyebrow)}
          className="text-[9px] @md:text-[10px] font-medium tracking-[0.35em] uppercase opacity-60 mb-4"
        />
        <EditableText
          as="h2"
          {...et('title', c.title)}
          className="text-5xl @md:text-7xl @lg:text-8xl uppercase tracking-[0.1em] leading-[1.05] mb-6 text-current"
          style={fd()}
        />

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
                <div
                  className={cn(
                    'grid gap-8 @md:gap-12 items-start',
                    !props?.hide_images && (pkg.image_ref || editable)
                      ? 'grid-cols-1 @md:grid-cols-[1fr_1fr]'
                      : 'grid-cols-1',
                    isEven && '@md:direction-rtl'
                  )}
                >
                  {/* Lado do conteúdo */}
                  <div className={cn(isEven && '@md:order-2')}>
                    <div className="flex items-baseline gap-4 mb-4">
                      <span className="text-5xl @md:text-6xl opacity-15 leading-none" style={fd()}>
                        {num}
                      </span>
                      <div>
                        <EditableText
                          as="h3"
                          {...et(`packages.${idx}.name`, pkg.name)}
                          className="text-sm @md:text-base tracking-[0.2em] uppercase font-medium"
                          style={fb()}
                        />
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
                      <p className="text-[9px] tracking-[0.3em] uppercase text-[var(--pa-taupe,#8C7B6E)] mb-1">
                        À VISTA
                      </p>
                      <p className="text-2xl @md:text-3xl tracking-[0.05em]" style={fd()}>
                        <EditableText
                          {...et(`packages.${idx}.price_cash`, pkg.price_cash || pkg.price)}
                          placeholder="R$ 250,00"
                        />
                      </p>
                      {(pkg.price_installments || editable) && (
                        <p className="text-[10px] tracking-[0.15em] uppercase text-[var(--pa-taupe,#8C7B6E)] mt-1">
                          OU{' '}
                          <EditableText
                            {...et(`packages.${idx}.price_installments`, pkg.price_installments)}
                            placeholder="3x de R$ 89,62"
                          />
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

export function PricingTableRenderer({
  content,
  data,
  props,
  onCtaClick,
}: {
  content?: any;
  data?: any;
  props?: any;
  onCtaClick?: CtaHandler;
}) {
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

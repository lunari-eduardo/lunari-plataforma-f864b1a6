import React from 'react';
import { cn } from '@/lib/utils';
import { EditableText } from '../../../blocks/EditableText';
import { EditableImage } from '../../../blocks/EditableImage';
import { useInlineEdit } from '../../../blocks/inlineContext';
import { fd, fb, alignClass, sectionBg, textColorClass } from './helpers';

export function EditorialOverlapBlend({
  data,
  content,
  props,
}: {
  data?: any;
  content?: any;
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
  const p = props || {};

  const isDark = (p.background ?? 'dark') === 'dark';
  const borderColor = isDark ? 'border-white/10' : 'border-[var(--pa-ink,#1A1714)]/10';
  const align = alignClass(p.align, 'left');

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
    <section
      className={cn(
        'py-16 @md:py-28 px-6 @md:px-14 overflow-hidden',
        sectionBg(p.background, 'dark'),
        textColorClass(p.text_color, p.background, 'dark')
      )}
    >
      <div className="max-w-[900px] mx-auto">
        <div className="grid grid-cols-1 @md:grid-cols-2 gap-10 @md:gap-24 items-center">
          {/* Visual (Photos) */}
          <div className="relative h-[280px] @md:h-[520px]">
            {imgSlot('photo_a', 'Foto A', {
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${p.photo_a?.width_pct || 72}%`,
              height: `${p.photo_a?.height_pct || 80}%`,
            })}
            {imgSlot('photo_b', 'Foto B', {
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: `${p.photo_b?.width_pct || 62}%`,
              height: `${p.photo_b?.height_pct || 66}%`,
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              border: '4px solid var(--pa-white, #fff)',
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
            <EditableText
              as="span"
              {...et('eyebrow', c.eyebrow)}
              className="text-[10px] font-medium tracking-[0.28em] uppercase opacity-50 mb-4 block"
            />

            <h2
              className="text-4xl @md:text-5xl @lg:text-[4rem] font-light leading-[1.02] tracking-[0.03em] mb-10 text-current"
              style={fd()}
            >
              <EditableText {...et('title', c.title)} placeholder="Título" />
              <em className="italic opacity-60">
                <EditableText {...et('title_italic', c.title_italic)} placeholder="em itálico" />
              </em>
            </h2>

            {c.details && c.details.length > 0 && (
              <div className="flex flex-col gap-0 mb-9">
                {c.details.map((detail: any, idx: number) => (
                  <div
                    key={detail.id || idx}
                    className={cn(
                      'flex justify-between items-baseline gap-6 py-3 border-b',
                      borderColor,
                      idx === 0 && 'border-t'
                    )}
                  >
                    <EditableText
                      as="span"
                      {...et(`details.${idx}.label`, detail.label)}
                      className="text-[10px] font-medium tracking-[0.24em] uppercase opacity-50 whitespace-nowrap"
                    />
                    <EditableText
                      as="span"
                      {...et(`details.${idx}.value`, detail.value)}
                      className="text-base font-light text-right opacity-75"
                      style={fd()}
                    />
                  </div>
                ))}
              </div>
            )}

            <EditableText
              as="p"
              {...et('body', c.body)}
              multiline
              className="italic text-base @md:text-[1.1rem] font-light leading-[1.7] opacity-80"
              style={fd()}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function EditorialSplitPortrait({
  data,
  content,
  props,
}: {
  data?: any;
  content?: any;
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
  const p = props || {};
  const isDark = (p.background ?? 'cream') === 'dark';
  const borderColor = isDark ? 'border-white/10' : 'border-[var(--pa-ink,#1A1714)]/10';
  const align = alignClass(p.align, 'left');

  const photoRef = p.photo_a?.image_ref || null;

  return (
    <section
      className={cn(
        'py-16 @md:py-24 px-6 @md:px-14 overflow-hidden',
        sectionBg(p.background, 'cream'),
        textColorClass(p.text_color, p.background, 'cream')
      )}
    >
      <div className="max-w-[900px] mx-auto">
        <div className="grid grid-cols-1 @md:grid-cols-[1fr_minmax(0,42%)] gap-10 @md:gap-16 items-start">
          {/* Coluna de texto */}
          <div className={cn('flex flex-col', align)}>
            <EditableText
              as="h2"
              {...et('title', c.title)}
              className="text-2xl @md:text-3xl tracking-[0.15em] uppercase mb-8 @md:mb-12 text-current"
              style={fd()}
            />

            <EditableText
              as="div"
              {...et('body', c.body)}
              multiline
              className="text-sm @md:text-base font-light leading-[2] tracking-[0.02em] whitespace-pre-line opacity-80 mb-8"
              style={fb()}
            />

            {/* Detalhes key-value */}
            {c.details && c.details.length > 0 && (
              <div className="flex flex-col gap-0 mt-4">
                {c.details.map((detail: any, idx: number) => (
                  <div
                    key={detail.id || idx}
                    className={cn(
                      'flex justify-between items-baseline gap-6 py-3 border-b',
                      borderColor,
                      idx === 0 && 'border-t'
                    )}
                  >
                    <EditableText
                      as="span"
                      {...et(`details.${idx}.label`, detail.label)}
                      className="text-[10px] font-medium tracking-[0.24em] uppercase opacity-50 whitespace-nowrap"
                    />
                    <EditableText
                      as="span"
                      {...et(`details.${idx}.value`, detail.value)}
                      className="text-base font-light text-right opacity-75"
                      style={fd()}
                    />
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

export function EditorialTextOnly({
  data,
  content,
  props,
}: {
  data?: any;
  content?: any;
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
  const p = props || {};
  const isDark = (p.background ?? 'cream') === 'dark';
  const borderColor = isDark ? 'border-white/10' : 'border-[var(--pa-ink,#1A1714)]/10';
  const align = alignClass(p.align, 'center');

  return (
    <section
      className={cn(
        'py-20 @md:py-32 px-6 @md:px-14 overflow-hidden',
        sectionBg(p.background, 'cream'),
        textColorClass(p.text_color, p.background, 'cream')
      )}
    >
      <div className={cn('max-w-[800px] mx-auto flex flex-col', align)}>
        <EditableText
          as="span"
          {...et('eyebrow', c.eyebrow)}
          className="text-[10px] font-medium tracking-[0.28em] uppercase opacity-50 mb-6 block"
        />

        <h2 className="text-4xl @md:text-6xl font-light leading-[1.1] tracking-[0.02em] mb-12" style={fd()}>
          <EditableText {...et('title', c.title)} placeholder="Título" />{' '}
          <em className="italic opacity-60">
            <EditableText {...et('title_italic', c.title_italic)} placeholder="em itálico" />
          </em>
        </h2>

        <EditableText
          as="p"
          {...et('body', c.body)}
          multiline
          className="italic text-lg @md:text-xl font-light leading-[1.8] opacity-70 mb-16 max-w-[650px] mx-auto"
          style={fd()}
        />

        {c.details && c.details.length > 0 && (
          <div className="flex flex-col gap-0 max-w-[500px] w-full mx-auto">
            {c.details.map((detail: any, idx: number) => (
              <div
                key={detail.id || idx}
                className={cn(
                  'flex justify-between items-baseline gap-6 py-4 border-b',
                  borderColor,
                  idx === 0 && 'border-t'
                )}
              >
                <EditableText
                  as="span"
                  {...et(`details.${idx}.label`, detail.label)}
                  className="text-[10px] font-medium tracking-[0.24em] uppercase opacity-50 whitespace-nowrap"
                />
                <EditableText
                  as="span"
                  {...et(`details.${idx}.value`, detail.value)}
                  className="text-base font-light text-right opacity-80"
                  style={fd()}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function EditorialRenderer({
  data,
  content,
  props,
}: {
  data?: any;
  content?: any;
  props?: any;
}) {
  const variant = props?.variant || 'overlap-blend';
  switch (variant) {
    case 'split-portrait':
      return <EditorialSplitPortrait data={data} content={content} props={props} />;
    case 'text-only':
      return <EditorialTextOnly data={data} content={content} props={props} />;
    default:
      return <EditorialOverlapBlend data={data} content={content} props={props} />;
  }
}

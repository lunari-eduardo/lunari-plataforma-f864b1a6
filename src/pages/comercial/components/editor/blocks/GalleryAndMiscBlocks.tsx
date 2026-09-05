import React from 'react';
import { BlockData } from '@/hooks/useMaterialEditor';
import { cn } from '@/lib/utils';
import { EditableText } from '../../../blocks/EditableText';
import { EditableImage, AddImageTile } from '../../../blocks/EditableImage';
import { useInlineEdit } from '../../../blocks/inlineContext';
import { fd, fb, alignClass, sectionBg, textColorClass } from './helpers';

export function DefaultRenderer({ block }: { block: BlockData }) {
  const inline = useInlineEdit();
  const et = (path: string, value: string | undefined) => ({
    editable: inline?.editable ?? false,
    value: value ?? '',
    onCommit: (v: string) => inline?.set(path, v),
  });
  const v = block.content ?? block.data ?? {};
  const align = alignClass(block.props?.align, 'center');
  const bg = sectionBg(block.props?.background, 'white');
  const textColor = textColorClass(block.props?.text_color, block.props?.background, 'white');

  return (
    <section className={cn('py-16 px-8', bg, textColor, align)}>
      <div className="max-w-2xl mx-auto">
        <EditableText
          as="h2"
          {...et('title', v.title)}
          multiline
          className="text-3xl text-current mb-4"
          style={fd()}
        />
        <EditableText
          as="p"
          {...et('body', v.body ?? v.content ?? v.description)}
          multiline
          className="opacity-70 whitespace-pre-line"
        />
      </div>
    </section>
  );
}

export function GalleryRenderer({
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
  const images: any[] = c.images || [];
  const layout = props?.layout ?? 'masonry';
  const align = alignClass(props?.align, 'center');

  const addImage = (url: string) => {
    inline?.set('images', [
      ...images,
      { id: crypto.randomUUID(), image_ref: url, span: 'normal', ratio: 'auto' },
    ]);
  };

  const addMultipleImages = (urls: string[]) => {
    const newImages = urls.map((url) => ({
      id: crypto.randomUUID(),
      image_ref: url,
      span: 'normal',
      ratio: 'auto',
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
        <EditableText
          as="p"
          {...et('eyebrow', c.eyebrow)}
          className="text-[10px] font-medium tracking-[0.28em] uppercase opacity-40 mb-4"
        />
        <EditableText as="h2" {...et('title', c.title)} className="text-4xl @md:text-5xl mb-4" style={fd()} />
        <EditableText as="p" {...et('caption', c.caption)} className="italic opacity-50 mb-12" style={fd()} />

        {layout === 'masonry' ? (
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
          <div className="grid grid-cols-2 @md:grid-cols-4 gap-2">
            {images.map((img: any, idx: number) => {
              const ratio = img.ratio && img.ratio !== 'auto' ? img.ratio : null;
              return (
                <div
                  key={img.id || idx}
                  className={cn(
                    'rounded-sm overflow-hidden bg-white/5 relative',
                    img.span === 'tall_2rows' && 'row-span-2',
                    img.span === 'wide_2cols' && 'col-span-2'
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
            {editable && <AddImageTile onAdd={addImage} onAddMultiple={addMultipleImages} />}
          </div>
        )}
      </div>
    </section>
  );
}

export function DividerRenderer({
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
  const style = props?.style || 'hairline';

  if (style === 'spaced') {
    return <section className={cn('py-12 @md:py-20', sectionBg(props?.background, 'cream'))} />;
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
          <EditableText
            as="p"
            {...et('label', c.label)}
            className="text-[9px] tracking-[0.35em] uppercase opacity-40 mt-2"
            style={fb()}
          />
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
            <EditableText
              as="span"
              {...et('label', c.label)}
              className="text-[9px] tracking-[0.35em] uppercase opacity-40 shrink-0"
              style={fb()}
              placeholder="Rótulo"
            />
          )}
          <div className="flex-1 h-[0.5px] bg-current opacity-15" />
        </div>
      </div>
    </section>
  );
}

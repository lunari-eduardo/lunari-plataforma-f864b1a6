import React from 'react';
import { BlockData } from '@/hooks/useMaterialEditor';
import { cn } from '@/lib/utils';
import { ProposalDesignTokens, tokensToCssVars, ensureFontLoaded } from '../../blocks/design';
import { InlineEditContext } from '../../blocks/inlineContext';
import { EditorialComposition } from '../../blocks/EditorialComposition';
import { BlockObserver } from './blocks/helpers';
import { CoverRenderer } from './blocks/CoverBlocks';
import { EditorialRenderer } from './blocks/EditorialBlocks';
import { PricingTableRenderer, PackageRenderer } from './blocks/PricingBlocks';
import { GalleryRenderer, DividerRenderer, DefaultRenderer } from './blocks/GalleryAndMiscBlocks';

export interface VisualRendererProps {
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
  const visibleBlocks = blocks.filter((b) => b.type !== 'global_settings');

  React.useEffect(() => {
    ensureFontLoaded(designTokens?.typography?.display);
    ensureFontLoaded(designTokens?.typography?.body);
  }, [designTokens?.typography?.display, designTokens?.typography?.body]);

  return (
    <div className="w-full h-full p-4 md:p-8 flex items-start justify-center transition-all duration-300">
      <div
        className={cn(
          '@container bg-white shadow-2xl overflow-y-auto overflow-x-hidden relative transition-all duration-500 origin-top flex flex-col w-full',
          viewMode === 'desktop'
            ? 'max-w-5xl rounded-sm min-h-full'
            : 'max-w-[375px] h-[812px] rounded-[3rem] border-[12px] border-zinc-900'
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
                {block.type === 'CoverBlock' && (
                  <CoverRenderer data={block.content || block.data} props={block.props} onCtaClick={onCtaClick} />
                )}
                {block.type === 'package' && <PackageRenderer data={block.data} onCtaClick={onCtaClick} />}
                {block.type === 'EditorialBlock' && (
                  <EditorialRenderer content={block.content} data={block.data} props={block.props} />
                )}
                {block.type === 'PricingTable' && (
                  <PricingTableRenderer
                    content={block.content}
                    data={block.data}
                    props={block.props}
                    onCtaClick={onCtaClick}
                  />
                )}
                {block.type === 'EditorialComposition' && (
                  <EditorialComposition content={block.content} props={block.props} />
                )}
                {block.type === 'Gallery' && (
                  <GalleryRenderer content={block.content} data={block.data} props={block.props} />
                )}
                {block.type === 'DividerBlock' && (
                  <DividerRenderer content={block.content} data={block.data} props={block.props} />
                )}
                {block.type === 'text' && <DefaultRenderer block={block} />}
              </BlockObserver>
            </InlineEditContext.Provider>
          );

          if (!isEditing) {
            // Modo público/preview: sem chrome de edição, conteúdo interativo (CTAs funcionam)
            return <div key={block.id || `block-${index}`}>{content}</div>;
          }

          return (
            <div
              key={block.id || `block-${index}`}
              onClick={() => onSelectBlock(index)}
              className={cn(
                'relative group cursor-pointer transition-all duration-200 outline outline-2 outline-transparent outline-offset-[-2px]',
                isActive ? 'outline-primary z-10 shadow-[0_0_0_4px_rgba(200,106,70,0.1)]' : 'hover:outline-primary/30'
              )}
            >
              {/* Tinta de hover */}
              <div
                className={cn(
                  'absolute inset-0 z-0 pointer-events-none transition-colors',
                  !isActive && 'group-hover:bg-primary/5'
                )}
              />

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

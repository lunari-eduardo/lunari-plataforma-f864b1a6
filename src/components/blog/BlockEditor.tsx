import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, GripVertical, Trash2, Type, Heading1, Heading2, Heading3, Image, List, Quote } from 'lucide-react';
import { TextBlock } from './blocks/TextBlock';
import { HeadingBlock } from './blocks/HeadingBlock';
import { ImageBlock } from './blocks/ImageBlock';
import { ListBlock } from './blocks/ListBlock';
import { QuoteBlock } from './blocks/QuoteBlock';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableBlock } from './blocks/SortableBlock';

export interface ContentBlock {
  id: string;
  type: 'paragraph' | 'h1' | 'h2' | 'h3' | 'image' | 'list' | 'quote';
  content: string;
  imageUrl?: string;
  imageCaption?: string;
  imageAlt?: string;
  listType?: 'ul' | 'ol';
}

interface BlockEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

// Parse HTML to blocks
const parseHtmlToBlocks = (html: string): ContentBlock[] => {
  if (!html || html.trim() === '') {
    return [{ id: crypto.randomUUID(), type: 'paragraph', content: '' }];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blocks: ContentBlock[] = [];

  const processNode = (node: Element) => {
    const tagName = node.tagName.toLowerCase();
    const id = crypto.randomUUID();

    switch (tagName) {
      case 'h1':
        blocks.push({ id, type: 'h1', content: node.innerHTML });
        break;
      case 'h2':
        blocks.push({ id, type: 'h2', content: node.innerHTML });
        break;
      case 'h3':
        blocks.push({ id, type: 'h3', content: node.innerHTML });
        break;
      case 'p':
        blocks.push({ id, type: 'paragraph', content: node.innerHTML });
        break;
      case 'ul':
        blocks.push({ id, type: 'list', content: node.innerHTML, listType: 'ul' });
        break;
      case 'ol':
        blocks.push({ id, type: 'list', content: node.innerHTML, listType: 'ol' });
        break;
      case 'blockquote':
        blocks.push({ id, type: 'quote', content: node.innerHTML });
        break;
      case 'figure':
        const img = node.querySelector('img');
        const caption = node.querySelector('figcaption');
        if (img) {
          blocks.push({
            id,
            type: 'image',
            content: '',
            imageUrl: img.getAttribute('src') || '',
            imageAlt: img.getAttribute('alt') || '',
            imageCaption: caption?.textContent || ''
          });
        }
        break;
      default:
        // Fallback para conteúdo genérico
        if (node.textContent?.trim()) {
          blocks.push({ id, type: 'paragraph', content: node.innerHTML });
        }
    }
  };

  doc.body.childNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      processNode(node as Element);
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      blocks.push({ id: crypto.randomUUID(), type: 'paragraph', content: node.textContent });
    }
  });

  return blocks.length > 0 ? blocks : [{ id: crypto.randomUUID(), type: 'paragraph', content: '' }];
};

// Convert blocks to HTML
const blocksToHtml = (blocks: ContentBlock[]): string => {
  return blocks.map(block => {
    switch (block.type) {
      case 'h1':
        return `<h1>${block.content}</h1>`;
      case 'h2':
        return `<h2>${block.content}</h2>`;
      case 'h3':
        return `<h3>${block.content}</h3>`;
      case 'paragraph':
        return `<p>${block.content}</p>`;
      case 'list':
        const tag = block.listType || 'ul';
        return `<${tag}>${block.content}</${tag}>`;
      case 'quote':
        return `<blockquote>${block.content}</blockquote>`;
      case 'image':
        if (!block.imageUrl) return '';
        return `<figure class="blog-image">
          <img src="${block.imageUrl}" alt="${block.imageAlt || ''}" />
          ${block.imageCaption ? `<figcaption>${block.imageCaption}</figcaption>` : ''}
        </figure>`;
      default:
        return `<p>${block.content}</p>`;
    }
  }).filter(Boolean).join('\n');
};

export function BlockEditor({ value, onChange, placeholder }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(() => parseHtmlToBlocks(value));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateBlocks = useCallback((newBlocks: ContentBlock[]) => {
    setBlocks(newBlocks);
    onChange(blocksToHtml(newBlocks));
  }, [onChange]);

  const addBlock = (type: ContentBlock['type'], afterIndex: number) => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type,
      content: '',
      listType: type === 'list' ? 'ul' : undefined,
    };
    const newBlocks = [...blocks];
    newBlocks.splice(afterIndex + 1, 0, newBlock);
    updateBlocks(newBlocks);
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    const newBlocks = blocks.map(block =>
      block.id === id ? { ...block, ...updates } : block
    );
    updateBlocks(newBlocks);
  };

  const deleteBlock = (id: string) => {
    if (blocks.length <= 1) {
      updateBlocks([{ id: crypto.randomUUID(), type: 'paragraph', content: '' }]);
      return;
    }
    updateBlocks(blocks.filter(block => block.id !== id));
  };

  const changeBlockType = (id: string, newType: ContentBlock['type']) => {
    const newBlocks = blocks.map(block =>
      block.id === id ? { 
        ...block, 
        type: newType, 
        listType: newType === 'list' ? 'ul' as const : undefined 
      } : block
    );
    updateBlocks(newBlocks);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex(b => b.id === active.id);
      const newIndex = blocks.findIndex(b => b.id === over.id);
      updateBlocks(arrayMove(blocks, oldIndex, newIndex));
    }
  };

  const BlockTypeSelector = ({ blockId, currentType, onAdd }: { blockId: string; currentType: ContentBlock['type']; onAdd: () => void }) => (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => changeBlockType(blockId, 'paragraph')}
        title="Parágrafo"
      >
        <Type className={`h-4 w-4 ${currentType === 'paragraph' ? 'text-primary' : ''}`} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => changeBlockType(blockId, 'h1')}
        title="Título H1"
      >
        <Heading1 className={`h-4 w-4 ${currentType === 'h1' ? 'text-primary' : ''}`} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => changeBlockType(blockId, 'h2')}
        title="Título H2"
      >
        <Heading2 className={`h-4 w-4 ${currentType === 'h2' ? 'text-primary' : ''}`} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => changeBlockType(blockId, 'h3')}
        title="Título H3"
      >
        <Heading3 className={`h-4 w-4 ${currentType === 'h3' ? 'text-primary' : ''}`} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => changeBlockType(blockId, 'image')}
        title="Imagem"
      >
        <Image className={`h-4 w-4 ${currentType === 'image' ? 'text-primary' : ''}`} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => changeBlockType(blockId, 'list')}
        title="Lista"
      >
        <List className={`h-4 w-4 ${currentType === 'list' ? 'text-primary' : ''}`} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => changeBlockType(blockId, 'quote')}
        title="Citação"
      >
        <Quote className={`h-4 w-4 ${currentType === 'quote' ? 'text-primary' : ''}`} />
      </Button>
      <div className="h-4 w-px bg-border mx-1" />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={() => deleteBlock(blockId)}
        title="Remover bloco"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  const renderBlock = (block: ContentBlock, index: number) => {
    const commonProps = {
      value: block.content,
      onChange: (content: string) => updateBlock(block.id, { content }),
      placeholder: index === 0 && !block.content ? placeholder : undefined,
    };

    switch (block.type) {
      case 'h1':
      case 'h2':
      case 'h3':
        return <HeadingBlock {...commonProps} level={block.type} />;
      case 'image':
        return (
          <ImageBlock
            imageUrl={block.imageUrl || ''}
            imageCaption={block.imageCaption || ''}
            imageAlt={block.imageAlt || ''}
            onUpdate={(updates) => updateBlock(block.id, updates)}
          />
        );
      case 'list':
        return (
          <ListBlock
            {...commonProps}
            listType={block.listType || 'ul'}
            onListTypeChange={(type) => updateBlock(block.id, { listType: type })}
          />
        );
      case 'quote':
        return <QuoteBlock {...commonProps} />;
      default:
        return <TextBlock {...commonProps} />;
    }
  };

  return (
    <div className="border rounded-lg bg-background">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map(b => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="divide-y divide-border">
            {blocks.map((block, index) => (
              <SortableBlock key={block.id} id={block.id}>
                <div className="group flex items-start gap-2 p-3">
                  <div className="flex items-center gap-1 pt-2 cursor-grab active:cursor-grabbing text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase">
                        {block.type === 'paragraph' && 'Parágrafo'}
                        {block.type === 'h1' && 'Título H1'}
                        {block.type === 'h2' && 'Título H2'}
                        {block.type === 'h3' && 'Título H3'}
                        {block.type === 'image' && 'Imagem'}
                        {block.type === 'list' && 'Lista'}
                        {block.type === 'quote' && 'Citação'}
                      </span>
                      <BlockTypeSelector
                        blockId={block.id}
                        currentType={block.type}
                        onAdd={() => addBlock('paragraph', index)}
                      />
                    </div>
                    {renderBlock(block, index)}
                  </div>
                </div>
              </SortableBlock>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      
      {/* Add block button */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => addBlock('paragraph', blocks.length - 1)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Adicionar bloco
          </Button>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => addBlock('h2', blocks.length - 1)}
              title="Adicionar título"
            >
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => addBlock('image', blocks.length - 1)}
              title="Adicionar imagem"
            >
              <Image className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => addBlock('list', blocks.length - 1)}
              title="Adicionar lista"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => addBlock('quote', blocks.length - 1)}
              title="Adicionar citação"
            >
              <Quote className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

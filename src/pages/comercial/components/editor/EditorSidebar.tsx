import React from 'react';
import { BlockData } from '@/hooks/useMaterialEditor';
import { cn } from '@/lib/utils';
import { 
  Image as ImageIcon, 
  AlignLeft, 
  DollarSign, 
  Briefcase, 
  HelpCircle, 
  MessageSquare,
  GripVertical,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface EditorSidebarProps {
  blocks: BlockData[];
  activeIndex: number;
  onSelectBlock: (index: number) => void;
  onAddBlock: (type: string) => void;
  onMoveBlock: (index: number, direction: 'up' | 'down') => void;
  onReorderBlocks: (oldIndex: number, newIndex: number) => void;
}

const getBlockIcon = (type: string) => {
  switch (type) {
    case 'cover': 
    case 'CoverBlock': return ImageIcon;
    case 'about': 
    case 'EditorialBlock': return AlignLeft;
    case 'package': 
    case 'PricingTable': return DollarSign;
    case 'portfolio': 
    case 'Gallery': return Briefcase;
    case 'faq': 
    case 'TestimonialBlock': return HelpCircle; // Testimonials will use HelpCircle or MessageSquare, let's use MessageSquare
    case 'cta': 
    case 'CTABlock': return MessageSquare;
    case 'text': 
    case 'FooterTerms': return AlignLeft;
    default: return AlignLeft;
  }
};

const getBlockName = (type: string) => {
  switch (type) {
    case 'cover': 
    case 'CoverBlock': return 'Capa';
    case 'about': return 'Apresentação';
    case 'EditorialBlock': return 'Editorial';
    case 'package': 
    case 'PricingTable': return 'Tabela de Preços';
    case 'portfolio': 
    case 'Gallery': return 'Galeria';
    case 'faq': return 'Perguntas Frequentes';
    case 'TestimonialBlock': return 'Depoimentos';
    case 'cta': 
    case 'CTABlock': return 'Chamada para ação';
    case 'text': return 'Texto Livre';
    case 'FooterTerms': return 'Rodapé';
    default: return 'Seção';
  }
};

const getBlockDesc = (type: string) => {
  switch (type) {
    case 'cover': 
    case 'CoverBlock': return 'Seção de abertura';
    case 'about': return 'Sobre você e seu trabalho';
    case 'EditorialBlock': return 'Bloco de conteúdo com imagens';
    case 'package': 
    case 'PricingTable': return 'Pacotes e valores';
    case 'portfolio': 
    case 'Gallery': return 'Mostre seus resultados';
    case 'faq': return 'Dúvidas comuns';
    case 'TestimonialBlock': return 'O que dizem sobre você';
    case 'cta': 
    case 'CTABlock': return 'Botão de contato e links';
    case 'text': return 'Conteúdo customizado';
    case 'FooterTerms': return 'Direitos autorais e termos';
    default: return '';
  }
};

const blockTypes = ['CoverBlock', 'EditorialBlock', 'PricingTable', 'Gallery', 'TestimonialBlock', 'CTABlock', 'FooterTerms', 'text'];

// Item sortable extraído para o dnd-kit
function SortableSidebarItem({ block, index, isActive, onSelect }: { block: BlockData, index: number, isActive: boolean, onSelect: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id || `${block.type}-${index}` }); // IMPORTANTE: blocos agora precisam de ID único. O hook já gera `id`.

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = getBlockIcon(block.type);

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all bg-background",
        isActive 
          ? "border-primary/20 bg-primary/5 shadow-sm ring-1 ring-primary/20" 
          : "border-transparent hover:bg-muted/50"
      )}
      onClick={onSelect}
    >
      <div className="mt-0.5 shrink-0">
        <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
      </div>
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <span className={cn("text-sm font-semibold leading-tight", isActive ? "text-foreground" : "text-foreground/80")}>
          {block.content?.title || block.content?.eyebrow || block.data?.title || getBlockName(block.type)}
        </span>
        <span className="text-[11px] text-muted-foreground truncate mt-0.5">
          {getBlockDesc(block.type)}
        </span>
      </div>
      
      {/* Botão de Grip para Drag and Drop */}
      <div 
        className="absolute right-2 top-2 flex flex-col opacity-0 transition-opacity group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        {...attributes} 
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

export function EditorSidebar({
  blocks,
  activeIndex,
  onSelectBlock,
  onAddBlock,
  onReorderBlocks
}: EditorSidebarProps) {
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Só ativa o drag se mover 5px (previne conflito com o click)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex(b => (b.id || `${b.type}-${blocks.indexOf(b)}`) === active.id);
      const newIndex = blocks.findIndex(b => (b.id || `${b.type}-${blocks.indexOf(b)}`) === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderBlocks(oldIndex, newIndex);
        
        // Se arrastar o bloco ativo, manter ele ativo no novo índice
        if (oldIndex === activeIndex) {
          onSelectBlock(newIndex);
        } else if (oldIndex < activeIndex && newIndex >= activeIndex) {
          onSelectBlock(activeIndex - 1); // Empurrou o ativo pra cima
        } else if (oldIndex > activeIndex && newIndex <= activeIndex) {
          onSelectBlock(activeIndex + 1); // Empurrou o ativo pra baixo
        }
      }
    }
  };

  const itemIds = blocks.map((b, i) => b.id || `${b.type}-${i}`);

  return (
    <div className="flex h-full flex-col">
      <div className="p-4 pt-6 pb-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Estrutura da Proposta
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2 pt-2 custom-scrollbar">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={itemIds}
            strategy={verticalListSortingStrategy}
          >
            {blocks.map((block, index) => (
              <SortableSidebarItem 
                key={itemIds[index]}
                block={block}
                index={index}
                isActive={index === activeIndex}
                onSelect={() => onSelectBlock(index)}
              />
            ))}
          </SortableContext>
        </DndContext>
        
        <div className="pt-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full gap-2 border-dashed bg-transparent hover:bg-muted/50 rounded-xl">
                <Plus className="h-4 w-4" />
                Adicionar Seção
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56 rounded-xl">
              {blockTypes.map((type) => {
                const Icon = getBlockIcon(type);
                return (
                  <DropdownMenuItem key={type} onClick={() => onAddBlock(type)} className="gap-3 py-2 cursor-pointer">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted/50">
                      <Icon className="h-3.5 w-3.5 text-foreground" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{getBlockName(type)}</span>
                      <span className="text-[10px] text-muted-foreground">{getBlockDesc(type)}</span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

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

export interface EditorSidebarProps {
  blocks: BlockData[];
  activeIndex: number;
  onSelectBlock: (index: number) => void;
  onAddBlock: (type: string) => void;
  onMoveBlock: (index: number, direction: 'up' | 'down') => void;
}

const getBlockIcon = (type: string) => {
  switch (type) {
    case 'cover': return ImageIcon;
    case 'about': return AlignLeft;
    case 'package': return DollarSign;
    case 'portfolio': return Briefcase;
    case 'faq': return HelpCircle;
    case 'cta': return MessageSquare;
    case 'text': return AlignLeft;
    default: return AlignLeft;
  }
};

const getBlockName = (type: string) => {
  switch (type) {
    case 'cover': return 'Capa';
    case 'about': return 'Apresentação';
    case 'package': return 'Investimento';
    case 'portfolio': return 'Portfólio';
    case 'faq': return 'Perguntas Frequentes';
    case 'cta': return 'Chamada para ação';
    case 'text': return 'Texto Livre';
    default: return 'Seção';
  }
};

const getBlockDesc = (type: string) => {
  switch (type) {
    case 'cover': return 'Seção de abertura';
    case 'about': return 'Sobre você e seu trabalho';
    case 'package': return 'Pacotes e valores';
    case 'portfolio': return 'Mostre seus resultados';
    case 'faq': return 'Dúvidas comuns';
    case 'cta': return 'Botão de contato';
    case 'text': return 'Conteúdo customizado';
    default: return '';
  }
};

const blockTypes = ['cover', 'about', 'package', 'portfolio', 'faq', 'cta', 'text'];

export function EditorSidebar({
  blocks,
  activeIndex,
  onSelectBlock,
  onAddBlock,
  onMoveBlock
}: EditorSidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-4 pt-6 pb-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Estrutura da Proposta
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2 pt-2 custom-scrollbar">
        {blocks.map((block, index) => {
          const Icon = getBlockIcon(block.type);
          const isActive = index === activeIndex;
          
          return (
            <div 
              key={`${block.id || block.type}-${index}`}
              className={cn(
                "group relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all",
                isActive 
                  ? "border-primary/20 bg-primary/5 shadow-sm ring-1 ring-primary/20" 
                  : "border-transparent bg-transparent hover:bg-muted/50"
              )}
              onClick={() => onSelectBlock(index)}
            >
              {/* Grip Indicator - Visible on hover or active */}
              <div className="mt-0.5 shrink-0">
                <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
              </div>
              
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className={cn("text-sm font-semibold leading-tight", isActive ? "text-foreground" : "text-foreground/80")}>
                  {block.data?.title || getBlockName(block.type)}
                </span>
                <span className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {getBlockDesc(block.type)}
                </span>
              </div>
              
              {/* Opções (mover) só aparece no hover */}
              <div className="absolute right-2 top-2 flex flex-col opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
              </div>
            </div>
          );
        })}
        
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

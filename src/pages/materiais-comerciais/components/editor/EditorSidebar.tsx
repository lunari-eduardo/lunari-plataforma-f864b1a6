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
  ChevronUp,
  ChevronDown,
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
  onRemoveBlock: (index: number) => void;
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
    case 'about': return 'Sobre';
    case 'package': return 'Pacote / Preço';
    case 'portfolio': return 'Portfólio';
    case 'faq': return 'FAQ';
    case 'cta': return 'Call to Action';
    case 'text': return 'Texto Livre';
    default: return 'Seção';
  }
};

const blockTypes = ['cover', 'about', 'package', 'portfolio', 'faq', 'cta', 'text'];

export function EditorSidebar({
  blocks,
  activeIndex,
  onSelectBlock,
  onAddBlock,
  onRemoveBlock,
  onMoveBlock
}: EditorSidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
        Conteúdo
      </div>
      
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="space-y-1">
          {blocks.map((block, index) => {
            const Icon = getBlockIcon(block.type);
            const isActive = index === activeIndex;
            
            return (
              <div 
                key={`${block.id || block.type}-${index}`}
                className={cn(
                  "group flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
                onClick={() => onSelectBlock(index)}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-gray-400" />
                  <span>{block.data?.title || getBlockName(block.type)}</span>
                </div>
                
                <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6" 
                    onClick={() => onMoveBlock(index, 'up')}
                    disabled={index === 0}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6" 
                    onClick={() => onMoveBlock(index, 'down')}
                    disabled={index === blocks.length - 1}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-6 px-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full gap-2" size="sm">
                <Plus className="h-4 w-4" />
                Adicionar Seção
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              {blockTypes.map((type) => {
                const Icon = getBlockIcon(type);
                return (
                  <DropdownMenuItem key={type} onClick={() => onAddBlock(type)} className="gap-2">
                    <Icon className="h-4 w-4 text-gray-500" />
                    {getBlockName(type)}
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

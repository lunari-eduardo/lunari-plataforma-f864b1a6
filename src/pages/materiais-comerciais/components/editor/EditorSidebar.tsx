import React from 'react';
import { 
  Image as ImageIcon, 
  AlignLeft, 
  Briefcase, 
  DollarSign, 
  HelpCircle, 
  MessageSquare,
  Plus,
  GripVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SectionDef {
  id: string;
  type: 'cover' | 'about' | 'portfolio' | 'package' | 'faq' | 'contact';
  title: string;
  isOptional?: boolean;
  isHidden?: boolean;
}

export const MOCK_SECTIONS: SectionDef[] = [
  { id: 'sec_1', type: 'cover', title: 'Capa Principal' },
  { id: 'sec_2', type: 'about', title: 'Sobre o Estúdio' },
  { id: 'sec_3', type: 'portfolio', title: 'Portfólio Resumido' },
  { id: 'sec_4', type: 'package', title: 'Pacote Ouro' },
  { id: 'sec_5', type: 'package', title: 'Pacote Prata' },
  { id: 'sec_6', type: 'faq', title: 'Dúvidas Frequentes', isOptional: true },
  { id: 'sec_7', type: 'contact', title: 'Como Contratar' },
];

const iconMap = {
  cover: ImageIcon,
  about: AlignLeft,
  portfolio: Briefcase,
  package: DollarSign,
  faq: HelpCircle,
  contact: MessageSquare,
};

interface EditorSidebarProps {
  sections: SectionDef[];
  activeSectionId: string;
  onSelectSection: (id: string) => void;
}

export function EditorSidebar({ sections, activeSectionId, onSelectSection }: EditorSidebarProps) {
  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-background">
      <div className="flex flex-col p-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Estrutura (Preview)
        </h2>
        
        <div className="flex flex-col space-y-1">
          {sections.map((sec) => {
            const Icon = iconMap[sec.type] || AlignLeft;
            const isActive = sec.id === activeSectionId;
            
            return (
              <button
                key={sec.id}
                onClick={() => onSelectSection(sec.id)}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors",
                  isActive 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <GripVertical className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-30 cursor-grab active:cursor-grabbing" />
                <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className="flex-1 text-left truncate">{sec.title}</span>
                {sec.isHidden && (
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">
                    Oculto
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Button variant="outline" className="w-full mt-6 gap-2 text-muted-foreground border-dashed">
          <Plus className="h-4 w-4" />
          Adicionar Seção
        </Button>
      </div>
    </div>
  );
}

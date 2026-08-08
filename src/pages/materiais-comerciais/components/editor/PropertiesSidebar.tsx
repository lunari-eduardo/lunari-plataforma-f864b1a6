import React from 'react';
import { BlockData } from '@/hooks/useMaterialEditor';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2, ChevronDown, Image as ImageIcon } from 'lucide-react';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface PropertiesSidebarProps {
  block: BlockData;
  blockIndex: number;
  onUpdateBlock: (index: number, data: Record<string, any>) => void;
  onRemoveBlock: (index: number) => void;
}

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

export function PropertiesSidebar({
  block,
  blockIndex,
  onUpdateBlock,
  onRemoveBlock
}: PropertiesSidebarProps) {
  
  const handleChange = (field: string, value: any) => {
    onUpdateBlock(blockIndex, { [field]: value });
  };

  const renderContentFields = () => {
    switch (block.type) {
      case 'cover':
        return (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Título</Label>
              <Textarea 
                value={block.data.title || ''} 
                onChange={(e) => handleChange('title', e.target.value)} 
                placeholder="Seu momento merece ser vivido e lembrado para sempre."
                className="resize-none min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Subtítulo</Label>
              <Textarea 
                value={block.data.subtitle || ''} 
                onChange={(e) => handleChange('subtitle', e.target.value)} 
                placeholder="Fotografias que eternizam a espera do seu maior amor..." 
                className="resize-none min-h-[80px]"
              />
            </div>
            
            <div className="space-y-2 pt-4">
              <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">Botão Primário</Label>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Texto</Label>
                  <Input 
                    value={block.data.btnText || ''} 
                    onChange={(e) => handleChange('btnText', e.target.value)} 
                    placeholder="Quero viver essa experiência" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Link</Label>
                  <Input 
                    value={block.data.btnLink || ''} 
                    onChange={(e) => handleChange('btnLink', e.target.value)} 
                    placeholder="#contato" 
                  />
                </div>
              </div>
            </div>
          </>
        );
      
      case 'package':
        return (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Nome do Pacote</Label>
              <Input 
                value={block.data.title || ''} 
                onChange={(e) => handleChange('title', e.target.value)} 
                placeholder="Ex: Essencial"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Preço (R$)</Label>
              <Input 
                type="number"
                value={block.data.price_cents ? block.data.price_cents / 100 : ''} 
                onChange={(e) => handleChange('price_cents', Number(e.target.value) * 100)} 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Descrição / Itens Inclusos</Label>
              <Textarea 
                value={block.data.description || ''} 
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="10 fotos digitais&#10;1h de ensaio..."
                className="min-h-[150px]"
              />
            </div>
          </>
        );

      default:
        return (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Título</Label>
              <Input 
                value={block.data.title || ''} 
                onChange={(e) => handleChange('title', e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Conteúdo</Label>
              <Textarea 
                value={block.data.content || ''} 
                onChange={(e) => handleChange('content', e.target.value)}
                className="min-h-[150px]"
              />
            </div>
          </>
        );
    }
  };

  const hasImageField = ['cover', 'about', 'portfolio'].includes(block.type);

  return (
    <div className="flex h-full flex-col">
      <div className="p-4 pt-6 pb-4 border-b border-border">
        <h2 className="text-xl font-medium text-foreground tracking-tight">
          Editando: {getBlockName(block.type)}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Tipo: {getBlockName(block.type)}</p>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
        
        {/* Accordion: CONTEÚDO */}
        <Collapsible defaultOpen className="space-y-2">
          <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
            Conteúdo
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2 pb-4">
            {renderContentFields()}
          </CollapsibleContent>
        </Collapsible>

        {/* Accordion: IMAGEM (Condicional) */}
        {hasImageField && (
          <Collapsible defaultOpen className="space-y-2 border-t border-border pt-4">
            <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
              Imagem
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2 pb-4">
              <div className="space-y-3">
                <div className="flex gap-3 items-center">
                  <div className="h-20 w-32 shrink-0 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
                    {block.data.image_url ? (
                      <img src={block.data.image_url} alt="Cover" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs h-8">Trocar imagem</Button>
                    <Button variant="ghost" size="sm" className="w-full text-xs h-8 text-destructive hover:bg-destructive/10">Remover</Button>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Accordion: ESTILO (Mock) */}
        <Collapsible className="space-y-2 border-t border-border pt-4">
          <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
            Estilo
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2 pb-4">
            <p className="text-sm text-muted-foreground">Configurações de estilo em breve.</p>
          </CollapsibleContent>
        </Collapsible>

        {/* Accordion: ESPAÇAMENTO (Mock) */}
        <Collapsible className="space-y-2 border-t border-border pt-4 border-b pb-4">
          <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
            Espaçamento
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2 pb-4">
            <p className="text-sm text-muted-foreground">Configurações de padding/margin em breve.</p>
          </CollapsibleContent>
        </Collapsible>

        {/* Delete Action */}
        <div className="pt-6 pb-8 flex justify-center">
          <Button 
            variant="ghost" 
            className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full max-w-[200px]"
            onClick={() => onRemoveBlock(blockIndex)}
          >
            Remover seção
          </Button>
        </div>

      </div>
    </div>
  );
}

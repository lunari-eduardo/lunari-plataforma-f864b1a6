import React from 'react';
import { BlockData } from '@/hooks/useMaterialEditor';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

export interface EditorCanvasProps {
  block: BlockData;
  blockIndex: number;
  onUpdateBlock: (index: number, data: Record<string, any>) => void;
  onRemoveBlock: (index: number) => void;
}

export function EditorCanvas({
  block,
  blockIndex,
  onUpdateBlock,
  onRemoveBlock
}: EditorCanvasProps) {
  
  const handleChange = (field: string, value: any) => {
    onUpdateBlock(blockIndex, { [field]: value });
  };
  
  const renderFields = () => {
    switch (block.type) {
      case 'cover':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título Principal</Label>
              <Input 
                value={block.data.title || ''} 
                onChange={(e) => handleChange('title', e.target.value)} 
                placeholder="Ex: Proposta de Marca" 
              />
            </div>
            <div className="space-y-2">
              <Label>Subtítulo</Label>
              <Input 
                value={block.data.subtitle || ''} 
                onChange={(e) => handleChange('subtitle', e.target.value)} 
                placeholder="Ex: Criado especialmente para..." 
              />
            </div>
          </div>
        );
        
      case 'about':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input 
                value={block.data.title || ''} 
                onChange={(e) => handleChange('title', e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Texto</Label>
              <Textarea 
                value={block.data.content || ''} 
                onChange={(e) => handleChange('content', e.target.value)}
                className="min-h-[150px]"
              />
            </div>
          </div>
        );

      case 'package':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Pacote</Label>
              <Input 
                value={block.data.title || ''} 
                onChange={(e) => handleChange('title', e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <Input 
                type="number"
                value={block.data.price_cents ? block.data.price_cents / 100 : ''} 
                onChange={(e) => handleChange('price_cents', Number(e.target.value) * 100)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição / Itens</Label>
              <Textarea 
                value={block.data.description || ''} 
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Liste os itens incluídos..."
              />
            </div>
          </div>
        );
        
      case 'portfolio':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input 
                value={block.data.title || ''} 
                onChange={(e) => handleChange('title', e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea 
                value={block.data.description || ''} 
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </div>
          </div>
        );

      case 'faq':
      case 'cta':
      case 'text':
      default:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input 
                value={block.data.title || ''} 
                onChange={(e) => handleChange('title', e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea 
                value={block.data.content || ''} 
                onChange={(e) => handleChange('content', e.target.value)}
                className="min-h-[150px]"
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between border-b pb-4">
        <h2 className="text-lg font-medium text-gray-900 capitalize">
          Editando: {block.type}
        </h2>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-red-500 hover:bg-red-50 hover:text-red-600"
          onClick={() => onRemoveBlock(blockIndex)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Remover Seção
        </Button>
      </div>
      
      {renderFields()}
    </div>
  );
}

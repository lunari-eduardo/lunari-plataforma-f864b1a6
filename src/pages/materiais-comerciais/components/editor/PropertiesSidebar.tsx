import React, { useState } from 'react';
import { BlockData } from '@/hooks/useMaterialEditor';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2, ChevronDown, Image as ImageIcon, Search, Check, DownloadCloud, Loader2 } from 'lucide-react';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useConfigurationContext } from '@/contexts/ConfigurationContext';
import { supabase } from '@/integrations/supabase/client';

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

// --- Função de Resize e Upload simulando a arquitetura R2 ---
const uploadAndResizeImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1920;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(async (blob) => {
          if (!blob) return reject('Failed to convert to blob');
          const ext = file.name.split('.').pop() || 'jpg';
          const filename = `${crypto.randomUUID()}.${ext}`;
          
          try {
            const { data, error } = await (supabase as any).storage
              .from('commercial_media')
              .upload(`proposals/${filename}`, blob, {
                cacheControl: '3600',
                upsert: false
              });

            if (error) throw error;
            
            // Tenta pegar a URL pública (ajuste o nome do bucket e path conforme seu env)
            const { data: publicUrlData } = (supabase as any).storage
              .from('commercial_media')
              .getPublicUrl(`proposals/${filename}`);
              
            resolve(publicUrlData.publicUrl);
          } catch (err) {
            console.error(err);
            reject(err);
          }
        }, 'image/jpeg', 0.85); // 85% de qualidade
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};


export function PropertiesSidebar({
  block,
  blockIndex,
  onUpdateBlock,
  onRemoveBlock
}: PropertiesSidebarProps) {
  const { pacotes } = useConfigurationContext();
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const handleChange = (field: string, value: any) => {
    onUpdateBlock(blockIndex, { [field]: value });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const url = await uploadAndResizeImage(file);
      handleChange('image_url', url);
    } catch (err) {
      console.error(err);
      alert('Erro ao fazer upload da imagem. Certifique-se que o bucket commercial_media existe.');
    } finally {
      setIsUploading(false);
    }
  };

  const importPackage = (pacote: any) => {
    onUpdateBlock(blockIndex, { 
      title: pacote.nome,
      price_cents: pacote.valor * 100, // Ajustar se pacote já vier em cents, assumindo float/int real
      description: pacote.descricao || pacote.itens?.join('\n') || ''
    });
    setIsPackageModalOpen(false);
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
                  <Label className="text-xs text-muted-foreground">Link (Ex: WhatsApp)</Label>
                  <Input 
                    value={block.data.btnLink || ''} 
                    onChange={(e) => handleChange('btnLink', e.target.value)} 
                    placeholder="https://wa.me/5511999999999" 
                  />
                </div>
              </div>
            </div>
          </>
        );
      
      case 'package':
        return (
          <>
            <Button 
              variant="outline" 
              className="w-full mb-4 border-dashed bg-muted/30 text-primary gap-2"
              onClick={() => setIsPackageModalOpen(true)}
            >
              <DownloadCloud className="h-4 w-4" />
              Importar do Banco (Pacotes)
            </Button>

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

      case 'cta':
        return (
          <>
             <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-xs mb-4">
                Configure os links globais do estúdio na aba Configurações da Proposta.
             </div>
             <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Título Chamada</Label>
              <Input 
                value={block.data.title || ''} 
                onChange={(e) => handleChange('title', e.target.value)} 
                placeholder="Vamos conversar?"
              />
            </div>
             <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Texto do Botão (WhatsApp)</Label>
              <Input 
                value={block.data.btnText || ''} 
                onChange={(e) => handleChange('btnText', e.target.value)} 
                placeholder="Chamar no WhatsApp"
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
    <>
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
                Imagem / Mídia
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
                      <Label htmlFor={`upload-${blockIndex}`} className="cursor-pointer">
                        <div className="flex h-8 w-full items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
                          {isUploading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                          Trocar imagem
                        </div>
                        <input 
                          type="file" 
                          id={`upload-${blockIndex}`}
                          className="hidden" 
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={isUploading}
                        />
                      </Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full text-xs h-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleChange('image_url', '')}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">A imagem será redimensionada e otimizada (Max 1920px).</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

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

      {/* MODAL DE PACOTES */}
      <Dialog open={isPackageModalOpen} onOpenChange={setIsPackageModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Importar Pacote</DialogTitle>
            <DialogDescription>
              Selecione um pacote cadastrado no sistema para preencher esta seção.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[400px] overflow-y-auto space-y-2 py-4">
            {!pacotes || pacotes.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                Nenhum pacote cadastrado nas configurações.
              </div>
            ) : (
              pacotes.map((pacote: any) => (
                <div 
                  key={pacote.id}
                  onClick={() => importPackage(pacote)}
                  className="flex flex-col p-4 border rounded-xl hover:border-primary cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-sm">{pacote.nome}</span>
                    <span className="font-bold text-sm text-primary">R$ {pacote.valor}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {pacote.descricao || 'Sem descrição'}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

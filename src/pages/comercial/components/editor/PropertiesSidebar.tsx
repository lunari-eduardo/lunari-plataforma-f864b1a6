import React, { useState } from 'react';
import { BlockData } from '@/hooks/useMaterialEditor';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Trash2, ChevronDown, DownloadCloud, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useConfigurationContext } from '@/contexts/ConfigurationContext';
import { getBlockDef, getBlockName } from '../../blocks/registry';
import { FieldEditor } from '../../blocks/FieldEditor';
import { uploadProposalImage } from '../../blocks/uploadImage';

export interface PropertiesSidebarProps {
  block: BlockData;
  blockIndex: number;
  onUpdateBlock: (index: number, data: Record<string, any>) => void;
  onRemoveBlock: (index: number) => void;
  /** Contexto para os botões de ajuda de texto com IA */
  aiContext?: {
    materialTitle?: string;
    sessionType?: string;
    tone?: string;
  };
}

// ============================================================
// PAINEL DE PROPRIEDADES — gerado a partir do registry de blocos.
// O formulário de cada tipo de bloco é declarado em blocks/registry.ts;
// este componente apenas renderiza o schema.
// ============================================================

export function PropertiesSidebar({
  block,
  blockIndex,
  onUpdateBlock,
  onRemoveBlock,
  aiContext
}: PropertiesSidebarProps) {
  const { pacotes } = useConfigurationContext();
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const def = getBlockDef(block.type);
  const content: Record<string, any> = block.content ?? block.data ?? {};

  const setContent = (updates: Record<string, any>) => {
    onUpdateBlock(blockIndex, { content: { ...content, ...updates } });
  };

  const setProps = (updates: Record<string, any>) => {
    onUpdateBlock(blockIndex, { props: { ...(block.props ?? {}), ...updates } });
  };

  const importPackage = (pacote: any) => {
    // Converte um pacote do ConfigurationContext em item da lista do PricingTable
    const features = (pacote.descricao ? String(pacote.descricao).split('\n').map((s: string) => s.trim()).filter(Boolean) : []);
    const newItem = {
      id: crypto.randomUUID(),
      name: pacote.nome || 'Pacote',
      price: pacote.valor != null ? `R$ ${Number(pacote.valor).toLocaleString('pt-BR')}` : '',
      price_unit: 'sessão',
      badge: '',
      features: Array.isArray(pacote.itens) && pacote.itens.length > 0 ? pacote.itens : features,
    };
    setContent({ packages: [...(content.packages ?? []), newItem] });
    setIsPackageModalOpen(false);
  };

  const handleSlotUpload = async (e: React.ChangeEvent<HTMLInputElement>, slotKey: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadProposalImage(file);
      const slot = { ...((block.props ?? {})[slotKey] ?? {}) };
      setProps({ [slotKey]: { ...slot, image_ref: url } });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar imagem para a nuvem. Verifique sua conexão e tente novamente.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const hasFields = (def?.fields?.length ?? 0) > 0;
  const hasSlots = (def?.propImageSlots?.length ?? 0) > 0;

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="p-4 pt-6 pb-4 border-b border-border">
          <h2 className="text-xl font-medium text-foreground tracking-tight">
            Editando: {getBlockName(block.type)}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">{def?.description ?? 'Seção'}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">

          {/* Ação específica: importar pacotes cadastrados (apenas Tabela de Preços) */}
          {block.type === 'PricingTable' && (
            <Button
              variant="outline"
              className="w-full border-dashed bg-muted/30 text-primary gap-2"
              onClick={() => setIsPackageModalOpen(true)}
            >
              <DownloadCloud className="h-4 w-4" />
              Importar do Banco (Pacotes)
            </Button>
          )}

          {/* Accordion: CONTEÚDO (schema-driven) */}
          {hasFields && (
            <Collapsible defaultOpen className="space-y-2">
              <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
                Conteúdo
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2 pb-4">
                {def!.fields.map((field) => (
                  <FieldEditor
                    key={field.key}
                    field={field}
                    value={content[field.key]}
                    onChange={(v) => setContent({ [field.key]: v })}
                    aiContext={{ blockType: block.type, ...aiContext }}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Accordion: IMAGENS em props (slots como EditorialBlock photo_a/photo_b) */}
          {hasSlots && (
            <Collapsible defaultOpen className="space-y-2 border-t border-border pt-4">
              <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
                Imagens
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-6 pt-2 pb-4">
                {def!.propImageSlots!.map((slot) => {
                  const current = (block.props ?? {})[slot.key]?.image_ref ?? null;
                  return (
                    <div key={slot.key} className="space-y-3">
                      <Label className="text-xs font-bold">{slot.label}</Label>
                      <div className="flex gap-3 items-center">
                        <div className="h-20 w-32 shrink-0 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
                          {current ? (
                            <img src={current} alt={slot.label} className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="flex flex-col gap-2 flex-1">
                          <Label htmlFor={`upload-${slot.key}-${blockIndex}`} className="cursor-pointer">
                            <div className="flex h-8 w-full items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
                              {isUploading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                              {current ? 'Trocar imagem' : 'Enviar imagem'}
                            </div>
                            <input
                              type="file"
                              id={`upload-${slot.key}-${blockIndex}`}
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => handleSlotUpload(e, slot.key)}
                              disabled={isUploading}
                            />
                          </Label>
                          {current ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-xs h-8 text-destructive hover:bg-destructive/10"
                              onClick={() => setProps({ [slot.key]: { ...((block.props ?? {})[slot.key] ?? {}), image_ref: null } })}
                            >
                              Remover
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-muted-foreground">As imagens serão redimensionadas e otimizadas automaticamente.</p>
              </CollapsibleContent>
            </Collapsible>
          )}

          {!hasFields && !hasSlots && (
            <p className="text-xs text-muted-foreground">Este bloco não possui campos editáveis.</p>
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
              Selecione um pacote cadastrado no sistema para adicionar à tabela.
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

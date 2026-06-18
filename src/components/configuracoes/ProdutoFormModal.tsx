/**
 * Modal para formulário de produto - substitui edição inline
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calcularMargemLucro } from '@/utils/productUtils';
import { formatarMoeda } from '@/utils/precificacaoUtils';
import { useCurrencyInput } from '@/hooks/useCurrencyInput';
import { EtiquetaChip } from '@/components/ui/etiqueta-chip';
import { ProdutoEtiquetasPopover } from './ProdutoEtiquetasPopover';
import { Button as UiButton } from '@/components/ui/button';
import type { Produto, ProdutoEtiqueta } from '@/types/configuration';

interface ProdutoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto?: Produto | null;
  onSave: (id: string, dados: Partial<Produto>) => Promise<void>;
  etiquetas?: ProdutoEtiqueta[];
  selectedEtiquetaIds?: string[];
  onChangeEtiquetas?: (ids: string[]) => void;
}

export default function ProdutoFormModal({
  open,
  onOpenChange,
  produto,
  onSave,
  etiquetas = [],
  selectedEtiquetaIds = [],
  onChangeEtiquetas,
}: ProdutoFormModalProps) {
  const [formData, setFormData] = useState({
    nome: '',
    preco_custo: 0,
    preco_venda: 0,
    favorito: false,
  });

  const custoInput = useCurrencyInput({
    value: formData.preco_custo,
    onChange: (v) => setFormData(prev => ({ ...prev, preco_custo: v }))
  });

  const vendaInput = useCurrencyInput({
    value: formData.preco_venda,
    onChange: (v) => setFormData(prev => ({ ...prev, preco_venda: v }))
  });

  useEffect(() => {
    if (produto && open) {
      setFormData({
        nome: produto.nome,
        preco_custo: produto.preco_custo,
        preco_venda: produto.preco_venda,
        favorito: !!produto.favorito,
      });
    } else if (!open) {
      setFormData({ nome: '', preco_custo: 0, preco_venda: 0, favorito: false });
    }
  }, [produto, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!produto?.id) return;
    try {
      await onSave(produto.id, formData);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
    }
  };

  const selectedEtiquetas = etiquetas.filter(e => selectedEtiquetaIds.includes(e.id));
  const margem = calcularMargemLucro(formData.preco_custo, formData.preco_venda);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Produto</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Produto</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              placeholder="Nome do produto"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="custo">Preço de Custo (R$)</Label>
              <Input id="custo" {...custoInput.inputProps} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venda">Preço de Venda (R$)</Label>
              <Input id="venda" {...vendaInput.inputProps} placeholder="0,00" />
            </div>
          </div>

          {/* Favorito */}
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, favorito: !prev.favorito }))}
            aria-pressed={formData.favorito}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md border transition-colors text-sm',
              formData.favorito
                ? 'border-amber-500/40 bg-amber-500/10 text-foreground'
                : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
            )}
          >
            <Star className={cn('h-4 w-4', formData.favorito && 'fill-amber-400 text-amber-500')} />
            {formData.favorito ? 'Marcado como favorito' : 'Marcar como favorito'}
          </button>

          {/* Etiquetas */}
          {produto && onChangeEtiquetas && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Etiquetas</Label>
                <ProdutoEtiquetasPopover
                  produtoId={produto.id}
                  etiquetas={etiquetas}
                  selectedIds={selectedEtiquetaIds}
                  onChange={onChangeEtiquetas}
                  align="end"
                  trigger={
                    <UiButton type="button" variant="outline" size="sm" className="h-7 text-xs">
                      Gerenciar
                    </UiButton>
                  }
                />
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[28px] p-2 rounded-md border border-dashed border-border">
                {selectedEtiquetas.length === 0 ? (
                  <span className="text-xs text-muted-foreground self-center">Nenhuma etiqueta atribuída</span>
                ) : (
                  selectedEtiquetas.map(et => (
                    <EtiquetaChip
                      key={et.id}
                      etiqueta={et}
                      size="xs"
                      onRemove={() => onChangeEtiquetas(selectedEtiquetaIds.filter(id => id !== et.id))}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {formData.preco_venda > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Margem de Lucro:</span>
                <span className={`font-medium ${margem.classe}`}>
                  {margem.porcentagem === 'N/A'
                    ? 'N/A'
                    : `${formatarMoeda(margem.valor)} (${margem.porcentagem})`
                  }
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">Salvar Alterações</Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Modal para formulário de produto - substitui edição inline
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { calcularMargemLucro } from '@/utils/productUtils';
import { formatarMoeda } from '@/utils/precificacaoUtils';
import type { Produto } from '@/types/configuration';

interface ProdutoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto?: Produto | null;
  onSave: (id: string, dados: Partial<Produto>) => Promise<void>;
}

export default function ProdutoFormModal({
  open,
  onOpenChange,
  produto,
  onSave
}: ProdutoFormModalProps) {
  const [formData, setFormData] = useState({
    nome: '',
    preco_custo: 0,
    preco_venda: 0
  });

  useEffect(() => {
    if (produto && open) {
      setFormData({
        nome: produto.nome,
        preco_custo: produto.preco_custo,
        preco_venda: produto.preco_venda
      });
    } else if (!open) {
      setFormData({
        nome: '',
        preco_custo: 0,
        preco_venda: 0
      });
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
      // Error toast já mostrado pelo context, modal permanece aberto
    }
  };

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
              <Input
                id="custo"
                type="number"
                step="0.01"
                min="0"
                value={formData.preco_custo || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  preco_custo: Number(e.target.value) 
                }))}
                placeholder="0,00"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="venda">Preço de Venda (R$)</Label>
              <Input
                id="venda"
                type="number"
                step="0.01"
                min="0"
                value={formData.preco_venda || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  preco_venda: Number(e.target.value) 
                }))}
                placeholder="0,00"
              />
            </div>
          </div>
          
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
            <Button type="submit" className="flex-1">
              Salvar Alterações
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
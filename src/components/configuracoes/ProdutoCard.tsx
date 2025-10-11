/**
 * Card de produto memoizado para performance
 */

import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Edit, Trash2 } from 'lucide-react';
import { formatarMoeda } from '@/utils/precificacaoUtils';
import type { Produto } from '@/types/configuration';
import type { MargemLucro } from '@/utils/productUtils';

interface ProdutoCardProps {
  produto: Produto;
  margem: MargemLucro;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  isDeleting?: boolean;
}

const ProdutoCard = memo(({
  produto,
  margem,
  onEdit,
  onDelete,
  canDelete,
  isDeleting = false
}: ProdutoCardProps) => {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{produto.nome}</h4>
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => onEdit(produto.id)}
                disabled={isDeleting}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 text-red-500 hover:text-red-600 hover:border-red-200" 
                onClick={() => onDelete(produto.id)}
                disabled={!canDelete || isDeleting}
                title={!canDelete ? 'Produto usado em pacotes' : 'Remover produto'}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block text-xs">Custo</span>
              <span className="font-medium">{formatarMoeda(produto.preco_custo)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Venda</span>
              <span className="font-medium">
                {produto.preco_venda ? formatarMoeda(produto.preco_venda) : 'Não definido'}
              </span>
            </div>
          </div>
          
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground text-xs">Margem de Lucro</span>
              <span className={`font-medium ${margem.classe}`}>
                {margem.porcentagem === 'N/A' 
                  ? 'N/A' 
                  : `${formatarMoeda(margem.valor)} (${margem.porcentagem})`
                }
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ProdutoCard.displayName = 'ProdutoCard';

export default ProdutoCard;
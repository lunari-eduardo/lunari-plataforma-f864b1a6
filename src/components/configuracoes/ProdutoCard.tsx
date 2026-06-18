/**
 * Card de produto memoizado para performance
 */

import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatarMoeda } from '@/utils/precificacaoUtils';
import { FavoriteStarToggle } from '@/components/ui/favorite-star-toggle';
import { EtiquetaChip } from '@/components/ui/etiqueta-chip';
import { ProdutoEtiquetasPopover } from './ProdutoEtiquetasPopover';
import type { Produto, ProdutoEtiqueta } from '@/types/configuration';
import type { MargemLucro } from '@/utils/productUtils';

interface ProdutoCardProps {
  produto: Produto;
  margem: MargemLucro;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorito: () => void;
  etiquetas: ProdutoEtiqueta[];
  selectedEtiquetaIds: string[];
  onChangeEtiquetas: (ids: string[]) => void;
  canDelete: boolean;
  isDeleting?: boolean;
}

const ProdutoCard = memo(({
  produto,
  margem,
  onEdit,
  onDelete,
  onToggleFavorito,
  etiquetas,
  selectedEtiquetaIds,
  onChangeEtiquetas,
  canDelete,
  isDeleting = false
}: ProdutoCardProps) => {
  return (
    <Card data-produto-id={produto.id} className={cn('overflow-hidden relative', produto.favorito && 'bg-amber-500/[0.04]')}>
      {produto.favorito && (
        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400/60" aria-hidden />
      )}
      <CardContent className="p-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <FavoriteStarToggle favorito={!!produto.favorito} onToggle={onToggleFavorito} size="sm" />
              <h4 className="text-sm font-semibold truncate">{produto.nome}</h4>
            </div>
            <div className="flex gap-1 shrink-0">
              <ProdutoEtiquetasPopover
                produtoId={produto.id}
                etiquetas={etiquetas}
                selectedIds={selectedEtiquetaIds}
                onChange={onChangeEtiquetas}
              />
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onEdit(produto.id)} disabled={isDeleting}>
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

          {(produto.etiquetas?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1">
              {produto.etiquetas!.map(et => (
                <EtiquetaChip key={et.id} etiqueta={et} size="xs" />
              ))}
            </div>
          )}

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

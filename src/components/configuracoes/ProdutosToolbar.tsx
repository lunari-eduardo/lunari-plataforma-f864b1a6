import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Star, X, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EtiquetaChip } from '@/components/ui/etiqueta-chip';
import type { ProdutoEtiqueta } from '@/types/configuration';

interface ProdutosToolbarProps {
  query: string;
  onQueryChange: (q: string) => void;
  etiquetas: ProdutoEtiqueta[];
  selectedEtiquetaIds: string[];
  onToggleEtiqueta: (id: string) => void;
  contagemPorEtiqueta: Map<string, number>;
  onlyFavoritos: boolean;
  onToggleOnlyFavoritos: () => void;
  onOpenManager: () => void;
  totalProdutos: number;
  totalFiltrados: number;
}

export default function ProdutosToolbar({
  query,
  onQueryChange,
  etiquetas,
  selectedEtiquetaIds,
  onToggleEtiqueta,
  contagemPorEtiqueta,
  onlyFavoritos,
  onToggleOnlyFavoritos,
  onOpenManager,
  totalProdutos,
  totalFiltrados,
}: ProdutosToolbarProps) {
  const hasAnyFilter = query.length > 0 || selectedEtiquetaIds.length > 0 || onlyFavoritos;
  const clearAll = () => {
    onQueryChange('');
    selectedEtiquetaIds.forEach(onToggleEtiqueta);
    if (onlyFavoritos) onToggleOnlyFavoritos();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Buscar produto..."
            className="pl-8 h-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Button
          type="button"
          variant={onlyFavoritos ? 'default' : 'outline'}
          size="sm"
          className="h-9"
          onClick={onToggleOnlyFavoritos}
          aria-pressed={onlyFavoritos}
        >
          <Star className={cn('h-4 w-4 mr-1.5', onlyFavoritos && 'fill-current')} />
          Só favoritos
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={onOpenManager}
        >
          <Settings2 className="h-4 w-4 mr-1.5" />
          Gerenciar etiquetas
        </Button>
      </div>

      {etiquetas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Etiquetas:</span>
          {etiquetas.map(et => (
            <EtiquetaChip
              key={et.id}
              etiqueta={et}
              size="sm"
              active={selectedEtiquetaIds.includes(et.id)}
              onClick={() => onToggleEtiqueta(et.id)}
              count={contagemPorEtiqueta.get(et.id) ?? 0}
            />
          ))}
          {hasAnyFilter && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-1"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {hasAnyFilter && (
        <div className="text-xs text-muted-foreground">
          Mostrando <span className="font-medium text-foreground">{totalFiltrados}</span> de {totalProdutos} produtos
        </div>
      )}
    </div>
  );
}

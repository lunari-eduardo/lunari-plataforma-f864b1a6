import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, ArrowUp, ArrowDown, Filter, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SituacaoFilter = 'todos' | 'pago' | 'parcial' | 'pendente';

interface WorkflowFiltersProps {
  // Ordenação
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: string, direction: 'asc' | 'desc') => void;
  
  // Filtro categoria
  categoryFilter: string;
  onCategoryFilterChange: (categoria: string) => void;
  categoryOptions: { id: string; nome: string }[];

  // Filtro situação financeira
  situacaoFilter: SituacaoFilter;
  onSituacaoFilterChange: (situacao: SituacaoFilter) => void;
}

const SITUACAO_LABELS: Record<SituacaoFilter, string> = {
  todos: 'Situação',
  pago: 'Pagas',
  parcial: 'Parciais',
  pendente: 'Pendentes',
};

export function WorkflowFilters({
  sortField,
  sortDirection,
  onSortChange,
  categoryFilter,
  onCategoryFilterChange,
  categoryOptions,
  situacaoFilter,
  onSituacaoFilterChange,
}: WorkflowFiltersProps) {
  const isActive = (field: string) => sortField === field;
  const situacaoActive = situacaoFilter !== 'todos' || isActive('situacao');

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Data */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 text-xs gap-1 px-2",
              isActive('date') && "bg-primary/10 text-primary"
            )}
          >
            Data
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[140px]">
          <DropdownMenuItem onClick={() => onSortChange('date', 'desc')}>
            <ArrowDown className="h-3 w-3 mr-2" />
            Mais recentes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange('date', 'asc')}>
            <ArrowUp className="h-3 w-3 mr-2" />
            Mais antigas
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Nome */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 text-xs gap-1 px-2",
              isActive('nome') && "bg-primary/10 text-primary"
            )}
          >
            Nome
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[120px]">
          <DropdownMenuItem onClick={() => onSortChange('nome', 'asc')}>
            <ArrowUp className="h-3 w-3 mr-2" />
            A → Z
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange('nome', 'desc')}>
            <ArrowDown className="h-3 w-3 mr-2" />
            Z → A
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Status */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 text-xs gap-1 px-2",
              isActive('status') && "bg-primary/10 text-primary"
            )}
          >
            Status
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[120px]">
          <DropdownMenuItem onClick={() => onSortChange('status', 'asc')}>
            <ArrowUp className="h-3 w-3 mr-2" />
            A → Z
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange('status', 'desc')}>
            <ArrowDown className="h-3 w-3 mr-2" />
            Z → A
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Situação Financeira (Filtro + Ordenação) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 text-xs gap-1 px-2",
              situacaoActive && "bg-primary/10 text-primary"
            )}
          >
            {situacaoFilter !== 'todos' ? (
              <>
                <Filter className="h-3 w-3" />
                Situação: {SITUACAO_LABELS[situacaoFilter]}
              </>
            ) : (
              'Situação'
            )}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Mostrar
          </DropdownMenuLabel>
          {(['todos', 'pago', 'parcial', 'pendente'] as SituacaoFilter[]).map(opt => (
            <DropdownMenuItem
              key={opt}
              onClick={() => onSituacaoFilterChange(opt)}
              className="flex items-center justify-between"
            >
              <span>
                {opt === 'todos' ? 'Todas' : SITUACAO_LABELS[opt]}
              </span>
              {situacaoFilter === opt && <Check className="h-3 w-3 text-primary" />}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Ordenar
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onSortChange('situacao', 'asc')}>
            <ArrowUp className="h-3 w-3 mr-2" />
            Pago primeiro
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange('situacao', 'desc')}>
            <ArrowDown className="h-3 w-3 mr-2" />
            Pendente primeiro
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Categoria (Filtro) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 text-xs gap-1 px-2",
              categoryFilter && "bg-primary/10 text-primary"
            )}
          >
            <Filter className="h-3 w-3" />
            {categoryFilter || 'Categoria'}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[140px]">
          <DropdownMenuItem onClick={() => onCategoryFilterChange('')}>
            Todas
          </DropdownMenuItem>
          {categoryOptions.map(cat => (
            <DropdownMenuItem 
              key={cat.id} 
              onClick={() => onCategoryFilterChange(cat.nome)}
            >
              {cat.nome}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Limpar filtros - só aparece quando há filtro ativo */}
      {(sortField || categoryFilter || situacaoFilter !== 'todos') && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            onSortChange('', 'asc');
            onCategoryFilterChange('');
            onSituacaoFilterChange('todos');
          }}
        >
          Limpar
        </Button>
      )}
    </div>
  );
}

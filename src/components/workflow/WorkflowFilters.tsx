import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, ArrowUp, ArrowDown, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowFiltersProps {
  // Ordenação
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: string, direction: 'asc' | 'desc') => void;
  
  // Filtro categoria
  categoryFilter: string;
  onCategoryFilterChange: (categoria: string) => void;
  categoryOptions: { id: string; nome: string }[];
}

export function WorkflowFilters({
  sortField,
  sortDirection,
  onSortChange,
  categoryFilter,
  onCategoryFilterChange,
  categoryOptions
}: WorkflowFiltersProps) {
  const isActive = (field: string) => sortField === field;

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

      {/* Situação Financeira */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 text-xs gap-1 px-2",
              isActive('situacao') && "bg-primary/10 text-primary"
            )}
          >
            Situação
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[160px]">
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
      {(sortField || categoryFilter) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            onSortChange('', 'asc');
            onCategoryFilterChange('');
          }}
        >
          Limpar
        </Button>
      )}
    </div>
  );
}

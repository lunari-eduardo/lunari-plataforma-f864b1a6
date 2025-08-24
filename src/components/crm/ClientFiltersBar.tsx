import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  SelectModal as Select, 
  SelectModalContent as SelectContent, 
  SelectModalItem as SelectItem, 
  SelectModalTrigger as SelectTrigger, 
  SelectModalValue as SelectValue 
} from '@/components/ui/select-in-modal';
import { Badge } from "@/components/ui/badge";
import { Search, User, DollarSign, CheckCircle, Clock, X, Filter, SlidersHorizontal } from "lucide-react";
import { useDialogDropdownContext } from "@/components/ui/dialog";

export interface ClientFilters {
  filtro: string;
  statusFilter: string;
  faturadoFilter: string;
  pagoFilter: string;
  receberFilter: string;
}

interface ClientFiltersBarProps {
  filters: ClientFilters;
  onFiltersChange: (filters: ClientFilters) => void;
  totalClients: number;
  filteredClients: number;
}

export function ClientFiltersBar({
  filters,
  onFiltersChange,
  totalClients,
  filteredClients
}: ClientFiltersBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const dropdownContext = useDialogDropdownContext();

  const updateFilter = (key: keyof ClientFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      filtro: '',
      statusFilter: 'todos',
      faturadoFilter: 'todos',
      pagoFilter: 'todos',
      receberFilter: 'todos'
    });
  };

  const handleSelectOpenChange = (open: boolean, selectType: string) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [selectType]: open
    }));
    dropdownContext?.setHasOpenDropdown(Object.values({...openDropdowns, [selectType]: open}).some(Boolean));
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.filtro) count++;
    if (filters.statusFilter && filters.statusFilter !== 'todos') count++;
    if (filters.faturadoFilter && filters.faturadoFilter !== 'todos') count++;
    if (filters.pagoFilter && filters.pagoFilter !== 'todos') count++;
    if (filters.receberFilter && filters.receberFilter !== 'todos') count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  const filterOptions = {
    status: [
      { value: 'todos', label: 'Todos os Status' },
      { value: 'ativo', label: 'Ativo' },
      { value: 'inativo', label: 'Inativo' }
    ],
    faturado: [
      { value: 'todos', label: 'Todos os Valores' },
      { value: 'baixo', label: 'Até R$ 1.000' },
      { value: 'medio', label: 'R$ 1.000 - R$ 5.000' },
      { value: 'alto', label: 'Acima de R$ 5.000' }
    ]
  };

  return (
    <div className="space-y-4">
      {/* Mobile Toggle Button */}
      <div className="md:hidden flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-xs"
        >
          <SlidersHorizontal className="h-3 w-3" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-2xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
        
        <div className="text-xs text-muted-foreground">
          {filteredClients} de {totalClients} clientes
        </div>
      </div>

      {/* Desktop Always Visible / Mobile Expandable */}
      <div className={`space-y-3 ${!isExpanded ? 'hidden md:block' : 'block'}`}>
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome, email ou telefone..." 
            className="pl-9 h-9" 
            value={filters.filtro} 
            onChange={(e) => updateFilter('filtro', e.target.value)} 
          />
          {filters.filtro && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => updateFilter('filtro', '')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Status Filter */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <User className="h-3 w-3" />
              Status do Cliente
            </div>
            <Select 
              value={filters.statusFilter} 
              onValueChange={(value) => updateFilter('statusFilter', value)}
              onOpenChange={(open) => handleSelectOpenChange(open, 'status')}
            >
              <SelectTrigger className={`h-9 ${filters.statusFilter !== 'todos' ? 'ring-1 ring-primary bg-primary/5' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.status.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Total Faturado Filter */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              Total Faturado
            </div>
            <Select 
              value={filters.faturadoFilter} 
              onValueChange={(value) => updateFilter('faturadoFilter', value)}
              onOpenChange={(open) => handleSelectOpenChange(open, 'faturado')}
            >
              <SelectTrigger className={`h-9 ${filters.faturadoFilter !== 'todos' ? 'ring-1 ring-primary bg-primary/5' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.faturado.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Total Pago Filter */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CheckCircle className="h-3 w-3" />
              Total Pago
            </div>
            <Select 
              value={filters.pagoFilter} 
              onValueChange={(value) => updateFilter('pagoFilter', value)}
              onOpenChange={(open) => handleSelectOpenChange(open, 'pago')}
            >
              <SelectTrigger className={`h-9 ${filters.pagoFilter !== 'todos' ? 'ring-1 ring-primary bg-primary/5' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.faturado.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* A Receber Filter */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="h-3 w-3" />
              Valor a Receber
            </div>
            <Select 
              value={filters.receberFilter} 
              onValueChange={(value) => updateFilter('receberFilter', value)}
              onOpenChange={(open) => handleSelectOpenChange(open, 'receber')}
            >
              <SelectTrigger className={`h-9 ${filters.receberFilter !== 'todos' ? 'ring-1 ring-primary bg-primary/5' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.faturado.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {activeFiltersCount > 0 && (
              <>
                <span className="text-xs text-muted-foreground">Filtros ativos:</span>
                {filters.filtro && (
                  <Badge variant="secondary" className="text-xs">
                    Busca: "{filters.filtro.length > 20 ? filters.filtro.substring(0, 20) + '...' : filters.filtro}"
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-1 h-3 w-3 p-0 hover:bg-transparent"
                      onClick={() => updateFilter('filtro', '')}
                    >
                      <X className="h-2 w-2" />
                    </Button>
                  </Badge>
                )}
                {filters.statusFilter !== 'todos' && (
                  <Badge variant="secondary" className="text-xs">
                    Status: {filterOptions.status.find(opt => opt.value === filters.statusFilter)?.label}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-1 h-3 w-3 p-0 hover:bg-transparent"
                      onClick={() => updateFilter('statusFilter', 'todos')}
                    >
                      <X className="h-2 w-2" />
                    </Button>
                  </Badge>
                )}
                {filters.faturadoFilter !== 'todos' && (
                  <Badge variant="secondary" className="text-xs">
                    Faturado: {filterOptions.faturado.find(opt => opt.value === filters.faturadoFilter)?.label}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-1 h-3 w-3 p-0 hover:bg-transparent"
                      onClick={() => updateFilter('faturadoFilter', 'todos')}
                    >
                      <X className="h-2 w-2" />
                    </Button>
                  </Badge>
                )}
                {filters.pagoFilter !== 'todos' && (
                  <Badge variant="secondary" className="text-xs">
                    Pago: {filterOptions.faturado.find(opt => opt.value === filters.pagoFilter)?.label}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-1 h-3 w-3 p-0 hover:bg-transparent"
                      onClick={() => updateFilter('pagoFilter', 'todos')}
                    >
                      <X className="h-2 w-2" />
                    </Button>
                  </Badge>
                )}
                {filters.receberFilter !== 'todos' && (
                  <Badge variant="secondary" className="text-xs">
                    A Receber: {filterOptions.faturado.find(opt => opt.value === filters.receberFilter)?.label}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-1 h-3 w-3 p-0 hover:bg-transparent"
                      onClick={() => updateFilter('receberFilter', 'todos')}
                    >
                      <X className="h-2 w-2" />
                    </Button>
                  </Badge>
                )}
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="hidden md:block text-xs text-muted-foreground">
              {filteredClients} de {totalClients} clientes
            </div>
            {activeFiltersCount > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearAllFilters}
                className="text-xs"
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
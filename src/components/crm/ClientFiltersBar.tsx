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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Search, Calendar, X, Filter, SlidersHorizontal } from "lucide-react";
import { useDialogDropdownContext } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRealtimeConfiguration } from "@/hooks/useRealtimeConfiguration";

export interface ClientFilters {
  filtro: string;
  dataInicio: string;
  dataFim: string;
  categoria: string;
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
  
  // Buscar categorias disponíveis
  const { categorias, isLoadingCategorias } = useRealtimeConfiguration();

  const updateFilter = (key: keyof ClientFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      filtro: '',
      dataInicio: '',
      dataFim: '',
      categoria: 'todas'
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
    if (filters.dataInicio) count++;
    if (filters.dataFim) count++;
    if (filters.categoria && filters.categoria !== 'todas') count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Data Início */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Data Início
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`h-9 w-full justify-start text-left font-normal ${
                    filters.dataInicio ? 'ring-1 ring-primary bg-primary/5' : ''
                  }`}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {filters.dataInicio
                    ? format(new Date(filters.dataInicio), "dd/MM/yyyy", { locale: ptBR })
                    : "Selecione..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={filters.dataInicio ? new Date(filters.dataInicio) : undefined}
                  onSelect={(date) => 
                    updateFilter('dataInicio', date ? format(date, 'yyyy-MM-dd') : '')
                  }
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Data Fim */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Data Fim
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`h-9 w-full justify-start text-left font-normal ${
                    filters.dataFim ? 'ring-1 ring-primary bg-primary/5' : ''
                  }`}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {filters.dataFim
                    ? format(new Date(filters.dataFim), "dd/MM/yyyy", { locale: ptBR })
                    : "Selecione..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={filters.dataFim ? new Date(filters.dataFim) : undefined}
                  onSelect={(date) => 
                    updateFilter('dataFim', date ? format(date, 'yyyy-MM-dd') : '')
                  }
                  disabled={(date) => {
                    if (filters.dataInicio) {
                      return date < new Date(filters.dataInicio);
                    }
                    return false;
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Categoria */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Filter className="h-3 w-3" />
              Categoria
            </div>
            <Select 
              value={filters.categoria} 
              onValueChange={(value) => updateFilter('categoria', value)}
              onOpenChange={(open) => handleSelectOpenChange(open, 'categoria')}
              disabled={isLoadingCategorias}
            >
              <SelectTrigger 
                className={`h-9 ${
                  filters.categoria && filters.categoria !== 'todas' 
                    ? 'ring-1 ring-primary bg-primary/5' 
                    : ''
                }`}
              >
                <SelectValue placeholder="Todas as Categorias" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background">
                <SelectItem value="todas">Todas as Categorias</SelectItem>
                {categorias && categorias.length > 0 ? (
                  categorias.map(cat => (
                    <SelectItem key={cat.id} value={cat.nome}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: cat.cor }}
                        />
                        {cat.nome}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="sem-categorias" disabled>
                    Nenhuma categoria cadastrada
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Atalhos de Período */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Atalhos:</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              const hoje = new Date();
              const doisAnosAtras = new Date();
              doisAnosAtras.setFullYear(hoje.getFullYear() - 2);
              
              onFiltersChange({
                ...filters,
                dataInicio: format(doisAnosAtras, 'yyyy-MM-dd'),
                dataFim: format(hoje, 'yyyy-MM-dd')
              });
            }}
          >
            Últimos 2 anos
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              const hoje = new Date();
              const umAnoAtras = new Date();
              umAnoAtras.setFullYear(hoje.getFullYear() - 1);
              
              onFiltersChange({
                ...filters,
                dataInicio: format(umAnoAtras, 'yyyy-MM-dd'),
                dataFim: format(hoje, 'yyyy-MM-dd')
              });
            }}
          >
            Último ano
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              const hoje = new Date();
              const inicioAno = new Date(hoje.getFullYear(), 0, 1);
              
              onFiltersChange({
                ...filters,
                dataInicio: format(inicioAno, 'yyyy-MM-dd'),
                dataFim: format(hoje, 'yyyy-MM-dd')
              });
            }}
          >
            Este ano
          </Button>
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
                {filters.dataInicio && (
                  <Badge variant="secondary" className="text-xs">
                    Início: {format(new Date(filters.dataInicio), "dd/MM/yyyy", { locale: ptBR })}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-1 h-3 w-3 p-0 hover:bg-transparent"
                      onClick={() => updateFilter('dataInicio', '')}
                    >
                      <X className="h-2 w-2" />
                    </Button>
                  </Badge>
                )}
                {filters.dataFim && (
                  <Badge variant="secondary" className="text-xs">
                    Fim: {format(new Date(filters.dataFim), "dd/MM/yyyy", { locale: ptBR })}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-1 h-3 w-3 p-0 hover:bg-transparent"
                      onClick={() => updateFilter('dataFim', '')}
                    >
                      <X className="h-2 w-2" />
                    </Button>
                  </Badge>
                )}
                {filters.categoria && filters.categoria !== 'todas' && (
                  <Badge variant="secondary" className="text-xs">
                    Categoria: {categorias.find(c => c.id === filters.categoria)?.nome || 'N/A'}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-1 h-3 w-3 p-0 hover:bg-transparent"
                      onClick={() => updateFilter('categoria', 'todas')}
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
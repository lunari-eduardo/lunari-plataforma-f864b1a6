import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar, Search, Filter } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import type { PeriodType } from '@/hooks/useLeadMetrics';

export interface UnifiedLeadFiltersProps {
  // Period filter
  periodType: PeriodType;
  onPeriodChange: (periodType: PeriodType) => void;
  
  // Search filters
  searchTerm: string;
  onSearchChange: (search: string) => void;
  origemFilter: string;
  onOrigemChange: (origem: string) => void;
}

const PERIOD_OPTIONS = [
  { value: 'current_year' as PeriodType, label: 'Todos (Ano Atual)' },
  { value: 'january_2025' as PeriodType, label: 'Janeiro 2025' },
  { value: 'february_2025' as PeriodType, label: 'Fevereiro 2025' },
  { value: 'march_2025' as PeriodType, label: 'Março 2025' },
  { value: 'april_2025' as PeriodType, label: 'Abril 2025' },
  { value: 'may_2025' as PeriodType, label: 'Maio 2025' },
  { value: 'june_2025' as PeriodType, label: 'Junho 2025' },
  { value: 'july_2025' as PeriodType, label: 'Julho 2025' },
  { value: 'august_2025' as PeriodType, label: 'Agosto 2025' },
  { value: 'september_2025' as PeriodType, label: 'Setembro 2025' },
  { value: 'october_2025' as PeriodType, label: 'Outubro 2025' },
  { value: 'november_2025' as PeriodType, label: 'Novembro 2025' },
  { value: 'december_2025' as PeriodType, label: 'Dezembro 2025' },
  { value: 'previous_year' as PeriodType, label: 'Ano Anterior' },
  { value: 'all_time' as PeriodType, label: 'Todos (Histórico Completo)' }
];

export default function UnifiedLeadFilters({
  periodType,
  onPeriodChange,
  searchTerm,
  onSearchChange,
  origemFilter,
  onOrigemChange
}: UnifiedLeadFiltersProps) {
  const { origens } = useAppContext();

  return (
    <Card className="p-3 bg-gradient-to-r from-lunar-surface to-lunar-surface/90 border-lunar-border/60 shadow-sm">
      <div className="space-y-3">
        {/* Filtro de Período - Destaca visualmente */}
        <div className="flex items-center gap-2 p-2 rounded-md bg-lunar-accent/10 border border-lunar-accent/20">
          <Calendar className="h-4 w-4 text-lunar-accent flex-shrink-0" />
          <Label className="text-sm font-medium text-lunar-accent whitespace-nowrap flex-shrink-0">
            Período:
          </Label>
          <Select value={periodType} onValueChange={onPeriodChange}>
            <SelectTrigger className="text-sm border-lunar-border/40 focus:border-lunar-accent/50 focus:ring-lunar-accent/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtros de Busca e Origem */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Campo de Busca */}
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-4 w-4 text-lunar-textSecondary flex-shrink-0" />
            <Input
              placeholder="Buscar leads..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="text-sm border-lunar-border/40 focus:border-lunar-accent/50 focus:ring-lunar-accent/20"
            />
          </div>

          {/* Filtro de Origem */}
          <div className="flex items-center gap-2 flex-1 sm:max-w-[200px]">
            <Filter className="h-4 w-4 text-lunar-textSecondary flex-shrink-0" />
            <Select value={origemFilter} onValueChange={onOrigemChange}>
              <SelectTrigger className="text-sm border-lunar-border/40 focus:border-lunar-accent/50 focus:ring-lunar-accent/20">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {origens.map(origem => (
                  <SelectItem key={origem.id} value={origem.nome}>
                    {origem.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </Card>
  );
}
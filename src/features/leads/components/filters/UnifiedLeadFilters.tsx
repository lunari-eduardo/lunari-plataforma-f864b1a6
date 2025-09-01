import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Search, MapPin } from 'lucide-react';
import type { PeriodType } from '@/hooks/useLeadMetrics';
export interface UnifiedLeadFiltersProps {
  periodType: PeriodType;
  onPeriodChange: (periodType: PeriodType) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  originFilter: string;
  onOriginChange: (origin: string) => void;
  origins: Array<{
    id: string;
    nome: string;
  }>;
  isMobile?: boolean;
}
const PERIOD_OPTIONS = [{
  value: 'last_7_days' as PeriodType,
  label: 'Últimos 7 dias'
}, {
  value: 'last_30_days' as PeriodType,
  label: 'Últimos 30 dias' 
}, {
  value: 'last_90_days' as PeriodType,
  label: 'Últimos 90 dias'
}, {
  value: 'current_year' as PeriodType,
  label: 'Ano Atual'
}, {
  value: 'january_2025' as PeriodType,
  label: 'Janeiro 2025'
}, {
  value: 'february_2025' as PeriodType,
  label: 'Fevereiro 2025'
}, {
  value: 'march_2025' as PeriodType,
  label: 'Março 2025'
}, {
  value: 'april_2025' as PeriodType,
  label: 'Abril 2025'
}, {
  value: 'may_2025' as PeriodType,
  label: 'Maio 2025'
}, {
  value: 'june_2025' as PeriodType,
  label: 'Junho 2025'
}, {
  value: 'july_2025' as PeriodType,
  label: 'Julho 2025'
}, {
  value: 'august_2025' as PeriodType,
  label: 'Agosto 2025'
}, {
  value: 'september_2025' as PeriodType,
  label: 'Setembro 2025'
}, {
  value: 'october_2025' as PeriodType,
  label: 'Outubro 2025'
}, {
  value: 'november_2025' as PeriodType,
  label: 'Novembro 2025'
}, {
  value: 'december_2025' as PeriodType,
  label: 'Dezembro 2025'
}, {
  value: 'previous_year' as PeriodType,
  label: 'Ano Anterior'
}, {
  value: 'archived' as PeriodType,
  label: '📁 Arquivados'
}, {
  value: 'all_active' as PeriodType,
  label: 'Todos Ativos'
}, {
  value: 'all_time' as PeriodType,
  label: 'Histórico Completo'
}];
export default function UnifiedLeadFilters({
  periodType,
  onPeriodChange,
  searchTerm,
  onSearchChange,
  originFilter,
  onOriginChange,
  origins,
  isMobile = false
}: UnifiedLeadFiltersProps) {
  return <Card className={`${isMobile ? 'p-2 py-1' : 'p-3 py-px'} bg-gradient-to-r from-lunar-surface to-lunar-surface/90 border-lunar-border/60 shadow-sm`}>
      {/* Desktop Layout */}
      <div className="hidden md:flex items-center gap-4">
        {/* Period Filter with highlight */}
        <div className="flex items-center gap-2 px-3 rounded-lg bg-lunar-accent/10 border border-lunar-accent/20 shadow-sm py-[5px]">
          <Calendar className="h-4 w-4 text-lunar-accent" />
          
          <Select value={periodType} onValueChange={onPeriodChange}>
            <SelectTrigger className="w-[180px] text-sm border-lunar-border/40 focus:border-lunar-accent/50 focus:ring-lunar-accent/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        
        {/* Search Filter */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="h-4 w-4 text-lunar-textSecondary" />
          <Input placeholder="Buscar leads..." value={searchTerm} onChange={e => onSearchChange(e.target.value)} className="text-sm border-lunar-border/40" />
        </div>
        
        {/* Origin Filter */}
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-lunar-textSecondary" />
          <Select value={originFilter} onValueChange={onOriginChange}>
            <SelectTrigger className="w-[150px] text-sm border-lunar-border/40">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {origins.map(origem => <SelectItem key={origem.id} value={origem.nome}>
                  {origem.nome}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mobile Layout - More Compact */}
      <div className={`md:hidden ${isMobile ? 'space-y-1.5' : 'space-y-3'}`}>
        {/* Period Filter with highlight - More compact */}
        <div className={`flex items-center gap-2 rounded-lg bg-lunar-accent/10 border border-lunar-accent/20 shadow-sm ${isMobile ? 'px-2 py-1' : 'px-3 py-2'}`}>
          <Calendar className={`text-lunar-accent ${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
          <Label className={`font-medium text-lunar-accent whitespace-nowrap ${isMobile ? 'text-xs' : 'text-sm'}`}>
            Período:
          </Label>
          <Select value={periodType} onValueChange={onPeriodChange}>
            <SelectTrigger className={`flex-1 border-lunar-border/40 focus:border-lunar-accent/50 focus:ring-lunar-accent/20 ${isMobile ? 'text-xs h-7' : 'text-sm'}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        
        {/* Search and Origin in same row on mobile - More compact */}
        <div className={`grid grid-cols-2 ${isMobile ? 'gap-1' : 'gap-2'}`}>
          <div className="flex items-center gap-1">
            <Search className={`text-lunar-textSecondary flex-shrink-0 ${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
            <Input 
              placeholder="Buscar..." 
              value={searchTerm} 
              onChange={e => onSearchChange(e.target.value)} 
              className={`border-lunar-border/40 ${isMobile ? 'text-xs h-7' : 'text-sm'}`} 
            />
          </div>
          
          <div className="flex items-center gap-1">
            <MapPin className={`text-lunar-textSecondary flex-shrink-0 ${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
            <Select value={originFilter} onValueChange={onOriginChange}>
              <SelectTrigger className={`border-lunar-border/40 ${isMobile ? 'text-xs h-7' : 'text-sm'}`}>
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {origins.map(origem => <SelectItem key={origem.id} value={origem.nome}>
                    {origem.nome}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </Card>;
}
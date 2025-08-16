import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from 'lucide-react';
import type { PeriodType } from '@/hooks/useLeadMetrics';

export interface PeriodFilterProps {
  periodType: PeriodType;
  onPeriodChange: (periodType: PeriodType) => void;
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

export default function LeadPeriodFilter({
  periodType,
  onPeriodChange
}: PeriodFilterProps) {
  return (
    <Card className="p-3 bg-lunar-surface border-lunar-border/60">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-lunar-textSecondary" />
        <Label className="text-sm font-medium text-lunar-text whitespace-nowrap">
          Período:
        </Label>
        
        <Select value={periodType} onValueChange={onPeriodChange}>
          <SelectTrigger className="w-[200px] text-sm">
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
    </Card>
  );
}
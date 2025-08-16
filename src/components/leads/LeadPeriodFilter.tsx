import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CalendarDays, Clock } from 'lucide-react';

export interface PeriodFilterProps {
  selectedMonth?: number;
  selectedYear?: number;
  dateType: 'criacao' | 'atualizacao';
  onMonthChange: (month?: number) => void;
  onYearChange: (year?: number) => void;
  onDateTypeChange: (type: 'criacao' | 'atualizacao') => void;
}

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' }
];

// Gerar anos (2023-2030)
const YEARS = Array.from({ length: 8 }, (_, i) => 2023 + i);

export default function LeadPeriodFilter({
  selectedMonth,
  selectedYear,
  dateType,
  onMonthChange,
  onYearChange,
  onDateTypeChange
}: PeriodFilterProps) {
  return (
    <Card className="p-3 bg-lunar-surface border-lunar-border/60">
      <div className="flex flex-wrap gap-4 items-center">
        {/* Seletor de Período */}
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium text-lunar-text whitespace-nowrap">
            Período:
          </Label>
          
          <Select 
            value={selectedMonth?.toString() || 'all'} 
            onValueChange={(value) => onMonthChange(value === 'all' ? undefined : parseInt(value))}
          >
            <SelectTrigger className="w-[120px] text-xs">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {MONTHS.map(month => (
                <SelectItem key={month.value} value={month.value.toString()}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={selectedYear?.toString() || 'all'} 
            onValueChange={(value) => onYearChange(value === 'all' ? undefined : parseInt(value))}
          >
            <SelectTrigger className="w-[80px] text-xs">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {YEARS.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Toggle Tipo de Data */}
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium text-lunar-text whitespace-nowrap">
            Filtrar por:
          </Label>
          
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3 w-3 text-lunar-textSecondary" />
            <Label htmlFor="date-type-toggle" className="text-xs text-lunar-textSecondary">
              Criação
            </Label>
            <Switch
              id="date-type-toggle"
              checked={dateType === 'atualizacao'}
              onCheckedChange={(checked) => onDateTypeChange(checked ? 'atualizacao' : 'criacao')}
              className="scale-75"
            />
            <Label htmlFor="date-type-toggle" className="text-xs text-lunar-textSecondary">
              Atualização
            </Label>
            <Clock className="h-3 w-3 text-lunar-textSecondary" />
          </div>
        </div>
      </div>
    </Card>
  );
}
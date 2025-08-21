import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
interface SalesMonthYearFilterProps {
  selectedMonth: Date | null;
  selectedCategory: string;
  availableYears: number[];
  availableCategories: string[];
  onMonthChange: (month: Date | null) => void;
  onCategoryChange: (category: string) => void;
}
export default function SalesMonthYearFilter({
  selectedMonth,
  selectedCategory,
  availableYears,
  availableCategories,
  onMonthChange,
  onCategoryChange
}: SalesMonthYearFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigateMonth = (direction: 'prev' | 'next') => {
    if (!selectedMonth) return;
    const newDate = new Date(selectedMonth);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    onMonthChange(newDate);
  };
  const clearMonthFilter = () => {
    onMonthChange(null);
  };
  return <div className="sticky top-0 z-50 bg-lunar-bg border-b border-lunar-border shadow-sm">
      <div className="p-4 space-y-4 py-[10px]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-lunar-text">Análise de Vendas</h1>
            <p className="text-xs text-lunar-textSecondary">
              {selectedMonth ? `Análise detalhada de ${format(selectedMonth, "MMMM 'de' yyyy", {
              locale: ptBR
            })}` : "Acompanhe o desempenho das suas vendas e alcance suas metas"}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Month/Year Selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')} disabled={!selectedMonth} className="h-8 w-8 p-0">
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("min-w-[160px] justify-start text-left font-normal h-8", !selectedMonth && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedMonth ? format(selectedMonth, "MMM yyyy", {
                    locale: ptBR
                  }) : "Selecionar mês"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={selectedMonth || undefined} onSelect={date => {
                  if (date) {
                    onMonthChange(date);
                    setIsOpen(false);
                  }
                }} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>

              <Button variant="outline" size="sm" onClick={() => navigateMonth('next')} disabled={!selectedMonth} className="h-8 w-8 p-0">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {selectedMonth && <Button variant="ghost" size="sm" onClick={clearMonthFilter} className="h-8 text-xs flex items-center gap-1">
                <X className="h-3 w-3" />
                Ano completo
              </Button>}
          </div>

          {/* Category Filter */}
          <Select value={selectedCategory} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-[160px] h-8">
              <SelectValue placeholder="Todas categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {availableCategories.map(category => <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>)}
            </SelectContent>
          </Select>

          {/* Reset Filters */}
          {(selectedMonth || selectedCategory !== 'all') && <Button variant="outline" size="sm" onClick={() => {
          onMonthChange(null);
          onCategoryChange('all');
        }} className="h-8 text-xs">
              Limpar filtros
            </Button>}
        </div>
      </div>
    </div>;
}
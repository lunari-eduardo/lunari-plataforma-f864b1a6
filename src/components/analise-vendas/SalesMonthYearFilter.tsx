import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';

interface SalesMonthYearFilterProps {
  selectedYear: number;
  selectedMonth: number | null; // null means "all months", 0-11 for specific months
  selectedCategory: string;
  availableYears: number[];
  availableCategories: string[];
  onYearChange: (year: number) => void;
  onMonthChange: (month: number | null) => void;
  onCategoryChange: (category: string) => void;
}

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function SalesMonthYearFilter({
  selectedYear,
  selectedMonth,
  selectedCategory,
  availableYears,
  availableCategories,
  onYearChange,
  onMonthChange,
  onCategoryChange
}: SalesMonthYearFilterProps) {
  const clearFilters = () => {
    onMonthChange(null);
    onCategoryChange('all');
  };

  const hasFilters = selectedMonth !== null || selectedCategory !== 'all';

  return (
    <div className="sticky top-0 z-50 bg-lunar-bg border-b border-lunar-border shadow-sm">
      <div className="p-4 space-y-4 py-[10px]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-xs text-lunar-textSecondary py-0 my-0">
              {selectedMonth !== null 
                ? `Análise detalhada de ${months[selectedMonth]} de ${selectedYear}`
                : "Acompanhe o desempenho das suas vendas e alcance suas metas"
              }
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Year Selector */}
          <Select value={selectedYear.toString()} onValueChange={(value) => onYearChange(parseInt(value))}>
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue placeholder="Selecionar ano" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Month Selector */}
          <Select 
            value={selectedMonth === null ? 'all' : selectedMonth.toString()} 
            onValueChange={(value) => onMonthChange(value === 'all' ? null : parseInt(value))}
          >
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="Todos os meses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {months.map((month, index) => (
                <SelectItem key={index} value={index.toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={selectedCategory} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-[160px] h-8">
              <SelectValue placeholder="Todas categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {availableCategories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Reset Filters */}
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="h-8 text-xs flex items-center gap-1">
              <X className="h-3 w-3" />
              Limpar filtros
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
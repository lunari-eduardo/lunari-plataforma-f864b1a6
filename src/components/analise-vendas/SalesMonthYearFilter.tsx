import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';

interface SalesMonthYearFilterProps {
  selectedYear: number;
  selectedMonth: number | null;
  selectedCategory: string;
  availableYears: number[];
  availableCategories: string[];
  onYearChange: (year: number) => void;
  onMonthChange: (month: number | null) => void;
  onCategoryChange: (category: string) => void;
}

const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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
    <div className="sticky top-0 z-50 bg-lunar-bg/95 backdrop-blur-sm border-b border-lunar-border/50">
      <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto">
        {/* Year */}
        <Select value={selectedYear.toString()} onValueChange={value => onYearChange(parseInt(value))}>
          <SelectTrigger className="w-[90px] h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map(year => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Month */}
        <Select 
          value={selectedMonth === null ? 'all' : selectedMonth.toString()} 
          onValueChange={value => onMonthChange(value === 'all' ? null : parseInt(value))}
        >
          <SelectTrigger className="w-[100px] h-7 text-xs">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {months.map((month, index) => (
              <SelectItem key={index} value={index.toString()}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category */}
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-[120px] h-7 text-xs">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {availableCategories.map(category => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear */}
        {hasFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters} 
            className="h-7 w-7 p-0 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

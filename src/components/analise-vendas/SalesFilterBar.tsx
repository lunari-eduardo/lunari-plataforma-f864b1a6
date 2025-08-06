import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter, X } from 'lucide-react';

interface SalesFilterBarProps {
  selectedYear: number;
  selectedCategory: string;
  availableYears: number[];
  availableCategories: string[];
  onYearChange: (value: number) => void;
  onCategoryChange: (value: string) => void;
}

export function SalesFilterBar({
  selectedYear,
  selectedCategory,
  availableYears,
  availableCategories,
  onYearChange,
  onCategoryChange
}: SalesFilterBarProps) {
  const activeFilters = [
    selectedCategory !== 'all' && { key: 'category', label: selectedCategory },
  ].filter(Boolean);

  const clearFilter = (filterKey: string) => {
    switch (filterKey) {
      case 'category':
        onCategoryChange('all');
        break;
    }
  };

  const clearAllFilters = () => {
    onCategoryChange('all');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row gap-3">
        <Select value={selectedYear.toString()} onValueChange={(value) => onYearChange(parseInt(value))}>
          <SelectTrigger className="w-full md:w-48 text-xs">
            <Calendar className="h-3 w-3 mr-2" />
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map(year => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full md:w-48 text-xs">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Categorias</SelectItem>
            {availableCategories.map(category => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeFilters.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllFilters}
            className="text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((filter: any) => (
            <Badge
              key={filter.key}
              variant="secondary"
              className="text-2xs flex items-center gap-1 pr-1"
            >
              {filter.label}
              <Button
                variant="ghost"
                size="sm"
                className="h-3 w-3 p-0 hover:bg-transparent"
                onClick={() => clearFilter(filter.key)}
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

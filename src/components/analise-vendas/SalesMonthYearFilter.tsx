import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { X, GitCompareArrows } from 'lucide-react';

interface SalesMonthYearFilterProps {
  selectedYear: number;
  selectedMonth: number | null;
  selectedCategory: string;
  availableYears: number[];
  availableCategories: string[];
  onYearChange: (year: number) => void;
  onMonthChange: (month: number | null) => void;
  onCategoryChange: (category: string) => void;
  // Comparison
  comparisonEnabled: boolean;
  comparisonYear: number | null;
  onComparisonEnabledChange: (enabled: boolean) => void;
  onComparisonYearChange: (year: number) => void;
  // Equivalent-period limit (0-11). null = auto
  comparisonLimitMonth: number | null;
  effectiveLimitMonth: number;
  onComparisonLimitMonthChange: (month: number | null) => void;
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
  onCategoryChange,
  comparisonEnabled,
  comparisonYear,
  onComparisonEnabledChange,
  onComparisonYearChange,
  comparisonLimitMonth,
  effectiveLimitMonth,
  onComparisonLimitMonthChange
}: SalesMonthYearFilterProps) {
  const clearFilters = () => {
    onMonthChange(null);
    onCategoryChange('all');
  };
  
  const hasFilters = selectedMonth !== null || selectedCategory !== 'all';

  // Years available for "compare with" — exclude the selected base year
  const comparisonYearOptions = availableYears.filter(y => y !== selectedYear);
  // Fallback: always include selectedYear - 1 if not in list
  if (!comparisonYearOptions.includes(selectedYear - 1)) {
    comparisonYearOptions.unshift(selectedYear - 1);
  }

  return (
    <div className="sticky top-0 z-50 bg-lunar-bg/95 backdrop-blur-sm border-b border-lunar-border/50">
      <div className="px-4 py-3 flex items-center gap-2.5 overflow-x-auto">
        {/* Year */}
        <Select value={selectedYear.toString()} onValueChange={value => onYearChange(parseInt(value))}>
          <SelectTrigger className="w-[100px] h-8 text-sm">
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
          <SelectTrigger className="w-[110px] h-8 text-sm">
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
          <SelectTrigger className="w-[135px] h-8 text-sm">
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
            className="h-8 w-8 p-0 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        {/* Divider */}
        <div className="h-6 w-px bg-lunar-border/50 shrink-0 mx-1" />

        {/* Comparison toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <GitCompareArrows className="h-3.5 w-3.5 text-lunar-textSecondary" />
          <Label htmlFor="comparison-toggle" className="text-sm text-lunar-textSecondary cursor-pointer whitespace-nowrap">
            Comparar
          </Label>
          <Switch
            id="comparison-toggle"
            checked={comparisonEnabled}
            onCheckedChange={onComparisonEnabledChange}
          />
        </div>

        {/* Comparison year */}
        {comparisonEnabled && (
          <Select
            value={(comparisonYear ?? selectedYear - 1).toString()}
            onValueChange={value => onComparisonYearChange(parseInt(value))}
          >
            <SelectTrigger className="w-[110px] h-8 text-sm">
              <SelectValue placeholder="vs" />
            </SelectTrigger>
            <SelectContent>
              {Array.from(new Set(comparisonYearOptions)).sort((a, b) => b - a).map(year => (
                <SelectItem key={year} value={year.toString()}>
                  vs {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Comparison limit month - only when comparing whole year (no specific month) */}
        {comparisonEnabled && selectedMonth === null && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Label className="text-xs text-lunar-textSecondary whitespace-nowrap">
              até:
            </Label>
            <Select
              value={comparisonLimitMonth === null ? 'auto' : comparisonLimitMonth.toString()}
              onValueChange={value =>
                onComparisonLimitMonthChange(value === 'auto' ? null : parseInt(value))
              }
            >
              <SelectTrigger className="w-[120px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  Auto ({months[effectiveLimitMonth]})
                </SelectItem>
                {months.map((month, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}


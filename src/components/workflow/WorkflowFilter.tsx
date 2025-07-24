import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, X } from "lucide-react";
import { getCurrentDateString, parseDateFromStorage } from '@/utils/dateUtils';
type WorkflowFilterProps = {
  onFilterChange: (filters: FilterOptions) => void;
  onResetFilters: () => void;
  statuses: string[];
};
export type FilterOptions = {
  search: string;
  status: string;
  month: string;
};
export function WorkflowFilter({
  onFilterChange,
  onResetFilters,
  statuses
}: WorkflowFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>(() => {
    const hoje = getCurrentDateString();
    const [ano, mes] = hoje.split('-');
    return {
      search: "",
      status: "all",
      month: `${parseInt(mes)}/${ano}`
    };
  });

  // Generate month options (last 12 months)
  const getMonthOptions = () => {
    const options = [];
    const hoje = getCurrentDateString();
    const [currentYear, currentMonth] = hoje.split('-').map(Number);
    
    for (let i = 0; i < 12; i++) {
      let year = currentYear;
      let month = currentMonth - i;
      
      if (month <= 0) {
        month += 12;
        year--;
      }
      
      const monthYear = `${month}/${year}`;
      const date = parseDateFromStorage(`${year}-${month.toString().padStart(2, '0')}-01`);
      const label = date.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric'
      });
      options.push({
        value: monthYear,
        label
      });
    }
    return options;
  };

  // Handler for filter changes
  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    const newFilters = {
      ...filters,
      [key]: value
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  // Reset all filters
  const handleReset = () => {
    const defaultFilters = {
      search: "",
      status: "all",
      month: (() => {
        const hoje = getCurrentDateString();
        const [ano, mes] = hoje.split('-');
        return `${parseInt(mes)}/${ano}`;
      })()
    };
    setFilters(defaultFilters);
    onResetFilters();
  };

  // Toggle filter expanded state
  const toggleFilters = () => {
    setIsExpanded(!isExpanded);
  };
  const monthOptions = getMonthOptions();
  return <div className="space-y-4">
      
      
      {/* Advanced Filters (Expandable) */}
      {isExpanded && <div className="pt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Select value={filters.status} onValueChange={value => handleFilterChange("status", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statuses.map(status => <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>}
    </div>;
}
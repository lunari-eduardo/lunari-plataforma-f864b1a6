import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, User, Flag, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useIsTablet } from '@/hooks/useIsTablet';
import { useIsMobile } from '@/hooks/use-mobile';
import type { TaskPriority, TaskStatus } from '@/types/tasks';
export interface TaskFilters {
  search: string;
  status: 'all' | TaskStatus;
  priority: 'all' | TaskPriority;
  assignee: 'all' | string;
  dateRange: 'all' | 'today' | 'week' | 'month' | 'overdue';
}
interface TaskFiltersBarProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  statusOptions: {
    value: string;
    label: string;
  }[];
  assigneeOptions: {
    value: string;
    label: string;
  }[];
}
export default function TaskFiltersBar({
  filters,
  onFiltersChange,
  statusOptions,
  assigneeOptions
}: TaskFiltersBarProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isCompactDevice = isMobile || isTablet;
  const [isExpanded, setIsExpanded] = useState(!isCompactDevice);

  const updateFilter = <K extends keyof TaskFilters,>(key: K, value: TaskFilters[K]) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      status: 'all',
      priority: 'all',
      assignee: 'all',
      dateRange: 'all'
    });
  };

  const hasActiveFilters = filters.search || filters.status !== 'all' || filters.priority !== 'all' || filters.assignee !== 'all' || filters.dateRange !== 'all';

  const dateRangeLabels = {
    all: 'Todos os prazos',
    today: 'Hoje',
    week: 'Esta semana',
    month: 'Este mês',
    overdue: 'Em atraso'
  };

  const priorityLabels = {
    all: 'Todas prioridades',
    high: 'Alta prioridade',
    medium: 'Média prioridade',
    low: 'Baixa prioridade'
  };

  return (
    <div className="bg-card border border-border rounded-lg p-2 space-y-2">
      {/* Desktop Layout - Single line with all filters */}
      <div className="hidden md:flex items-center gap-3">
        {/* Search */}
        <Input 
          placeholder="Buscar tarefas..." 
          value={filters.search} 
          onChange={e => updateFilter('search', e.target.value)} 
          className="h-8 w-64 text-sm" 
        />

        {/* Status Filter */}
        <Select value={filters.status} onValueChange={v => updateFilter('status', v as any)}>
          <SelectTrigger className="h-8 w-32 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {statusOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority Filter */}
        <Select value={filters.priority} onValueChange={v => updateFilter('priority', v as any)}>
          <SelectTrigger className="h-8 w-32 text-sm">
            <Flag className="w-3 h-3 mr-1" />
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(priorityLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Assignee Filter */}
        <Select value={filters.assignee} onValueChange={v => updateFilter('assignee', v as any)}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <User className="w-3 h-3 mr-1" />
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {assigneeOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range Filter */}
        <Select value={filters.dateRange} onValueChange={v => updateFilter('dateRange', v as any)}>
          <SelectTrigger className="h-8 w-32 text-sm">
            <Calendar className="w-3 h-3 mr-1" />
            <SelectValue placeholder="Prazo" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(dateRangeLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear button */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-sm">
            <X className="w-3 h-3 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-xs">
                {Object.values(filters).filter(v => v && v !== 'all').length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                <X className="w-3 h-3 mr-1" />
                Limpar
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsExpanded(!isExpanded)} 
              className="h-7 w-7 p-0"
            >
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="col-span-2">
              <Input 
                placeholder="Buscar tarefas..." 
                value={filters.search} 
                onChange={e => updateFilter('search', e.target.value)} 
                className="h-8 text-sm" 
              />
            </div>

            <Select value={filters.status} onValueChange={v => updateFilter('status', v as any)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {statusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.priority} onValueChange={v => updateFilter('priority', v as any)}>
              <SelectTrigger className="h-8 text-sm">
                <Flag className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(priorityLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.assignee} onValueChange={v => updateFilter('assignee', v as any)}>
              <SelectTrigger className="h-8 text-sm">
                <User className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {assigneeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.dateRange} onValueChange={v => updateFilter('dateRange', v as any)}>
              <SelectTrigger className="h-8 text-sm">
                <Calendar className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Prazo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(dateRangeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Active filters display - more compact */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-border/30">
          {filters.search && (
            <Badge variant="secondary" className="gap-1 text-xs px-2 py-0.5">
              "{filters.search}"
              <X className="w-3 h-3 cursor-pointer" onClick={() => updateFilter('search', '')} />
            </Badge>
          )}
          {filters.status !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-xs px-2 py-0.5">
              {statusOptions.find(s => s.value === filters.status)?.label}
              <X className="w-3 h-3 cursor-pointer" onClick={() => updateFilter('status', 'all')} />
            </Badge>
          )}
          {filters.priority !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-xs px-2 py-0.5">
              {priorityLabels[filters.priority]}
              <X className="w-3 h-3 cursor-pointer" onClick={() => updateFilter('priority', 'all')} />
            </Badge>
          )}
          {filters.assignee !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-xs px-2 py-0.5">
              {assigneeOptions.find(a => a.value === filters.assignee)?.label}
              <X className="w-3 h-3 cursor-pointer" onClick={() => updateFilter('assignee', 'all')} />
            </Badge>
          )}
          {filters.dateRange !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-xs px-2 py-0.5">
              {dateRangeLabels[filters.dateRange]}
              <X className="w-3 h-3 cursor-pointer" onClick={() => updateFilter('dateRange', 'all')} />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
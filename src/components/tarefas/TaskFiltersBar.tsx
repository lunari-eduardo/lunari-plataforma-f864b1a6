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
  statusOptions: { value: string; label: string }[];
  assigneeOptions: { value: string; label: string }[];
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
  
  const updateFilter = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
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

  const hasActiveFilters = filters.search || filters.status !== 'all' || filters.priority !== 'all' || 
                          filters.assignee !== 'all' || filters.dateRange !== 'all';

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
    <div className="bg-card border border-border rounded-lg p-1.5 md:p-3 space-y-1.5 md:space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-card-foreground text-xs md:text-sm">Filtros</h3>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-2xs px-1.5 py-0.5">
              {Object.values(filters).filter(v => v && v !== 'all').length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-2xs px-2">
              <X className="w-3 h-3 mr-1" />
              <span className="hidden md:inline">Limpar</span>
            </Button>
          )}
          {isCompactDevice && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </Button>
          )}
        </div>
      </div>

      {(!isCompactDevice || isExpanded) && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1.5 md:gap-2">
          {/* Search - spans 2 columns on mobile */}
          <div className="col-span-2 md:col-span-1">
            <Input
              placeholder="Buscar tarefas..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="h-6 md:h-8 text-xs md:text-sm"
            />
          </div>

          {/* Status Filter */}
          <Select value={filters.status} onValueChange={(v) => updateFilter('status', v as any)}>
            <SelectTrigger className="h-6 md:h-8 text-xs md:text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {statusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Priority Filter */}
          <Select value={filters.priority} onValueChange={(v) => updateFilter('priority', v as any)}>
            <SelectTrigger className="h-6 md:h-8 text-xs md:text-sm">
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
          <Select value={filters.assignee} onValueChange={(v) => updateFilter('assignee', v as any)}>
            <SelectTrigger className="h-6 md:h-8 text-xs md:text-sm">
              <User className="w-3 h-3 mr-1" />
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos responsáveis</SelectItem>
              {assigneeOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <Select value={filters.dateRange} onValueChange={(v) => updateFilter('dateRange', v as any)}>
            <SelectTrigger className="h-6 md:h-8 text-xs md:text-sm">
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

      {/* Active filters display */}
      {hasActiveFilters && (!isCompactDevice || isExpanded) && (
        <div className="flex flex-wrap gap-1">
          {filters.search && (
            <Badge variant="secondary" className="gap-1 text-2xs px-1.5 py-0.5">
              "{filters.search}"
              <X 
                className="w-2.5 h-2.5 cursor-pointer" 
                onClick={() => updateFilter('search', '')}
              />
            </Badge>
          )}
          {filters.status !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-2xs px-1.5 py-0.5">
              {statusOptions.find(s => s.value === filters.status)?.label}
              <X 
                className="w-2.5 h-2.5 cursor-pointer" 
                onClick={() => updateFilter('status', 'all')}
              />
            </Badge>
          )}
          {filters.priority !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-2xs px-1.5 py-0.5">
              {priorityLabels[filters.priority]}
              <X 
                className="w-2.5 h-2.5 cursor-pointer" 
                onClick={() => updateFilter('priority', 'all')}
              />
            </Badge>
          )}
          {filters.assignee !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-2xs px-1.5 py-0.5">
              {assigneeOptions.find(a => a.value === filters.assignee)?.label}
              <X 
                className="w-2.5 h-2.5 cursor-pointer" 
                onClick={() => updateFilter('assignee', 'all')}
              />
            </Badge>
          )}
          {filters.dateRange !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-2xs px-1.5 py-0.5">
              {dateRangeLabels[filters.dateRange]}
              <X 
                className="w-2.5 h-2.5 cursor-pointer" 
                onClick={() => updateFilter('dateRange', 'all')}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
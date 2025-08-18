import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, User, Flag, X } from 'lucide-react';
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
    <div className="bg-lunar-surface border border-lunar-border/60 rounded-lg p-2 md:p-4 space-y-2 md:space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-lunar-text text-sm md:text-base">Filtros</h3>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 md:h-8 text-xs md:text-sm">
            <X className="w-3 h-3 md:w-4 md:h-4 mr-1" />
            <span className="hidden md:inline">Limpar</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
        {/* Search - spans 2 columns on mobile */}
        <div className="col-span-2 md:col-span-1">
          <Input
            placeholder="Buscar tarefas..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="bg-lunar-background border-lunar-border h-8 md:h-10 text-sm"
          />
        </div>

        {/* Status Filter */}
        <Select value={filters.status} onValueChange={(v) => updateFilter('status', v as any)}>
          <SelectTrigger className="bg-lunar-background border-lunar-border h-8 md:h-10 text-sm">
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
          <SelectTrigger className="bg-lunar-background border-lunar-border h-8 md:h-10 text-sm">
            <Flag className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
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
          <SelectTrigger className="bg-lunar-background border-lunar-border h-8 md:h-10 text-sm">
            <User className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
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
          <SelectTrigger className="bg-lunar-background border-lunar-border h-8 md:h-10 text-sm">
            <Calendar className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            <SelectValue placeholder="Prazo" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(dateRangeLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              "{filters.search}"
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => updateFilter('search', '')}
              />
            </Badge>
          )}
          {filters.status !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {statusOptions.find(s => s.value === filters.status)?.label}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => updateFilter('status', 'all')}
              />
            </Badge>
          )}
          {filters.priority !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {priorityLabels[filters.priority]}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => updateFilter('priority', 'all')}
              />
            </Badge>
          )}
          {filters.assignee !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {assigneeOptions.find(a => a.value === filters.assignee)?.label}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => updateFilter('assignee', 'all')}
              />
            </Badge>
          )}
          {filters.dateRange !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {dateRangeLabels[filters.dateRange]}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => updateFilter('dateRange', 'all')}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
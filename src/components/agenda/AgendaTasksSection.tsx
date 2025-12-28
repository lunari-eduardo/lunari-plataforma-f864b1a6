import React, { useMemo } from 'react';
import { isSameDay, parseISO, getMonth, getYear, getDate } from 'date-fns';
import { Plus, User, Calendar, Circle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { Task } from '@/types/tasks';

interface AgendaTasksSectionProps {
  selectedDate: Date;
  tasks: Task[];
  viewMode: 'day' | 'week' | 'month' | 'year';
  onCreateTask: () => void;
  onDayClick?: (date: Date) => void;
}

export default function AgendaTasksSection({ 
  selectedDate, 
  tasks, 
  viewMode,
  onCreateTask,
  onDayClick
}: AgendaTasksSectionProps) {
  const navigate = useNavigate();
  
  // Filter tasks for the selected date that are not completed (for day/week views)
  const dayTasks = useMemo(() => {
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = parseISO(task.dueDate);
      if (!isSameDay(taskDate, selectedDate)) return false;
      if (task.status === 'done' || task.completedAt) return false;
      return true;
    });
  }, [tasks, selectedDate]);
  
  // Group tasks by day for monthly view
  const monthlyTasksSummary = useMemo(() => {
    if (viewMode !== 'month') return [];
    
    const year = getYear(selectedDate);
    const month = getMonth(selectedDate);
    
    // Filter tasks for this month that are not completed
    const monthTasks = tasks.filter(task => {
      if (!task.dueDate) return false;
      if (task.status === 'done' || task.completedAt) return false;
      
      const taskDate = parseISO(task.dueDate);
      return getYear(taskDate) === year && getMonth(taskDate) === month;
    });
    
    // Group by day
    const tasksByDay = new Map<number, number>();
    monthTasks.forEach(task => {
      const day = getDate(parseISO(task.dueDate!));
      tasksByDay.set(day, (tasksByDay.get(day) || 0) + 1);
    });
    
    // Convert to sorted array
    return Array.from(tasksByDay.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([day, count]) => ({ day, count }));
  }, [tasks, selectedDate, viewMode]);
  
  // Limit to 5 tasks for daily view
  const visibleTasks = dayTasks.slice(0, 5);
  const hasMoreTasks = dayTasks.length > 5;
  
  const handleTaskClick = (taskId: string) => {
    navigate(`/app/tarefas?taskId=${taskId}`);
  };
  
  const handleViewAllTasks = () => {
    navigate('/app/tarefas');
  };
  
  const handleDayItemClick = (day: number) => {
    if (onDayClick) {
      const year = getYear(selectedDate);
      const month = getMonth(selectedDate);
      onDayClick(new Date(year, month, day));
    }
  };
  
  const getPriorityIndicator = (priority: Task['priority']) => {
    switch (priority) {
      case 'high':
        return <Circle className="h-2.5 w-2.5 fill-red-500 text-red-500" />;
      case 'medium':
        return <Circle className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />;
      case 'low':
        return <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />;
      default:
        return <Circle className="h-2.5 w-2.5 fill-lunar-muted text-lunar-muted" />;
    }
  };
  
  const getLinkIndicator = (task: Task) => {
    if (task.relatedClienteId) {
      return (
        <span className="flex items-center gap-1 text-xs text-lunar-muted">
          <User className="h-3 w-3" />
          <span className="hidden sm:inline">Cliente</span>
        </span>
      );
    }
    if (task.relatedSessionId) {
      return (
        <span className="flex items-center gap-1 text-xs text-lunar-muted">
          <Calendar className="h-3 w-3" />
          <span className="hidden sm:inline">Agendamento</span>
        </span>
      );
    }
    return (
      <span className="text-xs text-lunar-muted/60">•</span>
    );
  };
  
  // Dynamic title based on view mode
  const sectionTitle = viewMode === 'month' ? 'Tarefas do mês' : 'Tarefas do dia';
  
  // Hide in year view
  if (viewMode === 'year') {
    return null;
  }

  return (
    <div className="mt-6 p-4 bg-lunar-surface/30 border border-lunar-border/20 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-lunar-text">
          {sectionTitle}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-lunar-muted hover:text-lunar-accent hover:bg-lunar-accent/10"
          onClick={onCreateTask}
          title="Criar nova tarefa"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Content based on view mode */}
      {viewMode === 'month' ? (
        // Monthly summary view
        <div className="space-y-2">
          {monthlyTasksSummary.length === 0 ? (
            <p className="text-sm text-lunar-muted py-3 text-center">
              Nenhuma tarefa pendente neste mês
            </p>
          ) : (
            <ul className="space-y-1.5">
              {monthlyTasksSummary.map(({ day, count }) => (
                <li 
                  key={day}
                  className="flex items-center gap-2 py-2 px-3 rounded-md bg-lunar-background/40 hover:bg-lunar-background/70 cursor-pointer transition-colors group"
                  onClick={() => handleDayItemClick(day)}
                >
                  <Calendar className="h-3.5 w-3.5 text-lunar-accent" />
                  <span className="text-sm text-lunar-text flex-1">
                    Dia {day} - {count === 1 ? 'existe 1 tarefa' : `existem ${count} tarefas`}
                  </span>
                  <ExternalLink className="h-3 w-3 text-lunar-muted/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        // Daily/Weekly task list
        <>
          {visibleTasks.length === 0 ? (
            <p className="text-sm text-lunar-muted py-3 text-center">
              Nenhuma tarefa para este dia
            </p>
          ) : (
            <ul className="space-y-2">
              {visibleTasks.map(task => (
                <li 
                  key={task.id}
                  className="flex items-center justify-between gap-2 py-2 px-3 rounded-md bg-lunar-background/40 hover:bg-lunar-background/70 cursor-pointer transition-colors group"
                  onClick={() => handleTaskClick(task.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getPriorityIndicator(task.priority)}
                    <span className="text-sm text-lunar-text truncate">
                      {task.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getLinkIndicator(task)}
                    <ExternalLink className="h-3 w-3 text-lunar-muted/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      
      {/* View all link - show when there are more tasks or in monthly view */}
      {(hasMoreTasks || (viewMode === 'month' && monthlyTasksSummary.length > 0)) && (
        <div className="mt-3 pt-2 border-t border-lunar-border/20">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-lunar-muted hover:text-lunar-accent"
            onClick={handleViewAllTasks}
          >
            Ver todas as tarefas →
          </Button>
        </div>
      )}
    </div>
  );
}

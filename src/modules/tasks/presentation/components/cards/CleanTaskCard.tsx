import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User } from 'lucide-react';
import type { Task } from '@/types/tasks';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { useSupabaseTaskStatuses } from '@/hooks/useSupabaseTaskStatuses';
import { hexToRgb } from '@/modules/tasks/presentation/components/utils';

interface CleanTaskCardProps {
  task: Task;
  onComplete: () => void;
  onView: () => void;
  isDone: boolean;
}

/** Mesmo mapa de prioridade do card do Kanban (fonte única). */
const priorityBar: Record<string, string> = {
  high: 'bg-lunar-error',
  medium: 'bg-lunar-warning',
  low: 'bg-muted-foreground/40',
};

export default function CleanTaskCard({
  task,
  onComplete,
  onView,
  isDone
}: CleanTaskCardProps) {
  const { statuses } = useSupabaseTaskStatuses();
  const statusRgb = useMemo(
    () => hexToRgb(statuses.find(s => s.key === task.status)?.color || '#6b7280'),
    [statuses, task.status],
  );

  const daysUntilDue = task.dueDate ? 
    Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 
    null;

  return (
    <div
      className={`task-card overflow-hidden p-3 space-y-3 ${isDone ? 'opacity-60' : ''}`}
      style={{ '--card-color': statusRgb } as React.CSSProperties}
    >
      {/* Priority indicator & Title */}
      <div className="flex items-start gap-3">
        <div className={`w-1 h-8 rounded-full flex-shrink-0 ${priorityBar[task.priority] || priorityBar.low}`} />
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium text-[13px] leading-tight ${
            isDone ? 'line-through text-muted-foreground' : 'text-foreground'
          }`}>
            {task.title}
          </h3>
          {task.assigneeName && (
            <div className="flex items-center gap-1 mt-1">
              <User className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{task.assigneeName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Due Date & Actions */}
      <div className="flex items-center justify-between">
        {task.dueDate ? (
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {formatDateForDisplay(task.dueDate)}
            </span>
            {daysUntilDue !== null && (
              <Badge 
                variant={
                  daysUntilDue < 0 ? 'destructive' : 
                  daysUntilDue <= 2 ? 'secondary' : 'outline'
                }
                className="text-2xs px-1.5 py-0.5"
              >
                {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d atrasada` : 
                 daysUntilDue === 0 ? 'Hoje' : 
                 `${daysUntilDue}d`}
              </Badge>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="text-xs">Sem prazo</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          {!isDone && (
            <Button
              variant="outline"
              size="sm"
              onClick={onComplete}
              className="h-6 px-2 text-2xs"
            >
              Concluir
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onView}
            className="h-6 px-2 text-2xs"
          >
            Ver
          </Button>
        </div>
      </div>
    </div>
  );
}

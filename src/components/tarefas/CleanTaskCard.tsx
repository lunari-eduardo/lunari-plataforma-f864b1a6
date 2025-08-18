import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User } from 'lucide-react';
import type { Task } from '@/types/tasks';
import { formatDateForDisplay } from '@/utils/dateUtils';

interface CleanTaskCardProps {
  task: Task;
  onComplete: () => void;
  onView: () => void;
  isDone: boolean;
}

export default function CleanTaskCard({
  task,
  onComplete,
  onView,
  isDone
}: CleanTaskCardProps) {
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500'; 
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const daysUntilDue = task.dueDate ? 
    Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 
    null;

  return (
    <div className={`bg-lunar-background border border-lunar-border/60 rounded-lg p-3 space-y-3 hover:shadow-sm transition-shadow ${
      isDone ? 'opacity-60' : ''
    }`}>
      {/* Priority indicator & Title */}
      <div className="flex items-start gap-3">
        <div className={`w-1 h-8 rounded-full flex-shrink-0 ${getPriorityColor(task.priority)}`} />
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium text-sm leading-tight ${
            isDone ? 'line-through text-lunar-textSecondary' : 'text-lunar-text'
          }`}>
            {task.title}
          </h3>
          {task.assigneeName && (
            <div className="flex items-center gap-1 mt-1">
              <User className="w-3 h-3 text-lunar-textSecondary" />
              <span className="text-xs text-lunar-textSecondary">{task.assigneeName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Due Date & Actions */}
      <div className="flex items-center justify-between">
        {task.dueDate ? (
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3 text-lunar-textSecondary" />
            <span className="text-xs text-lunar-textSecondary">
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
          <div className="flex items-center gap-2 text-lunar-textSecondary">
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
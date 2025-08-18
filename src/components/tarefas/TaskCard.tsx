import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Task, TaskPriority } from '@/types/tasks';
import { differenceInCalendarDays } from 'date-fns';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';

function daysUntil(dateIso?: string) {
  if (!dateIso) return undefined;
  // Parse due date safely (supports 'YYYY-MM-DD' without timezone shift)
  let due: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    const [y, m, d] = dateIso.split('-').map(Number);
    due = new Date(y, m - 1, d);
  } else {
    due = new Date(dateIso);
  }
  // Normalize "today" to local midnight to avoid off-by-one issues
  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return differenceInCalendarDays(due, todayLocal);
}

const priorityLabel: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta'
};

export default function TaskCard({
  task: t,
  onComplete,
  onReopen,
  onEdit,
  onDelete,
  onRequestMove,
  isDone,
  statusOptions,
  dndRef,
  dndListeners,
  dndAttributes,
  dndStyle,
  isDragging = false
}: {
  task: Task;
  onComplete: () => void;
  onReopen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRequestMove?: (status: string) => void;
  isDone: boolean;
  statusOptions: {
    value: string;
    label: string;
  }[];
  dndRef?: (node: HTMLElement | null) => void;
  dndListeners?: any;
  dndAttributes?: any;
  dndStyle?: any;
  isDragging?: boolean;
}) {
  const { statuses } = useTaskStatuses();
  
  const dueInfo = useMemo(() => {
    if (isDone || t.completedAt) return null;
    const d = daysUntil(t.dueDate);
    if (d === undefined) return null;
    if (d < 0) return <span className="text-lunar-error">Vencida há {Math.abs(d)} dia(s)</span>;
    if (d === 1) return <span className="text-lunar-accent">Falta 1 dia</span>;
    if (d <= 2) return <span className="text-lunar-accent">Faltam {d} dia(s)</span>;
    return null;
  }, [t.dueDate, isDone, t.completedAt]);

  const currentStatus = useMemo(() => {
    return statuses.find(s => s.key === t.status);
  }, [statuses, t.status]);

  const statusColor = currentStatus?.color || '#3b82f6';

  const priorityBadgeClasses = useMemo(() => {
    switch (t.priority) {
      case 'high':
        return 'text-tasks-priority-high border-tasks-priority-high/40 bg-tasks-priority-high/10';
      case 'medium':
        return 'text-tasks-priority-medium border-tasks-priority-medium/40 bg-tasks-priority-medium/10';
      default:
        return 'text-lunar-textSecondary border-lunar-border/60 bg-transparent';
    }
  }, [t.priority]);

  return (
    <li 
      className={`relative overflow-hidden rounded-md border border-lunar-border/60 bg-lunar-surface p-3 transition-none cursor-grab active:cursor-grabbing select-none touch-none transform-gpu ${isDragging ? 'opacity-70 border-dashed ring-1 ring-lunar-accent/40' : ''}`} 
      ref={dndRef as any} 
      style={dndStyle} 
      {...dndAttributes || {}} 
      {...dndListeners || {}} 
      onPointerDownCapture={e => {
        const target = e.target as HTMLElement;
        if (target?.closest('[data-no-drag="true"]')) {
          e.stopPropagation();
        }
      }}
    >
      {/* Status color bar */}
      <span 
        aria-hidden 
        className="pointer-events-none absolute inset-y-0 left-0 w-1" 
        style={{ backgroundColor: statusColor }}
      />
      
      {/* Title - up to 2 lines */}
      <h3 
        className="text-sm font-medium text-lunar-text line-clamp-2 cursor-pointer hover:text-lunar-accent mb-2" 
        onClick={onEdit} 
        data-no-drag="true" 
        title="Abrir detalhes"
      >
        {t.title}
      </h3>
      
      {/* Priority badge */}
      <div className="mb-2">
        <Badge variant="outline" className={`text-xs ${priorityBadgeClasses}`}>
          {priorityLabel[t.priority]}
        </Badge>
      </div>
      
      {/* Tags side by side */}
      {(t.tags?.length || 0) > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-3">
          {t.tags!.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      
      {/* Creation date and due date */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-lunar-textSecondary mb-3">
        <span>Criada: {new Date(t.createdAt).toLocaleDateString('pt-BR')}</span>
        {t.dueDate && (
          <span>
            Prazo: {formatDateForDisplay(t.dueDate)} {dueInfo}
          </span>
        )}
      </div>
      
      {/* Bottom buttons */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 text-xs" 
          onClick={onEdit} 
          data-no-drag="true"
        >
          Ver detalhes
        </Button>
        
        {!isDone ? (
          <Button 
            variant="secondary" 
            size="sm" 
            className="h-8 text-xs" 
            onClick={onComplete} 
            data-no-drag="true"
          >
            Concluído
          </Button>
        ) : (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-xs" 
            onClick={onReopen} 
            data-no-drag="true"
          >
            Reabrir
          </Button>
        )}
      </div>
    </li>
  );
}
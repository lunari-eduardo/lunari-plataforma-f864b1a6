import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Task, TaskPriority } from '@/types/tasks';
import { differenceInCalendarDays } from 'date-fns';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { useSupabaseTaskStatuses } from '@/hooks/useSupabaseTaskStatuses';

function daysUntil(dateIso?: string) {
  if (!dateIso) return undefined;
  let due: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    const [y, m, d] = dateIso.split('-').map(Number);
    due = new Date(y, m - 1, d);
  } else {
    due = new Date(dateIso);
  }
  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return differenceInCalendarDays(due, todayLocal);
}

/** Convert hex to "r, g, b" for CSS */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '107, 114, 128';
  return `${r}, ${g}, ${b}`;
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
  statusOptions: { value: string; label: string }[];
  dndRef?: (node: HTMLElement | null) => void;
  dndListeners?: any;
  dndAttributes?: any;
  dndStyle?: any;
  isDragging?: boolean;
}) {
  const { statuses } = useSupabaseTaskStatuses();

  const dueInfo = useMemo(() => {
    if (isDone || t.completedAt) return null;
    const d = daysUntil(t.dueDate);
    if (d === undefined) return null;
    if (d < 0) return <span className="text-lunar-error font-medium">Vencida há {Math.abs(d)} dia(s)</span>;
    if (d === 1) return <span className="text-lunar-accent font-medium">Falta 1 dia</span>;
    if (d <= 2) return <span className="text-lunar-accent font-medium">Faltam {d} dia(s)</span>;
    return null;
  }, [t.dueDate, isDone, t.completedAt]);

  const currentStatus = useMemo(() => statuses.find(s => s.key === t.status), [statuses, t.status]);
  const statusColor = currentStatus?.color || '#6b7280';
  const statusRgb = hexToRgb(statusColor);

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
      className={`glass-task-card relative overflow-hidden p-3 cursor-grab active:cursor-grabbing select-none touch-none transform-gpu ${isDragging ? 'glass-task-card-placeholder' : ''}`}
      ref={dndRef as any}
      style={{
        ...dndStyle,
        '--card-color': statusRgb,
      } as React.CSSProperties}
      {...dndAttributes || {}}
      {...dndListeners || {}}
      onPointerDownCapture={e => {
        const target = e.target as HTMLElement;
        if (target?.closest('[data-no-drag="true"]')) {
          e.stopPropagation();
        }
      }}
    >
      {/* Title */}
      <h3
        className="text-sm font-medium text-lunar-text line-clamp-2 cursor-pointer hover:text-lunar-accent transition-colors duration-200 mb-2"
        onClick={onEdit}
        data-no-drag="true"
        title="Abrir detalhes"
      >
        {t.title}
      </h3>

      {/* Priority badge */}
      <div className="mb-2">
        <Badge variant="outline" className={`text-xs backdrop-blur-sm ${priorityBadgeClasses}`}>
          {priorityLabel[t.priority]}
        </Badge>
      </div>

      {/* Tags */}
      {(t.tags?.length || 0) > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-3">
          {t.tags!.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Dates */}
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
          className="h-8 text-xs hover:bg-black/[0.06] dark:hover:bg-white/10 transition-colors"
          onClick={onEdit}
          data-no-drag="true"
        >
          Ver detalhes
        </Button>

        {!isDone ? (
          <Button
            variant="secondary"
            size="sm"
            className="h-8 text-xs hover:bg-black/[0.08] dark:hover:bg-white/10 transition-colors"
            onClick={onComplete}
            data-no-drag="true"
          >
            Concluído
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs hover:bg-black/[0.06] dark:hover:bg-white/10 transition-colors"
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

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { Task, TaskPriority } from '@/types/tasks';
import { differenceInCalendarDays } from 'date-fns';
import { CheckSquare, Calendar, Paperclip } from 'lucide-react';
import { getInitials } from '@/utils/getInitials';
import { useSupabaseTaskStatuses } from '@/hooks/useSupabaseTaskStatuses';

function parseDueDate(dateIso?: string): Date | null {
  if (!dateIso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    const [y, m, d] = dateIso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateIso);
}

/** Friendly relative due date (Hoje, Amanhã, Em 3 dias, Atrasada 2d). */
function formatFriendlyDue(
  dueIso?: string,
  isDone?: boolean
): { label: string; tone: 'overdue' | 'urgent' | 'soon' | 'normal' } | null {
  if (!dueIso || isDone) return null;
  const due = parseDueDate(dueIso);
  if (!due) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = differenceInCalendarDays(due, today);
  if (diff < 0) return { label: `Atrasada ${Math.abs(diff)}d`, tone: 'overdue' };
  if (diff === 0) return { label: 'Hoje', tone: 'urgent' };
  if (diff === 1) return { label: 'Amanhã', tone: 'urgent' };
  if (diff <= 3) return { label: `Em ${diff} dias`, tone: 'soon' };
  if (diff <= 7) return { label: `Em ${diff} dias`, tone: 'normal' };
  return {
    label: due.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    tone: 'normal',
  };
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '107, 114, 128';
  return `${r}, ${g}, ${b}`;
}

const priorityDot: Record<TaskPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-muted-foreground/40',
};

const dueToneClass: Record<'overdue' | 'urgent' | 'soon' | 'normal', string> = {
  overdue: 'text-red-500',
  urgent: 'text-amber-500',
  soon: 'text-lunar-accent',
  normal: 'text-lunar-textSecondary',
};

export default function TaskCard({
  task: t,
  onComplete,
  onReopen,
  onEdit,
  isDone,
  dndRef,
  dndListeners,
  dndAttributes,
  dndStyle,
  isDragging = false,
}: {
  task: Task;
  onComplete: () => void;
  onReopen: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onRequestMove?: (status: string) => void;
  isDone: boolean;
  statusOptions?: { value: string; label: string }[];
  dndRef?: (node: HTMLElement | null) => void;
  dndListeners?: any;
  dndAttributes?: any;
  dndStyle?: any;
  isDragging?: boolean;
}) {
  const { statuses } = useSupabaseTaskStatuses();

  const statusColor = useMemo(
    () => statuses.find((s) => s.key === t.status)?.color || '#6b7280',
    [statuses, t.status]
  );
  const statusRgb = hexToRgb(statusColor);

  const due = useMemo(() => formatFriendlyDue(t.dueDate, isDone), [t.dueDate, isDone]);

  const checklistTotal = t.checklistItems?.length || 0;
  const checklistDone = t.checklistItems?.filter((c) => c.completed).length || 0;
  const hasChecklist = checklistTotal > 0;
  const checklistComplete = hasChecklist && checklistDone === checklistTotal;

  const visibleTags = (t.tags || []).slice(0, 2);
  const extraTags = (t.tags?.length || 0) - visibleTags.length;

  const hasAttachments = (t.attachments?.length || 0) > 0;

  return (
    <li
      className={`group glass-task-card relative overflow-hidden p-3 cursor-grab active:cursor-grabbing select-none touch-auto transform-gpu ${
        isDragging ? 'glass-task-card-placeholder' : ''
      } ${isDone ? 'opacity-70' : ''}`}
      ref={dndRef as any}
      style={{
        ...dndStyle,
        '--card-color': statusRgb,
      } as React.CSSProperties}
      {...(dndAttributes || {})}
      {...(dndListeners || {})}
      onPointerDownCapture={(e) => {
        const target = e.target as HTMLElement;
        if (target?.closest('[data-no-drag="true"]')) {
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        // open details when clicking on card body (not on interactive zone)
        const target = e.target as HTMLElement;
        if (target.closest('[data-no-drag="true"]')) return;
        onEdit();
      }}
    >
      {/* Title row */}
      <div className="flex items-start gap-2">
        <span
          className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${priorityDot[t.priority]}`}
          title={`Prioridade: ${t.priority}`}
        />
        <h3
          className={`flex-1 text-sm font-medium leading-snug line-clamp-2 ${
            isDone ? 'line-through text-lunar-textSecondary' : 'text-lunar-text'
          }`}
        >
          {t.title}
        </h3>
      </div>

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-2">
          {visibleTags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-2xs px-1.5 py-0 h-5 border-lunar-border/60 bg-transparent text-lunar-textSecondary"
            >
              {tag}
            </Badge>
          ))}
          {extraTags > 0 && (
            <span className="text-2xs text-lunar-textSecondary opacity-70">+{extraTags}</span>
          )}
        </div>
      )}

      {/* Meta row */}
      {(due || hasChecklist || t.assigneeName || hasAttachments) && (
        <div className="flex items-center gap-3 mt-2.5 text-2xs">
          {due && (
            <span className={`flex items-center gap-1 font-medium ${dueToneClass[due.tone]}`}>
              <Calendar className="w-3 h-3" />
              {due.label}
            </span>
          )}

          {hasChecklist && (
            <span
              className={`flex items-center gap-1 ${
                checklistComplete ? 'text-green-500' : 'text-lunar-textSecondary'
              }`}
            >
              <CheckSquare className="w-3 h-3" />
              {checklistDone}/{checklistTotal}
            </span>
          )}

          {hasAttachments && (
            <span className="flex items-center gap-1 text-lunar-textSecondary">
              <Paperclip className="w-3 h-3" />
              {t.attachments!.length}
            </span>
          )}

          {/* Push avatar to the right */}
          {t.assigneeName && (
            <span
              className="ml-auto flex items-center justify-center w-5 h-5 rounded-full bg-lunar-accent/15 text-lunar-accent text-[10px] font-semibold"
              title={t.assigneeName}
            >
              {getInitials(t.assigneeName)}
            </span>
          )}
        </div>
      )}

      {/* Quick action: complete / reopen — appears on hover */}
      <button
        type="button"
        data-no-drag="true"
        onClick={(e) => {
          e.stopPropagation();
          isDone ? onReopen() : onComplete();
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity text-2xs px-2 py-0.5 rounded-md bg-foreground/5 hover:bg-foreground/10 text-lunar-textSecondary hover:text-lunar-text"
      >
        {isDone ? 'Reabrir' : 'Concluir'}
      </button>
    </li>
  );
}

import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import ColumnQuickAdd from '@/components/tarefas/ColumnQuickAdd';
import DraggableTaskCard from '@/components/tarefas/dnd/DraggableTaskCard';
import type { Task } from '@/types/tasks';
import { hexToRgb } from './utils';

interface KanbanColumnProps {
  title: string;
  statusKey: string;
  color?: string;
  tasks: Task[];
  doneKey: string;
  defaultOpenKey: string;
  statusOptions: { value: string; label: string }[];
  activeId: string | null;
  onAdd: (title: string) => Promise<void> | void;
  onComplete: (id: string) => void;
  onReopen: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onRequestMove: (id: string, status: string) => void;
}

export default function KanbanColumn({
  title, statusKey, color, tasks, doneKey, defaultOpenKey,
  statusOptions, activeId, onAdd, onComplete, onReopen, onEdit, onDelete, onRequestMove,
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: statusKey });
  const rgb = hexToRgb(color || '#6b7280');

  return (
    <section className="flex-1 min-w-[280px] h-full flex flex-col">
      <header className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: color || '#6b7280' }} />
          <h2 className="text-sm font-semibold text-lunar-text">{title}</h2>
        </div>
        <span
          className="glass-column-badge text-2xs px-2 py-0.5 rounded-full"
          style={{ '--col-color': rgb } as React.CSSProperties}
        >
          {tasks.length}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={cn('glass-column flex-1 p-2 overflow-hidden flex flex-col', isOver && 'glass-column-over')}
        style={{ '--col-color': rgb } as React.CSSProperties}
      >
        <div className="flex-1 overflow-y-auto scrollbar-kanban">
          <div className="px-1 pb-2">
            <ColumnQuickAdd onAdd={(t) => onAdd(t)} />
          </div>
          <ul className="space-y-2 pb-2">
            {tasks.map(t => (
              <DraggableTaskCard
                key={t.id}
                task={t}
                statusColor={color}
                onComplete={() => onComplete(t.id)}
                onReopen={() => onReopen(t.id)}
                onEdit={() => onEdit(t)}
                onDelete={() => onDelete(t.id)}
                onRequestMove={status => onRequestMove(t.id, status)}
                isDone={t.status === doneKey as any}
                statusOptions={statusOptions}
                activeId={activeId}
              />
            ))}
            {tasks.length === 0 && (
              <li className="text-center text-sm text-lunar-textSecondary py-6 opacity-50">Vazio</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

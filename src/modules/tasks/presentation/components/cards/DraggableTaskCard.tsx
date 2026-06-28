import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import TaskCard from '@/components/tarefas/TaskCard';
import type { Task } from '@/types/tasks';

export default function DraggableTaskCard(props: {
  task: Task;
  statusColor?: string;
  onComplete: () => void;
  onReopen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRequestMove?: (status: string) => void;
  isDone: boolean;
  statusOptions: { value: string; label: string }[];
  activeId?: string | null;
}) {
  const { task, activeId, statusColor, ...rest } = props;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: { task } });

  const isHidden = isDragging || activeId === task.id;
  const style: React.CSSProperties | undefined = isHidden
    ? { opacity: 0, pointerEvents: 'none' as const }
    : transform
      ? { transform: CSS.Transform.toString(transform) }
      : undefined;

  return (
    <TaskCard
      task={task}
      isDone={rest.isDone}
      onComplete={rest.onComplete}
      onReopen={rest.onReopen}
      onEdit={rest.onEdit}
      onDelete={rest.onDelete}
      onRequestMove={rest.onRequestMove}
      statusOptions={rest.statusOptions}
      dndRef={setNodeRef as any}
      dndListeners={listeners}
      dndAttributes={attributes}
      dndStyle={style}
      isDragging={isHidden}
    />
  );
}

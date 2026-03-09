import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Trash, GripVertical } from 'lucide-react';
import {
  DndContext,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '@/types/tasks';
import { cn } from '@/lib/utils';

interface ChecklistPanelProps {
  items: Task[];
  addTask: (input: any) => Task | any;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  doneKey: string;
  defaultOpenKey: string;
  variant?: 'column' | 'section';
}

export default function ChecklistPanel({
  items,
  addTask,
  updateTask,
  deleteTask,
  doneKey,
  defaultOpenKey,
  variant = 'column',
}: ChecklistPanelProps) {
  const [title, setTitle] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return hideCompleted ? items.filter(i => !i.checked) : items;
  }, [items, hideCompleted]);

  const unchecked = useMemo(() => filtered.filter(i => !i.checked), [filtered]);
  const checked = useMemo(() => filtered.filter(i => i.checked), [filtered]);

  // Sync orderedIds with unchecked items
  useEffect(() => {
    setOrderedIds(prev => {
      const ids = new Set(unchecked.map(t => t.id));
      const kept = prev.filter(id => ids.has(id));
      const keptSet = new Set(kept);
      const newIds = unchecked.filter(t => !keptSet.has(t.id)).map(t => t.id);
      return [...kept, ...newIds];
    });
  }, [unchecked]);

  const orderedUnchecked = useMemo(() => {
    const map = new Map(unchecked.map(t => [t.id, t]));
    return orderedIds.map(id => map.get(id)).filter(Boolean) as Task[];
  }, [orderedIds, unchecked]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: any) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedIds(prev => {
      const oldIndex = prev.indexOf(active.id);
      const newIndex = prev.indexOf(over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const activeTask = activeId ? unchecked.find(t => t.id === activeId) : null;

  const handleAdd = () => {
    const t = title.trim();
    if (!t) return;
    addTask({
      title: t,
      status: defaultOpenKey as any,
      priority: 'medium',
      source: 'manual',
      type: 'checklist',
      checked: false,
    });
    setTitle('');
  };

  const handleToggle = (task: Task, nextChecked: boolean) => {
    updateTask(task.id, {
      checked: nextChecked,
      status: (nextChecked ? doneKey : defaultOpenKey) as any,
    });
  };

  return (
    <section className={cn(variant === 'column' ? 'min-w-[260px] w-[260px]' : '')}>
      <header className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-lunar-text">Checklist</h2>
        <div className="flex items-center gap-2">
          <span className="text-2xs text-lunar-textSecondary">Ocultar concluídas</span>
          <Switch checked={hideCompleted} onCheckedChange={setHideCompleted} />
        </div>
      </header>
      <Card className="p-2 bg-lunar-surface border-lunar-border/60">
        <div className="flex items-center gap-2 mb-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Adicionar item"
            className="h-8"
          />
          <Button size="icon" className="h-8 w-8" onClick={handleAdd}>+</Button>
        </div>

        <div className="space-y-1">
          {/* Unchecked items with DnD */}
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={(e) => setActiveId(e.active.id as string)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
              {orderedUnchecked.map(item => (
                <SortableChecklistItem
                  key={item.id}
                  item={item}
                  onToggle={handleToggle}
                  onDelete={deleteTask}
                  isDragging={activeId === item.id}
                />
              ))}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeTask ? (
                <ChecklistItemContent
                  item={activeTask}
                  onToggle={handleToggle}
                  onDelete={deleteTask}
                  isOverlay
                />
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Checked items (no DnD) */}
          {checked.map(item => (
            <ChecklistItemContent
              key={item.id}
              item={item}
              onToggle={handleToggle}
              onDelete={deleteTask}
            />
          ))}

          {filtered.length === 0 && (
            <div className="py-4 text-center text-2xs text-lunar-textSecondary">Nenhum item</div>
          )}
        </div>
      </Card>
    </section>
  );
}

/* ── Sortable wrapper ── */
function SortableChecklistItem({
  item,
  onToggle,
  onDelete,
  isDragging,
}: {
  item: Task;
  onToggle: (task: Task, checked: boolean) => void;
  onDelete: (id: string) => void;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <li ref={setNodeRef} style={style}>
      <ChecklistItemContent
        item={item}
        onToggle={onToggle}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </li>
  );
}

/* ── Visual row ── */
function ChecklistItemContent({
  item,
  onToggle,
  onDelete,
  dragHandleProps,
  isOverlay,
}: {
  item: Task;
  onToggle: (task: Task, checked: boolean) => void;
  onDelete: (id: string) => void;
  dragHandleProps?: Record<string, any>;
  isOverlay?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-1.5 group px-1 py-1 rounded-md transition-colors hover:bg-muted/40',
        item.checked && 'opacity-50',
        isOverlay && 'bg-card/90 backdrop-blur-[30px] shadow-lg border border-border/40 scale-[1.04]'
      )}
    >
      {/* Drag handle */}
      {dragHandleProps && !item.checked ? (
        <button
          {...dragHandleProps}
          className="mt-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
          tabIndex={-1}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      ) : (
        <span className="w-3.5" />
      )}

      <Checkbox
        checked={!!item.checked}
        onCheckedChange={(v) => onToggle(item, Boolean(v))}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm text-lunar-text', item.checked ? 'line-through opacity-60' : '')}>
          {item.title}
        </p>
        {item.description && (
          <p className="text-2xs text-lunar-textSecondary truncate">{item.description}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onDelete(item.id)}
        title="Excluir"
      >
        <Trash className="h-4 w-4" />
      </Button>
    </div>
  );
}

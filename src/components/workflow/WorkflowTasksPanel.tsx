import React, { useMemo, useState, useEffect } from "react";
import { Plus, CalendarDays, ChevronDown, ChevronUp, PanelRightClose, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useSupabaseTasks } from "@/hooks/useSupabaseTasks";
import { cn } from "@/lib/utils";
import { endOfMonth, parseISO, isWithinInterval, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DndContext,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@/types/tasks";

interface WorkflowTasksPanelProps {
  currentMonth: { month: number; year: number };
  onCollapse?: () => void;
}

export function WorkflowTasksPanel({ currentMonth, onCollapse }: WorkflowTasksPanelProps) {
  const { tasks, updateTask, addTask, deleteTask, loading } = useSupabaseTasks();
  const [showCompleted, setShowCompleted] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const monthStart = useMemo(
    () => new Date(currentMonth.year, currentMonth.month - 1, 1),
    [currentMonth]
  );
  const monthEnd = useMemo(() => endOfMonth(monthStart), [monthStart]);

  const monthTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.dueDate) {
        try {
          return isWithinInterval(parseISO(t.dueDate), { start: monthStart, end: monthEnd });
        } catch { return false; }
      }
      if (t.createdAt) {
        try {
          return isWithinInterval(parseISO(t.createdAt), { start: monthStart, end: monthEnd });
        } catch { return false; }
      }
      return false;
    });
  }, [tasks, monthStart, monthEnd]);

  const pendingTasks = useMemo(() => monthTasks.filter((t) => t.status !== "done"), [monthTasks]);
  const completedTasks = useMemo(() => monthTasks.filter((t) => t.status === "done"), [monthTasks]);

  // Sync orderedIds with pendingTasks
  useEffect(() => {
    setOrderedIds((prev) => {
      const pendingIds = new Set(pendingTasks.map((t) => t.id));
      const kept = prev.filter((id) => pendingIds.has(id));
      const keptSet = new Set(kept);
      const newIds = pendingTasks.filter((t) => !keptSet.has(t.id)).map((t) => t.id);
      return [...kept, ...newIds];
    });
  }, [pendingTasks]);

  const orderedPending = useMemo(() => {
    const map = new Map(pendingTasks.map((t) => [t.id, t]));
    return orderedIds.map((id) => map.get(id)).filter(Boolean) as Task[];
  }, [orderedIds, pendingTasks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: any) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedIds((prev) => {
      const oldIndex = prev.indexOf(active.id);
      const newIndex = prev.indexOf(over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleToggleStatus = async (task: Task) => {
    await updateTask(task.id, { status: task.status === "done" ? "todo" : "done" });
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    await addTask({ title: newTaskTitle.trim(), status: "todo", priority: "medium", source: "manual", type: "simple" });
    setNewTaskTitle("");
    setIsAdding(false);
  };

  const activeTask = activeId ? pendingTasks.find((t) => t.id === activeId) : null;
  const monthLabel = format(monthStart, "MMMM", { locale: ptBR });

  return (
    <div className="flex flex-col h-full rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl backdrop-saturate-[1.8] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold capitalize">Tarefas de {monthLabel}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground tabular-nums">
            {pendingTasks.length} pendente{pendingTasks.length !== 1 ? "s" : ""}
          </span>
          {onCollapse && (
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onCollapse} title="Fechar painel de tarefas">
              <PanelRightClose className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 space-y-1">
          {loading && monthTasks.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">Carregando tarefas...</p>
          )}
          {!loading && monthTasks.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma tarefa para este mês</p>
          )}

          {/* Pending tasks with DnD */}
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={(e) => setActiveId(e.active.id as string)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
              {orderedPending.map((task) => (
                <SortableTaskRow
                  key={task.id}
                  task={task}
                  onToggle={() => handleToggleStatus(task)}
                  onDelete={() => deleteTask(task.id)}
                  isDragging={activeId === task.id}
                />
              ))}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeTask ? (
                <TaskRowContent task={activeTask} onToggle={() => {}} onDelete={() => {}} isOverlay />
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Completed section */}
          {completedTasks.length > 0 && (
            <>
              <button onClick={() => setShowCompleted(!showCompleted)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground py-2 w-full">
                {showCompleted ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {completedTasks.length} concluída{completedTasks.length !== 1 ? "s" : ""}
              </button>
              {showCompleted && completedTasks.map((task) => (
                <TaskRowContent
                  key={task.id}
                  task={task}
                  onToggle={() => handleToggleStatus(task)}
                  onDelete={() => deleteTask(task.id)}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Add task */}
      <div className="border-t border-border/40 p-3">
        {isAdding ? (
          <form onSubmit={(e) => { e.preventDefault(); handleAddTask(); }} className="flex items-center gap-2">
            <input
              autoFocus
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Nova tarefa..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onBlur={() => { if (!newTaskTitle.trim()) setIsAdding(false); }}
              onKeyDown={(e) => { if (e.key === "Escape") { setIsAdding(false); setNewTaskTitle(""); } }}
            />
            <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-xs">Salvar</Button>
          </form>
        ) : (
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground gap-1.5 h-8" onClick={() => setIsAdding(true)}>
            <Plus className="h-3.5 w-3.5" />
            Adicionar tarefa
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Sortable wrapper ── */
function SortableTaskRow({ task, onToggle, onDelete, isDragging }: { task: Task; onToggle: () => void; onDelete: () => void; isDragging: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });

  const style = {
    transform: isDragging ? CSS.Transform.toString(transform) : undefined,
    transition: isDragging ? transition : undefined,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskRowContent task={task} onToggle={onToggle} onDelete={onDelete} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

/* ── Visual row ── */
function TaskRowContent({
  task,
  onToggle,
  onDelete,
  dragHandleProps,
  isOverlay,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  dragHandleProps?: Record<string, any>;
  isOverlay?: boolean;
}) {
  const isDone = task.status === "done";
  const priorityColor: Record<string, string> = { high: "bg-destructive", medium: "bg-amber-500", low: "bg-blue-400" };

  return (
    <div
      className={cn(
        "flex items-start gap-1.5 px-1.5 py-1.5 rounded-md hover:bg-muted/50 transition-colors group",
        isDone && "opacity-50",
        isOverlay && "bg-card/90 backdrop-blur-[30px] shadow-lg border border-border/40 scale-[1.04]"
      )}
    >
      {/* Drag handle */}
      {dragHandleProps && !isDone ? (
        <button {...dragHandleProps} className="mt-0.5 opacity-30 group-hover:opacity-60 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none" tabIndex={-1}>
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      ) : (
        <span className="w-3.5" />
      )}

      <Checkbox checked={isDone} onCheckedChange={() => onToggle()} className="mt-0.5 h-3.5 w-3.5" />

      <div className="flex-1 min-w-0">
        <span className={cn("text-sm leading-snug block truncate", isDone && "line-through text-muted-foreground")}>
          {task.title}
        </span>
        {task.dueDate && (
          <span className="text-[10px] text-muted-foreground">
            {format(parseISO(task.dueDate), "dd MMM", { locale: ptBR })}
          </span>
        )}
      </div>

      {/* Delete button on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="mt-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-destructive"
        title="Excluir tarefa"
        tabIndex={-1}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <span className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0", priorityColor[task.priority] || "bg-muted")} title={task.priority} />
    </div>
  );
}

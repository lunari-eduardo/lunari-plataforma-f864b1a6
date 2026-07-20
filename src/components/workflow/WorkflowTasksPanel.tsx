import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Plus,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  PanelRightClose,
  Trash2,
  GripVertical,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useSupabaseTasks } from "@/hooks/useSupabaseTasks";
import { useSupabaseTaskStatuses } from "@/hooks/useSupabaseTaskStatuses";
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
import { MIRROR_ROOT_TAG } from "@/features/workflow/domain/productTaskMirror";
import { isMirrorTask } from "@/features/workflow/domain/taskClassification";
import { useMirrorToggleHandler } from "@/features/workflow/realtime/useProductTaskMirror";
import type { ProdutoWorkflowFlow } from "@/features/workflow/domain/productFlow";

/** Deriva título/subtítulo enxuto para tarefas-espelho.
 *  Formato completo: "<Etapa> — <Produto> · <Cliente>". */
function deriveMirrorDisplay(task: Task): { title: string; subtitle?: string } {
  if (!task.tags?.includes(MIRROR_ROOT_TAG)) return { title: task.title };
  const [etapa, resto] = task.title.split(" — ");
  if (!resto) return { title: task.title };
  return { title: etapa.trim(), subtitle: resto.trim() };
}

interface WorkflowTasksPanelProps {
  currentMonth: { month: number; year: number };
  monthSessionIds?: Set<string>;
  onSessionProductsChange?: (sessionId: string, novosProdutos: ProdutoWorkflowFlow[]) => Promise<unknown> | unknown;
  onCollapse?: () => void;
}

export function WorkflowTasksPanel({ currentMonth, monthSessionIds, onSessionProductsChange, onCollapse }: WorkflowTasksPanelProps) {
  const { tasks, updateTask, addTask, deleteTask, loading } = useSupabaseTasks();
  const { isTerminalKey, getDoneKey, getDefaultOpenKey } = useSupabaseTaskStatuses();
  const [showCompleted, setShowCompleted] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Ids das tarefas-espelho com toggle em vôo — checkbox mostra checked
  // imediatamente e ignora cliques duplicados enquanto persiste.
  const [pendingToggleIds, setPendingToggleIds] = useState<Set<string>>(() => new Set());


  const monthStart = useMemo(
    () => new Date(currentMonth.year, currentMonth.month - 1, 1),
    [currentMonth]
  );
  const monthEnd = useMemo(() => endOfMonth(monthStart), [monthStart]);

  // === Segregação ===
  // 1) Tarefas-espelho (Produção): aparecem apenas para sessões do mês corrente
  //    (evita poluir o dock com produtos de meses vizinhos em cache).
  // 2) Tarefas normais: SÓ aparecem se tiverem dueDate dentro do mês corrente.
  const mirrorAll = useMemo(() => {
    const all = tasks.filter(isMirrorTask);
    if (!monthSessionIds || monthSessionIds.size === 0) return all;
    return all.filter((t) => t.relatedSessionId && monthSessionIds.has(t.relatedSessionId));
  }, [tasks, monthSessionIds]);
  const normalMonth = useMemo(() => {
    return tasks.filter((t) => {
      if (isMirrorTask(t)) return false;
      if (!t.dueDate) return false;
      try {
        return isWithinInterval(parseISO(t.dueDate), { start: monthStart, end: monthEnd });
      } catch {
        return false;
      }
    });
  }, [tasks, monthStart, monthEnd]);

  const mirrorPending = useMemo(
    () => mirrorAll.filter((t) => !isTerminalKey(t.status)),
    [mirrorAll, isTerminalKey]
  );

  const normalPending = useMemo(
    () => normalMonth.filter((t) => !isTerminalKey(t.status)),
    [normalMonth, isTerminalKey]
  );
  const normalDone = useMemo(
    () => normalMonth.filter((t) => isTerminalKey(t.status)),
    [normalMonth, isTerminalKey]
  );

  // Concluídas: apenas tarefas normais. Tarefas-espelho são apagadas ao entregar.
  const completedAll = normalDone;
  const totalPending = mirrorPending.length + normalPending.length;
  const isEmpty = mirrorPending.length === 0 && normalMonth.length === 0;

  // Sync orderedIds só com tarefas normais pendentes (espelho é ordenado automaticamente).
  useEffect(() => {
    setOrderedIds((prev) => {
      const ids = new Set(normalPending.map((t) => t.id));
      const kept = prev.filter((id) => ids.has(id));
      const keptSet = new Set(kept);
      const newIds = normalPending.filter((t) => !keptSet.has(t.id)).map((t) => t.id);
      return [...kept, ...newIds];
    });
  }, [normalPending]);

  const orderedNormalPending = useMemo(() => {
    const map = new Map(normalPending.map((t) => [t.id, t]));
    return orderedIds.map((id) => map.get(id)).filter(Boolean) as Task[];
  }, [orderedIds, normalPending]);

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

  const toggleMirror = useMirrorToggleHandler({
    updateSessionProducts: async (sessionId, novosProdutos) => {
      if (onSessionProductsChange) await onSessionProductsChange(sessionId, novosProdutos);
    },
    updateTaskLocal: async (taskId, patch) => {
      await updateTask(taskId, patch as any);
    },
    removeTaskLocal: async (taskId) => {
      await deleteTask(taskId);
    },
  });

  const handleToggleStatus = async (task: Task) => {
    if (isMirrorTask(task)) {
      const nextIsDone = !isTerminalKey(task.status);
      await toggleMirror(task, nextIsDone);
      return;
    }
    const nextStatus = isTerminalKey(task.status) ? getDefaultOpenKey() : getDoneKey();
    await updateTask(task.id, { status: nextStatus });
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    await addTask({
      title: newTaskTitle.trim(),
      status: getDefaultOpenKey(),
      priority: "medium",
      source: "manual",
      type: "simple",
    });
    setNewTaskTitle("");
    setIsAdding(false);
  };

  const activeTask = activeId ? normalPending.find((t) => t.id === activeId) : null;
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
            {totalPending} pendente{totalPending !== 1 ? "s" : ""}
          </span>
          {onCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onCollapse}
              title="Fechar painel de tarefas"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 space-y-4">
          {loading && isEmpty && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Carregando tarefas...
            </p>
          )}
          {!loading && isEmpty && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Nenhuma tarefa neste mês
            </p>
          )}

          {/* === Seção: Produção (tarefas-espelho) === */}
          {mirrorPending.length > 0 && (
            <section>
              <SectionHeader label="Produção" count={mirrorPending.length} />
              <div className="space-y-1 mt-1">
                {mirrorPending.map((task) => (
                  <TaskRowContent
                    key={task.id}
                    task={task}
                    onToggle={() => handleToggleStatus(task)}
                    onDelete={() => deleteTask(task.id)}
                    isDone={false}
                  />
                ))}
              </div>
            </section>
          )}

          {/* === Seção: Vencendo neste mês === */}
          {(normalPending.length > 0 || mirrorPending.length > 0) && (
            <section>
              <SectionHeader
                label="Vencendo neste mês"
                count={normalPending.length}
              />
              {normalPending.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 py-2 px-1">
                  Sem tarefas com prazo neste mês.
                </p>
              ) : (
                <div className="mt-1">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={rectIntersection}
                    modifiers={[restrictToVerticalAxis]}
                    onDragStart={(e) => setActiveId(e.active.id as string)}
                    onDragEnd={handleDragEnd}
                    onDragCancel={() => setActiveId(null)}
                  >
                    <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                      <div className="space-y-1">
                        {orderedNormalPending.map((task) => (
                          <SortableTaskRow
                            key={task.id}
                            task={task}
                            onToggle={() => handleToggleStatus(task)}
                            onDelete={() => deleteTask(task.id)}
                            isDragging={activeId === task.id}
                            isDone={isTerminalKey(task.status)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                  {createPortal(
                    <DragOverlay dropAnimation={null}>
                      {activeTask ? (
                        <TaskRowContent
                          task={activeTask}
                          onToggle={() => {}}
                          onDelete={() => {}}
                          isOverlay
                          isDone={isTerminalKey(activeTask.status)}
                        />
                      ) : null}
                    </DragOverlay>,
                    document.body
                  )}
                </div>
              )}
              <Link
                to="/app/tarefas"
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                Ver todas as tarefas
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </section>
          )}

          {/* === Seção: Concluídas do mês (colapsável) === */}
          {completedAll.length > 0 && (
            <section>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground py-1"
              >
                {showCompleted ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                Concluídas ({completedAll.length})
              </button>
              {showCompleted && (
                <div className="space-y-1 mt-1">
                  {completedAll.map((task) => (
                    <TaskRowContent
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggleStatus(task)}
                      onDelete={() => deleteTask(task.id)}
                      isDone
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Add task */}
      <div className="border-t border-border/40 p-3">
        {isAdding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddTask();
            }}
            className="flex items-center gap-2"
          >
            <input
              autoFocus
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Nova tarefa..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onBlur={() => {
                if (!newTaskTitle.trim()) setIsAdding(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsAdding(false);
                  setNewTaskTitle("");
                }
              }}
            />
            <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-xs">
              Salvar
            </Button>
          </form>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs text-muted-foreground gap-1.5 h-8"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar tarefa
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Cabeçalho de seção ── */
function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-1 pb-1 border-b border-border/30">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      <span className="text-[10px] tabular-nums text-muted-foreground/70">{count}</span>
    </div>
  );
}

/* ── Sortable wrapper ── */
function SortableTaskRow({
  task,
  onToggle,
  onDelete,
  isDragging,
  isDone,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  isDragging: boolean;
  isDone: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskRowContent
        task={task}
        onToggle={onToggle}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDone={isDone}
      />
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
  isDone = false,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  dragHandleProps?: Record<string, any>;
  isOverlay?: boolean;
  isDone?: boolean;
}) {
  const priorityColor: Record<string, string> = {
    high: "bg-destructive",
    medium: "bg-amber-500",
    low: "bg-blue-400",
  };

  return (
    <div
      className={cn(
        "flex items-start gap-1.5 px-1.5 py-1.5 rounded-md hover:bg-muted/50 transition-colors group",
        isDone && "opacity-50",
        isOverlay &&
          "bg-card/90 backdrop-blur-[30px] shadow-lg border border-border/40 scale-[1.04]"
      )}
    >
      {/* Drag handle */}
      {dragHandleProps && !isDone ? (
        <button
          {...dragHandleProps}
          className="mt-0.5 opacity-30 group-hover:opacity-60 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
          tabIndex={-1}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      ) : (
        <span className="w-3.5" />
      )}

      <Checkbox
        checked={isDone}
        onCheckedChange={() => onToggle()}
        className="mt-0.5 h-3.5 w-3.5"
      />

      {(() => {
        const { title, subtitle } = deriveMirrorDisplay(task);
        return (
          <div className="flex-1 min-w-0">
            <span
              className={cn(
                "text-sm leading-snug block truncate",
                isDone && "line-through text-muted-foreground"
              )}
            >
              {title}
            </span>
            {subtitle && (
              <span className="text-[10px] text-muted-foreground block truncate">
                {subtitle}
              </span>
            )}
            {task.dueDate && !subtitle && (
              <span className="text-[10px] text-muted-foreground">
                {format(parseISO(task.dueDate), "dd MMM", { locale: ptBR })}
              </span>
            )}
          </div>
        );
      })()}

      {/* Delete button on hover — oculto para tarefas-espelho (são derivadas). */}
      {!isMirrorTask(task) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="mt-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-destructive"
          title="Excluir tarefa"
          tabIndex={-1}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      <span
        className={cn(
          "h-2 w-2 rounded-full mt-1.5 shrink-0",
          priorityColor[task.priority] || "bg-muted"
        )}
        title={task.priority}
      />
    </div>
  );
}

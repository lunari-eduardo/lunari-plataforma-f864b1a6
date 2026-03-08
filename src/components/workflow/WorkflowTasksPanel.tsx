import React, { useMemo, useState } from "react";
import { Plus, CalendarDays, ChevronDown, ChevronUp, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSupabaseTasks } from "@/hooks/useSupabaseTasks";
import { cn } from "@/lib/utils";
import { startOfMonth, endOfMonth, parseISO, isWithinInterval, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Task } from "@/types/tasks";

interface WorkflowTasksPanelProps {
  currentMonth: { month: number; year: number };
}

export function WorkflowTasksPanel({ currentMonth }: WorkflowTasksPanelProps) {
  const { tasks, updateTask, addTask, loading } = useSupabaseTasks();
  const [showCompleted, setShowCompleted] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  // Filter tasks for current month by dueDate
  const monthStart = useMemo(
    () => new Date(currentMonth.year, currentMonth.month - 1, 1),
    [currentMonth]
  );
  const monthEnd = useMemo(
    () => endOfMonth(monthStart),
    [monthStart]
  );

  const monthTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!t.dueDate) return false;
      try {
        const d = parseISO(t.dueDate);
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
      } catch {
        return false;
      }
    });
  }, [tasks, monthStart, monthEnd]);

  const pendingTasks = useMemo(
    () => monthTasks.filter((t) => t.status !== "done"),
    [monthTasks]
  );
  const completedTasks = useMemo(
    () => monthTasks.filter((t) => t.status === "done"),
    [monthTasks]
  );

  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    await updateTask(task.id, { status: newStatus });
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    // Create task with dueDate set to first day of current month
    await addTask({
      title: newTaskTitle.trim(),
      status: "todo",
      priority: "medium",
      source: "manual",
      type: "simple",
      dueDate: format(monthStart, "yyyy-MM-dd"),
    });
    setNewTaskTitle("");
    setIsAdding(false);
  };

  const priorityColor: Record<string, string> = {
    high: "bg-red-500",
    medium: "bg-amber-500",
    low: "bg-blue-400",
  };

  const monthLabel = format(monthStart, "MMMM", { locale: ptBR });

  return (
    <div className="flex flex-col h-full rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl backdrop-saturate-[1.8] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold capitalize">
            Tarefas de {monthLabel}
          </h3>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {pendingTasks.length} pendente{pendingTasks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Task list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-1">
          {loading && monthTasks.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Carregando tarefas...
            </p>
          )}

          {!loading && monthTasks.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Nenhuma tarefa para este mês
            </p>
          )}

          {/* Pending tasks */}
          {pendingTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              priorityColor={priorityColor}
              onToggle={() => handleToggleStatus(task)}
            />
          ))}

          {/* Completed section */}
          {completedTasks.length > 0 && (
            <>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground py-2 w-full"
              >
                {showCompleted ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {completedTasks.length} concluída{completedTasks.length !== 1 ? "s" : ""}
              </button>
              {showCompleted &&
                completedTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    priorityColor={priorityColor}
                    onToggle={() => handleToggleStatus(task)}
                  />
                ))}
            </>
          )}
        </div>
      </ScrollArea>

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

function TaskRow({
  task,
  priorityColor,
  onToggle,
}: {
  task: Task;
  priorityColor: Record<string, string>;
  onToggle: () => void;
}) {
  const isDone = task.status === "done";

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors group",
        isDone && "opacity-50"
      )}
    >
      <Checkbox
        checked={isDone}
        onCheckedChange={() => onToggle()}
        className="mt-0.5 h-3.5 w-3.5"
      />
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-sm leading-snug block truncate",
            isDone && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </span>
        {task.dueDate && (
          <span className="text-[10px] text-muted-foreground">
            {format(parseISO(task.dueDate), "dd MMM", { locale: ptBR })}
          </span>
        )}
      </div>
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

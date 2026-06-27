import { useCallback, useEffect, useMemo, useState } from 'react';
import './Tarefas.css';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTasks } from '@/modules/tasks/presentation/hooks/useTasks';
import { tasksStore } from '@/modules/tasks/presentation/store/tasksStore';
import { useSupabaseTaskPeople } from '@/hooks/useSupabaseTaskPeople';

import type { Task } from '@/types/tasks';
import TaskFormModal from '@/modules/tasks/presentation/components/TaskFormModal';
import QuickCaptureBar from '@/components/tarefas/QuickCaptureBar';
import TaskCard from '@/components/tarefas/TaskCard';
import PriorityLegend from '@/components/tarefas/PriorityLegend';
import { useSupabaseTaskStatuses } from '@/hooks/useSupabaseTaskStatuses';
import ManageTaskStatusesModal from '@/components/tarefas/ManageTaskStatusesModal';
import ChecklistPanel from '@/components/tarefas/ChecklistPanel';
import TaskFiltersBar, { type TaskFilters } from '@/components/tarefas/TaskFiltersBar';
import { DndContext, rectIntersection, useSensor, useSensors, MouseSensor, TouchSensor, DragOverlay } from '@dnd-kit/core';
import KanbanColumn from '@/modules/tasks/presentation/components/KanbanColumn';
import TasksListView from '@/modules/tasks/presentation/components/TasksListView';
import UndoButton from '@/modules/tasks/presentation/components/UndoButton';
import { useTasksUndo } from '@/modules/tasks/presentation/hooks/useTasksUndo';
import { hexToRgb } from '@/modules/tasks/presentation/components/utils';
import { useRunCapability } from '@/shared/capability/react';
import {
  createTask as createTaskCap,
  updateTask as updateTaskCap,
  deleteTask as deleteTaskCap,
  moveTask as moveTaskCap,
  completeTask as completeTaskCap,
  reopenTask as reopenTaskCap,
} from '@/modules/tasks';
import { isOk } from '@/shared/result';

function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  return tasks.filter(task => {
    if (task.type === 'checklist' && (!task.activeSections || task.activeSections.length === 1)) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesTitle = task.title.toLowerCase().includes(searchLower);
      const matchesDescription = task.description?.toLowerCase().includes(searchLower) || false;
      const matchesTags = task.tags?.some(tag => tag.toLowerCase().includes(searchLower)) || false;
      if (!matchesTitle && !matchesDescription && !matchesTags) return false;
    }
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (filters.assignee !== 'all' && task.assigneeId !== filters.assignee) return false;
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      switch (filters.dateRange) {
        case 'today': return dueDate >= today && dueDate < tomorrow;
        case 'week': return dueDate <= weekFromNow;
        case 'month': return dueDate <= monthFromNow;
        case 'overdue': return dueDate < today;
        default: return true;
      }
    }
    return true;
  });
}

export default function Tarefas() {
  // Onda 4c: leitura via tasksStore (alimentado pelo canal realtime único em App.tsx).
  // Mutações vão por Capabilities; updates otimistas via `tasksStore.applyOptimisticPatch`.
  const tasks = useTasks();
  const applyOptimisticPatch = useCallback(
    (id: string, patch: Partial<Task>) => tasksStore.applyOptimisticPatch(id, patch),
    [],
  );
  // O canal realtime já reflete mudanças no store — `refetch` vira no-op (mantido
  // por compatibilidade com `useTasksUndo` e error paths das capabilities).
  const refetch = useCallback(() => {}, []);
  const { people } = useSupabaseTaskPeople();
  const { toast } = useToast();
  const run = useRunCapability();


  const [view, setView] = useState<'kanban' | 'list'>(() => (localStorage.getItem('lunari_tasks_view') as any) || 'kanban');
  const [filters, setFilters] = useState<TaskFilters>({ search: '', status: 'all', priority: 'all', assignee: 'all', dateRange: 'all' });
  const { statuses, getDoneKey, getDefaultOpenKey } = useSupabaseTaskStatuses();
  const doneKey = getDoneKey();
  const defaultOpenKey = getDefaultOpenKey();
  const statusOptions = useMemo(() => statuses.map(s => ({ value: s.key, label: s.name })), [statuses]);
  const assigneeOptions = useMemo(() => [...people.map(p => ({ value: p.id, label: p.name }))], [people]);
  const [manageStatusesOpen, setManageStatusesOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<string | undefined>(undefined);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 6 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } });
  const sensors = useSensors(mouseSensor, touchSensor);


  const checklistItems = useMemo(() => tasks.filter(t => t.type === 'checklist'), [tasks]);
  const filtered = useMemo(() => filterTasks(tasks, filters), [tasks, filters]);
  const groups = useMemo(() => {
    const map: Record<string, Task[]> = {};
    statuses.forEach(s => { map[s.key] = []; });
    filtered.forEach(t => { (map[t.status] ||= []).push(t); });
    return map;
  }, [filtered, statuses]);

  const activeTask = useMemo(() => (activeId ? tasks.find(t => t.id === activeId) : null), [activeId, tasks]);
  const activeTaskColor = useMemo(
    () => (activeTask ? statuses.find(s => s.key === activeTask.status)?.color : undefined),
    [activeTask, statuses],
  );

  // ───────────── Capabilities helpers ─────────────
  const handleCapError = useCallback(
    (action: string, message: string) => {
      toast({ title: `Erro ao ${action}`, description: message, variant: 'destructive' });
    },
    [toast],
  );

  // ───────────── Undo (até 3 ações) ─────────────
  const statusNameOf = useCallback(
    (key: string) => statuses.find(s => s.key === key)?.name ?? key,
    [statuses],
  );
  const undo = useTasksUndo({ applyOptimisticPatch, refetch, statusNameOf });

  const createTask = useCallback(
    async (input: Partial<Task> & { title: string }) => {
      const res = await run(createTaskCap, {
        title: input.title,
        description: input.description,
        status: input.status ?? defaultOpenKey,
        priority: (input.priority ?? 'medium') as any,
        type: (input.type ?? 'simple') as any,
        dueDate: input.dueDate,
        assigneeName: input.assigneeName,
        tags: input.tags,
        source: 'user',
        activeSections: input.activeSections as any,
        checklistItems: input.checklistItems as any,
        callToAction: input.callToAction,
        socialPlatforms: input.socialPlatforms,
        attachments: input.attachments as any,
        captions: input.captions as any,
        notes: input.notes,
        estimatedHours: input.estimatedHours,
      });
      if (!isOk(res)) handleCapError('criar tarefa', res.error.message);
      else refetch();
    },
    [run, defaultOpenKey, handleCapError, refetch],
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      const keys = Object.keys(patch);

      // Toggle de checkbox do painel checklist: vem {checked} ou {checked,status}.
      // Routeia para complete/reopen (que escrevem checked + status + completed_at).
      if ('checked' in patch && patch.checked !== undefined) {
        const current = tasks.find(t => t.id === id);
        if (patch.checked === true) {
          if (current && current.status !== doneKey) undo.pushComplete(id, current.status);
          const res = await run(completeTaskCap, { id });
          if (!isOk(res)) handleCapError('concluir tarefa', res.error.message);
          else refetch();
          return;
        }
        const target = patch.status && patch.status !== doneKey ? patch.status : defaultOpenKey;
        if (current?.status === doneKey) undo.pushReopen(id, doneKey);
        const res = await run(reopenTaskCap, { id, toStatus: target });
        if (!isOk(res)) handleCapError('reabrir tarefa', res.error.message);
        else refetch();
        return;
      }

      // Status changes => roteia para capabilities específicas
      if (patch.status && keys.length === 1) {
        if (patch.status === doneKey) {
          const res = await run(completeTaskCap, { id });
          if (!isOk(res)) handleCapError('concluir tarefa', res.error.message);
          else refetch();
          return;
        }
        const current = tasks.find(t => t.id === id);
        if (current?.status === doneKey) {
          const res = await run(reopenTaskCap, { id, toStatus: patch.status });
          if (!isOk(res)) handleCapError('reabrir tarefa', res.error.message);
          else refetch();
          return;
        }
        const res = await run(moveTaskCap, { id, toStatus: patch.status });
        if (!isOk(res)) handleCapError('mover tarefa', res.error.message);
        else refetch();
        return;
      }

      // Patch genérico — vai por updateTask
      const cleanPatch: Record<string, unknown> = { ...patch };
      delete cleanPatch.id;
      delete cleanPatch.createdAt;
      delete cleanPatch.source;
      delete cleanPatch.completedAt;
      delete cleanPatch.snoozeUntil;
      delete cleanPatch.lastNotifiedAt;
      delete cleanPatch.assigneeId;
      delete cleanPatch.relatedBudgetId;
      if (Object.keys(cleanPatch).length === 0) return;
      const res = await run(updateTaskCap, { id, patch: cleanPatch as any });
      if (!isOk(res)) handleCapError('atualizar tarefa', res.error.message);
      else refetch();
    },
    [run, tasks, doneKey, defaultOpenKey, handleCapError, refetch, undo],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const res = await run(deleteTaskCap, { id });
      if (!isOk(res)) handleCapError('excluir tarefa', res.error.message);
      else refetch();
    },
    [run, handleCapError, refetch],
  );

  // Adaptador para componentes que esperam um `addTask` (ChecklistPanel etc.)
  const addTask = useCallback(
    async (input: Partial<Task> & { title: string }) => {
      await createTask(input);
      return null as unknown as Task;
    },
    [createTask],
  );




  // ───────────── Handlers UI ─────────────
  const handleComplete = (id: string) => {
    const t = tasks.find(x => x.id === id);
    if (t && t.status !== doneKey) undo.pushComplete(id, t.status);
    updateTask(id, { status: doneKey } as any);
  };
  const handleReopen = (id: string) => {
    undo.pushReopen(id, doneKey);
    updateTask(id, { status: defaultOpenKey } as any);
  };
  const handleDelete = (id: string) => {
    const snap = tasks.find(x => x.id === id);
    if (snap) undo.pushDelete(snap);
    deleteTask(id);
  };
  const handleMove = (id: string, status: string) => {
    const t = tasks.find(x => x.id === id);
    if (t && t.status !== status) undo.pushMove(id, t.status, status);
    updateTask(id, { status } as any);
  };

  const openCreate = (status?: string) => {
    setCreateStatus(status);
    setCreateOpen(true);
  };

  return (
    <div className="page-tarefas-modern h-[calc(100vh-4rem)] flex flex-col transition-colors duration-300">
      <div className="flex-shrink-0 px-2 pt-3 space-y-3">
        <header className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 md:gap-2 flex-wrap">
            <Select value={view} onValueChange={v => { setView(v as any); localStorage.setItem('lunari_tasks_view', v); }}>
              <SelectTrigger className="h-8 w-[100px] md:w-[120px] text-xs md:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kanban">Kanban</SelectItem>
                <SelectItem value="list">Lista</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setManageStatusesOpen(true)} className="text-xs md:text-sm">
              <span className="hidden md:inline">Gerenciar</span>
              <span className="md:hidden">Config</span>
            </Button>
            <UndoButton entries={undo.entries} onUndo={undo.performUndo} />
            <Button size="sm" onClick={() => openCreate()} className="glass-btn-primary text-xs md:text-sm">
              Nova tarefa
            </Button>
          </div>
        </header>

        <QuickCaptureBar
          onCapture={async (title) => {
            await createTask({ title, status: defaultOpenKey, priority: 'medium', type: 'simple' });
          }}
        />

        <TaskFiltersBar filters={filters} onFiltersChange={setFilters} statusOptions={statusOptions} assigneeOptions={assigneeOptions} />
        <PriorityLegend />
      </div>

      <div className="flex-1 overflow-hidden">
        {view === 'kanban' ? (
          <div className="flex flex-col h-full">
            <DndContext
              sensors={sensors}
              collisionDetection={rectIntersection}
              onDragStart={e => { setActiveId(String(e.active.id)); }}
              onDragEnd={e => {
                const overId = e.over?.id as string | undefined;
                const draggedId = activeId;
                // Limpa o overlay ANTES de qualquer await para não piscar.
                requestAnimationFrame(() => setActiveId(null));
                if (draggedId && overId) {
                  const current = tasks.find(tt => tt.id === draggedId);
                  if (current && current.status !== overId) {
                    undo.pushMove(draggedId, current.status, overId);
                    // Update otimista: card aparece na coluna destino imediatamente.
                    applyOptimisticPatch(draggedId, { status: overId } as any);
                    updateTask(draggedId, { status: overId } as any);
                  }
                }
              }}
              onDragCancel={() => { requestAnimationFrame(() => setActiveId(null)); }}
            >
              <div className="flex-1 relative">
                <div
                  className="absolute inset-0 overflow-x-auto overflow-y-hidden scrollbar-kanban-h"
                  style={{ overscrollBehaviorX: 'contain', touchAction: 'pan-x pan-y' }}
                  onWheel={(e) => {
                    // Trackpad horizontal já entrega deltaX — não interferir.
                    if (e.deltaX !== 0) return;
                    // Se o cursor está sobre uma coluna com scroll vertical pendente, deixa rolar a coluna.
                    const path = e.nativeEvent.composedPath() as HTMLElement[];
                    const verticalScroller = path.find(
                      el => el?.classList?.contains?.('scrollbar-kanban') &&
                            el.scrollHeight > el.clientHeight
                    );
                    if (verticalScroller) return;
                    e.currentTarget.scrollLeft += e.deltaY;
                  }}
                >

                  <div className="flex h-full gap-3 min-w-max px-2 py-1">
                    <ChecklistPanel
                      items={checklistItems}
                      addTask={addTask}
                      updateTask={updateTask}
                      deleteTask={deleteTask}
                      doneKey={doneKey}
                      defaultOpenKey={defaultOpenKey}
                      variant="column"
                    />
                    {statuses.map(col => (
                      <KanbanColumn
                        key={col.id}
                        title={col.name}
                        statusKey={col.key as any}
                        color={col.color}
                        tasks={groups[col.key] || []}
                        doneKey={doneKey}
                        defaultOpenKey={defaultOpenKey}
                        statusOptions={statusOptions}
                        activeId={activeId}
                        onAdd={async (title) => {
                          await createTask({ title, status: col.key, priority: 'medium', type: 'simple' });
                        }}
                        onComplete={handleComplete}
                        onReopen={handleReopen}
                        onEdit={setEditTask}
                        onDelete={handleDelete}
                        onRequestMove={handleMove}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <DragOverlay dropAnimation={null}>
                {activeTask ? (
                  <div
                    className="glass-drag-overlay pointer-events-none relative overflow-hidden"
                    style={{ '--card-color': hexToRgb(activeTaskColor || '#6b7280') } as React.CSSProperties}
                  >
                    <TaskCard
                      task={activeTask}
                      onComplete={() => {}}
                      onReopen={() => {}}
                      onEdit={() => {}}
                      onDelete={() => {}}
                      onRequestMove={() => {}}
                      isDone={activeTask.status === doneKey as any}
                      statusOptions={statusOptions}
                      isDragging={true}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        ) : (
          <TasksListView
            filtered={filtered}
            checklistItems={checklistItems}
            doneKey={doneKey}
            defaultOpenKey={defaultOpenKey}
            addTask={addTask}
            updateTask={updateTask}
            deleteTask={deleteTask}
            onView={setEditTask}
            onComplete={(id) => { handleComplete(id); }}
          />
        )}
      </div>

      {/* Modal único — criação */}
      <TaskFormModal
        open={createOpen}
        onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreateStatus(undefined); }}
        mode="create"
        initial={{ status: createStatus ?? defaultOpenKey, priority: 'medium', type: 'simple' }}
        onSubmit={async (data) => {
          await createTask(data as any);
        }}
      />

      {/* Modal único — edição (com botão Excluir) */}
      <TaskFormModal
        open={!!editTask}
        onOpenChange={(o) => { if (!o) setEditTask(null); }}
        mode="edit"
        initial={editTask ?? undefined}
        onSubmit={async (data) => {
          if (!editTask) return;
          await updateTask(editTask.id, data as any);
          setEditTask(null);
        }}
        onDelete={editTask ? async () => {
          await deleteTask(editTask.id);
          setEditTask(null);
        } : undefined}
      />


      <ManageTaskStatusesModal open={manageStatusesOpen} onOpenChange={setManageStatusesOpen} />
    </div>
  );
}

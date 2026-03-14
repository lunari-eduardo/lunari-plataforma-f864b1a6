import { useEffect, useMemo, useState } from 'react';
import './Tarefas.css';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSupabaseTasks } from '@/hooks/useSupabaseTasks';
import { useSupabaseTaskPeople } from '@/hooks/useSupabaseTaskPeople';
import type { Task, TaskStatus } from '@/types/tasks';
import UnifiedTaskModal from '@/components/tarefas/UnifiedTaskModal';
import TaskCard from '@/components/tarefas/TaskCard';
import PriorityLegend from '@/components/tarefas/PriorityLegend';
import { cn } from '@/lib/utils';
import { useSupabaseTaskStatuses } from '@/hooks/useSupabaseTaskStatuses';
import ManageTaskStatusesModal from '@/components/tarefas/ManageTaskStatusesModal';
import ChecklistPanel from '@/components/tarefas/ChecklistPanel';
import TaskDetailsModal from '@/components/tarefas/TaskDetailsModal';
import TaskFiltersBar, { type TaskFilters } from '@/components/tarefas/TaskFiltersBar';
import CleanTaskCard from '@/components/tarefas/CleanTaskCard';
import { DndContext, rectIntersection, useSensor, useSensors, PointerSensor, DragOverlay, useDroppable } from '@dnd-kit/core';
import DraggableTaskCard from '@/components/tarefas/dnd/DraggableTaskCard';

/** Convert hex color to "r, g, b" string for CSS rgba() */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '107, 114, 128';
  return `${r}, ${g}, ${b}`;
}

// Filter tasks based on filters
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
  const { tasks, loading: tasksLoading, addTask, updateTask, deleteTask } = useSupabaseTasks();
  const { people } = useSupabaseTaskPeople();
  const { toast } = useToast();

  useEffect(() => { document.title = 'Tarefas | Lunari'; }, []);

  const [view, setView] = useState<'kanban' | 'list'>(() => localStorage.getItem('lunari_tasks_view') as any || 'kanban');
  const [filters, setFilters] = useState<TaskFilters>({ search: '', status: 'all', priority: 'all', assignee: 'all', dateRange: 'all' });
  const { statuses, loading: statusesLoading, getDoneKey, getDefaultOpenKey } = useSupabaseTaskStatuses();
  const doneKey = getDoneKey();
  const defaultOpenKey = getDefaultOpenKey();
  const statusOptions = useMemo(() => statuses.map(s => ({ value: s.key, label: s.name })), [statuses]);
  const assigneeOptions = useMemo(() => [...people.map(p => ({ value: p.id, label: p.name }))], [people]);
  const [manageStatusesOpen, setManageStatusesOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 6 } });
  const sensors = useSensors(pointerSensor);

  useEffect(() => {
    if (selectedTask) {
      const updatedTask = tasks.find(t => t.id === selectedTask.id);
      if (updatedTask && JSON.stringify(updatedTask) !== JSON.stringify(selectedTask)) {
        setSelectedTask(updatedTask);
      }
    }
  }, [tasks, selectedTask]);

  const checklistItems = useMemo(() => tasks.filter(t => t.type === 'checklist'), [tasks]);
  const filtered = useMemo(() => filterTasks(tasks, filters), [tasks, filters]);
  const groups = useMemo(() => {
    const map: Record<string, Task[]> = {};
    statuses.forEach(s => { map[s.key] = []; });
    filtered.forEach(t => { (map[t.status] ||= []).push(t); });
    return map;
  }, [filtered, statuses]);

  // Get the active dragged task + its status color for the overlay
  const activeTask = useMemo(() => activeId ? tasks.find(t => t.id === activeId) : null, [activeId, tasks]);
  const activeTaskColor = useMemo(() => {
    if (!activeTask) return undefined;
    return statuses.find(s => s.key === activeTask.status)?.color;
  }, [activeTask, statuses]);

  const StatusColumn = ({ title, statusKey, color }: { title: string; statusKey: string; color?: string }) => {
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
            {groups[statusKey]?.length || 0}
          </span>
        </header>

        <div
          ref={setNodeRef}
          className={cn(
            'glass-column flex-1 p-2 overflow-hidden flex flex-col',
            isOver && 'glass-column-over'
          )}
          style={{ '--col-color': rgb } as React.CSSProperties}
        >
          <div className="flex-1 overflow-y-auto scrollbar-kanban">
            <ul className="space-y-2 pb-2">
              {(groups[statusKey] || []).map(t => (
                <DraggableTaskCard
                  key={t.id}
                  task={t}
                  statusColor={color}
                  onComplete={() => { updateTask(t.id, { status: doneKey as any }); toast({ title: 'Tarefa concluída' }); }}
                  onReopen={() => { updateTask(t.id, { status: defaultOpenKey as any }); toast({ title: 'Tarefa reaberta' }); }}
                  onEdit={() => setSelectedTask(t)}
                  onDelete={() => { deleteTask(t.id); toast({ title: 'Tarefa excluída' }); }}
                  onRequestMove={status => { updateTask(t.id, { status: status as any }); toast({ title: 'Tarefa movida' }); }}
                  isDone={t.status === doneKey as any}
                  statusOptions={statusOptions}
                  activeId={activeId}
                />
              ))}
              {(groups[statusKey] || []).length === 0 && (
                <li className="text-center text-sm text-lunar-textSecondary py-8 opacity-60">
                  Nenhuma tarefa neste status
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>
    );
  };

  const ListView = () => (
    <div className="space-y-2">
      <ChecklistPanel items={checklistItems} addTask={addTask} updateTask={updateTask} deleteTask={deleteTask} doneKey={doneKey} defaultOpenKey={defaultOpenKey} variant="section" />
      <Card className="p-2 bg-white/30 dark:bg-white/[0.04] backdrop-blur-xl border-white/35 dark:border-white/[0.08]">
        <div className="grid gap-2">
          {filtered.map(t => (
            <CleanTaskCard key={t.id} task={t} onComplete={() => { updateTask(t.id, { status: doneKey as any }); toast({ title: 'Tarefa concluída' }); }} onView={() => setSelectedTask(t)} isDone={t.status === doneKey as any} />
          ))}
          {filtered.length === 0 && <div className="py-8 text-center text-sm text-lunar-textSecondary">Nenhuma tarefa encontrada.</div>}
        </div>
      </Card>
    </div>
  );

  return (
    <div className="page-tarefas-modern h-[calc(100vh-4rem)] flex flex-col transition-colors duration-300">
      {/* Header + Filters */}
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
            <Button size="sm" onClick={() => setCreateOpen(true)} className="glass-btn-primary text-xs md:text-sm">
              Nova tarefa
            </Button>
          </div>
        </header>

        <TaskFiltersBar filters={filters} onFiltersChange={setFilters} statusOptions={statusOptions} assigneeOptions={assigneeOptions} />
        <PriorityLegend />
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-hidden">
        {view === 'kanban' ? (
          <div className="flex flex-col h-full">
            <DndContext
              sensors={sensors}
              collisionDetection={rectIntersection}
              onDragStart={e => { setActiveId(String(e.active.id)); }}
              onDragEnd={e => {
                const overId = e.over?.id as string | undefined;
                if (activeId && overId) {
                  const current = tasks.find(tt => tt.id === activeId);
                  if (current && current.status !== overId) {
                    updateTask(activeId, { status: overId as any });
                    toast({ title: 'Tarefa movida' });
                  }
                }
                setActiveId(null);
              }}
              onDragCancel={() => setActiveId(null)}
            >
              <div className="flex-1 relative">
                <div className="absolute inset-0 overflow-x-auto overflow-y-hidden scrollbar-kanban">
                  <div className="flex h-full gap-3 min-w-max px-2 py-1">
                    <ChecklistPanel items={checklistItems} addTask={addTask} updateTask={updateTask} deleteTask={deleteTask} doneKey={doneKey} defaultOpenKey={defaultOpenKey} variant="column" />
                    {statuses.map(col => (
                      <StatusColumn key={col.id} title={col.name} statusKey={col.key as any} color={col.color} />
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
          <ListView />
        )}
      </div>

      <UnifiedTaskModal open={createOpen} onOpenChange={setCreateOpen} mode="create" onSubmit={async (data: any) => {
        const t = await addTask({ ...data, source: 'manual' });
        toast({ title: 'Tarefa criada', description: t?.title || 'Nova tarefa' });
      }} />
      <ManageTaskStatusesModal open={manageStatusesOpen} onOpenChange={setManageStatusesOpen} />
      <TaskDetailsModal task={selectedTask} open={!!selectedTask} onOpenChange={open => !open && setSelectedTask(null)} onUpdate={updateTask} onDelete={deleteTask} statusOptions={statusOptions} />
    </div>
  );
}

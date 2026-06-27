import { useEffect, useMemo, useState } from 'react';
import './Tarefas.css';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSupabaseTasks } from '@/hooks/useSupabaseTasks';
import { useSupabaseTaskPeople } from '@/hooks/useSupabaseTaskPeople';
import type { Task } from '@/types/tasks';
import QuickTaskModal from '@/components/tarefas/QuickTaskModal';
import QuickCaptureBar from '@/components/tarefas/QuickCaptureBar';
import TaskCard from '@/components/tarefas/TaskCard';
import PriorityLegend from '@/components/tarefas/PriorityLegend';
import { useSupabaseTaskStatuses } from '@/hooks/useSupabaseTaskStatuses';
import ManageTaskStatusesModal from '@/components/tarefas/ManageTaskStatusesModal';
import ChecklistPanel from '@/components/tarefas/ChecklistPanel';
import TaskDetailsModal from '@/components/tarefas/TaskDetailsModal';
import TaskFiltersBar, { type TaskFilters } from '@/components/tarefas/TaskFiltersBar';
import { DndContext, rectIntersection, useSensor, useSensors, PointerSensor, DragOverlay } from '@dnd-kit/core';
import KanbanColumn from '@/modules/tasks/presentation/components/KanbanColumn';
import TasksListView from '@/modules/tasks/presentation/components/TasksListView';
import { hexToRgb } from '@/modules/tasks/presentation/components/utils';

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
  const { tasks, addTask, updateTask, deleteTask } = useSupabaseTasks();
  const { people } = useSupabaseTaskPeople();
  const { toast } = useToast();

  const [view, setView] = useState<'kanban' | 'list'>(() => (localStorage.getItem('lunari_tasks_view') as any) || 'kanban');
  const [filters, setFilters] = useState<TaskFilters>({ search: '', status: 'all', priority: 'all', assignee: 'all', dateRange: 'all' });
  const { statuses, getDoneKey, getDefaultOpenKey } = useSupabaseTaskStatuses();
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

  const activeTask = useMemo(() => (activeId ? tasks.find(t => t.id === activeId) : null), [activeId, tasks]);
  const activeTaskColor = useMemo(
    () => (activeTask ? statuses.find(s => s.key === activeTask.status)?.color : undefined),
    [activeTask, statuses],
  );

  const handleComplete = (id: string) => { updateTask(id, { status: doneKey as any }); };
  const handleReopen = (id: string) => { updateTask(id, { status: defaultOpenKey as any }); };
  const handleDelete = (id: string) => { deleteTask(id); };
  const handleMove = (id: string, status: string) => { updateTask(id, { status: status as any }); };

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
            <Button size="sm" onClick={() => setCreateOpen(true)} className="glass-btn-primary text-xs md:text-sm">
              Nova tarefa
            </Button>
          </div>
        </header>

        <QuickCaptureBar
          onCapture={async (title) => {
            await addTask({ title, status: defaultOpenKey, priority: 'medium', type: 'simple', source: 'manual' } as any);
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
                if (activeId && overId) {
                  const current = tasks.find(tt => tt.id === activeId);
                  if (current && current.status !== overId) {
                    updateTask(activeId, { status: overId as any });
                    toast({ title: 'Tarefa movida' });
                  }
                }
                requestAnimationFrame(() => setActiveId(null));
              }}
              onDragCancel={() => { requestAnimationFrame(() => setActiveId(null)); }}
            >
              <div className="flex-1 relative">
                <div className="absolute inset-0 overflow-x-auto overflow-y-hidden scrollbar-kanban">
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
                          await addTask({
                            title,
                            status: col.key,
                            priority: 'medium',
                            type: 'simple',
                            source: 'manual',
                          } as any);
                        }}
                        onComplete={handleComplete}
                        onReopen={handleReopen}
                        onEdit={setSelectedTask}
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
            onView={setSelectedTask}
            onComplete={(id) => { handleComplete(id); toast({ title: 'Tarefa concluída' }); }}
          />
        )}
      </div>

      <QuickTaskModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultStatus={defaultOpenKey}
        onSubmit={async (data) => { await addTask(data as any); }}
      />
      <ManageTaskStatusesModal open={manageStatusesOpen} onOpenChange={setManageStatusesOpen} />
      <TaskDetailsModal
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={open => !open && setSelectedTask(null)}
        onUpdate={updateTask}
        onDelete={deleteTask}
        statusOptions={statusOptions}
      />
    </div>
  );
}

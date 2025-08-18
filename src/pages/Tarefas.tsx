import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTasks } from '@/hooks/useTasks';
import { useTaskPeople } from '@/hooks/useTaskPeople';
import type { Task, TaskStatus } from '@/types/tasks';
import TaskFormModal from '@/components/tarefas/TaskFormModal';
import TaskCard from '@/components/tarefas/TaskCard';
import PriorityLegend from '@/components/tarefas/PriorityLegend';
import { cn } from '@/lib/utils';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import ManageTaskStatusesModal from '@/components/tarefas/ManageTaskStatusesModal';
import TemplateManagerModal from '@/components/tarefas/TemplateManagerModal';
import ChecklistPanel from '@/components/tarefas/ChecklistPanel';
import TaskDetailsModal from '@/components/tarefas/TaskDetailsModal';
import TaskFiltersBar, { type TaskFilters } from '@/components/tarefas/TaskFiltersBar';
import CleanTaskCard from '@/components/tarefas/CleanTaskCard';
import { DndContext, rectIntersection, useSensor, useSensors, PointerSensor, DragOverlay, useDroppable } from '@dnd-kit/core';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import DraggableTaskCard from '@/components/tarefas/dnd/DraggableTaskCard';
import { Sparkles } from 'lucide-react';
// Filter tasks based on filters
function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  return tasks.filter(task => {
    // Skip checklist items in main filters
    if (task.type === 'checklist') return false;

    // Text search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesTitle = task.title.toLowerCase().includes(searchLower);
      const matchesDescription = task.description?.toLowerCase().includes(searchLower) || false;
      const matchesTags = task.tags?.some(tag => tag.toLowerCase().includes(searchLower)) || false;
      if (!matchesTitle && !matchesDescription && !matchesTags) return false;
    }

    // Status filter
    if (filters.status !== 'all' && task.status !== filters.status) return false;

    // Priority filter
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;

    // Assignee filter
    if (filters.assignee !== 'all' && task.assigneeId !== filters.assignee) return false;

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      if (!task.dueDate) return false;

      const dueDate = new Date(task.dueDate);
      
      switch (filters.dateRange) {
        case 'today':
          return dueDate >= today && dueDate < tomorrow;
        case 'week':
          return dueDate <= weekFromNow;
        case 'month':
          return dueDate <= monthFromNow;
        case 'overdue':
          return dueDate < today;
        default:
          return true;
      }
    }

    return true;
  });
}

export default function Tarefas() {
  const { tasks, addTask, updateTask, deleteTask } = useTasks();
  const { people } = useTaskPeople();
  const { toast } = useToast();

  useEffect(() => {
    document.title = 'Tarefas | Lunari';
  }, []);

  const [view, setView] = useState<'kanban' | 'list'>(() => (localStorage.getItem('lunari_tasks_view') as any) || 'kanban');
  const [filters, setFilters] = useState<TaskFilters>({
    search: '',
    status: 'all',
    priority: 'all',
    assignee: 'all',
    dateRange: 'all'
  });

const { statuses, getDoneKey, getDefaultOpenKey } = useTaskStatuses();
const doneKey = getDoneKey();
const defaultOpenKey = getDefaultOpenKey();
const statusOptions = useMemo(() => statuses.map(s => ({ value: s.key, label: s.name })), [statuses]);
const assigneeOptions = useMemo(() => [
  ...people.map(p => ({ value: p.id, label: p.name }))
], [people]);

const [manageStatusesOpen, setManageStatusesOpen] = useState(false);
const [createOpen, setCreateOpen] = useState(false);
const [showTemplateManager, setShowTemplateManager] = useState(false);
const [selectedTask, setSelectedTask] = useState<Task | null>(null);
const [activeId, setActiveId] = useState<string | null>(null);

const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 4 } });
const sensors = useSensors(pointerSensor);

  const checklistItems = useMemo(() => tasks.filter(t => t.type === 'checklist'), [tasks]);
  const filtered = useMemo(() => filterTasks(tasks, filters), [tasks, filters]);

  const groups = useMemo(() => {
    const map: Record<string, Task[]> = {};
    statuses.forEach(s => { map[s.key] = []; });
    filtered.forEach(t => { (map[t.status] ||= []).push(t); });
    return map;
  }, [filtered, statuses]);

  const StatusColumn = ({ title, statusKey, color }: { title: string; statusKey: string; color?: string }) => {
    const { isOver, setNodeRef } = useDroppable({ id: statusKey });
    return (
      <section className="flex-1 min-w-[260px]">
        <header className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: color || '#6b7280' }}
            />
            <h2 className="text-sm font-semibold text-lunar-text">{title}</h2>
          </div>
          <Badge variant="outline" className="text-2xs">{groups[statusKey]?.length || 0}</Badge>
        </header>
        <Card
          ref={setNodeRef}
          className={cn(
            "p-2 pb-8 bg-lunar-surface min-h-[70vh] max-h-[70vh] overflow-y-auto",
            isOver ? "ring-2 ring-lunar-accent/60" : ""
          )}
          style={{ 
            borderLeft: `3px solid ${color || '#6b7280'}`,
            borderTopColor: 'hsl(var(--lunar-border) / 0.6)',
            borderRightColor: 'hsl(var(--lunar-border) / 0.6)', 
            borderBottomColor: 'hsl(var(--lunar-border) / 0.6)'
          }}
        >
          <ul className="space-y-2">
              {(groups[statusKey] || []).map((t) => (
                <li key={t.id}>
                  <CleanTaskCard
                    task={t}
                    onComplete={() => { updateTask(t.id, { status: doneKey as any }); toast({ title: 'Tarefa concluída' }); }}
                    onView={() => setSelectedTask(t)}
                    isDone={t.status === (doneKey as any)}
                  />
                </li>
              ))}
          </ul>
        </Card>
      </section>
    );
  };

  const ListView = () => (
    <div className="space-y-2">
      <ChecklistPanel
        items={checklistItems}
        addTask={addTask}
        updateTask={updateTask}
        deleteTask={deleteTask}
        doneKey={doneKey}
        defaultOpenKey={defaultOpenKey}
        variant="section"
      />
      <Card className="p-2 bg-lunar-surface border-lunar-border/60">
        <div className="grid gap-2">
          {filtered.map(t => (
            <CleanTaskCard
              key={t.id}
              task={t}
              onComplete={() => { updateTask(t.id, { status: doneKey as any }); toast({ title: 'Tarefa concluída' }); }}
              onView={() => setSelectedTask(t)}
              isDone={t.status === (doneKey as any)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-lunar-textSecondary">
              Nenhuma tarefa encontrada.
            </div>
          )}
        </div>
      </Card>
    </div>
  );

  return (
    <main className="page-tarefas p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-base font-bold text-lunar-text">Tarefas</h1>
        <div className="flex items-center gap-2">
          <Select value={view} onValueChange={(v) => { setView(v as any); localStorage.setItem('lunari_tasks_view', v); }}>
            <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="kanban">Kanban</SelectItem>
              <SelectItem value="list">Lista</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setShowTemplateManager(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Templates
          </Button>
          <Button variant="outline" onClick={() => setManageStatusesOpen(true)}>Gerenciar</Button>
          <Button onClick={() => setCreateOpen(true)}>Nova tarefa</Button>
        </div>
      </header>

      <TaskFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        statusOptions={statusOptions}
        assigneeOptions={assigneeOptions}
      />

      <PriorityLegend />

      {view === 'kanban' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          modifiers={[restrictToFirstScrollableAncestor]}
          onDragStart={(e) => {
            setActiveId(String(e.active.id));
            console.log('[DND] drag start', e.active.id);
          }}
          onDragEnd={(e) => {
            const overId = e.over?.id as string | undefined;
            console.log('[DND] drag end', { activeId, overId });
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
          <div className="overflow-x-auto scrollbar-kanban">
            <div className="flex gap-4 min-w-max pr-2">
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
                <StatusColumn key={col.id} title={col.name} statusKey={col.key as any} color={col.color} />
              ))}
            </div>
          </div>
          <DragOverlay>
            <div className="pointer-events-none">
              {activeId ? (() => {
                const at = tasks.find(tt => tt.id === activeId);
                return at ? (
                  <TaskCard
                    task={at}
                    onComplete={() => {}}
                    onReopen={() => {}}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onRequestMove={() => {}}
                    isDone={at.status === (doneKey as any)}
                    statusOptions={statusOptions}
                    isDragging={true}
                  />
                ) : null;
              })() : null}
            </div>
          </DragOverlay>
        </DndContext>
      ) : (
        <ListView />)
      }

      <TaskFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={(data: any) => {
          const t = addTask({ ...data, source: 'manual' });
          toast({ title: 'Tarefa criada', description: t.title });
        }}
      />

      <ManageTaskStatusesModal open={manageStatusesOpen} onOpenChange={setManageStatusesOpen} />

      <TemplateManagerModal 
        open={showTemplateManager} 
        onOpenChange={setShowTemplateManager} 
      />

      <TaskDetailsModal
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onUpdate={updateTask}
        onDelete={deleteTask}
        statusOptions={statusOptions}
      />
    </main>
  );
}

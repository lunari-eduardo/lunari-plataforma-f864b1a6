import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useTasks } from '@/hooks/useTasks';
import type { Task, TaskPriority, TaskStatus } from '@/types/tasks';
import TaskFormModal from '@/components/tarefas/TaskFormModal';
import TaskCard from '@/components/tarefas/TaskCard';
import PriorityLegend from '@/components/tarefas/PriorityLegend';
import { cn } from '@/lib/utils';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import ManageTaskStatusesModal from '@/components/tarefas/ManageTaskStatusesModal';
import ChecklistPanel from '@/components/tarefas/ChecklistPanel';
function groupByStatus(tasks: Task[]) {
  return tasks.reduce<Record<TaskStatus, Task[]>>((acc, t) => {
    (acc[t.status] ||= []).push(t);
    return acc;
  }, { todo: [], doing: [], waiting: [], done: [] } as any);
}

function daysUntil(dateIso?: string) {
  if (!dateIso) return undefined;
  const now = new Date();
  const due = new Date(dateIso);
  const diffMs = due.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

const priorityWeight: Record<TaskPriority, number> = { low: 1, medium: 2, high: 3 };

export default function Tarefas() {
  const { tasks, addTask, updateTask, deleteTask } = useTasks();
  const { toast } = useToast();

  useEffect(() => {
    document.title = 'Tarefas | Lunari';
  }, []);

  const [view, setView] = useState<'kanban' | 'list'>(() => (localStorage.getItem('lunari_tasks_view') as any) || 'kanban');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [sortKey, setSortKey] = useState<'dueDate' | 'priority' | 'createdAt'>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

const { statuses, getDoneKey, getDefaultOpenKey } = useTaskStatuses();
const doneKey = getDoneKey();
const defaultOpenKey = getDefaultOpenKey();
const statusOptions = useMemo(() => statuses.map(s => ({ value: s.key, label: s.name })), [statuses]);
const [manageStatusesOpen, setManageStatusesOpen] = useState(false);

const [createOpen, setCreateOpen] = useState(false);
  const [editTaskData, setEditTaskData] = useState<Task | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const checklistItems = useMemo(() => tasks.filter(t => t.type === 'checklist'), [tasks]);

  const filtered = useMemo(() => {
    const tag = tagFilter.trim().toLowerCase();

    let arr = tasks
      .filter(t => t.type !== 'checklist')
      .filter(t => {
        const inStatus = statusFilter === 'all' || t.status === statusFilter;
        const inTag = !tag || (t.tags || []).some(x => x.toLowerCase().includes(tag));
        return inStatus && inTag;
      });

    arr.sort((a, b) => {
      if (sortKey === 'priority') {
        const diff = priorityWeight[(a.priority)] - priorityWeight[(b.priority)];
        return sortDir === 'asc' ? diff : -diff;
      }
      if (sortKey === 'dueDate') {
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        const diff = ad - bd;
        return sortDir === 'asc' ? diff : -diff;
      }
      // createdAt
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === 'asc' ? diff : -diff;
    });

    return arr;
  }, [tasks, statusFilter, tagFilter, sortKey, sortDir]);

  const groups = useMemo(() => {
    const map: Record<string, Task[]> = {};
    statuses.forEach(s => { map[s.key] = []; });
    filtered.forEach(t => { (map[t.status] ||= []).push(t); });
    return map;
  }, [filtered, statuses]);

  const StatusColumn = ({ title, statusKey }: { title: string; statusKey: string }) => (
    <section className="flex-1 min-w-[260px]">
      <header className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-lunar-text">{title}</h2>
        <Badge variant="outline" className="text-2xs">{groups[statusKey]?.length || 0}</Badge>
      </header>
      <Card
        className={cn(
          "p-2 pb-8 bg-lunar-surface border-lunar-border/60 min-h-[70vh] max-h-[70vh] overflow-y-auto",
          dragOverColumn === statusKey ? "ring-2 ring-lunar-accent/60" : ""
        )}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (draggingId) setDragOverColumn(statusKey as any); }}
        onDragLeave={() => { if (dragOverColumn === (statusKey as any)) setDragOverColumn(null); }}
        onDrop={(e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData('text/plain');
          if (id) {
            updateTask(id, { status: statusKey as any });
            toast({ title: 'Tarefa movida' });
          }
          setDragOverColumn(null);
          setDraggingId(null);
        }}
      >
        <ul className="space-y-2">
            {(groups[statusKey] || []).map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onComplete={() => { updateTask(t.id, { status: doneKey as any }); toast({ title: 'Tarefa concluída' }); }}
                onReopen={() => updateTask(t.id, { status: defaultOpenKey as any })}
                onEdit={() => setEditTaskData(t)}
                onDelete={() => deleteTask(t.id)}
                onDragStart={(id) => setDraggingId(id)}
                onDragEnd={() => { setDraggingId(null); setDragOverColumn(null); }}
                isDragging={draggingId === t.id}
                onRequestMove={(status) => { updateTask(t.id, { status: status as any }); toast({ title: 'Tarefa movida' }); }}
                isDone={t.status === (doneKey as any)}
                statusOptions={statusOptions}
              />
            ))}
        </ul>
      </Card>
    </section>
  );

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
        <ul className="divide-y divide-lunar-border/50">
          {filtered.map(t => (
            <li key={t.id} className="py-1.5 px-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-lunar-text truncate">{t.title}</h3>
                  <Badge variant="outline" className="text-[10px]">{t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Média' : 'Baixa'}</Badge>
                  <Badge variant="outline" className="text-[10px]">{t.status === 'todo' ? 'A Fazer' : t.status === 'doing' ? 'Em Andamento' : t.status === 'waiting' ? 'Aguardando' : 'Concluída'}</Badge>
                </div>
                {t.description && <p className="text-2xs text-lunar-textSecondary truncate">{t.description}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {t.assigneeName && <Badge variant="secondary" className="text-[10px]">{t.assigneeName}</Badge>}
                  {t.tags?.map(tag => <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>)}
                  {t.dueDate && (
                    <>
                      <Separator orientation="vertical" className="h-3" />
                      <span className="text-2xs">Prazo: {new Date(t.dueDate).toLocaleDateString('pt-BR')}</span>
                      {(() => {
                        const d = daysUntil(t.dueDate);
                        if (d === undefined) return null;
                        if (d < 0) return <span className="text-lunar-error">Vencida há {Math.abs(d)} dia(s)</span>;
                        if (d <= 2) return <span className="text-lunar-accent">Faltam {d} dia(s)</span>;
                        return null;
                      })()}
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {t.status !== (doneKey as any) ? (
                  <Button variant="secondary" size="sm" className="h-7 text-2xs" onClick={() => updateTask(t.id, { status: doneKey as any })}>Concluir</Button>
                ) : (
                  <Button variant="ghost" size="sm" className="h-7 text-2xs" onClick={() => updateTask(t.id, { status: defaultOpenKey as any })}>Reabrir</Button>
                )}
                <Select value={t.status} onValueChange={v => updateTask(t.id, { status: v as any })}>
                  <SelectTrigger className="h-7 px-2 text-2xs w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" className="h-7 text-2xs" onClick={() => setEditTaskData(t)}>Editar</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteTask(t.id)} title="Excluir">×</Button>
              </div>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="py-6 text-center text-2xs text-lunar-textSecondary">Nenhuma tarefa encontrada.</li>
          )}
        </ul>
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
          <Button variant="outline" onClick={() => setManageStatusesOpen(true)}>Gerenciar status</Button>
          <Button onClick={() => setCreateOpen(true)}>Nova tarefa</Button>
        </div>
      </header>

      {/* Filtros */}
      <Card className="p-3 bg-lunar-surface border-lunar-border/60">
        <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-2">
          <Input placeholder="Filtrar por etiqueta" value={tagFilter} onChange={e => setTagFilter(e.target.value)} />
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {statusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Select value={sortKey} onValueChange={v => setSortKey(v as any)}>
              <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dueDate">Ordenar: Prazo</SelectItem>
                <SelectItem value="priority">Ordenar: Prioridade</SelectItem>
                <SelectItem value="createdAt">Ordenar: Criação</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortDir} onValueChange={v => setSortDir(v as any)}>
              <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Asc</SelectItem>
                <SelectItem value="desc">Desc</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <PriorityLegend />

      {view === 'kanban' ? (
        <div className="overflow-x-auto">
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
              <StatusColumn key={col.id} title={col.name} statusKey={col.key as any} />
            ))}
          </div>
        </div>
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

      {editTaskData && (
        <TaskFormModal
          open={!!editTaskData}
          onOpenChange={(o) => { if (!o) setEditTaskData(null); }}
          mode="edit"
          initial={editTaskData}
          onSubmit={(data: any) => {
            updateTask(editTaskData.id, data);
            toast({ title: 'Tarefa atualizada', description: data.title });
          }}
        />
      )}
    </main>
  );
}

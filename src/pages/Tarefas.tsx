import { useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';
import type { Task, TaskStatus } from '@/types/tasks';

function groupByStatus(tasks: Task[]) {
  return tasks.reduce<Record<TaskStatus, Task[]>>((acc, t) => {
    (acc[t.status] ||= []).push(t);
    return acc;
  }, { todo: [], doing: [], waiting: [], done: [] } as any);
}

export default function Tarefas() {
  const { tasks, updateTask, deleteTask } = useTasks();
  const { toast } = useToast();

  useEffect(() => {
    document.title = 'Tarefas | Lunari';
  }, []);

  const groups = useMemo(() => groupByStatus(tasks), [tasks]);

  const StatusColumn = ({ title, statusKey }: { title: string; statusKey: TaskStatus }) => (
    <section className="flex-1 min-w-[260px]">
      <header className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-lunar-text">{title}</h2>
        <Badge variant="outline" className="text-2xs">{groups[statusKey]?.length || 0}</Badge>
      </header>
      <Card className="p-2 bg-lunar-surface border-lunar-border/60">
        <ul className="space-y-2">
          {(groups[statusKey] || []).map((t) => (
            <li key={t.id} className="rounded-md border border-lunar-border/60 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-lunar-text truncate">{t.title}</h3>
                  {t.description && (
                    <p className="text-2xs text-lunar-textSecondary truncate">{t.description}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {t.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                    ))}
                    {t.relatedClienteId && (
                      <Link to={`/clientes/${t.relatedClienteId}`} className="text-2xs text-lunar-accent underline">
                        Ver cliente
                      </Link>
                    )}
                    {t.relatedBudgetId && (
                      <Link to={`/orcamentos`} className="text-2xs text-lunar-accent underline">
                        Ver orçamento
                      </Link>
                    )}
                    {t.relatedSessionId && (
                      <Link to={`/workflow`} className="text-2xs text-lunar-accent underline">
                        Ver sessão
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {t.status !== 'done' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 text-2xs"
                      onClick={() => {
                        updateTask(t.id, { status: 'done' });
                        toast({ title: 'Tarefa concluída' });
                      }}
                    >
                      Concluir
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-2xs"
                      onClick={() => updateTask(t.id, { status: 'todo' })}
                    >
                      Reabrir
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => deleteTask(t.id)}
                    title="Excluir"
                  >
                    ×
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-2xs text-lunar-textSecondary">
                <span>Criada: {new Date(t.createdAt).toLocaleDateString('pt-BR')}</span>
                {t.dueDate && (
                  <>
                    <Separator orientation="vertical" className="h-3" />
                    <span>Prazo: {new Date(t.dueDate).toLocaleDateString('pt-BR')}</span>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );

  return (
    <main className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-base font-bold text-lunar-text">Tarefas</h1>
      </header>
      <div className="grid gap-4 md:grid-cols-4 sm:grid-cols-2 grid-cols-1">
        <StatusColumn title="A Fazer" statusKey="todo" />
        <StatusColumn title="Fazendo" statusKey="doing" />
        <StatusColumn title="Aguardando" statusKey="waiting" />
        <StatusColumn title="Concluídas" statusKey="done" />
      </div>
    </main>
  );
}

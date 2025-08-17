import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import { differenceInCalendarDays } from 'date-fns';
import { parseDateFromStorage, formatDateForDisplay } from '@/utils/dateUtils';

export function HighPriorityDueSoonCard() {
  const { tasks } = useTasks();
  const { getDoneKey, statuses } = useTaskStatuses();
  const doneKey = getDoneKey();

  const items = useMemo(() => {
    const today = new Date();
    const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const parseDue = (iso?: string) => {
      if (!iso) return undefined as unknown as Date | undefined;
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return parseDateFromStorage(iso);
      const d = new Date(iso);
      return isNaN(d.getTime()) ? undefined : d;
    };

    return tasks
      .filter((t) => t.dueDate)
      .filter((t) => t.status !== doneKey && !t.completedAt)
      .map((t) => ({ t, due: parseDue(t.dueDate) }))
      .filter((x) => !!x.due)
      .map((x) => ({
        ...x,
        days: differenceInCalendarDays(x.due as Date, todayLocal),
      }))
      .filter((x) => x.days >= 0 && x.days <= 5)
      .sort((a, b) => (a.due as Date).getTime() - (b.due as Date).getTime());
  }, [tasks, doneKey]);

  const count = items.length;

  const daysLabel = (d: number) => {
    if (d === 0) return 'Hoje';
    if (d === 1) return 'Amanhã';
    return `Em ${d} dias`;
  };

  const getStatusName = (statusKey: string) => {
    const status = statuses.find(s => s.key === statusKey);
    return status?.name || statusKey;
  };

  return (
    <Card className="dashboard-card rounded-2xl border-0 shadow-card-subtle hover:shadow-card-elevated transition-shadow duration-300">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-gradient">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <CardTitle className="text-lg font-semibold">Próximas Tarefas</CardTitle>
          <Badge variant="secondary" className="dashboard-badge bg-card-gradient border-0 shadow-theme-subtle hover:shadow-theme text-sm font-semibold transition-shadow duration-300" aria-label={`Quantidade de tarefas: ${count}`}>{count}</Badge>
        </div>
        <Link to="/tarefas">
          <Button variant="ghost" size="sm">Ver todas</Button>
        </Link>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="text-2xs text-lunar-textSecondary">Nenhuma tarefa vence nos próximos 5 dias.</p>
        ) : (
           <ul className="space-y-3">
             {items.map(({ t, due, days }) => (
                <li key={t.id} className="p-3 rounded-xl bg-card-gradient shadow-none hover:shadow-card-subtle transition-shadow duration-300">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-lunar-text truncate" title={t.title}>{t.title}</p>
                    <p className="text-xs text-lunar-textSecondary mt-1">
                      {getStatusName(t.status)} • Prazo: {formatDateForDisplay(t.dueDate!)} • {daysLabel(days)}
                    </p>
                  </div>
                </li>
             ))}
           </ul>
        )}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useSupabaseTasks } from '@/hooks/useSupabaseTasks';
import { useSupabaseTaskStatuses } from '@/hooks/useSupabaseTaskStatuses';
import { differenceInCalendarDays } from 'date-fns';
import { parseDateFromStorage, formatDateForDisplay } from '@/utils/dateUtils';

export function HighPriorityDueSoonCard() {
  const { tasks } = useSupabaseTasks();
  const { getDoneKey, statuses } = useSupabaseTaskStatuses();
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
      .filter(t => t.dueDate)
      .filter(t => t.status !== doneKey && !t.completedAt)
      .map(t => ({
        t,
        due: parseDue(t.dueDate)
      }))
      .filter(x => !!x.due)
      .map(x => ({
        ...x,
        days: differenceInCalendarDays(x.due as Date, todayLocal)
      }))
      .filter(x => x.days <= 5) // Include overdue (days < 0) and up to 5 days ahead
      .sort((a, b) => (a.due as Date).getTime() - (b.due as Date).getTime());
  }, [tasks, doneKey]);
  
  const count = items.length;
  const overdueCount = items.filter(x => x.days < 0).length;
  
  const daysLabel = (d: number) => {
    if (d < 0) {
      const absDays = Math.abs(d);
      return `Atrasada ${absDays} dia${absDays > 1 ? 's' : ''}`;
    }
    if (d === 0) return 'Hoje';
    if (d === 1) return 'Amanhã';
    return `Em ${d} dias`;
  };
  
  const isOverdue = (days: number) => days < 0;
  
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
          <CardTitle className="font-semibold text-base">Tarefas Pendentes</CardTitle>
          <Badge variant="secondary" className="dashboard-badge bg-card-gradient border-0 shadow-theme-subtle hover:shadow-theme text-sm font-semibold transition-shadow duration-300" aria-label={`Quantidade de tarefas: ${count}`}>{count}</Badge>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="text-2xs" aria-label={`${overdueCount} tarefas atrasadas`}>
              {overdueCount} atrasada{overdueCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <Link to="/app/tarefas">
          <Button variant="ghost" size="sm">Ver todas</Button>
        </Link>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="text-2xs text-lunar-textSecondary">Nenhuma tarefa pendente ou próxima.</p>
        ) : (
          <ul className="max-h-64 overflow-y-auto space-y-3">
            {items.map(({ t, due, days }) => (
              <li 
                key={t.id} 
                className={`p-3 rounded-xl shadow-none hover:shadow-card-subtle transition-shadow duration-300 ${
                  isOverdue(days) 
                    ? 'bg-destructive/10 border border-destructive/20' 
                    : 'bg-card-gradient'
                }`}
              >
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${isOverdue(days) ? 'text-destructive' : 'text-lunar-text'}`} title={t.title}>
                    {t.title}
                  </p>
                  <p className={`text-xs mt-1 ${isOverdue(days) ? 'text-destructive/80' : 'text-lunar-textSecondary'}`}>
                    {getStatusName(t.status)} • Prazo: {formatDateForDisplay(t.dueDate!)} • <span className={isOverdue(days) ? 'font-semibold' : ''}>{daysLabel(days)}</span>
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

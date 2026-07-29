import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckSquare, CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
import { useSupabaseTasks } from "@/hooks/useSupabaseTasks";
import { useSupabaseTaskStatuses } from "@/hooks/useSupabaseTaskStatuses";
import { differenceInCalendarDays } from "date-fns";
import { parseDateFromStorage, formatDateForDisplay } from "@/utils/dateUtils";

/**
 * Card "Tarefas Pendentes" — visual do mockup.
 * Mostra empty state ilustrado quando não há tarefas prioritárias.
 */
export function TarefasPendentesCard() {
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
      .filter((t) => t.dueDate)
      .filter((t) => t.status !== doneKey && !t.completedAt)
      .map((t) => ({ t, due: parseDue(t.dueDate) }))
      .filter((x) => !!x.due)
      .map((x) => ({
        ...x,
        days: differenceInCalendarDays(x.due as Date, todayLocal),
      }))
      .filter((x) => x.days <= 5)
      .sort((a, b) => (a.due as Date).getTime() - (b.due as Date).getTime());
  }, [tasks, doneKey]);

  const count = items.length;

  const daysLabel = (d: number) => {
    if (d < 0) {
      const abs = Math.abs(d);
      return `Atrasada ${abs} dia${abs > 1 ? "s" : ""}`;
    }
    if (d === 0) return "Hoje";
    if (d === 1) return "Amanhã";
    return `Em ${d} dias`;
  };

  const getStatusName = (statusKey: string) =>
    statuses.find((s) => s.key === statusKey)?.name || statusKey;

  return (
    <Card className="flex h-full flex-col rounded-2xl border-border/60 bg-card shadow-card-subtle transition-shadow duration-300 hover:shadow-card-elevated">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-gold-soft text-accent-gold">
            <CheckSquare className="h-4 w-4" />
          </div>
          <CardTitle className="text-base font-semibold text-foreground">
            Tarefas Pendentes
          </CardTitle>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {count}
          </span>
        </div>
        {count > 0 && (
          <Link to="/app/tarefas">
            <Button variant="ghost" size="sm">
              Ver todas
            </Button>
          </Link>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col pt-0">
        {count === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Nenhuma tarefa pendente
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Você está em dia! 🎉
            </p>
          </div>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {items.map(({ t, days }) => {
              const overdue = days < 0;
              return (
                <li
                  key={t.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    overdue
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border/60 bg-muted/30"
                  }`}
                >
                  <p
                    className={`truncate text-sm font-semibold ${
                      overdue ? "text-destructive" : "text-foreground"
                    }`}
                    title={t.title}
                  >
                    {t.title}
                  </p>
                  <p
                    className={`mt-1 text-xs ${
                      overdue ? "text-destructive/80" : "text-muted-foreground"
                    }`}
                  >
                    {getStatusName(t.status)} • {formatDateForDisplay(t.dueDate!)} •{" "}
                    <span className={overdue ? "font-semibold" : ""}>
                      {daysLabel(days)}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

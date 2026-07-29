import { Link } from "react-router-dom";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronRight } from "lucide-react";
import { useAppointmentsRangeQuery } from "@/modules/agenda";
import { format, addDays } from "date-fns";
import { parseDateFromStorage } from "@/utils/dateUtils";

/**
 * "Próximos Agendamentos" — visual do mockup.
 * Trilho terra à esquerda com dia + hora empilhados; badge "Confirmado" à direita.
 */
export function ProximosAgendamentosCard() {
  const today = useMemo(() => new Date(), []);
  const start = format(today, "yyyy-MM-dd");
  const end = format(addDays(today, 60), "yyyy-MM-dd");
  const { data: appointments = [] } = useAppointmentsRangeQuery({ start, end });

  const items = useMemo(() => {
    const now = new Date();
    const todayKey = format(now, "yyyy-MM-dd");
    return appointments
      .filter((a) => a.status === "confirmado")
      .filter((a) => {
        if (a.date > todayKey) return true;
        if (a.date === todayKey) {
          const [hh, mm] = a.time.split(":").map(Number);
          const d = parseDateFromStorage(a.date) ?? new Date(a.date);
          d.setHours(hh || 0, mm || 0, 0, 0);
          return d >= now;
        }
        return false;
      })
      .map((a) => {
        const d = parseDateFromStorage(a.date) ?? new Date(a.date);
        return { a, when: d };
      })
      .sort((x, y) => x.when.getTime() - y.when.getTime())
      .slice(0, 3);
  }, [appointments]);

  return (
    <Card className="h-full rounded-2xl border-border/60 bg-card shadow-card-subtle transition-shadow duration-300 hover:shadow-card-elevated">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-gold-soft text-accent-gold">
            <Calendar className="h-4 w-4" />
          </div>
          <CardTitle className="text-base font-semibold text-foreground">
            Próximos Agendamentos
          </CardTitle>
        </div>
        <Link to="/app/agenda">
          <Button variant="ghost" size="sm">
            Ver todos
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">
              Nenhum agendamento confirmado
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {items.map(({ a, when }) => (
              <li
                key={a.id}
                className="group flex items-center gap-4 rounded-xl px-2 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex shrink-0 flex-col items-start gap-0.5 border-l-2 border-primary pl-3 leading-tight">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
                    {format(when, "dd")} {format(when, "MMM").toUpperCase().replace(".", "")}
                  </span>
                  <span className="text-[11px] font-semibold text-primary/80">
                    {a.time}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {a.client}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {a.type}
                  </p>
                </div>
                <span className="hidden shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 sm:inline dark:text-emerald-400">
                  Confirmado
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

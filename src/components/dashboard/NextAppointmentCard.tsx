import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAppointmentsRangeQuery } from "@/modules/agenda";
import { format, addDays } from "date-fns";
import { useMemo } from "react";
import { parseDateFromStorage } from "@/utils/dateUtils";

/**
 * Mini-card do "Próximo compromisso" — visual do mockup.
 * Fica ao lado do título de saudação no header do dashboard.
 */
export function NextAppointmentCard() {
  const today = useMemo(() => new Date(), []);
  const start = format(today, "yyyy-MM-dd");
  const end = format(addDays(today, 30), "yyyy-MM-dd");
  const { data: appointments = [] } = useAppointmentsRangeQuery({ start, end });

  const next = useMemo(() => {
    const now = new Date();
    return appointments
      .filter((a) => a.status === "confirmado")
      .map((a) => {
        const d = parseDateFromStorage(a.date) ?? new Date(a.date);
        const [hh, mm] = a.time.split(":").map(Number);
        d.setHours(hh || 0, mm || 0, 0, 0);
        return { a, when: d };
      })
      .filter((x) => x.when >= now)
      .sort((x, y) => x.when.getTime() - y.when.getTime())[0];
  }, [appointments]);

  return (
    <Link to="/app/agenda" className="block w-full lg:w-[300px]">
      <Card className="flex items-center gap-4 rounded-2xl border-border/60 bg-card p-4 shadow-card-subtle transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-elevated">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Próximo compromisso
          </div>
          {next ? (
            <>
              <div className="mt-1 text-lg font-bold leading-tight text-foreground">
                {format(next.when, "dd/MM")} às {format(next.when, "HH:mm")}
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {next.a.client}
                {next.a.type ? ` — ${next.a.type}` : ""}
              </div>
            </>
          ) : (
            <>
              <div className="mt-1 text-lg font-bold leading-tight text-foreground">
                Sem compromissos
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                Aproveite o momento
              </div>
            </>
          )}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Calendar className="h-5 w-5" />
        </div>
      </Card>
    </Link>
  );
}

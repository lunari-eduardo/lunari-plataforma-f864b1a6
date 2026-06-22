import { useMemo } from "react";
import { useSupabaseTasks } from "@/hooks/useSupabaseTasks";
import { useSupabaseTaskStatuses } from "@/hooks/useSupabaseTaskStatuses";
import { differenceInCalendarDays, format } from "date-fns";
import { parseDateFromStorage } from "@/utils/dateUtils";
import { useAppointmentsRangeQuery } from "@/modules/agenda/presentation";

/**
 * Wave 4 — primeiro consumidor real migrado para a nova arquitetura.
 * Lê os appointments do dia via capability `agenda.appointments.listByRange`,
 * em vez de depender do contexto monolítico `useAgenda`.
 */
export default function useTodayOverview() {
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => format(today, "yyyy-MM-dd"), [today]);

  const { data: appointments = [] } = useAppointmentsRangeQuery({
    start: todayIso,
    end: todayIso,
  });

  const { tasks } = useSupabaseTasks();
  const { getDoneKey } = useSupabaseTaskStatuses();

  const sessionsToday = appointments.length;

  const nextAppointment = useMemo(() => {
    const now = new Date();
    const todays = appointments
      .map((a) => {
        const d = parseDateFromStorage(a.date) ?? new Date(a.date);
        const [hh, mm] = a.time.split(":").map(Number);
        d.setHours(hh || 0, mm || 0, 0, 0);
        return d;
      })
      .filter((d) => d >= now)
      .sort((a, b) => a.getTime() - b.getTime());
    return todays[0] || null;
  }, [appointments]);

  const tasksToday = useMemo(() => {
    const doneKey = getDoneKey();
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
      .filter((x) => x.days === 0).length;
  }, [tasks, getDoneKey, today]);

  return { sessionsToday, tasksToday, nextAppointment } as const;
}

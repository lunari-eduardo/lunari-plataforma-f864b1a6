import { useMemo } from "react";
import { useAgenda } from "@/hooks/useAgenda";
import { useTasks } from "@/hooks/useTasks";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { differenceInCalendarDays } from 'date-fns';
import { parseDateFromStorage } from '@/utils/dateUtils';

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function useTodayOverview() {
  const { appointments } = useAgenda();
  const { tasks } = useTasks();
  const { getDoneKey } = useTaskStatuses();

  const today = new Date();
  const todayYMD = today.toISOString().slice(0, 10);

  const sessionsToday = useMemo(() => {
    return appointments.filter((a) => isSameDay(a.date instanceof Date ? a.date : new Date(a.date), today)).length;
  }, [appointments]);

  const nextAppointment = useMemo(() => {
    const now = new Date();
    const todays = appointments
      .filter((a) => isSameDay(a.date instanceof Date ? a.date : new Date(a.date), today))
      .map((a) => {
        const d = new Date(a.date);
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
      .filter((x) => x.days === 0) // Only tasks due today
      .length;
  }, [tasks, getDoneKey, today]);

  return { sessionsToday, tasksToday, nextAppointment } as const;
}

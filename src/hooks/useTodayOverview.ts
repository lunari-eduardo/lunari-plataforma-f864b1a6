import { useMemo } from "react";
import { useAgenda } from "@/hooks/useAgenda";
import { useTasks } from "@/hooks/useTasks";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function useTodayOverview() {
  const { appointments } = useAgenda();
  const { tasks } = useTasks();
  const { getDoneKey } = useTaskStatuses();

  // Debug para verificar tarefas
  console.log('🔍 [useTodayOverview] Total tasks:', tasks.length);
  console.log('🔍 [useTodayOverview] Tasks data:', tasks);

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
    console.log('🔍 [useTodayOverview] doneKey:', doneKey);
    console.log('🔍 [useTodayOverview] todayYMD:', todayYMD);
    
    const todayTasks = tasks.filter((t) => {
      const hasDueDate = !!t.dueDate;
      const isToday = t.dueDate?.slice(0, 10) === todayYMD;
      const isNotDone = t.status !== doneKey;
      
      console.log(`🔍 [useTodayOverview] Task ${t.title}:`, {
        dueDate: t.dueDate,
        hasDueDate,
        isToday,
        status: t.status,
        isNotDone,
        include: hasDueDate && isToday && isNotDone
      });
      
      return hasDueDate && isToday && isNotDone;
    });
    
    console.log('🔍 [useTodayOverview] Tasks today:', todayTasks.length);
    return todayTasks.length;
  }, [tasks, getDoneKey, todayYMD]);

  return { sessionsToday, tasksToday, nextAppointment } as const;
}

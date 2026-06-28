import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppNotification } from '@/types/notifications';

/** Tarefas vencidas e tarefas com vencimento hoje (status != concluído) */
export function useTaskNotifications(): AppNotification[] {
  const [items, setItems] = useState<AppNotification[]>([]);

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];
    const in1DayISO = new Date(today.getTime() + 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    // Carrega keys de status terminais do próprio usuário (configuráveis).
    const { data: statusRows } = await supabase
      .from('task_statuses')
      .select('key,is_done')
      .eq('user_id', user.id);
    const terminalKeys = (statusRows ?? [])
      .filter((r: any) => r.is_done)
      .map((r: any) => r.key as string);
    // Fallback legado quando o usuário ainda não tem statuses configurados.
    const excludeKeys = terminalKeys.length > 0
      ? terminalKeys
      : ['done', 'concluido', 'concluida', 'finalizada', 'finalizado'];

    const { data } = await supabase
      .from('tasks')
      .select('id, title, due_date, status, priority')
      .eq('user_id', user.id)
      .not('due_date', 'is', null)
      .lte('due_date', in1DayISO)
      .not('status', 'in', `(${excludeKeys.map((k) => `"${k}"`).join(',')})`)
      .order('due_date', { ascending: true })
      .limit(50);

    const next: AppNotification[] = (data || []).map((t: any) => {
      const overdue = t.due_date < todayISO;
      return {
        id: `task-${overdue ? 'overdue' : 'today'}-${t.id}`,
        category: 'pendencia',
        priority: overdue ? 'critica' : 'alta',
        title: overdue ? 'Tarefa atrasada' : 'Tarefa para hoje',
        description: t.title,
        timestamp: t.due_date + 'T00:00:00Z',
        route: '/app/tarefas',
        icon: 'check',
      } as AppNotification;
    });

    setItems(next);
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchAll]);

  return items;
}

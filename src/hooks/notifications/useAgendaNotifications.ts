import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppNotification } from '@/types/notifications';

/** Agendamentos confirmados nas últimas 24h */
export function useAgendaNotifications(): AppNotification[] {
  const [items, setItems] = useState<AppNotification[]>([]);

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const ago24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('appointments')
      .select('id, title, date, time, status, updated_at, cliente_id, clientes(nome)')
      .eq('user_id', user.id)
      .eq('status', 'confirmado')
      .gte('updated_at', ago24h)
      .order('updated_at', { ascending: false })
      .limit(20);

    const next: AppNotification[] = (data || []).map((a: any) => ({
      id: `appt-confirmed-${a.id}`,
      category: 'agenda',
      priority: 'media',
      title: 'Agendamento confirmado',
      description: `${a.clientes?.nome || a.title || 'Cliente'} — ${formatDate(a.date)} ${a.time || ''}`.trim(),
      timestamp: a.updated_at,
      route: '/app/agenda',
      icon: 'calendar',
    }));

    setItems(next);
  }, []);

  useEffect(() => {
    fetchAll();
    // A3: reduz polling para 15min (notificação não precisa ser realtime;
    // eventos importantes chegam pelo canal Realtime unificado).
    const id = setInterval(fetchAll, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchAll]);


  return items;
}

function formatDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
}

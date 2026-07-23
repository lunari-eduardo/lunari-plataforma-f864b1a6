import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkflowCache } from '@/contexts/WorkflowCacheContext';
import type { WorkflowSession } from '@/features/workflow';
import { AppNotification } from '@/types/notifications';
import {
  bucketProductsByDeadline,
  type DeadlineItem,
} from '@/features/workflow/domain/productDeadlines';

const formatBR = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
};

function itemToNotif(item: DeadlineItem): AppNotification {
  const { bucket, diasParaVencer, cliente, produtoNome, quantidade, prazoEntrega, sessionId, produtoId } = item;

  let title: string;
  let priority: AppNotification['priority'];
  let quando: string;
  if (bucket === 'atrasado') {
    title = 'Prazo de produto vencido';
    priority = 'critica';
    quando = diasParaVencer === -1 ? 'venceu ontem' : `venceu há ${Math.abs(diasParaVencer)} dias`;
  } else if (bucket === 'hoje') {
    title = 'Prazo de produto vence hoje';
    priority = 'alta';
    quando = 'vence hoje';
  } else if (bucket === 'amanha') {
    title = 'Prazo de produto vence amanhã';
    priority = 'alta';
    quando = 'vence amanhã';
  } else if (bucket === 'semana') {
    title = `Prazo de produto em ${diasParaVencer} dias`;
    priority = 'media';
    quando = `vence em ${diasParaVencer} dias (${formatBR(prazoEntrega)})`;
  } else {
    title = `Prazo em ${diasParaVencer} dias`;
    priority = 'baixa';
    quando = `vence em ${diasParaVencer} dias (${formatBR(prazoEntrega)})`;
  }

  return {
    id: `prod-prazo-${bucket}-${sessionId}-${produtoId}`,
    category: 'pendencia',
    priority,
    title,
    description: `${cliente} — ${quantidade > 1 ? quantidade + 'x ' : ''}${produtoNome} · ${quando}`,
    timestamp: `${prazoEntrega}T00:00:00Z`,
    route: '/app/workflow',
    icon: 'package',
  };
}

function buildNotifsFromSessions(sessions: WorkflowSession[]): AppNotification[] {
  return bucketProductsByDeadline(sessions as any[])
    // Notificação só até 7 dias (paridade com comportamento anterior).
    .filter((i) => i.bucket !== 'futuro')
    .map(itemToNotif);
}

/**
 * Notificações D-7 / D-1 / hoje / atrasado baseadas em `prazoEntrega`
 * por produto. Ignora produtos sem prazo ou já entregues.
 */
export function useProductDeadlineNotifications(): AppNotification[] {
  const { subscribe } = useWorkflowCache();
  const [items, setItems] = useState<AppNotification[]>([]);

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Janela: 90 dias para trás (produtos com prazo atrasado) + 120 dias à frente
    // (bucket "futuro" filtrado no consumidor). Corta o SELECT global que
    // escaneava clientes_sessoes inteira do usuário (top-3 do pg_stat_statements).
    const today = new Date();
    const since = new Date(today);
    since.setDate(since.getDate() - 90);
    const until = new Date(today);
    until.setDate(until.getDate() + 120);
    const sinceIso = since.toISOString().split('T')[0];
    const untilIso = until.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('clientes_sessoes')
      .select('id, data_sessao, produtos_incluidos, clientes(nome)')
      .eq('user_id', user.id)
      .not('produtos_incluidos', 'is', null)
      .gte('data_sessao', sinceIso)
      .lte('data_sessao', untilIso)
      .order('data_sessao', { ascending: true })
      .limit(500);

    if (error) {
      console.error('[useProductDeadlineNotifications] fetch error:', error);
      return;
    }
    setItems(buildNotifsFromSessions((data || []) as unknown as WorkflowSession[]));
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = window.setInterval(fetchAll, 15 * 60 * 1000);
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchAll();
    };
    document.addEventListener('visibilitychange', onVis);

    const unsub = subscribe((sessions) => {
      setItems((prev) => {
        const cacheIds = new Set(sessions.map((s) => String(s.id)));
        const kept = prev.filter((n) => {
          const parts = n.id.split('-');
          const sessionId = parts.slice(3, -1).join('-') || parts[3];
          return !cacheIds.has(sessionId);
        });
        return [...kept, ...buildNotifsFromSessions(sessions)];
      });
    });

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
      unsub();
    };
  }, [fetchAll, subscribe]);

  return items;
}

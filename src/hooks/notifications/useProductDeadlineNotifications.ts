import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkflowCache } from '@/contexts/WorkflowCacheContext';
import type { WorkflowSession } from '@/features/workflow';
import { AppNotification } from '@/types/notifications';
import {
  hydrateProduto,
  isEntregue,
  deterministicProductId,
} from '@/features/workflow/domain/productFlow';

type Bucket = 'overdue' | 'today' | 'tomorrow' | 'week';

const startOfLocalDay = (d: Date) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

const parseISODateLocal = (iso: string): Date | null => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const formatBR = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

function buildNotifsFromSessions(sessions: WorkflowSession[]): AppNotification[] {
  const today = startOfLocalDay(new Date());
  const out: AppNotification[] = [];

  for (const session of sessions) {
    const produtos = ((session as any).produtos_incluidos as any[]) || [];
    if (produtos.length === 0) continue;
    const clienteNome = (session as any).clientes?.nome || 'Cliente';
    const sessionId = String(session.id);

    produtos.forEach((raw, idx) => {
      const p = hydrateProduto(raw);
      if (!p.prazoEntrega) return;
      if (isEntregue(p.etapas)) return;

      const prazoDate = parseISODateLocal(p.prazoEntrega);
      if (!prazoDate) return;

      const diffMs = startOfLocalDay(prazoDate).getTime() - today.getTime();
      const diffDias = Math.round(diffMs / 86400000);

      let bucket: Bucket;
      let title: string;
      let priority: AppNotification['priority'];
      let quando: string;

      if (diffDias < 0) {
        bucket = 'overdue';
        title = 'Prazo de produto vencido';
        priority = 'critica';
        quando = diffDias === -1 ? 'venceu ontem' : `venceu há ${Math.abs(diffDias)} dias`;
      } else if (diffDias === 0) {
        bucket = 'today';
        title = 'Prazo de produto vence hoje';
        priority = 'alta';
        quando = 'vence hoje';
      } else if (diffDias === 1) {
        bucket = 'tomorrow';
        title = 'Prazo de produto vence amanhã';
        priority = 'alta';
        quando = 'vence amanhã';
      } else if (diffDias <= 7) {
        bucket = 'week';
        title = `Prazo de produto em ${diffDias} dias`;
        priority = 'media';
        quando = `vence em ${diffDias} dias (${formatBR(prazoDate)})`;
      } else {
        return;
      }

      const produtoKey =
        (p.id && String(p.id)) ||
        (p.produtoId && String(p.produtoId)) ||
        deterministicProductId(sessionId, p.nome || 'produto', idx);

      const qtd = Number(p.quantidade) || 1;
      const nome = p.nome || 'Produto';

      out.push({
        id: `prod-prazo-${bucket}-${sessionId}-${produtoKey}`,
        category: 'pendencia',
        priority,
        title,
        description: `${clienteNome} — ${qtd > 1 ? qtd + 'x ' : ''}${nome} · ${quando}`,
        timestamp: `${p.prazoEntrega}T00:00:00Z`,
        route: '/app/workflow',
        icon: 'package',
      });
    });
  }

  return out;
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

    const { data, error } = await supabase
      .from('clientes_sessoes')
      .select('id, data_sessao, produtos_incluidos, clientes(nome)')
      .eq('user_id', user.id)
      .not('produtos_incluidos', 'is', null)
      .order('data_sessao', { ascending: true });

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
      // Merge com o que já temos: o cache cobre meses navegados;
      // preservamos os buckets de meses não presentes fazendo um refetch leve.
      // Para não perder responsividade, aplicamos imediatamente o subset do cache
      // e disparamos refetch em background.
      setItems((prev) => {
        const cacheIds = new Set(sessions.map((s) => String(s.id)));
        const kept = prev.filter((n) => {
          // n.id: prod-prazo-{bucket}-{sessionId}-{produtoKey}
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

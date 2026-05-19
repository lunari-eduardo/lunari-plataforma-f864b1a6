import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppNotification } from '@/types/notifications';

/**
 * Notificações financeiras:
 * - Contas faturadas vencidas (data_vencimento < hoje, status='faturado')
 * - Contas vencendo em até 3 dias
 * - Cobranças pagas nas últimas 48h
 * - Cobranças enviadas há mais de 7 dias e ainda não pagas
 */
export function useFinancialNotifications(): AppNotification[] {
  const [items, setItems] = useState<AppNotification[]>([]);

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];
    const in3DaysISO = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];
    const ago48h = new Date(today.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const ago7d = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const next: AppNotification[] = [];

    // Contas vencidas e a vencer
    const { data: txs, error: txsError } = await supabase
      .from('fin_transactions')
      .select('id, valor, data_vencimento, status, item_id, fin_items_master!inner(nome, grupo_principal)')
      .eq('user_id', user.id)
      .eq('status', 'faturado')
      .lte('data_vencimento', in3DaysISO)
      .order('data_vencimento', { ascending: true })
      .limit(50);

    if (txsError) {
      console.warn('useFinancialNotifications: fin_transactions query falhou', txsError);
    }

    (txs || []).forEach((t: any) => {
      const desc = t.fin_items_master?.nome || t.fin_items_master?.grupo_principal || 'Conta';
      const venc = t.data_vencimento;
      const isOverdue = venc < todayISO;
      const valor = Number(t.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      next.push({
        id: `fin-${isOverdue ? 'overdue' : 'soon'}-${t.id}`,
        category: 'financeiro',
        priority: isOverdue ? 'critica' : 'alta',
        title: isOverdue ? 'Conta vencida' : 'Conta a vencer',
        description: `${valor} — ${desc} · venc. ${formatDate(venc)}`,
        timestamp: venc + 'T00:00:00Z',
        route: '/app/financas',
        icon: 'dollar',
      });
    });

    // Cobranças pagas (últimas 48h)
    const { data: pagas } = await supabase
      .from('cobrancas')
      .select('id, valor, descricao, data_pagamento, cliente_id, clientes(nome)')
      .eq('user_id', user.id)
      .eq('status', 'pago')
      .gte('data_pagamento', ago48h)
      .order('data_pagamento', { ascending: false })
      .limit(20);

    (pagas || []).forEach((c: any) => {
      const valor = Number(c.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const cliente = c.clientes?.nome || 'cliente';
      next.push({
        id: `cobranca-paid-${c.id}`,
        category: 'financeiro',
        priority: 'media',
        title: 'Pagamento confirmado',
        description: `${valor} de ${cliente}${c.descricao ? ' — ' + c.descricao : ''}`,
        timestamp: c.data_pagamento || new Date().toISOString(),
        route: '/app/financas',
        icon: 'check',
      });
    });

    // Cobranças pendentes há mais de 7 dias
    const { data: pendentes } = await supabase
      .from('cobrancas')
      .select('id, valor, descricao, created_at, clientes(nome)')
      .eq('user_id', user.id)
      .in('status', ['pendente', 'aguardando'])
      .lte('created_at', ago7d)
      .order('created_at', { ascending: true })
      .limit(20);

    (pendentes || []).forEach((c: any) => {
      const valor = Number(c.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const cliente = c.clientes?.nome || 'cliente';
      next.push({
        id: `cobranca-stale-${c.id}`,
        category: 'financeiro',
        priority: 'media',
        title: 'Cobrança sem pagamento',
        description: `${valor} de ${cliente} — enviada há mais de 7 dias`,
        timestamp: c.created_at,
        route: '/app/financas',
        icon: 'dollar',
      });
    });

    setItems(next);
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 5 * 60 * 1000); // refresh a cada 5min
    return () => clearInterval(id);
  }, [fetchAll]);

  return items;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

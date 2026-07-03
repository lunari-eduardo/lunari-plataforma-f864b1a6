import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppNotification } from '@/types/notifications';

/**
 * - Contratos assinados nos últimos 7 dias
 * - Contratos enviados há mais de 3 dias e ainda sem assinatura
 */
export function useContractNotifications(): AppNotification[] {
  const [items, setItems] = useState<AppNotification[]>([]);

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const ago7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const ago3d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const next: AppNotification[] = [];

    const { data: assinados } = await supabase
      .from('contratos')
      .select('id, titulo, assinado_em, cliente_id, clientes(nome)')
      .eq('user_id', user.id)
      .eq('status', 'assinado')
      .gte('assinado_em', ago7d)
      .order('assinado_em', { ascending: false })
      .limit(20);

    (assinados || []).forEach((c: any) => {
      next.push({
        id: `contract-signed-${c.id}`,
        category: 'documento',
        priority: 'media',
        title: 'Contrato assinado',
        description: `${c.titulo || 'Contrato'} — ${c.clientes?.nome || 'cliente'}`,
        timestamp: c.assinado_em,
        route: c.cliente_id ? `/app/clientes/${c.cliente_id}` : '/app/clientes',
        icon: 'check',
      });
    });

    const { data: pendentes } = await supabase
      .from('contratos')
      .select('id, titulo, enviado_em, cliente_id, clientes(nome)')
      .eq('user_id', user.id)
      .eq('status', 'enviado')
      .lte('enviado_em', ago3d)
      .order('enviado_em', { ascending: true })
      .limit(20);

    (pendentes || []).forEach((c: any) => {
      next.push({
        id: `contract-stale-${c.id}`,
        category: 'documento',
        priority: 'alta',
        title: 'Contrato aguardando assinatura',
        description: `${c.titulo || 'Contrato'} — ${c.clientes?.nome || 'cliente'}`,
        timestamp: c.enviado_em,
        route: c.cliente_id ? `/app/clientes/${c.cliente_id}` : '/app/clientes',
        icon: 'fileText',
      });
    });

    setItems(next);
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 15 * 60 * 1000) /* A3: reduz egress */;
    return () => clearInterval(id);
  }, [fetchAll]);

  return items;
}

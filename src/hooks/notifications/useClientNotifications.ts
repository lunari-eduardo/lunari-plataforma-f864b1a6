import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppNotification } from '@/types/notifications';

/**
 * - Aniversariantes hoje (cliente)
 * - Respostas de formulário recebidas nas últimas 48h
 * - Leads novos sem follow-up há mais de 2 dias
 */
export function useClientNotifications(): AppNotification[] {
  const [items, setItems] = useState<AppNotification[]>([]);

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayMMDD = `${mm}-${dd}`;
    const yyyymmdd = `${today.getFullYear()}${mm}${dd}`;

    const ago48h = new Date(today.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const ago2d = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

    const next: AppNotification[] = [];

    // Aniversariantes hoje
    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, nome, data_nascimento')
      .eq('user_id', user.id)
      .not('data_nascimento', 'is', null);

    (clientes || []).forEach((c: any) => {
      if (!c.data_nascimento) return;
      const mmddCliente = c.data_nascimento.slice(5); // YYYY-MM-DD -> MM-DD
      if (mmddCliente === todayMMDD) {
        next.push({
          id: `birthday-${c.id}-${yyyymmdd}`,
          category: 'cliente',
          priority: 'media',
          title: 'Aniversário hoje',
          description: c.nome,
          timestamp: today.toISOString(),
          route: `/app/clientes/${c.id}`,
          icon: 'gift',
        });
      }
    });

    // Respostas de formulário recentes
    const { data: respostas } = await supabase
      .from('formulario_respostas')
      .select('id, respondente_nome, submitted_at, formulario_id, formularios(titulo)')
      .eq('user_id', user.id)
      .gte('submitted_at', ago48h)
      .order('submitted_at', { ascending: false })
      .limit(20);

    (respostas || []).forEach((r: any) => {
      next.push({
        id: `form-response-${r.id}`,
        category: 'cliente',
        priority: 'alta',
        title: 'Nova resposta de formulário',
        description: `${r.respondente_nome || 'Anônimo'} — ${r.formularios?.titulo || 'Formulário'}`,
        timestamp: r.submitted_at,
        route: '/app/configuracoes',
        icon: 'inbox',
      });
    });

    // Leads novos sem follow-up há > 2 dias
    const { data: leads } = await supabase
      .from('leads')
      .select('id, nome, created_at, status')
      .eq('user_id', user.id)
      .lte('created_at', ago2d)
      .in('status', ['novo', 'new'])
      .order('created_at', { ascending: true })
      .limit(20);

    (leads || []).forEach((l: any) => {
      next.push({
        id: `lead-stale-${l.id}`,
        category: 'cliente',
        priority: 'alta',
        title: 'Lead sem follow-up',
        description: `${l.nome} aguardando há mais de 2 dias`,
        timestamp: l.created_at,
        route: '/app/leads',
        icon: 'user',
      });
    });

    setItems(next);
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchAll]);

  return items;
}

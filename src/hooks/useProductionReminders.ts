import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkflowCache } from '@/contexts/WorkflowCacheContext';
import { WorkflowSession } from '@/features/workflow';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { hydrateProduto, isEntregue } from '@/features/workflow/domain/productFlow';

const isPendente = (p: any) => !isEntregue(hydrateProduto(p).etapas);

// Janela de leitura do dock/notificações de produção. Corta o SELECT global que
// escaneava clientes_sessoes inteira do usuário (top-1 do pg_stat_statements).
const LOOKBACK_DAYS = 180;

interface ProductionReminder {
  id: string;
  cliente: string;
  produto: string;
  tipo: string;
  quantidade: number;
  dataSessao: string;
  mesAno: string;
}

export function useProductionReminders(): ProductionReminder[] {
  const { subscribe } = useWorkflowCache();
  const [reminders, setReminders] = useState<ProductionReminder[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const extractReminders = useCallback((sessions: WorkflowSession[]) => {
    const pending: ProductionReminder[] = [];

    sessions.forEach(session => {
      const produtos = session.produtos_incluidos as any[] || [];
      const clienteNome = session.clientes?.nome || 'Cliente desconhecido';
      const dataSessao = session.data_sessao;
      const mesAno = format(new Date(dataSessao + 'T12:00:00'), "MMMM 'de' yyyy", { locale: ptBR });

      produtos.forEach((p: any) => {
        if (isPendente(p)) {
          pending.push({
            id: `${session.id}-${p.nome}`,
            cliente: clienteNome,
            produto: p.nome,
            tipo: p.tipo || 'incluso',
            quantidade: p.quantidade || 1,
            dataSessao,
            mesAno,
          });
        }
      });
    });

    return pending.sort((a, b) => new Date(a.dataSessao).getTime() - new Date(b.dataSessao).getTime());
  }, []);

  // Fetch inicial LIMITADO em janela + projeção enxuta (sem contato do cliente,
  // sem SELECT *). Antes: query sem filtro de data com SELECT * — 87s totais em 24h.
  const fetchRecentPendingProducts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);
    const sinceIso = since.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('clientes_sessoes')
      .select('id, data_sessao, produtos_incluidos, clientes(nome)')
      .eq('user_id', user.id)
      .not('produtos_incluidos', 'is', null)
      .gte('data_sessao', sinceIso)
      .order('data_sessao', { ascending: true })
      .limit(500)
      .abortSignal(controller.signal);

    if (error) {
      if ((error as any).name === 'AbortError' || (error as any).code === '20') return;
      console.error('Error fetching pending products:', error);
      return;
    }

    const sessionsWithPending = (data || []).filter((session: any) => {
      const produtos = session.produtos_incluidos as any[] || [];
      return produtos.some(isPendente);
    });

    setReminders(extractReminders(sessionsWithPending as unknown as WorkflowSession[]));
  }, [extractReminders]);

  useEffect(() => {
    fetchRecentPendingProducts();

    const unsubscribe = subscribe((sessions) => {
      const sessionsWithPending = sessions.filter(session => {
        const produtos = session.produtos_incluidos as any[] || [];
        return produtos.some(isPendente);
      });
      setReminders(extractReminders(sessionsWithPending));
    });

    return () => {
      abortRef.current?.abort();
      unsubscribe();
    };
  }, [subscribe, fetchRecentPendingProducts, extractReminders]);

  return reminders;
}

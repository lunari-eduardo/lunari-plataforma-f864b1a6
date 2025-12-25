import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkflowCache } from '@/contexts/WorkflowCacheContext';
import { WorkflowSession } from '@/hooks/useWorkflowRealtime';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

  const extractReminders = useCallback((sessions: WorkflowSession[]) => {
    const pending: ProductionReminder[] = [];
    
    sessions.forEach(session => {
      const produtos = session.produtos_incluidos as any[] || [];
      const clienteNome = session.clientes?.nome || 'Cliente desconhecido';
      const dataSessao = session.data_sessao;
      const mesAno = format(new Date(dataSessao + 'T12:00:00'), "MMMM 'de' yyyy", { locale: ptBR });
      
      produtos.forEach((p: any) => {
        if (!p.produzido) {
          pending.push({
            id: `${session.id}-${p.nome}`,
            cliente: clienteNome,
            produto: p.nome,
            tipo: p.tipo || 'incluso',
            quantidade: p.quantidade || 1,
            dataSessao,
            mesAno
          });
        }
      });
    });
    
    // Ordenar por data mais antiga primeiro (atrasados aparecem primeiro)
    return pending.sort((a, b) => new Date(a.dataSessao).getTime() - new Date(b.dataSessao).getTime());
  }, []);

  // Buscar TODAS as sessões com produtos pendentes diretamente do Supabase
  const fetchAllPendingProducts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('clientes_sessoes')
      .select(`
        *,
        clientes (nome, email, telefone, whatsapp)
      `)
      .eq('user_id', user.id)
      .not('produtos_incluidos', 'is', null)
      .order('data_sessao', { ascending: true });

    if (error) {
      console.error('Error fetching pending products:', error);
      return;
    }

    // Filtrar sessões que têm pelo menos 1 produto não produzido
    const sessionsWithPending = (data || []).filter((session: any) => {
      const produtos = session.produtos_incluidos as any[] || [];
      return produtos.some((p: any) => !p.produzido);
    });

    setReminders(extractReminders(sessionsWithPending as WorkflowSession[]));
  }, [extractReminders]);

  useEffect(() => {
    // Carregar inicial de todas as sessões
    fetchAllPendingProducts();
    
    // Subscrever para atualizações em tempo real do cache
    const unsubscribe = subscribe((sessions) => {
      // Filtrar apenas sessões com produtos pendentes
      const sessionsWithPending = sessions.filter(session => {
        const produtos = session.produtos_incluidos as any[] || [];
        return produtos.some((p: any) => !p.produzido);
      });
      setReminders(extractReminders(sessionsWithPending));
    });

    return unsubscribe;
  }, [subscribe, fetchAllPendingProducts, extractReminders]);

  return reminders;
}

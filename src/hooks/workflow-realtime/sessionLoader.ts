import { supabase } from '@/integrations/supabase/client';
import { WorkflowSession } from './types';

export const fetchWorkflowSessionsWithPayments = async (userId: string): Promise<WorkflowSession[]> => {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const dateFilter = twelveMonthsAgo.toISOString().split('T')[0];

  const { data, error: fetchError } = await supabase
    .from('clientes_sessoes')
    .select(`
      *,
      clientes (
        nome,
        email,
        telefone,
        whatsapp
      )
    `)
    .eq('user_id', userId)
    .or('status.is.null,status.not.in.(historico,stub)')
    .gte('data_sessao', dateFilter)
    .order('data_sessao', { ascending: true })
    .order('hora_sessao', { ascending: true });

  if (fetchError) {
    console.error('❌ Error fetching sessions:', fetchError);
    throw fetchError;
  }

  console.log('✅ Loaded sessions:', data?.length || 0);

  const sessionIds = (data || []).map((s) => s.session_id);
  const { transactionsRepo } = await import('@/features/workflow/data');
  const allTransacoes = await transactionsRepo.listBySessionIds(userId, sessionIds);

  // Agrupar transações por session_id em memória
  const transacoesPorSessao = (allTransacoes || []).reduce((acc, t) => {
    if (!acc[t.session_id]) acc[t.session_id] = [];
    acc[t.session_id].push(t);
    return acc;
  }, {} as Record<string, typeof allTransacoes>);

  // Mapear sessões com pagamentos
  const sessionsWithPayments = (data || []).map((session) => {
    const transacoesData = transacoesPorSessao[session.session_id] || [];

    const pagamentos = transacoesData.map((t) => {
      const match = t.descricao?.match(/\[ID:([^\]]+)\]/);
      const paymentId = match ? match[1] : t.id;
      const isPaid = t.tipo === 'pagamento';
      const isPending = t.tipo === 'ajuste';
      const parcelaMatch = t.descricao?.match(/Parcela (\d+)\/(\d+)/);
      const numeroParcela = parcelaMatch ? parseInt(parcelaMatch[1]) : undefined;
      const totalParcelas = parcelaMatch ? parseInt(parcelaMatch[2]) : undefined;

      let tipo: 'pago' | 'agendado' | 'parcelado' = 'pago';
      if (isPending) tipo = totalParcelas ? 'parcelado' : 'agendado';

      let statusPagamento: 'pago' | 'pendente' | 'atrasado' = 'pago';
      if (isPending) {
        statusPagamento = 'pendente';
        if (t.data_vencimento && new Date(t.data_vencimento) < new Date()) {
          statusPagamento = 'atrasado';
        }
      }

      return {
        id: paymentId,
        valor: Number(t.valor) || 0,
        data: isPaid ? t.data_transacao : '',
        dataVencimento: t.data_vencimento || undefined,
        observacoes: t.descricao?.replace(/\s*\[ID:[^\]]+\]/, '') || '',
        tipo,
        statusPagamento,
        numeroParcela,
        totalParcelas,
        origem: 'manual' as const,
        editavel: true,
      };
    });

    return { ...session, pagamentos } as unknown as WorkflowSession;
  });

  return sessionsWithPayments;
};

export const runBackgroundRefreezing = (sessionsWithPayments: WorkflowSession[], userId: string) => {
  setTimeout(async () => {
    try {
      const { pricingFreezingService } = await import('@/services/PricingFreezingService');
      for (const session of sessionsWithPayments) {
        const regrasCongeladas = (session as any).regras_congeladas as any;
        if (!regrasCongeladas?.pacote) {
          console.warn('⚠️ Background re-freezing session:', session.id);
          const novasRegras = await pricingFreezingService.congelarDadosCompletos(
            session.pacote,
            session.categoria,
          );
          await supabase
            .from('clientes_sessoes')
            .update({ regras_congeladas: novasRegras as any })
            .eq('id', session.id)
            .eq('user_id', userId);
        }
      }
    } catch (err) {
      console.error('❌ Background re-freezing failed (non-fatal):', err);
    }
  }, 2000);
};

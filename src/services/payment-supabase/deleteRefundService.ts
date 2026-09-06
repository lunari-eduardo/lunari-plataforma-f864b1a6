import { supabase } from '@/integrations/supabase/client';
import { getSessionBinding } from './sessionBinding';

/**
 * Deletar um pagamento específico do Supabase
 */
export async function deletePaymentFromSupabase(sessionKey: string, paymentId: string): Promise<boolean> {
  try {
    console.log('🗑️ Deletando pagamento:', { sessionKey, paymentId });

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      console.error('❌ Usuário não autenticado');
      return false;
    }

    const sessao = await getSessionBinding(sessionKey);
    if (!sessao) {
      console.error('❌ Sessão não encontrada');
      return false;
    }

    let cobrancaIdToDelete: string | null = null;
    if (paymentId.startsWith('asaas-parcela-')) {
      const parcelaId = paymentId.replace('asaas-parcela-', '');
      const { data: parcela } = await supabase
        .from('cobranca_parcelas')
        .select('cobranca_id')
        .eq('id', parcelaId)
        .maybeSingle();
      if (parcela?.cobranca_id) {
        cobrancaIdToDelete = parcela.cobranca_id;
      }
      await supabase.from('cobranca_parcelas').delete().eq('id', parcelaId);
    } else if (paymentId.startsWith('asaas-') || paymentId.startsWith('mp-') || paymentId.startsWith('ip-')) {
      cobrancaIdToDelete = paymentId.replace(/^(asaas-|mp-|ip-)/, '');
    }

    if (cobrancaIdToDelete) {
      const isValidCobrancaUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cobrancaIdToDelete);
      if (isValidCobrancaUUID) {
        await supabase.from('cobranca_parcelas').delete().eq('cobranca_id', cobrancaIdToDelete);
        await supabase.from('cobrancas').delete().eq('id', cobrancaIdToDelete).eq('user_id', userData.user.id);
        console.log('✅ Cobrança excluída da tabela cobrancas:', cobrancaIdToDelete);
      }
    }

    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId);

    let idsParaDeletar: string[] = [];

    // 1. Buscar por tracking [ID:paymentId]
    const { data: transacoesComTracking, error: errorTracking } = await supabase
      .from('clientes_transacoes')
      .select('id, descricao')
      .eq('session_id', sessao.session_id)
      .ilike('descricao', `%[ID:${paymentId}]%`);

    if (errorTracking) {
      console.error('❌ Erro ao buscar transações com tracking:', errorTracking);
    }

    if (transacoesComTracking && transacoesComTracking.length > 0) {
      idsParaDeletar = transacoesComTracking.map(t => t.id);
      console.log('✅ Encontrado via tracking [ID:]:', idsParaDeletar.length);
    }

    // 2. Se não encontrou com tracking, tentar busca por descrição contendo paymentId
    if (idsParaDeletar.length === 0) {
      const { data: transacoesPorDescricao, error: errorDescricao } = await supabase
        .from('clientes_transacoes')
        .select('id, descricao')
        .eq('session_id', sessao.session_id)
        .ilike('descricao', `%${paymentId}%`);

      if (!errorDescricao && transacoesPorDescricao && transacoesPorDescricao.length > 0) {
        idsParaDeletar = transacoesPorDescricao.map(t => t.id);
        console.log('✅ Encontrado via descrição:', idsParaDeletar.length);
      }
    }

    // 3. Se é UUID válido, tentar buscar diretamente pelo id
    if (idsParaDeletar.length === 0 && isValidUUID) {
      const { data: transacaoPorId, error: errorId } = await supabase
        .from('clientes_transacoes')
        .select('id')
        .eq('id', paymentId)
        .maybeSingle();

      if (!errorId && transacaoPorId) {
        idsParaDeletar = [transacaoPorId.id];
        console.log('✅ Encontrado via UUID direto:', paymentId);
      }
    }

    if (idsParaDeletar.length > 0) {
      const { error: deleteError } = await supabase
        .from('clientes_transacoes')
        .delete()
        .in('id', idsParaDeletar);

      if (deleteError) {
        console.error('❌ Erro ao deletar transações:', deleteError);
        return false;
      }

      console.log(`✅ ${idsParaDeletar.length} transação(ões) deletada(s) com sucesso`);
    }

    window.dispatchEvent(new CustomEvent('payment-deleted', {
      detail: { sessionId: sessao.session_id, paymentId }
    }));

    return true;
  } catch (error) {
    console.error('❌ Erro ao deletar pagamento:', error);
    return false;
  }
}

/**
 * Estornar um pagamento: cria uma transação de estorno referenciando o original
 */
export async function refundPayment(
  sessionKey: string,
  paymentId: string,
  valor: number,
  motivo?: string,
  options?: { keepAsCredit?: boolean }
): Promise<boolean> {
  try {
    const keepAsCredit = options?.keepAsCredit === true;
    console.log('🔄 Estornando pagamento:', { sessionKey, paymentId, valor, motivo, keepAsCredit });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return false;
    }

    const binding = await getSessionBinding(sessionKey);
    if (!binding) {
      console.error('❌ Session not found:', sessionKey);
      return false;
    }

    let cobrancaIdToUpdate: string | null = null;
    if (paymentId.startsWith('asaas-parcela-')) {
      const parcelaId = paymentId.replace('asaas-parcela-', '');
      const { data: parcela } = await supabase
        .from('cobranca_parcelas')
        .select('cobranca_id')
        .eq('id', parcelaId)
        .maybeSingle();
      if (parcela?.cobranca_id) {
        cobrancaIdToUpdate = parcela.cobranca_id;
      }
    } else if (paymentId.startsWith('asaas-') || paymentId.startsWith('mp-') || paymentId.startsWith('ip-')) {
      cobrancaIdToUpdate = paymentId.replace(/^(asaas-|mp-|ip-)/, '');
    }

    if (cobrancaIdToUpdate) {
      const isValidCobrancaUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cobrancaIdToUpdate);
      if (isValidCobrancaUUID) {
        await supabase
          .from('cobrancas')
          .update({ status: 'estornado', updated_at: new Date().toISOString() })
          .eq('id', cobrancaIdToUpdate)
          .eq('user_id', user.id);
        console.log('✅ Status de cobrança atualizado para estornado:', cobrancaIdToUpdate);
      }
    }

    const descricaoBase = `Estorno${motivo ? `: ${motivo}` : ''}`;
    const descricao = keepAsCredit
      ? `${descricaoBase} [Mantido como crédito do cliente] [REF:${paymentId}]`
      : `${descricaoBase} [REF:${paymentId}]`;

    const { error } = await supabase
      .from('clientes_transacoes')
      .insert({
        user_id: user.id,
        cliente_id: binding.cliente_id,
        session_id: binding.session_id,
        tipo: 'estorno',
        valor: valor,
        data_transacao: new Date().toISOString().split('T')[0],
        descricao,
        updated_by: user.id
      });

    if (error) {
      console.error('❌ Erro ao criar estorno em clientes_transacoes:', error);
    } else {
      console.log('✅ Estorno criado com sucesso em clientes_transacoes:', { paymentId, valor });
    }

    if (keepAsCredit) {
      const { error: creditErr } = await supabase.rpc('grant_client_credit', {
        p_cliente_id: binding.cliente_id,
        p_valor: valor,
        p_origem: 'estorno_para_credito',
        p_session_origem: binding.session_id,
        p_descricao: motivo
          ? `Crédito de estorno: ${motivo}`
          : `Crédito de estorno do pagamento ${paymentId.slice(0, 8)}`,
        p_expira_em: null,
        p_transacao_id: null,
      });
      if (creditErr) {
        console.error('⚠️ Estorno gravado, mas falha ao registrar crédito:', creditErr);
      } else {
        console.log('✅ Crédito registrado no ledger do cliente');
      }
    }

    window.dispatchEvent(new CustomEvent('payment-refunded', {
      detail: { sessionId: binding.session_id, paymentId, valor, keepAsCredit }
    }));

    return true;
  } catch (error) {
    console.error('❌ Erro ao estornar pagamento:', error);
    return false;
  }
}

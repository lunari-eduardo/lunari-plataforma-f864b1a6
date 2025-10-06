import { supabase } from '@/integrations/supabase/client';

/**
 * Serviço centralizado para gerenciar pagamentos no Supabase
 * 
 * IMPORTANTE: 
 * - clientes_sessoes.id (UUID) = chave primária, usada no workflow UI
 * - clientes_sessoes.session_id (text) = identificador legível (workflow-timestamp-random)
 * - clientes_transacoes.session_id = armazena o UUID para vinculação
 * 
 * Este serviço usa clientes_sessoes.id (UUID) para buscar o cliente_id
 */
export class PaymentSupabaseService {
  /**
   * Buscar cliente_id através do UUID da sessão
   */
  static async getClienteIdFromSession(sessionUuid: string): Promise<string | null> {
    try {
      console.log('🔍 Buscando cliente_id para session UUID:', sessionUuid);
      
      const { data, error } = await supabase
        .from('clientes_sessoes')
        .select('cliente_id')
        .eq('id', sessionUuid)
        .single();

      if (error) {
        console.error('❌ Erro ao buscar cliente_id:', error);
        return null;
      }

      return data?.cliente_id || null;
    } catch (error) {
      console.error('❌ Erro ao buscar cliente_id:', error);
      return null;
    }
  }

  /**
   * Salvar um único pagamento em clientes_transacoes
   * O trigger trigger_recompute_session_paid() irá automaticamente:
   * - Recalcular valor_pago em clientes_sessoes
   * - Disparar evento realtime
   */
  static async saveSinglePaymentToSupabase(
    sessionUuid: string,
    payment: {
      valor: number;
      data: string;
      observacoes?: string;
      forma_pagamento?: string;
    }
  ): Promise<boolean> {
    try {
      // 1. Buscar user_id autenticado
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData?.user) {
        console.error('❌ Usuário não autenticado:', userError);
        return false;
      }

      const userId = userData.user.id;

      // 2. Buscar cliente_id através do UUID da sessão
      const clienteId = await this.getClienteIdFromSession(sessionUuid);
      
      if (!clienteId) {
        console.error('❌ Não foi possível encontrar cliente_id para session UUID:', sessionUuid);
        return false;
      }

      // 3. Inserir transação em clientes_transacoes (session_id armazena o UUID)
      const { error: insertError } = await supabase
        .from('clientes_transacoes')
        .insert({
          user_id: userId,
          cliente_id: clienteId,
          session_id: sessionUuid,
          tipo: 'pagamento',
          valor: payment.valor,
          data_transacao: payment.data,
          descricao: payment.observacoes || 'Pagamento rápido',
          updated_by: userId
        });

      if (insertError) {
        console.error('❌ Erro ao inserir pagamento:', insertError);
        return false;
      }

      console.log('✅ Pagamento salvo no Supabase:', {
        sessionUuid,
        valor: payment.valor,
        clienteId
      });

      // 4. O trigger trigger_recompute_session_paid() irá automaticamente:
      //    - Recalcular valor_pago em clientes_sessoes
      //    - Atualizar updated_at
      //    - Disparar evento realtime para sincronização automática

      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar pagamento no Supabase:', error);
      return false;
    }
  }

  /**
   * Salvar múltiplos pagamentos (para modal de gerenciamento)
   */
  static async saveMultiplePayments(
    sessionUuid: string,
    payments: Array<{
      valor: number;
      data: string;
      observacoes?: string;
      forma_pagamento?: string;
    }>
  ): Promise<boolean> {
    try {
      for (const payment of payments) {
        const success = await this.saveSinglePaymentToSupabase(sessionUuid, payment);
        if (!success) {
          console.error('❌ Falha ao salvar pagamento:', payment);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar múltiplos pagamentos:', error);
      return false;
    }
  }
}

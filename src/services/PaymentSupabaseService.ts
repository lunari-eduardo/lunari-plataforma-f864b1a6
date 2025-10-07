import { supabase } from '@/integrations/supabase/client';

/**
 * Serviço centralizado para gerenciar pagamentos no Supabase
 * 
 * IMPORTANTE: 
 * - clientes_sessoes.id (UUID) = chave primária, usada no workflow UI
 * - clientes_sessoes.session_id (text) = identificador legível (workflow-timestamp-random)
 * - clientes_transacoes.session_id = armazena session_id (text) para vinculação
 * 
 * Este serviço aceita tanto UUID quanto session_id (text) e resolve automaticamente
 */
export class PaymentSupabaseService {
  /**
   * Buscar dados da sessão através de UUID ou session_id (text)
   * Retorna { id: UUID, session_id: string, cliente_id: UUID }
   */
  static async getSessionBinding(sessionKey: string): Promise<{ id: string; session_id: string; cliente_id: string } | null> {
    try {
      console.log('🔍 Buscando sessão por chave:', sessionKey);
      
      const { data, error } = await supabase
        .from('clientes_sessoes')
        .select('id, session_id, cliente_id')
        .or(`id.eq.${sessionKey},session_id.eq.${sessionKey}`)
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao buscar sessão:', error);
        return null;
      }

      if (!data) {
        console.warn('⚠️ Nenhuma sessão encontrada para chave:', sessionKey);
        return null;
      }

      console.log('✅ Sessão encontrada:', { 
        id: data.id, 
        session_id: data.session_id,
        cliente_id: data.cliente_id 
      });

      return data;
    } catch (error) {
      console.error('❌ Erro ao buscar sessão:', error);
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
    sessionKey: string,
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

      // 2. Buscar sessão (aceita UUID ou session_id text)
      const sessao = await this.getSessionBinding(sessionKey);
      
      if (!sessao) {
        console.error('❌ Sessão não encontrada para chave:', sessionKey);
        return false;
      }

      // 3. Inserir transação em clientes_transacoes (session_id armazena o session_id TEXT)
      const { error: insertError } = await supabase
        .from('clientes_transacoes')
        .insert({
          user_id: userId,
          cliente_id: sessao.cliente_id,
          session_id: sessao.session_id,  // ⚡ Usar session_id (text) para consistência com trigger
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
        sessionKey,
        session_id: sessao.session_id,
        valor: payment.valor,
        cliente_id: sessao.cliente_id
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
    sessionKey: string,
    payments: Array<{
      valor: number;
      data: string;
      observacoes?: string;
      forma_pagamento?: string;
    }>
  ): Promise<boolean> {
    try {
      for (const payment of payments) {
        const success = await this.saveSinglePaymentToSupabase(sessionKey, payment);
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

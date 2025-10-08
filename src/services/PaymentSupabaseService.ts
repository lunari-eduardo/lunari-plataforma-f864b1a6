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
   * Verificar se um pagamento já existe no Supabase
   */
  static async paymentExists(sessionKey: string, paymentId: string): Promise<boolean> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return false;

      const sessao = await this.getSessionBinding(sessionKey);
      if (!sessao) return false;

      const { data, error } = await supabase
        .from('clientes_transacoes')
        .select('id')
        .eq('session_id', sessao.session_id)
        .ilike('descricao', `%${paymentId}%`)
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao verificar existência de pagamento:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('❌ Erro ao verificar pagamento:', error);
      return false;
    }
  }

  /**
   * Deletar um pagamento específico do Supabase
   */
  static async deletePaymentFromSupabase(sessionKey: string, paymentId: string): Promise<boolean> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        console.error('❌ Usuário não autenticado');
        return false;
      }

      const sessao = await this.getSessionBinding(sessionKey);
      if (!sessao) {
        console.error('❌ Sessão não encontrada');
        return false;
      }

      // Buscar transações que contenham o paymentId na descrição
      const { data: transacoes, error: fetchError } = await supabase
        .from('clientes_transacoes')
        .select('id')
        .eq('session_id', sessao.session_id)
        .ilike('descricao', `%[ID:${paymentId}]%`);

      if (fetchError) {
        console.error('❌ Erro ao buscar transação:', fetchError);
        return false;
      }

      if (!transacoes || transacoes.length === 0) {
        console.warn('⚠️ Nenhuma transação encontrada para deletar:', paymentId);
        return true; // Considerar sucesso se não existe
      }

      // Deletar cada transação encontrada
      for (const transacao of transacoes) {
        const { error: deleteError } = await supabase
          .from('clientes_transacoes')
          .delete()
          .eq('id', transacao.id);

        if (deleteError) {
          console.error('❌ Erro ao deletar transação:', deleteError);
          return false;
        }
      }

      console.log('✅ Pagamento deletado do Supabase:', { paymentId, session_id: sessao.session_id, count: transacoes.length });
      return true;
    } catch (error) {
      console.error('❌ Erro ao deletar pagamento:', error);
      return false;
    }
  }

  /**
   * Salvar um único pagamento específico (evita duplicação)
   * Agora aceita paymentId para rastreamento
   */
  static async saveSinglePaymentTracked(
    sessionKey: string,
    paymentId: string,
    payment: {
      valor: number;
      data: string;
      observacoes?: string;
      forma_pagamento?: string;
    }
  ): Promise<boolean> {
    try {
      // Verificar se já existe
      const exists = await this.paymentExists(sessionKey, paymentId);
      if (exists) {
        console.log('⚠️ Pagamento já existe, ignorando:', paymentId);
        return true;
      }

      // 1. Buscar user_id autenticado
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData?.user) {
        console.error('❌ Usuário não autenticado:', userError);
        return false;
      }

      const userId = userData.user.id;

      // 2. Buscar sessão
      const sessao = await this.getSessionBinding(sessionKey);
      
      if (!sessao) {
        console.error('❌ Sessão não encontrada para chave:', sessionKey);
        return false;
      }

      // 3. Inserir transação com ID de rastreamento na descrição
      const descricao = `${payment.observacoes || 'Pagamento'} [ID:${paymentId}]`;
      
      const { error: insertError } = await supabase
        .from('clientes_transacoes')
        .insert({
          user_id: userId,
          cliente_id: sessao.cliente_id,
          session_id: sessao.session_id,
          tipo: 'pagamento',
          valor: payment.valor,
          data_transacao: payment.data,
          descricao: descricao,
          updated_by: userId
        });

      if (insertError) {
        console.error('❌ Erro ao inserir pagamento:', insertError);
        return false;
      }

      console.log('✅ Pagamento salvo no Supabase:', {
        paymentId,
        sessionKey,
        session_id: sessao.session_id,
        valor: payment.valor,
        cliente_id: sessao.cliente_id
      });

      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar pagamento rastreado:', error);
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

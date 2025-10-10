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
   * Update an existing payment in Supabase (prevents duplication on edit)
   */
  static async updateSinglePayment(
    sessionKey: string,
    paymentId: string,
    payment: {
      valor?: number;
      data?: string;
      observacoes?: string;
      forma_pagamento?: string;
    }
  ): Promise<boolean> {
    try {
      console.log('🔄 [PaymentService] Updating payment:', { sessionKey, paymentId, payment });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ User not authenticated');
        return false;
      }

      // Find session binding
      const binding = await this.getSessionBinding(sessionKey);
      if (!binding) {
        console.error('❌ Session not found:', sessionKey);
        return false;
      }

      // Build update object
      const updates: any = {
        updated_at: new Date().toISOString(),
        updated_by: user.id
      };

      if (payment.valor !== undefined) updates.valor = payment.valor;
      if (payment.data) updates.data_transacao = payment.data;
      
      // Update description to preserve [ID:paymentId] tracking
      const baseDesc = payment.observacoes || 'Pagamento';
      updates.descricao = `${baseDesc} [ID:${paymentId}]`;

      // Update transaction with paymentId tracking
      const { error } = await supabase
        .from('clientes_transacoes')
        .update(updates)
        .eq('session_id', binding.session_id)
        .eq('cliente_id', binding.cliente_id)
        .eq('user_id', user.id)
        .ilike('descricao', `%[ID:${paymentId}]%`);

      if (error) {
        console.error('❌ Error updating payment:', error);
        return false;
      }

      console.log('✅ Payment updated successfully');
      return true;

    } catch (error) {
      console.error('❌ Error in updateSinglePayment:', error);
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
   * FASE 2: Suporte para migração de dados antigos
   */
  static async deletePaymentFromSupabase(sessionKey: string, paymentId: string): Promise<boolean> {
    try {
      console.log('🗑️ Deletando pagamento:', { sessionKey, paymentId });

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

      // FASE 2: Buscar com fallback para dados antigos
      // Tentar formato novo primeiro: [ID:paymentId]
      const { data: transacoesComTracking, error: errorTracking } = await supabase
        .from('clientes_transacoes')
        .select('id, descricao')
        .eq('session_id', sessao.session_id)
        .ilike('descricao', `%[ID:${paymentId}]%`);

      if (errorTracking) {
        console.error('❌ Erro ao buscar transações com tracking:', errorTracking);
      }

      // Se não encontrou, tentar buscar por paymentId diretamente (formato antigo)
      let { data: transacoesSemTracking, error: errorSemTracking } = await supabase
        .from('clientes_transacoes')
        .select('id, descricao')
        .eq('session_id', sessao.session_id)
        .or(`descricao.ilike.%${paymentId}%,id.eq.${paymentId}`);

      if (errorSemTracking) {
        console.error('❌ Erro ao buscar transações sem tracking:', errorSemTracking);
      }

      // Combinar resultados e remover duplicatas
      const todasTransacoes = [
        ...(transacoesComTracking || []),
        ...(transacoesSemTracking || [])
      ];
      
      const idsUnicos = [...new Set(todasTransacoes.map(t => t.id))];

      if (idsUnicos.length === 0) {
        console.warn('⚠️ Nenhuma transação encontrada para deletar:', paymentId);
        return true; // Considerar sucesso se já não existe
      }

      // Deletar todas as transações encontradas
      const { error: deleteError } = await supabase
        .from('clientes_transacoes')
        .delete()
        .in('id', idsUnicos);

      if (deleteError) {
        console.error('❌ Erro ao deletar transações:', deleteError);
        return false;
      }

      console.log(`✅ ${idsUnicos.length} transação(ões) deletada(s) com sucesso`);
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

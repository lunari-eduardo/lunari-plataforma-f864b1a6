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
      
      // Verificar se parece um UUID válido
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionKey);
      
      let data = null;
      let error = null;
      
      // FASE 3: Buscar separadamente para evitar erro no .or() com formatos diferentes
      if (isUUID) {
        // Buscar por UUID (id) primeiro
        const result = await supabase
          .from('clientes_sessoes')
          .select('id, session_id, cliente_id')
          .eq('id', sessionKey)
          .maybeSingle();
        data = result.data;
        error = result.error;
        
        if (data) {
          console.log('✅ Sessão encontrada por UUID (id):', data.id);
        }
      }
      
      // Se não encontrou por UUID ou não é UUID, buscar por session_id (TEXT)
      if (!data) {
        const result = await supabase
          .from('clientes_sessoes')
          .select('id, session_id, cliente_id')
          .eq('session_id', sessionKey)
          .maybeSingle();
        data = result.data;
        error = result.error;
        
        if (data) {
          console.log('✅ Sessão encontrada por session_id (TEXT):', data.session_id);
        }
      }

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

      // 4. Disparar evento para sincronização imediata da UI
      window.dispatchEvent(new CustomEvent('payment-created', {
        detail: { 
          sessionId: sessao.session_id, 
          amount: payment.valor,
          clienteId: sessao.cliente_id
        }
      }));

      // 5. O trigger trigger_recompute_session_paid() irá automaticamente:
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
   * Update an existing payment in Supabase with fallback for legacy data
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

      const binding = await this.getSessionBinding(sessionKey);
      if (!binding) {
        console.error('❌ Session not found:', sessionKey);
        return false;
      }

      // FASE 1: Try to find with [ID:paymentId] (new format)
      const { data: withTracking } = await supabase
        .from('clientes_transacoes')
        .select('id, valor, data_transacao, descricao')
        .eq('session_id', binding.session_id)
        .ilike('descricao', `%[ID:${paymentId}]%`)
        .maybeSingle();

      let transactionIdToUpdate: string | null = null;
      let originalValue: number | null = null;
      let originalDate: string | null = null;

      if (withTracking) {
        transactionIdToUpdate = withTracking.id;
        originalValue = Number(withTracking.valor);
        originalDate = withTracking.data_transacao;
        console.log('✅ Found payment with tracking:', transactionIdToUpdate);
      } else {
        console.log('⚠️ Payment not found with [ID:...], trying fallback for legacy data');
        
        // Fallback: buscar por dados originais (para pagamentos legados sem [ID:...])
        const { data: legacy } = await supabase
          .from('clientes_transacoes')
          .select('id, descricao, valor, data_transacao')
          .eq('session_id', binding.session_id)
          .eq('cliente_id', binding.cliente_id)
          .eq('user_id', user.id)
          .eq('tipo', 'pagamento')
          .order('created_at', { ascending: true });

        // Encontrar o primeiro que NÃO tenha [ID:...] (é legado)
        const legacyPayment = legacy?.find(t => !t.descricao.includes('[ID:'));
        if (legacyPayment) {
          transactionIdToUpdate = legacyPayment.id;
          originalValue = Number(legacyPayment.valor);
          originalDate = legacyPayment.data_transacao;
          console.log('✅ Found legacy payment without tracking:', transactionIdToUpdate);
        }
      }

      if (!transactionIdToUpdate) {
        console.error('❌ Payment not found for update (neither with tracking nor legacy)');
        return false;
      }

      // Build update object
      const updates: any = {
        updated_at: new Date().toISOString(),
        updated_by: user.id
      };

      if (payment.valor !== undefined) updates.valor = payment.valor;
      if (payment.data) updates.data_transacao = payment.data;
      
      // SEMPRE adicionar [ID:paymentId] na descrição (para migrar dados legados)
      const baseDesc = payment.observacoes || 'Pagamento';
      updates.descricao = `${baseDesc} [ID:${paymentId}]`;

      // Execute UPDATE
      const { error } = await supabase
        .from('clientes_transacoes')
        .update(updates)
        .eq('id', transactionIdToUpdate);

      if (error) {
        console.error('❌ Error updating payment:', error);
        return false;
      }

      console.log('✅ Payment updated successfully with tracking added');
      return true;

    } catch (error) {
      console.error('❌ Error in updateSinglePayment:', error);
      return false;
    }
  }

  /**
   * Salvar pagamentos pendentes (parcelas/agendamentos) no Supabase
   * Usa tipo='pagamento_pendente' para diferenciar de pagamentos realizados
   */
  static async savePendingPayments(
    sessionKey: string,
    payments: Array<{
      paymentId: string;
      valor: number;
      dataVencimento: string;
      numeroParcela?: number;
      totalParcelas?: number;
      observacoes?: string;
      tipo: 'agendado' | 'parcelado';
    }>
  ): Promise<boolean> {
    try {
      console.log('💾 Salvando pagamentos pendentes:', { sessionKey, count: payments.length });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ User not authenticated');
        return false;
      }

      const binding = await this.getSessionBinding(sessionKey);
      if (!binding) {
        console.error('❌ Session not found:', sessionKey);
        return false;
      }

      // Preparar registros para inserção
      const records = payments.map(p => {
        let descricao = p.observacoes || (p.tipo === 'parcelado' 
          ? `Parcela ${p.numeroParcela}/${p.totalParcelas}` 
          : 'Pagamento agendado');
        
        // Adicionar tracking [ID:paymentId]
        descricao = `${descricao} [ID:${p.paymentId}]`;

        return {
          user_id: user.id,
          cliente_id: binding.cliente_id,
          session_id: binding.session_id,
          tipo: 'ajuste', // Usar 'ajuste' para não violar CHECK constraint
          valor: p.valor,
          data_transacao: p.dataVencimento,
          data_vencimento: p.dataVencimento,
          descricao: descricao,
          updated_by: user.id
        };
      });

      const { error } = await supabase
        .from('clientes_transacoes')
        .insert(records);

      if (error) {
        console.error('❌ Error saving pending payments:', error);
        return false;
      }

      console.log(`✅ ${payments.length} pagamentos pendentes salvos no Supabase`);
      return true;

    } catch (error) {
      console.error('❌ Error in savePendingPayments:', error);
      return false;
    }
  }

  /**
   * Atualizar pagamento pendente (editar valores/vencimento sem marcar como pago)
   */
  static async updatePendingPayment(
    sessionKey: string,
    paymentId: string,
    updates: {
      valor?: number;
      dataVencimento?: string;
      observacoes?: string;
      numeroParcela?: number;
      totalParcelas?: number;
    }
  ): Promise<boolean> {
    try {
      console.log('📝 Atualizando pagamento pendente:', { sessionKey, paymentId, updates });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ User not authenticated');
        return false;
      }

      const binding = await this.getSessionBinding(sessionKey);
      if (!binding) {
        console.error('❌ Session not found:', sessionKey);
        return false;
      }

      // Buscar o registro atual para preservar a descrição
      const { data: existing } = await supabase
        .from('clientes_transacoes')
        .select('descricao')
        .eq('session_id', binding.session_id)
        .ilike('descricao', `%[ID:${paymentId}]%`)
        .maybeSingle();

      if (!existing) {
        console.error('❌ Pending payment not found:', paymentId);
        return false;
      }

      // Reconstruir descrição preservando [ID:...]
      let descricao = existing.descricao;
      if (updates.observacoes !== undefined) {
        // Extrair a parte [ID:...]
        const idMatch = descricao.match(/\[ID:[^\]]+\]/);
        const idPart = idMatch ? idMatch[0] : `[ID:${paymentId}]`;
        
        if (updates.numeroParcela && updates.totalParcelas) {
          descricao = `Parcela ${updates.numeroParcela}/${updates.totalParcelas} ${idPart}`;
        } else {
          descricao = `${updates.observacoes || 'Pagamento agendado'} ${idPart}`;
        }
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
        updated_by: user.id,
        descricao
      };

      if (updates.valor !== undefined) updateData.valor = updates.valor;
      if (updates.dataVencimento) {
        updateData.data_vencimento = updates.dataVencimento;
        updateData.data_transacao = updates.dataVencimento;
      }

      const { error } = await supabase
        .from('clientes_transacoes')
        .update(updateData)
        .eq('session_id', binding.session_id)
        .ilike('descricao', `%[ID:${paymentId}]%`);

      if (error) {
        console.error('❌ Error updating pending payment:', error);
        return false;
      }

      console.log('✅ Pending payment updated successfully');
      return true;

    } catch (error) {
      console.error('❌ Error in updatePendingPayment:', error);
      return false;
    }
  }

  /**
   * Atualizar pagamento pendente para pago (marca como realizado)
   * Com fallback para inserir se não existir
   */
  static async markPaymentAsPaid(
    sessionKey: string,
    paymentId: string,
    dataPagamento: string,
    valor?: number,
    observacoes?: string
  ): Promise<boolean> {
    try {
      console.log('✅ Marcando pagamento como pago:', { sessionKey, paymentId, dataPagamento });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ User not authenticated');
        return false;
      }

      const binding = await this.getSessionBinding(sessionKey);
      if (!binding) {
        console.error('❌ Session not found:', sessionKey);
        return false;
      }

      // Atualizar de 'ajuste' (pendente) para 'pagamento'
      const { data: updated, error } = await supabase
        .from('clientes_transacoes')
        .update({
          tipo: 'pagamento',
          data_transacao: dataPagamento,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('session_id', binding.session_id)
        .ilike('descricao', `%[ID:${paymentId}]%`)
        .select('id');

      if (error) {
        console.error('❌ Error marking payment as paid:', error);
        return false;
      }

      // Fallback: se não encontrou nenhum registro, inserir como novo pagamento
      if (!updated || updated.length === 0) {
        console.warn('⚠️ Pending payment not found, inserting as new payment');
        
        if (!valor) {
          console.error('❌ Cannot insert payment without valor');
          return false;
        }

        return await this.saveSinglePaymentTracked(sessionKey, paymentId, {
          valor,
          data: dataPagamento,
          observacoes
        });
      }

      // ✅ Disparar evento para sincronização imediata da UI
      window.dispatchEvent(new CustomEvent('payment-created', {
        detail: { 
          sessionId: binding.session_id, 
          paymentId,
          clienteId: binding.cliente_id
        }
      }));

      console.log('✅ Payment marked as paid successfully');
      return true;

    } catch (error) {
      console.error('❌ Error in markPaymentAsPaid:', error);
      return false;
    }
  }

  /**
   * Verificar se um pagamento já existe no Supabase (por paymentId OU intentKey)
   */
  static async paymentExists(
    sessionKey: string,
    paymentId: string,
    options?: {
      binding?: { id: string; session_id: string; cliente_id: string };
      intentKey?: string;
    }
  ): Promise<boolean> {
    try {
      const sessao = options?.binding ?? await this.getSessionBinding(sessionKey);
      if (!sessao) return false;

      // Constrói filtro: paymentId OU intentKey
      const filters: string[] = [`descricao.ilike.%[ID:${paymentId}]%`];
      if (options?.intentKey) {
        filters.push(`descricao.ilike.%[INTENT:${options.intentKey}]%`);
      }

      const { data, error } = await supabase
        .from('clientes_transacoes')
        .select('id')
        .eq('session_id', sessao.session_id)
        .or(filters.join(','))
        .limit(1)
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
   * FASE 2: Suporte para IDs não-UUID (como scheduled-timestamp-hash)
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

      // Verificar se paymentId é um UUID válido
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

      if (idsParaDeletar.length === 0) {
        console.warn('⚠️ Nenhuma transação encontrada para deletar:', paymentId);
        return true; // Considerar sucesso se já não existe
      }

      // Deletar todas as transações encontradas
      const { error: deleteError } = await supabase
        .from('clientes_transacoes')
        .delete()
        .in('id', idsParaDeletar);

      if (deleteError) {
        console.error('❌ Erro ao deletar transações:', deleteError);
        return false;
      }

      console.log(`✅ ${idsParaDeletar.length} transação(ões) deletada(s) com sucesso`);

      // Disparar evento para atualizar UI
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
   * O pagamento original é mantido intacto para auditoria
   */
  static async refundPayment(
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

      const binding = await this.getSessionBinding(sessionKey);
      if (!binding) {
        console.error('❌ Session not found:', sessionKey);
        return false;
      }

      const descricaoBase = `Estorno${motivo ? `: ${motivo}` : ''}`;
      const descricao = keepAsCredit
        ? `${descricaoBase} [Mantido como crédito do cliente]`
        : descricaoBase;

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
        console.error('❌ Erro ao criar estorno:', error);
        return false;
      }

      console.log('✅ Estorno criado com sucesso:', { paymentId, valor });

      // Se marcado como "manter como crédito", concede o valor no ledger do cliente
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
          // Não falha a operação: estorno já foi feito. Apenas alerta.
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
    },
    options?: {
      binding?: { id: string; session_id: string; cliente_id: string };
      intentKey?: string;
    }
  ): Promise<boolean> {
    try {
      // 1. Resolver binding (reusa o passado por parâmetro se houver)
      const sessao = options?.binding ?? await this.getSessionBinding(sessionKey);
      if (!sessao) {
        console.error('❌ Sessão não encontrada para chave:', sessionKey);
        return false;
      }

      // 2. Verificar duplicação por paymentId OU intentKey (idempotência)
      const exists = await this.paymentExists(sessionKey, paymentId, {
        binding: sessao,
        intentKey: options?.intentKey,
      });
      if (exists) {
        console.log('⚠️ Pagamento já existe (paymentId/intentKey), ignorando:', paymentId, options?.intentKey);
        return true;
      }

      // 3. Buscar user_id da sessão atual (sem round-trip extra)
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (sessionError || !userId) {
        console.error('❌ Usuário não autenticado:', sessionError);
        return false;
      }

      // 4. Inserir transação com tracking + intent
      const intentTag = options?.intentKey ? ` [INTENT:${options.intentKey}]` : '';
      const descricao = `${payment.observacoes || 'Pagamento'} [ID:${paymentId}]${intentTag}`;

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

      console.log('✅ Pagamento salvo:', { paymentId, session_id: sessao.session_id, valor: payment.valor });
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

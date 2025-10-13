/**
 * Supabase Adapter for Financial Transactions
 * Gerencia transações financeiras (lançamentos únicos, parcelados, recorrentes, cartão)
 */

import { supabase } from '@/integrations/supabase/client';
import { StatusTransacao } from '@/types/financas';
import { getCurrentDateString } from '@/utils/dateUtils';

export interface FinancialTransactionDB {
  id: string;
  user_id: string;
  item_id: string;
  valor: number;
  data_vencimento: string;
  status: StatusTransacao;
  observacoes?: string;
  parcela_atual?: number;
  parcela_total?: number;
  recurring_blueprint_id?: string;
  credit_card_id?: string;
  data_compra?: string;
  parent_id?: string;
  created_at?: string;
  updated_at?: string;
}

export class SupabaseFinancialTransactionsAdapter {
  
  /**
   * Buscar todas as transações do usuário
   */
  static async getAllTransactions(): Promise<FinancialTransactionDB[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('fin_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('data_vencimento', { ascending: false });
      
      if (error) throw error;
      
      return (data || []) as FinancialTransactionDB[];
    } catch (error) {
      console.error('Erro ao buscar transações:', error);
      throw error;
    }
  }
  
  /**
   * Buscar transações por período
   */
  static async getTransactionsByDateRange(startDate: string, endDate: string): Promise<FinancialTransactionDB[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('fin_transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('data_vencimento', startDate)
        .lte('data_vencimento', endDate)
        .order('data_vencimento');
      
      if (error) throw error;
      
      return (data || []) as FinancialTransactionDB[];
    } catch (error) {
      console.error('Erro ao buscar transações por período:', error);
      throw error;
    }
  }
  
  /**
   * Criar nova transação
   */
  static async createTransaction(transaction: Omit<FinancialTransactionDB, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<FinancialTransactionDB> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('fin_transactions')
        .insert({
          user_id: user.id,
          ...transaction
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return data as FinancialTransactionDB;
    } catch (error) {
      console.error('Erro ao criar transação:', error);
      throw error;
    }
  }
  
  /**
   * Criar múltiplas transações (para parcelamentos e recorrências)
   */
  static async createMultipleTransactions(transactions: Array<Omit<FinancialTransactionDB, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<FinancialTransactionDB[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const transactionsWithUser = transactions.map(t => ({
        user_id: user.id,
        ...t
      }));
      
      const { data, error } = await supabase
        .from('fin_transactions')
        .insert(transactionsWithUser)
        .select();
      
      if (error) throw error;
      
      return (data || []) as FinancialTransactionDB[];
    } catch (error) {
      console.error('Erro ao criar múltiplas transações:', error);
      throw error;
    }
  }
  
  /**
   * Atualizar transação
   */
  static async updateTransaction(id: string, updates: Partial<FinancialTransactionDB>): Promise<FinancialTransactionDB> {
    try {
      const { data, error } = await supabase
        .from('fin_transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      return data as FinancialTransactionDB;
    } catch (error) {
      console.error('Erro ao atualizar transação:', error);
      throw error;
    }
  }
  
  /**
   * Marcar transação como paga
   */
  static async markAsPaid(id: string): Promise<FinancialTransactionDB> {
    return this.updateTransaction(id, { status: 'Pago' });
  }
  
  /**
   * Excluir transação
   */
  static async deleteTransaction(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('fin_transactions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao excluir transação:', error);
      throw error;
    }
  }
  
  /**
   * Atualizar status automaticamente baseado na data
   */
  static async updateStatusByDate(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const hoje = getCurrentDateString();
      
      const { data, error } = await supabase
        .from('fin_transactions')
        .update({ status: 'Faturado' })
        .eq('user_id', user.id)
        .eq('status', 'Agendado')
        .lte('data_vencimento', hoje)
        .select();
      
      if (error) throw error;
      
      return data?.length || 0;
    } catch (error) {
      console.error('Erro ao atualizar status por data:', error);
      throw error;
    }
  }

  /**
   * FASE 2: Criar transações recorrentes anuais (12 meses)
   */
  static async createRecurringYearlyTransactions(params: {
    itemId: string;
    valor: number;
    diaVencimento: number;
    dataInicio: string;
    isValorFixo: boolean;
    observacoes?: string;
  }): Promise<FinancialTransactionDB[]> {
    const { itemId, valor, diaVencimento, dataInicio, isValorFixo, observacoes } = params;
    const [ano, mes] = dataInicio.split('-').map(Number);
    
    // Gerar 12 transações (uma para cada mês restante do ano)
    const transactions: Omit<FinancialTransactionDB, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [];
    
    for (let m = mes; m <= 12; m++) {
      const ultimoDiaMes = new Date(ano, m, 0).getDate();
      const diaAjustado = Math.min(diaVencimento, ultimoDiaMes);
      const dataVencimento = `${ano}-${m.toString().padStart(2, '0')}-${diaAjustado.toString().padStart(2, '0')}`;
      
      transactions.push({
        item_id: itemId,
        valor: isValorFixo ? valor : 0, // Se valor variável, criar com 0
        data_vencimento: dataVencimento,
        status: (dataVencimento <= getCurrentDateString() ? 'Faturado' : 'Agendado') as StatusTransacao,
        observacoes: isValorFixo 
          ? (observacoes || 'Recorrente - Valor Fixo')
          : (observacoes || 'Recorrente - Editar Valor'),
        parcela_atual: undefined,
        parcela_total: undefined,
        recurring_blueprint_id: undefined,
        credit_card_id: undefined,
        data_compra: undefined,
        parent_id: `recurring_${Date.now()}`
      });
    }

    return this.createMultipleTransactions(transactions);
  }

  /**
   * FASE 2: Criar transações parceladas (N parcelas mensais)
   */
  static async createParceledTransactions(params: {
    itemId: string;
    valorTotal: number;
    dataPrimeiraOcorrencia: string;
    numeroDeParcelas: number;
    observacoes?: string;
  }): Promise<FinancialTransactionDB[]> {
    const { itemId, valorTotal, dataPrimeiraOcorrencia, numeroDeParcelas, observacoes } = params;
    const valorParcela = valorTotal / numeroDeParcelas;
    const parentId = `parcela_${Date.now()}`;

    const transactions: Omit<FinancialTransactionDB, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [];
    
    for (let i = 0; i < numeroDeParcelas; i++) {
      const dataVencimento = this.calculateParcelDate(dataPrimeiraOcorrencia, i);
      
      transactions.push({
        item_id: itemId,
        valor: valorParcela,
        data_vencimento: dataVencimento,
        status: (dataVencimento <= getCurrentDateString() ? 'Faturado' : 'Agendado') as StatusTransacao,
        parcela_atual: i + 1,
        parcela_total: numeroDeParcelas,
        observacoes: observacoes ? `${observacoes} (${i + 1}/${numeroDeParcelas})` : `(${i + 1}/${numeroDeParcelas})`,
        recurring_blueprint_id: undefined,
        credit_card_id: undefined,
        data_compra: undefined,
        parent_id: parentId
      });
    }

    return this.createMultipleTransactions(transactions);
  }

  /**
   * FASE 2: Criar transações de cartão de crédito com cálculo de vencimentos
   */
  static async createCreditCardTransactions(params: {
    itemId: string;
    valorTotal: number;
    dataCompra: string;
    cartaoCreditoId: string;
    numeroDeParcelas?: number;
    observacoes?: string;
  }): Promise<FinancialTransactionDB[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { itemId, valorTotal, dataCompra, cartaoCreditoId, numeroDeParcelas = 1, observacoes } = params;

    // Buscar dados do cartão
    const { data: cartaoData, error: cartaoError } = await supabase
      .from('fin_credit_cards')
      .select('*')
      .eq('id', cartaoCreditoId)
      .eq('user_id', user.id)
      .single();

    if (cartaoError || !cartaoData) throw new Error('Cartão de crédito não encontrado');

    const valorParcela = valorTotal / numeroDeParcelas;
    const parentId = `cartao_${Date.now()}`;

    const transactions: Omit<FinancialTransactionDB, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [];

    for (let i = 0; i < numeroDeParcelas; i++) {
      const dataVencimento = this.calculateCreditCardDueDate(
        dataCompra,
        cartaoData.dia_fechamento,
        cartaoData.dia_vencimento,
        i
      );

      transactions.push({
        item_id: itemId,
        valor: valorParcela,
        data_vencimento: dataVencimento,
        status: (dataVencimento <= getCurrentDateString() ? 'Faturado' : 'Agendado') as StatusTransacao,
        credit_card_id: cartaoCreditoId,
        data_compra: dataCompra,
        parcela_atual: numeroDeParcelas > 1 ? i + 1 : undefined,
        parcela_total: numeroDeParcelas > 1 ? numeroDeParcelas : undefined,
        observacoes: observacoes ? `${observacoes} (Cartão: ${cartaoData.nome})` : `Cartão: ${cartaoData.nome}`,
        recurring_blueprint_id: undefined,
        parent_id: parentId
      });
    }

    return this.createMultipleTransactions(transactions);
  }

  /**
   * Helper: Calcular data de parcela (adicionar N meses)
   */
  private static calculateParcelDate(dataInicial: string, indiceParcela: number): string {
    const [ano, mes, dia] = dataInicial.split('-').map(Number);
    const novaData = new Date(ano, mes - 1 + indiceParcela, dia);
    
    // Ajustar para último dia do mês se necessário
    const ultimoDiaMes = new Date(novaData.getFullYear(), novaData.getMonth() + 1, 0).getDate();
    if (dia > ultimoDiaMes) {
      novaData.setDate(ultimoDiaMes);
    }

    return novaData.toISOString().split('T')[0];
  }

  /**
   * Helper: Calcular data de vencimento para cartão de crédito
   */
  private static calculateCreditCardDueDate(
    dataCompra: string,
    diaFechamento: number,
    diaVencimento: number,
    parcelaIndex: number
  ): string {
    const [ano, mes, dia] = dataCompra.split('-').map(Number);
    
    // 1. Determinar o período da fatura (qual fatura a compra pertence)
    let mesPeriodoFatura = mes;
    let anoPeriodoFatura = ano;
    
    // Se compra após fechamento, vai para período da próxima fatura
    if (dia > diaFechamento) {
      mesPeriodoFatura++;
      if (mesPeriodoFatura > 12) {
        mesPeriodoFatura = 1;
        anoPeriodoFatura++;
      }
    }
    
    // 2. Fatura sempre vence NO MÊS SEGUINTE ao período
    let mesVencimentoPrimeiraFatura = mesPeriodoFatura + 1;
    let anoVencimentoPrimeiraFatura = anoPeriodoFatura;
    
    if (mesVencimentoPrimeiraFatura > 12) {
      mesVencimentoPrimeiraFatura = 1;
      anoVencimentoPrimeiraFatura++;
    }
    
    // 3. Calcular vencimento da parcela atual
    let mesVencimento = mesVencimentoPrimeiraFatura + parcelaIndex;
    let anoVencimento = anoVencimentoPrimeiraFatura;
    
    while (mesVencimento > 12) {
      mesVencimento -= 12;
      anoVencimento++;
    }
    
    // 4. Dia de vencimento
    const ultimoDiaMes = new Date(anoVencimento, mesVencimento, 0).getDate();
    const diaVencimentoAjustado = Math.min(diaVencimento, ultimoDiaMes);
    
    return `${anoVencimento}-${mesVencimento.toString().padStart(2, '0')}-${diaVencimentoAjustado.toString().padStart(2, '0')}`;
  }
}

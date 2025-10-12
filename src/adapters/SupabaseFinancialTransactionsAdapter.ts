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
}

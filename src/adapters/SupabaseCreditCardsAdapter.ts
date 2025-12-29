/**
 * Supabase Adapter for Credit Cards
 * Gerencia cartões de crédito
 */

import { supabase } from '@/integrations/supabase/client';

export interface CreditCardDB {
  id: string;
  user_id: string;
  nome: string;
  dia_vencimento: number;
  dia_fechamento: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export class SupabaseCreditCardsAdapter {
  
  /**
   * Buscar todos os cartões ativos do usuário
   */
  static async getAllCards(): Promise<CreditCardDB[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('fin_credit_cards')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar cartões:', error);
      throw error;
    }
  }
  
  /**
   * Criar novo cartão (com verificação de duplicata)
   */
  static async createCard(nome: string, dia_vencimento: number, dia_fechamento: number): Promise<CreditCardDB> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      // Verificar se já existe cartão com mesmo nome
      const { data: existing } = await supabase
        .from('fin_credit_cards')
        .select('*')
        .eq('user_id', user.id)
        .eq('nome', nome)
        .eq('ativo', true)
        .maybeSingle();
      
      if (existing) {
        console.log(`⚠️ Cartão "${nome}" já existe, retornando existente`);
        return existing;
      }
      
      const { data, error } = await supabase
        .from('fin_credit_cards')
        .insert({
          user_id: user.id,
          nome,
          dia_vencimento,
          dia_fechamento,
          ativo: true
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Erro ao criar cartão:', error);
      throw error;
    }
  }
  
  /**
   * Atualizar cartão
   */
  static async updateCard(id: string, updates: Partial<Pick<CreditCardDB, 'nome' | 'dia_vencimento' | 'dia_fechamento' | 'ativo'>>): Promise<CreditCardDB> {
    try {
      const { data, error } = await supabase
        .from('fin_credit_cards')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Erro ao atualizar cartão:', error);
      throw error;
    }
  }
  
  /**
   * Desativar cartão (soft delete)
   */
  static async deleteCard(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('fin_credit_cards')
        .update({ ativo: false })
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao remover cartão:', error);
      throw error;
    }
  }
  
  /**
   * Buscar cartão por ID
   */
  static async getCardById(id: string): Promise<CreditCardDB | null> {
    try {
      const { data, error } = await supabase
        .from('fin_credit_cards')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Erro ao buscar cartão:', error);
      throw error;
    }
  }
}

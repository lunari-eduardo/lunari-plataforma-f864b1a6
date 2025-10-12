/**
 * Supabase Adapter for Recurring Blueprints
 * Gerencia blueprints de despesas recorrentes
 */

import { supabase } from '@/integrations/supabase/client';

export interface RecurringBlueprintDB {
  id: string;
  user_id: string;
  item_id: string;
  valor: number;
  dia_vencimento: number;
  data_inicio: string;
  data_fim?: string;
  is_valor_fixo: boolean;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export class SupabaseRecurringBlueprintsAdapter {
  
  /**
   * Buscar todos os blueprints ativos do usuário
   */
  static async getAllBlueprints(): Promise<RecurringBlueprintDB[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('fin_recurring_blueprints')
        .select('*')
        .eq('user_id', user.id)
        .order('data_inicio', { ascending: false });
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar blueprints:', error);
      throw error;
    }
  }
  
  /**
   * Buscar blueprints ativos para um período específico
   */
  static async getActiveBlueprintsForMonth(year: number, month: number): Promise<RecurringBlueprintDB[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const targetDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      
      const { data, error } = await supabase
        .from('fin_recurring_blueprints')
        .select('*')
        .eq('user_id', user.id)
        .lte('data_inicio', targetDate)
        .or(`data_fim.is.null,data_fim.gte.${targetDate}`);
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar blueprints ativos:', error);
      throw error;
    }
  }
  
  /**
   * Criar novo blueprint
   */
  static async createBlueprint(blueprint: Omit<RecurringBlueprintDB, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<RecurringBlueprintDB> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('fin_recurring_blueprints')
        .insert({
          user_id: user.id,
          ...blueprint
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Erro ao criar blueprint:', error);
      throw error;
    }
  }
  
  /**
   * Atualizar blueprint
   */
  static async updateBlueprint(id: string, updates: Partial<RecurringBlueprintDB>): Promise<RecurringBlueprintDB> {
    try {
      const { data, error } = await supabase
        .from('fin_recurring_blueprints')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Erro ao atualizar blueprint:', error);
      throw error;
    }
  }
  
  /**
   * Excluir blueprint
   */
  static async deleteBlueprint(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('fin_recurring_blueprints')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao excluir blueprint:', error);
      throw error;
    }
  }
  
  /**
   * Buscar blueprint por ID
   */
  static async getBlueprintById(id: string): Promise<RecurringBlueprintDB | null> {
    try {
      const { data, error } = await supabase
        .from('fin_recurring_blueprints')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Erro ao buscar blueprint:', error);
      throw error;
    }
  }
}

/**
 * Supabase Adapter for Financial Items
 * Gerencia itens financeiros mestres (DAS, Aluguel, etc.)
 */

import { supabase } from '@/integrations/supabase/client';
import { ItemFinanceiro, GrupoPrincipal } from '@/types/financas';
import { getCurrentDateString } from '@/utils/dateUtils';

export interface ItemFinanceiroSupabase extends ItemFinanceiro {
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  is_default?: boolean;
}

// Itens padrão que são inseridos automaticamente para novos usuários
const DEFAULT_FINANCIAL_ITEMS: Array<{ nome: string; grupo_principal: GrupoPrincipal }> = [
  // Despesas Fixas
  { nome: 'DAS', grupo_principal: 'Despesa Fixa' },
  { nome: 'Aluguel', grupo_principal: 'Despesa Fixa' },
  { nome: 'Água', grupo_principal: 'Despesa Fixa' },
  { nome: 'Adobe', grupo_principal: 'Despesa Fixa' },
  { nome: 'Internet', grupo_principal: 'Despesa Fixa' },
  { nome: 'Energia Elétrica', grupo_principal: 'Despesa Fixa' },
  { nome: 'Pró-labore', grupo_principal: 'Despesa Fixa' },
  { nome: 'Colaborador', grupo_principal: 'Despesa Fixa' },
  { nome: 'Assinatura', grupo_principal: 'Despesa Fixa' },
  { nome: 'Canva', grupo_principal: 'Despesa Fixa' },
  // Despesas Variáveis
  { nome: 'Combustível', grupo_principal: 'Despesa Variável' },
  { nome: 'Alimentação', grupo_principal: 'Despesa Variável' },
  { nome: 'Marketing', grupo_principal: 'Despesa Variável' },
  { nome: 'Fornecedor 1', grupo_principal: 'Despesa Variável' },
  { nome: 'Fornecedor 2', grupo_principal: 'Despesa Variável' },
  { nome: 'Cursos e treinamentos', grupo_principal: 'Despesa Variável' },
  // Investimentos
  { nome: 'Acervo/Cenário', grupo_principal: 'Investimento' },
  { nome: 'Equipamentos', grupo_principal: 'Investimento' },
  // Receitas Não Operacionais
  { nome: 'Receita Extra', grupo_principal: 'Receita Não Operacional' },
  { nome: 'Vendas de Equipamentos', grupo_principal: 'Receita Não Operacional' }
];

export class SupabaseFinancialItemsAdapter {
  
  /**
   * Inicializar itens padrão para um novo usuário
   */
  static async initializeDefaultItems(userId: string): Promise<void> {
    try {
      // Verificar se usuário já tem itens
      const { data: existing } = await supabase
        .from('fin_items_master')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
      
      if (existing && existing.length > 0) {
        console.log('Usuário já possui itens financeiros');
        return;
      }
      
      // Inserir itens padrão
      const itemsToInsert = DEFAULT_FINANCIAL_ITEMS.map(item => ({
        user_id: userId,
        nome: item.nome,
        grupo_principal: item.grupo_principal,
        ativo: true,
        is_default: true
      }));
      
      const { error } = await supabase
        .from('fin_items_master')
        .insert(itemsToInsert);
      
      if (error) throw error;
      
      console.log(`✅ ${itemsToInsert.length} itens financeiros padrão criados`);
    } catch (error) {
      console.error('Erro ao inicializar itens padrão:', error);
      throw error;
    }
  }
  
  /**
   * Buscar todos os itens ativos do usuário
   */
  static async getAllItems(): Promise<ItemFinanceiroSupabase[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      // Tentar inicializar itens padrão (não faz nada se já existirem)
      await this.initializeDefaultItems(user.id);
      
      const { data, error } = await supabase
        .from('fin_items_master')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      
      // Converter para formato compatível
      return (data || []).map(item => ({
        id: item.id,
        nome: item.nome,
        grupo_principal: item.grupo_principal as GrupoPrincipal,
        userId: item.user_id,
        ativo: item.ativo,
        criadoEm: item.created_at?.split('T')[0] || getCurrentDateString(),
        created_at: item.created_at,
        updated_at: item.updated_at,
        user_id: item.user_id,
        is_default: item.is_default
      }));
    } catch (error) {
      console.error('Erro ao buscar itens financeiros:', error);
      throw error;
    }
  }
  
  /**
   * Criar novo item financeiro
   */
  static async createItem(nome: string, grupo_principal: GrupoPrincipal): Promise<ItemFinanceiroSupabase> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('fin_items_master')
        .insert({
          user_id: user.id,
          nome,
          grupo_principal,
          ativo: true,
          is_default: false
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        id: data.id,
        nome: data.nome,
        grupo_principal: data.grupo_principal as GrupoPrincipal,
        userId: data.user_id,
        ativo: data.ativo,
        criadoEm: data.created_at?.split('T')[0] || getCurrentDateString(),
        created_at: data.created_at,
        updated_at: data.updated_at,
        user_id: data.user_id,
        is_default: data.is_default
      };
    } catch (error) {
      console.error('Erro ao criar item financeiro:', error);
      throw error;
    }
  }
  
  /**
   * Atualizar item financeiro
   */
  static async updateItem(id: string, updates: { nome?: string; ativo?: boolean }): Promise<ItemFinanceiroSupabase> {
    try {
      const { data, error } = await supabase
        .from('fin_items_master')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        id: data.id,
        nome: data.nome,
        grupo_principal: data.grupo_principal as GrupoPrincipal,
        userId: data.user_id,
        ativo: data.ativo,
        criadoEm: data.created_at?.split('T')[0] || getCurrentDateString(),
        created_at: data.created_at,
        updated_at: data.updated_at,
        user_id: data.user_id,
        is_default: data.is_default
      };
    } catch (error) {
      console.error('Erro ao atualizar item financeiro:', error);
      throw error;
    }
  }
  
  /**
   * Desativar item financeiro (soft delete)
   */
  static async deleteItem(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('fin_items_master')
        .update({ ativo: false })
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao remover item financeiro:', error);
      throw error;
    }
  }

  /**
   * FASE 1: Obter itens por grupo específico
   */
  static async getItemsByGroup(grupo: GrupoPrincipal): Promise<ItemFinanceiroSupabase[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('fin_items_master')
        .select('*')
        .eq('user_id', user.id)
        .eq('grupo_principal', grupo)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      
      return (data || []).map(item => ({
        id: item.id,
        nome: item.nome,
        grupo_principal: item.grupo_principal as GrupoPrincipal,
        userId: item.user_id,
        ativo: item.ativo,
        criadoEm: item.created_at?.split('T')[0] || getCurrentDateString(),
        created_at: item.created_at,
        updated_at: item.updated_at,
        user_id: item.user_id,
        is_default: item.is_default || false
      }));
    } catch (error) {
      console.error('Erro ao buscar itens por grupo:', error);
      throw error;
    }
  }
}

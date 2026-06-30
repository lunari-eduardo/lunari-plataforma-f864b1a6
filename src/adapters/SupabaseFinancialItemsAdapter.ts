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
  // Cache de Promise por usuário para evitar race conditions:
  // múltiplas chamadas paralelas a getAllItems aguardam a mesma inicialização.
  private static initPromises = new Map<string, Promise<void>>();

  /**
   * Inicializar itens padrão para um novo usuário (idempotente, race-safe)
   */
  static async initializeDefaultItems(userId: string): Promise<void> {
    const cached = this.initPromises.get(userId);
    if (cached) return cached;

    const promise = (async () => {
      try {
        // Verificação rápida — evita INSERT desnecessário quando usuário já tem itens
        const { data: existing } = await supabase
          .from('fin_items_master')
          .select('id')
          .eq('user_id', userId)
          .limit(1);

        if (existing && existing.length > 0) return;

        const itemsToInsert = DEFAULT_FINANCIAL_ITEMS.map(item => ({
          user_id: userId,
          nome: item.nome,
          grupo_principal: item.grupo_principal,
          ativo: true,
          is_default: true
        }));

        // O índice único (user_id, lower(nome), grupo_principal) garante idempotência
        // mesmo se duas chamadas paralelas escaparem do cache acima.
        const { error } = await supabase
          .from('fin_items_master')
          .upsert(itemsToInsert, {
            onConflict: 'user_id,nome,grupo_principal',
            ignoreDuplicates: true
          });

        // Erros de unique violation (23505) são esperados em race e devem ser silenciados
        if (error && (error as any).code !== '23505') throw error;

        console.log(`✅ Itens financeiros padrão garantidos para ${userId}`);
      } catch (error) {
        // Ao falhar, remove cache para permitir nova tentativa em chamada futura
        this.initPromises.delete(userId);
        console.error('Erro ao inicializar itens padrão:', error);
        throw error;
      }
    })();

    this.initPromises.set(userId, promise);
    return promise;
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
        is_default: item.is_default,
        group_code: (item as any).group_code ?? null,
        is_system: (item as any).is_system ?? false,
        archived_at: (item as any).archived_at ?? null,
      }));
    } catch (error) {
      console.error('Erro ao buscar itens financeiros:', error);
      throw error;
    }
  }

  /**
   * Buscar TODOS os itens do usuário (ativos + arquivados).
   * Usado apenas para resolver nomes/grupos de transações antigas — não usar
   * em seletores de criação de novos lançamentos.
   */
  static async getAllItemsIncludingArchived(): Promise<ItemFinanceiroSupabase[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('fin_items_master')
        .select('*')
        .eq('user_id', user.id)
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
        is_default: item.is_default,
        group_code: (item as any).group_code ?? null,
        is_system: (item as any).is_system ?? false,
        archived_at: (item as any).archived_at ?? null,
      }));
    } catch (error) {
      console.error('Erro ao buscar itens (incl. arquivados):', error);
      throw error;
    }
  }
  
  /**
   * Criar novo item financeiro.
   * - Se já existir um item ativo com mesmo nome+grupo → lança DUPLICATE_ACTIVE.
   * - Se existir arquivado (ativo=false) → reativa em vez de inserir (evita 409 no índice único).
   * - Caso contrário → INSERT normal.
   */
  static async createItem(nome: string, grupo_principal: GrupoPrincipal): Promise<ItemFinanceiroSupabase> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const nomeTrim = nome.trim();
      if (!nomeTrim) throw new Error('Nome inválido');

      // Procura existente case-insensitive no mesmo grupo (cobre ativos e arquivados)
      const { data: existentes, error: findErr } = await supabase
        .from('fin_items_master')
        .select('*')
        .eq('user_id', user.id)
        .eq('grupo_principal', grupo_principal)
        .ilike('nome', nomeTrim);

      if (findErr) throw findErr;

      const existente = (existentes || []).find(
        i => (i.nome || '').trim().toLowerCase() === nomeTrim.toLowerCase()
      );

      let data: any;

      if (existente) {
        if (existente.ativo) {
          const err: any = new Error('DUPLICATE_ACTIVE');
          err.code = 'DUPLICATE_ACTIVE';
          throw err;
        }
        // Reativa item arquivado (mesmo grupo e nome equivalente)
        const { data: updated, error: upErr } = await supabase
          .from('fin_items_master')
          .update({ ativo: true, nome: nomeTrim })
          .eq('id', existente.id)
          .select()
          .single();
        if (upErr) throw upErr;
        data = updated;
      } else {
        const { data: inserted, error } = await supabase
          .from('fin_items_master')
          .insert({
            user_id: user.id,
            nome: nomeTrim,
            grupo_principal,
            ativo: true,
            is_default: false
          })
          .select()
          .single();
        if (error) throw error;
        data = inserted;
      }

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
        is_default: data.is_default,
        group_code: (data as any).group_code ?? null,
        is_system: (data as any).is_system ?? false,
        archived_at: (data as any).archived_at ?? null,
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
        is_default: data.is_default,
        group_code: (data as any).group_code ?? null,
        is_system: (data as any).is_system ?? false,
        archived_at: (data as any).archived_at ?? null,
      };
    } catch (error) {
      console.error('Erro ao atualizar item financeiro:', error);
      throw error;
    }
  }
  
  /**
   * Excluir definitivamente o item financeiro.
   * As FKs em fin_transactions / fin_recurring_blueprints são ON DELETE CASCADE,
   * portanto a UI deve confirmar com o usuário antes de chamar este método.
   */
  static async deleteItem(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('fin_items_master')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao remover item financeiro:', error);
      throw error;
    }
  }

  /**
   * Apenas oculta o item (mantém histórico). Útil quando o usuário quer
   * preservar transações antigas mas não ver mais o item na lista.
   */
  static async archiveItem(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('fin_items_master')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao arquivar item financeiro:', error);
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
        is_default: item.is_default || false,
        group_code: (item as any).group_code ?? null,
        is_system: (item as any).is_system ?? false,
        archived_at: (item as any).archived_at ?? null
      }));
    } catch (error) {
      console.error('Erro ao buscar itens por grupo:', error);
      throw error;
    }
  }
}

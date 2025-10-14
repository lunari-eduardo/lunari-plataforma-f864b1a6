/**
 * FASE 1: Serviço Supabase para Itens Financeiros
 * 
 * Substitui o FinancialItemsService localStorage por implementação Supabase
 * - CRUD completo de itens financeiros
 * - Seed de itens padrão no primeiro uso
 * - Integração com RLS do Supabase
 */

import { GrupoPrincipal, ItemFinanceiro } from '@/types/financas';
import { SupabaseFinancialItemsAdapter } from '@/adapters/SupabaseFinancialItemsAdapter';

export interface ISupabaseFinancialItemsService {
  getAllItems(): Promise<ItemFinanceiro[]>;
  getItemsByGroup(grupo: GrupoPrincipal): Promise<ItemFinanceiro[]>;
  createItem(nome: string, grupoPrincipal: GrupoPrincipal): Promise<ItemFinanceiro>;
  updateItem(id: string, updates: { nome?: string; ativo?: boolean }): Promise<ItemFinanceiro>;
  deleteItem(id: string): Promise<void>;
  initializeDefaultItems(): Promise<void>;
}

class SupabaseFinancialItemsService implements ISupabaseFinancialItemsService {
  
  async getAllItems(): Promise<ItemFinanceiro[]> {
    const items = await SupabaseFinancialItemsAdapter.getAllItems();
    
    return items.map(item => ({
      id: item.id,
      nome: item.nome,
      grupo_principal: item.grupo_principal,
      userId: item.userId,
      ativo: item.ativo,
      criadoEm: item.criadoEm
    }));
  }

  async getItemsByGroup(grupo: GrupoPrincipal): Promise<ItemFinanceiro[]> {
    const items = await SupabaseFinancialItemsAdapter.getItemsByGroup(grupo);
    
    return items.map(item => ({
      id: item.id,
      nome: item.nome,
      grupo_principal: item.grupo_principal,
      userId: item.userId,
      ativo: item.ativo,
      criadoEm: item.criadoEm
    }));
  }

  async createItem(nome: string, grupoPrincipal: GrupoPrincipal): Promise<ItemFinanceiro> {
    const item = await SupabaseFinancialItemsAdapter.createItem(nome, grupoPrincipal);
    
    return {
      id: item.id,
      nome: item.nome,
      grupo_principal: item.grupo_principal,
      userId: item.userId,
      ativo: item.ativo,
      criadoEm: item.criadoEm
    };
  }

  async updateItem(id: string, updates: { nome?: string; ativo?: boolean }): Promise<ItemFinanceiro> {
    const item = await SupabaseFinancialItemsAdapter.updateItem(id, updates);
    
    return {
      id: item.id,
      nome: item.nome,
      grupo_principal: item.grupo_principal,
      userId: item.userId,
      ativo: item.ativo,
      criadoEm: item.criadoEm
    };
  }

  async deleteItem(id: string): Promise<void> {
    await SupabaseFinancialItemsAdapter.deleteItem(id);
  }

  async initializeDefaultItems(): Promise<void> {
    // O adapter já gerencia a inicialização automática no getAllItems
    await SupabaseFinancialItemsAdapter.getAllItems();
  }
}

// Exportar instância única
export const supabaseFinancialItemsService = new SupabaseFinancialItemsService();

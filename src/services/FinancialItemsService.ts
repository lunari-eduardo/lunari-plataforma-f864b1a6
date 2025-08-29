import { ItemFinanceiro, GrupoPrincipal } from '@/types/financas';
import { getCurrentDateString } from '@/utils/dateUtils';

// Extended interface for Supabase compatibility
export interface ItemFinanceiroSupabase extends ItemFinanceiro {
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  is_default?: boolean; // Para identificar itens padrão do sistema
}

// Service interface for data operations
export interface IFinancialItemsService {
  getDefaultItems(): ItemFinanceiroSupabase[];
  getAllItems(): Promise<ItemFinanceiroSupabase[]>;
  createItem(item: Omit<ItemFinanceiroSupabase, 'id' | 'criadoEm'>): Promise<ItemFinanceiroSupabase>;
  updateItem(id: string, updates: Partial<ItemFinanceiroSupabase>): Promise<ItemFinanceiroSupabase>;
  deleteItem(id: string): Promise<void>;
  syncWithSupabase?(): Promise<void>;
}

// Default financial items based on the provided image
const DEFAULT_FINANCIAL_ITEMS: ItemFinanceiroSupabase[] = [
  // Despesas Fixas
  { id: 'default_1', nome: 'DAS', grupo_principal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  { id: 'default_2', nome: 'Aluguel', grupo_principal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  { id: 'default_3', nome: 'Água', grupo_principal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  { id: 'default_4', nome: 'Adobe', grupo_principal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  { id: 'default_5', nome: 'Internet', grupo_principal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  { id: 'default_6', nome: 'Energia Elétrica', grupo_principal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  { id: 'default_7', nome: 'Pró-labore', grupo_principal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  { id: 'default_8', nome: 'Colaborador', grupo_principal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  { id: 'default_9', nome: 'Assinatura', grupo_principal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  { id: 'default_10', nome: 'Canva', grupo_principal: 'Despesa Fixa', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  
  // Despesas Variáveis
  { id: 'default_11', nome: 'Combustível', grupo_principal: 'Despesa Variável', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  { id: 'default_12', nome: 'Alimentação', grupo_principal: 'Despesa Variável', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  { id: 'default_13', nome: 'Marketing', grupo_principal: 'Despesa Variável', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  { id: 'default_14', nome: 'Fornecedor 1', grupo_principal: 'Despesa Variável', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  { id: 'default_15', nome: 'Fornecedor 2', grupo_principal: 'Despesa Variável', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  { id: 'default_16', nome: 'Cursos e treinamentos', grupo_principal: 'Despesa Variável', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  
  // Investimentos
  { id: 'default_17', nome: 'Acervo/Cenário', grupo_principal: 'Investimento', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  { id: 'default_18', nome: 'Equipamentos', grupo_principal: 'Investimento', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  
  // Receitas Não Operacionais
  { id: 'default_19', nome: 'Receita Extra', grupo_principal: 'Receita Não Operacional', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true },
  { id: 'default_20', nome: 'Vendas de Equipamentos', grupo_principal: 'Receita Não Operacional', userId: 'default', ativo: true, criadoEm: getCurrentDateString(), is_default: true }
];

// LocalStorage-based implementation
class LocalStorageFinancialItemsService implements IFinancialItemsService {
  private readonly storageKey = 'lunari_fin_items';

  getDefaultItems(): ItemFinanceiroSupabase[] {
    return DEFAULT_FINANCIAL_ITEMS;
  }

  async getAllItems(): Promise<ItemFinanceiroSupabase[]> {
    const saved = localStorage.getItem(this.storageKey);
    if (!saved) {
      // Initialize with default items
      const defaultItems = this.getDefaultItems();
      localStorage.setItem(this.storageKey, JSON.stringify(defaultItems));
      return defaultItems;
    }
    return JSON.parse(saved);
  }

  async createItem(item: Omit<ItemFinanceiroSupabase, 'id' | 'criadoEm'>): Promise<ItemFinanceiroSupabase> {
    const newItem: ItemFinanceiroSupabase = {
      ...item,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      criadoEm: getCurrentDateString(),
      created_at: new Date().toISOString(),
      is_default: false
    };

    const items = await this.getAllItems();
    const updatedItems = [...items, newItem];
    localStorage.setItem(this.storageKey, JSON.stringify(updatedItems));
    
    return newItem;
  }

  async updateItem(id: string, updates: Partial<ItemFinanceiroSupabase>): Promise<ItemFinanceiroSupabase> {
    const items = await this.getAllItems();
    const index = items.findIndex(item => item.id === id);
    
    if (index === -1) {
      throw new Error(`Item with id ${id} not found`);
    }

    const updatedItem = {
      ...items[index],
      ...updates,
      updated_at: new Date().toISOString()
    };

    items[index] = updatedItem;
    localStorage.setItem(this.storageKey, JSON.stringify(items));
    
    return updatedItem;
  }

  async deleteItem(id: string): Promise<void> {
    const items = await this.getAllItems();
    const filteredItems = items.filter(item => item.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(filteredItems));
  }
}

// Supabase-based implementation (placeholder for future)
class SupabaseFinancialItemsService implements IFinancialItemsService {
  getDefaultItems(): ItemFinanceiroSupabase[] {
    return DEFAULT_FINANCIAL_ITEMS;
  }

  async getAllItems(): Promise<ItemFinanceiroSupabase[]> {
    // TODO: Implement Supabase query
    throw new Error('Supabase integration not yet implemented. Please connect to Supabase first.');
  }

  async createItem(item: Omit<ItemFinanceiroSupabase, 'id' | 'criadoEm'>): Promise<ItemFinanceiroSupabase> {
    // TODO: Implement Supabase insert
    throw new Error('Supabase integration not yet implemented. Please connect to Supabase first.');
  }

  async updateItem(id: string, updates: Partial<ItemFinanceiroSupabase>): Promise<ItemFinanceiroSupabase> {
    // TODO: Implement Supabase update
    throw new Error('Supabase integration not yet implemented. Please connect to Supabase first.');
  }

  async deleteItem(id: string): Promise<void> {
    // TODO: Implement Supabase delete
    throw new Error('Supabase integration not yet implemented. Please connect to Supabase first.');
  }

  async syncWithSupabase(): Promise<void> {
    // TODO: Implement bidirectional sync between localStorage and Supabase
    throw new Error('Supabase integration not yet implemented. Please connect to Supabase first.');
  }
}

// Service factory
export class FinancialItemsServiceFactory {
  private static isSupabaseConnected = false; // This will be updated when Supabase is connected

  static createService(): IFinancialItemsService {
    if (this.isSupabaseConnected) {
      return new SupabaseFinancialItemsService();
    }
    return new LocalStorageFinancialItemsService();
  }

  static enableSupabase() {
    this.isSupabaseConnected = true;
  }

  static isUsingSupabase(): boolean {
    return this.isSupabaseConnected;
  }
}

// Export singleton instance
export const financialItemsService = FinancialItemsServiceFactory.createService();
/**
 * Supabase Implementation for Pricing System
 * Handles all pricing data persistence with multi-user support
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { 
  PricingStorageAdapter,
  ConfiguracaoPrecificacao,
  TabelaPrecos,
  FaixaPreco
} from '@/types/pricing';

export class SupabasePricingAdapter implements PricingStorageAdapter {
  
  // ============= CONFIGURATION =============
  
  loadConfiguration(): ConfiguracaoPrecificacao {
    // For synchronous compatibility, return default during first load
    console.warn('SupabasePricingAdapter: Using sync method, use async loading for better UX');
    return { modelo: 'fixo' };
  }

  async loadConfigurationAsync(): Promise<ConfiguracaoPrecificacao> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('modelo_de_preco')
        .select('*')
        .eq('user_id', user.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading pricing configuration:', error);
        throw error;
      }

      if (data) {
        return {
          id: data.id,
          user_id: data.user_id,
          modelo: data.modelo as 'fixo' | 'global' | 'categoria',
          created_at: data.created_at,
          updated_at: data.updated_at
        };
      }

      // Return default if no configuration exists
      return { modelo: 'fixo' };
    } catch (error) {
      console.error('Failed to load pricing configuration:', error);
      return { modelo: 'fixo' };
    }
  }

  async saveConfiguration(config: ConfiguracaoPrecificacao): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      const configData = {
        user_id: user.user.id,
        modelo: config.modelo
      };

      const { error } = await supabase
        .from('modelo_de_preco')
        .upsert(configData, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error saving pricing configuration:', error);
        throw error;
      }

      console.log(`Successfully saved pricing configuration: ${config.modelo}`);
    } catch (error) {
      console.error('Failed to save pricing configuration:', error);
      toast.error('Erro ao salvar configuração de preços');
      throw error;
    }
  }

  // ============= GLOBAL TABLE =============
  
  loadGlobalTable(): TabelaPrecos | null {
    console.warn('SupabasePricingAdapter: Using sync method for global table');
    return null;
  }

  async loadGlobalTableAsync(): Promise<TabelaPrecos | null> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('tabelas_precos')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('tipo', 'global')
        .maybeSingle();

      if (error) {
        console.error('Error loading global pricing table:', error);
        throw error;
      }

      if (data) {
        return {
          id: data.id,
          user_id: data.user_id,
          nome: data.nome,
          faixas: data.faixas as unknown as FaixaPreco[],
          created_at: data.created_at,
          updated_at: data.updated_at
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to load global pricing table:', error);
      return null;
    }
  }

  async saveGlobalTable(table: TabelaPrecos): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      const tableData = {
        id: table.id,
        user_id: user.user.id,
        nome: table.nome,
        faixas: table.faixas as any,
        tipo: 'global'
      };

      const { error } = await supabase
        .from('tabelas_precos')
        .upsert(tableData, {
          onConflict: 'id'
        });

      if (error) {
        console.error('Error saving global pricing table:', error);
        throw error;
      }

      console.log(`Successfully saved global pricing table: ${table.nome}`);
    } catch (error) {
      console.error('Failed to save global pricing table:', error);
      toast.error('Erro ao salvar tabela global de preços');
      throw error;
    }
  }

  // ============= CATEGORY TABLE =============
  
  loadCategoryTable(categoryId: string): TabelaPrecos | null {
    console.warn(`SupabasePricingAdapter: Using sync method for category table: ${categoryId}`);
    return null;
  }

  async loadCategoryTableAsync(categoryId: string): Promise<TabelaPrecos | null> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('tabelas_precos')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('tipo', 'categoria')
        .eq('categoria_id', categoryId)
        .maybeSingle();

      if (error) {
        console.error(`Error loading category pricing table for ${categoryId}:`, error);
        throw error;
      }

      if (data) {
        return {
          id: data.id,
          user_id: data.user_id,
          nome: data.nome,
          faixas: data.faixas as unknown as FaixaPreco[],
          created_at: data.created_at,
          updated_at: data.updated_at
        };
      }

      return null;
    } catch (error) {
      console.error(`Failed to load category pricing table for ${categoryId}:`, error);
      return null;
    }
  }

  async saveCategoryTable(categoryId: string, table: TabelaPrecos): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      const tableData = {
        id: table.id,
        user_id: user.user.id,
        nome: table.nome,
        faixas: table.faixas as any,
        tipo: 'categoria',
        categoria_id: categoryId
      };

      const { error } = await supabase
        .from('tabelas_precos')
        .upsert(tableData, {
          onConflict: 'id'
        });

      if (error) {
        console.error(`Error saving category pricing table for ${categoryId}:`, error);
        throw error;
      }

      console.log(`Successfully saved category pricing table: ${table.nome} for category ${categoryId}`);
    } catch (error) {
      console.error(`Failed to save category pricing table for ${categoryId}:`, error);
      toast.error('Erro ao salvar tabela de preços por categoria');
      throw error;
    }
  }

  // ============= UTILITY METHODS =============

  async getAllCategoryTables(): Promise<Record<string, TabelaPrecos>> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('tabelas_precos')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('tipo', 'categoria');

      if (error) {
        console.error('Error loading all category tables:', error);
        throw error;
      }

      const categoryTables: Record<string, TabelaPrecos> = {};
      
      data?.forEach(table => {
        if (table.categoria_id) {
          categoryTables[table.categoria_id] = {
            id: table.id,
            user_id: table.user_id,
            nome: table.nome,
            faixas: table.faixas as unknown as FaixaPreco[],
            created_at: table.created_at,
            updated_at: table.updated_at
          };
        }
      });

      return categoryTables;
    } catch (error) {
      console.error('Failed to load all category tables:', error);
      return {};
    }
  }
}
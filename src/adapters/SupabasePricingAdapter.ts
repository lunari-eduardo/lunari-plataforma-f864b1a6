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
  // ============= INTERNAL CACHE =============
  private cachedConfig: ConfiguracaoPrecificacao | null = null;
  private cachedGlobalTable: TabelaPrecos | null = null;
  private categoryTablesCache: Record<string, TabelaPrecos> = {};
  
  // ============= CONFIGURATION =============
  
  loadConfiguration(): ConfiguracaoPrecificacao {
    // Return cached config if available, otherwise default
    if (this.cachedConfig) {
      return this.cachedConfig;
    }
    console.warn('SupabasePricingAdapter: No cached config, returning default');
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
        const config = {
          id: data.id,
          user_id: data.user_id,
          modelo: data.modelo as 'fixo' | 'global' | 'categoria',
          created_at: data.created_at,
          updated_at: data.updated_at
        };
        // Update cache
        this.cachedConfig = config;
        return config;
      }

      // Return default if no configuration exists
      const defaultConfig = { modelo: 'fixo' as const };
      this.cachedConfig = defaultConfig;
      return defaultConfig;
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

      // Update cache after successful save
      this.cachedConfig = { ...config, user_id: user.user.id };
      console.log(`Successfully saved pricing configuration: ${config.modelo}`);
    } catch (error) {
      console.error('Failed to save pricing configuration:', error);
      toast.error('Erro ao salvar configuração de preços');
      throw error;
    }
  }

  // ============= GLOBAL TABLE =============
  
  loadGlobalTable(): TabelaPrecos | null {
    // Return cached global table if available
    if (this.cachedGlobalTable) {
      return this.cachedGlobalTable;
    }
    
    // Try to load synchronously from cache, if empty try async load once
    console.warn('SupabasePricingAdapter: No cached global table, attempting async load...');
    this.loadGlobalTableAsync().catch(err => 
      console.error('Failed to async load global table:', err)
    );
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
        const table = {
          id: data.id,
          user_id: data.user_id,
          nome: data.nome,
          faixas: Array.isArray(data.faixas)
            ? (data.faixas as any[]).map((f: any) => ({
                min: f.min ?? f.de ?? 1,
                max: f.max ?? (f.ate === 999999 ? null : (f.ate ?? null)),
                valor: f.valor ?? f.valor_foto_extra ?? 0,
              }))
            : [],
          created_at: data.created_at,
          updated_at: data.updated_at
        };
        // Update cache
        this.cachedGlobalTable = table;
        return table;
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

      console.log('💾 Saving global table:', table);

      // Sanitize ID - if not UUID, omit to let DB generate
      const tableData: any = {
        user_id: user.user.id,
        nome: table.nome,
        faixas: table.faixas as any,
        tipo: 'global'
      };

      // Only include ID if it's a valid UUID
      const isValidUuid = table.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(table.id);
      if (isValidUuid) {
        tableData.id = table.id;
      }

      const { data: savedData, error } = await supabase
        .from('tabelas_precos')
        .upsert(tableData, {
          onConflict: isValidUuid ? 'id' : 'user_id,tipo'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error saving global pricing table:', error);
        if (error.code === '42P10') {
          console.error('🚨 Database index mismatch! The unique constraints may need to be recreated.');
        }
        throw error;
      }

      // Update cache with saved data
      if (savedData) {
        this.cachedGlobalTable = {
          id: savedData.id,
          user_id: savedData.user_id,
          nome: savedData.nome,
          faixas: savedData.faixas as unknown as FaixaPreco[],
          created_at: savedData.created_at,
          updated_at: savedData.updated_at
        };
      }

      console.log(`✅ Successfully saved global pricing table: ${table.nome}`);
    } catch (error) {
      console.error('❌ Failed to save global pricing table:', error);
      toast.error('Erro ao salvar tabela global de preços');
      throw error;
    }
  }

  // ============= CATEGORY TABLE =============
  
  loadCategoryTable(categoryId: string): TabelaPrecos | null {
    // Return cached category table if available
    if (this.categoryTablesCache[categoryId]) {
      return this.categoryTablesCache[categoryId];
    }
    
    // Try to load synchronously from cache, if empty try async load once
    console.warn(`SupabasePricingAdapter: No cached category table for: ${categoryId}, attempting async load...`);
    this.loadCategoryTableAsync(categoryId).catch(err => 
      console.error(`Failed to async load category table for ${categoryId}:`, err)
    );
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
        const table = {
          id: data.id,
          user_id: data.user_id,
          nome: data.nome,
          faixas: Array.isArray(data.faixas)
            ? (data.faixas as any[]).map((f: any) => ({
                min: f.min ?? f.de ?? 1,
                max: f.max ?? (f.ate === 999999 ? null : (f.ate ?? null)),
                valor: f.valor ?? f.valor_foto_extra ?? 0,
              }))
            : [],
          created_at: data.created_at,
          updated_at: data.updated_at
        };
        // Update cache
        this.categoryTablesCache[categoryId] = table;
        return table;
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

      console.log('💾 Saving category table:', { categoryId, table });

      // Validate and resolve categoryId if it's a name instead of UUID
      let resolvedCategoryId = categoryId;
      
      // Check if categoryId is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(categoryId)) {
        console.log('🔍 Resolving category name to UUID:', categoryId);
        
        const { data: categoria, error: categoriaError } = await supabase
          .from('categorias')
          .select('id')
          .eq('user_id', user.user.id)
          .eq('nome', categoryId)
          .maybeSingle();

        if (categoriaError || !categoria) {
          console.error('❌ Category not found:', categoryId, categoriaError);
          throw new Error(`Categoria não encontrada: ${categoryId}`);
        }
        
        resolvedCategoryId = categoria.id;
        console.log('✅ Category resolved:', { name: categoryId, id: resolvedCategoryId });
      }

      // Sanitize ID - if not UUID, omit to let DB generate
      const tableData: any = {
        user_id: user.user.id,
        nome: table.nome,
        faixas: table.faixas as any,
        tipo: 'categoria',
        categoria_id: resolvedCategoryId
      };

      // Only include ID if it's a valid UUID
      const isValidUuid = table.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(table.id);
      if (isValidUuid) {
        tableData.id = table.id;
      }

      const { data: savedData, error } = await supabase
        .from('tabelas_precos')
        .upsert(tableData, {
          onConflict: isValidUuid ? 'id' : 'user_id,tipo,categoria_id'
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Error saving category pricing table for ${categoryId}:`, error);
        if (error.code === '42P10') {
          console.error('🚨 Database index mismatch! The unique constraints may need to be recreated.');
        }
        throw error;
      }

      // Update cache with saved data (using original categoryId as key)
      if (savedData) {
        this.categoryTablesCache[categoryId] = {
          id: savedData.id,
          user_id: savedData.user_id,
          nome: savedData.nome,
          faixas: savedData.faixas as unknown as FaixaPreco[],
          created_at: savedData.created_at,
          updated_at: savedData.updated_at
        };
      }

      console.log(`✅ Successfully saved category pricing table: ${table.nome} for category ${categoryId}`);
    } catch (error) {
      console.error(`❌ Failed to save category pricing table for ${categoryId}:`, error);
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
          const categoryTable = {
            id: table.id,
            user_id: table.user_id,
            nome: table.nome,
            faixas: Array.isArray(table.faixas)
              ? (table.faixas as any[]).map((f: any) => ({
                  min: f.min ?? f.de ?? 1,
                  max: f.max ?? (f.ate === 999999 ? null : (f.ate ?? null)),
                  valor: f.valor ?? f.valor_foto_extra ?? 0,
                }))
              : [],
            created_at: table.created_at,
            updated_at: table.updated_at
          };
          categoryTables[table.categoria_id] = categoryTable;
          // Update cache
          this.categoryTablesCache[table.categoria_id] = categoryTable;
        }
      });

      return categoryTables;
    } catch (error) {
      console.error('Failed to load all category tables:', error);
      return {};
    }
  }

  // ============= PRELOAD METHOD =============
  
  async preloadAll(): Promise<void> {
    console.log('🔄 Preloading all pricing data...');
    try {
      // Load configuration
      await this.loadConfigurationAsync();
      
      // Load global table
      await this.loadGlobalTableAsync();
      
      // Load all category tables
      await this.getAllCategoryTables();
      
      console.log('✅ All pricing data preloaded successfully');
    } catch (error) {
      console.error('❌ Error preloading pricing data:', error);
      throw error;
    }
  }
}
/**
 * Configuration management service for pricing system
 * Handles loading, saving and managing pricing configurations
 */

import type { 
  ConfiguracaoPrecificacao, 
  TabelaPrecos, 
  PricingStorageAdapter 
} from '@/types/pricing';
import { PRICING_STORAGE_KEYS } from '@/types/pricing';

class LocalStorageAdapter implements PricingStorageAdapter {
  loadConfiguration(): ConfiguracaoPrecificacao {
    try {
      const config = localStorage.getItem(PRICING_STORAGE_KEYS.CONFIGURACAO);
      if (config) {
        return JSON.parse(config);
      }
    } catch (error) {
      console.error('Error loading pricing configuration:', error);
    }
    
    // Default configuration
    return { modelo: 'fixo' };
  }

  async saveConfiguration(config: ConfiguracaoPrecificacao): Promise<void> {
    try {
      localStorage.setItem(PRICING_STORAGE_KEYS.CONFIGURACAO, JSON.stringify(config));
    } catch (error) {
      console.error('Error saving pricing configuration:', error);
      throw error;
    }
  }

  loadGlobalTable(): TabelaPrecos | null {
    try {
      const tabela = localStorage.getItem(PRICING_STORAGE_KEYS.TABELA_GLOBAL);
      return tabela ? JSON.parse(tabela) : null;
    } catch (error) {
      console.error('Error loading global pricing table:', error);
      return null;
    }
  }

  async saveGlobalTable(table: TabelaPrecos): Promise<void> {
    try {
      localStorage.setItem(PRICING_STORAGE_KEYS.TABELA_GLOBAL, JSON.stringify(table));
    } catch (error) {
      console.error('Error saving global pricing table:', error);
      throw error;
    }
  }

  loadCategoryTable(categoryId: string): TabelaPrecos | null {
    try {
      const categorias = localStorage.getItem(PRICING_STORAGE_KEYS.CATEGORIAS_PREFIX);
      if (!categorias) return null;
      
      const categoriasArray = JSON.parse(categorias);
      const categoria = categoriasArray.find((cat: any) => cat.id === categoryId);
      
      return categoria?.tabelaPrecosFotos || null;
    } catch (error) {
      console.error('Error loading category pricing table:', error);
      return null;
    }
  }

  async saveCategoryTable(categoryId: string, table: TabelaPrecos): Promise<void> {
    try {
      const categorias = localStorage.getItem(PRICING_STORAGE_KEYS.CATEGORIAS_PREFIX);
      if (!categorias) return;
      
      const categoriasArray = JSON.parse(categorias);
      const categoriaIndex = categoriasArray.findIndex((cat: any) => cat.id === categoryId);
      
      if (categoriaIndex !== -1) {
        categoriasArray[categoriaIndex] = {
          ...categoriasArray[categoriaIndex],
          tabelaPrecosFotos: table
        };
        
        localStorage.setItem(PRICING_STORAGE_KEYS.CATEGORIAS_PREFIX, JSON.stringify(categoriasArray));
      }
    } catch (error) {
      console.error('Error saving category pricing table:', error);
      throw error;
    }
  }
}

export class PricingConfigurationService {
  private static adapter: PricingStorageAdapter = new LocalStorageAdapter();
  private static isUsingSupabase: boolean = false;

  /**
   * Set storage adapter (useful for testing or Supabase migration)
   */
  static setAdapter(adapter: PricingStorageAdapter): void {
    this.adapter = adapter;
    this.isUsingSupabase = adapter.constructor.name === 'SupabasePricingAdapter';
  }

  /**
   * Initialize Supabase adapter
   */
  static async initializeSupabaseAdapter(): Promise<void> {
    try {
      const { SupabasePricingAdapter } = await import('@/adapters/SupabasePricingAdapter');
      this.setAdapter(new SupabasePricingAdapter());
      console.log('✅ Supabase pricing adapter initialized and set as active adapter');
    } catch (error) {
      console.error('❌ Failed to initialize Supabase adapter:', error);
      throw error;
    }
  }

  /**
   * Load current pricing configuration
   */
  static loadConfiguration(): ConfiguracaoPrecificacao {
    return this.adapter.loadConfiguration();
  }

  /**
   * Save pricing configuration
   */
  static async saveConfiguration(config: ConfiguracaoPrecificacao): Promise<void> {
    await this.adapter.saveConfiguration(config);
    
    // Dispatch event for system notification
    const evento = new CustomEvent('precificacao-modelo-changed', {
      detail: { novoModelo: config.modelo }
    });
    window.dispatchEvent(evento);
  }

  /**
   * Load global pricing table
   */
  static loadGlobalTable(): TabelaPrecos | null {
    return this.adapter.loadGlobalTable();
  }

  /**
   * Save global pricing table
   */
  static async saveGlobalTable(table: TabelaPrecos): Promise<void> {
    await this.adapter.saveGlobalTable(table);
  }

  /**
   * Load category-specific pricing table
   */
  static loadCategoryTable(categoryId: string): TabelaPrecos | null {
    return this.adapter.loadCategoryTable(categoryId);
  }

  /**
   * Save category-specific pricing table
   */
  static async saveCategoryTable(categoryId: string, table: TabelaPrecos): Promise<void> {
    await this.adapter.saveCategoryTable(categoryId, table);
  }

  /**
   * Get all available categories with pricing tables
   */
  static getCategoriesWithPricing(): Array<{id: string, nome: string, hasPricing: boolean}> {
    try {
      const categorias = localStorage.getItem(PRICING_STORAGE_KEYS.CATEGORIAS_PREFIX);
      if (!categorias) return [];
      
      const categoriasArray = JSON.parse(categorias);
      return categoriasArray.map((cat: any) => ({
        id: cat.id,
        nome: cat.nome,
        hasPricing: !!cat.tabelaPrecosFotos
      }));
    } catch (error) {
      console.error('Error loading categories with pricing:', error);
      return [];
    }
  }

  /**
   * Generate unique ID for new tables
   */
  static generateTableId(): string {
    return `tabela_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
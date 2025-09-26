/**
 * Service for migrating pricing data from localStorage to Supabase
 * Handles one-time migration with data validation and backup
 */

import { supabase } from '@/integrations/supabase/client';
import { SupabasePricingAdapter } from '@/adapters/SupabasePricingAdapter';
import { PricingConfigurationService } from './PricingConfigurationService';
import { toast } from 'sonner';
import type { 
  ConfiguracaoPrecificacao,
  TabelaPrecos,
  PricingMigrationData
} from '@/types/pricing';
import { PRICING_STORAGE_KEYS } from '@/types/pricing';

const MIGRATION_KEY = 'pricing_supabase_migration_v1_completed';
const MIGRATION_VERSION = '1.0.0';
const MIGRATION_IN_PROGRESS_KEY = 'pricing_migration_in_progress';

export class PricingMigrationService {
  private supabaseAdapter: SupabasePricingAdapter;
  private migrationInProgress = false;
  private toastShown = false;

  constructor() {
    this.supabaseAdapter = new SupabasePricingAdapter();
  }

  /**
   * Check if migration is needed
   */
  isMigrationNeeded(): boolean {
    const migrationCompleted = localStorage.getItem(MIGRATION_KEY);
    const migrationInProgress = localStorage.getItem(MIGRATION_IN_PROGRESS_KEY);
    const hasLocalData = this.hasLocalPricingData();
    
    // Don't migrate if already completed, in progress, or no local data
    return !migrationCompleted && !migrationInProgress && !this.migrationInProgress && hasLocalData;
  }

  /**
   * Check if there's local pricing data to migrate
   */
  private hasLocalPricingData(): boolean {
    try {
      const config = localStorage.getItem(PRICING_STORAGE_KEYS.CONFIGURACAO);
      const globalTable = localStorage.getItem(PRICING_STORAGE_KEYS.TABELA_GLOBAL);
      const categorias = localStorage.getItem(PRICING_STORAGE_KEYS.CATEGORIAS_PREFIX);

      return !!(config || globalTable || categorias);
    } catch (error) {
      console.error('Error checking local pricing data:', error);
      return false;
    }
  }

  /**
   * Execute automatic migration
   */
  async executeMigration(): Promise<boolean> {
    if (!this.isMigrationNeeded()) {
      console.log('⚠️ Pricing migration not needed or already completed');
      return true;
    }

    // Prevent concurrent migrations
    if (this.migrationInProgress) {
      console.log('⚠️ Migration already in progress, skipping');
      return true;
    }

    this.migrationInProgress = true;
    localStorage.setItem(MIGRATION_IN_PROGRESS_KEY, 'true');

    try {
      console.log('🔄 Starting pricing data migration to Supabase...');
      
      // Check authentication
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.error('❌ User not authenticated for migration');
        return false;
      }

      // Create backup before migration
      const backupData = await this.createBackup();
      
      // Migrate data
      const migrationData = this.collectLocalData();
      await this.migrateToSupabase(migrationData);

      // Validate migration
      const isValid = await this.validateMigration(migrationData);
      if (!isValid) {
        throw new Error('Migration validation failed');
      }

      // Mark migration as completed
      localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
      localStorage.removeItem(MIGRATION_IN_PROGRESS_KEY);
      
      console.log('✅ Pricing migration completed successfully');
      
      // Show success toast only once
      if (!this.toastShown) {
        toast.success('Dados de precificação migrados com sucesso!');
        this.toastShown = true;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Pricing migration failed:', error);
      localStorage.removeItem(MIGRATION_IN_PROGRESS_KEY);
      
      // Show error toast only once
      if (!this.toastShown) {
        toast.error('Erro na migração dos dados. Tentando novamente...');
        this.toastShown = true;
      }
      
      return false;
    } finally {
      this.migrationInProgress = false;
    }
  }

  /**
   * Collect all local pricing data
   */
  private collectLocalData(): PricingMigrationData {
    const configuracao = PricingConfigurationService.loadConfiguration();
    const tabelaGlobal = PricingConfigurationService.loadGlobalTable();
    
    // Collect category tables
    const tabelasCategorias: Record<string, TabelaPrecos> = {};
    try {
      const categorias = localStorage.getItem(PRICING_STORAGE_KEYS.CATEGORIAS_PREFIX);
      if (categorias) {
        const categoriasArray = JSON.parse(categorias);
        categoriasArray.forEach((categoria: any) => {
          if (categoria.tabelaPrecosFotos) {
            tabelasCategorias[categoria.id] = categoria.tabelaPrecosFotos;
          }
        });
      }
    } catch (error) {
      console.error('Error collecting category tables:', error);
    }

    return {
      version: MIGRATION_VERSION,
      configuracao,
      tabelaGlobal: tabelaGlobal || undefined,
      tabelasCategorias,
      migratedAt: new Date().toISOString()
    };
  }

  /**
   * Migrate data to Supabase
   */
  private async migrateToSupabase(data: PricingMigrationData): Promise<void> {
    // Migrate configuration
    if (data.configuracao) {
      await this.supabaseAdapter.saveConfiguration(data.configuracao);
      console.log('✅ Configuration migrated');
    }

    // Migrate global table
    if (data.tabelaGlobal) {
      // Sanitize global table - ensure UUID or let DB generate
      const globalTableToSave = { ...data.tabelaGlobal };
      if (globalTableToSave.id && !this.isValidUUID(globalTableToSave.id)) {
        console.log(`🔧 Removing non-UUID id from global table: ${globalTableToSave.id}`);
        delete globalTableToSave.id;
      }
      
      await this.supabaseAdapter.saveGlobalTable(globalTableToSave);
      console.log('✅ Global table migrated');
    }

    // Migrate category tables
    const categoryIds = Object.keys(data.tabelasCategorias);
    for (const categoryId of categoryIds) {
      const table = data.tabelasCategorias[categoryId];
      if (table) {
        // Sanitize category table - ensure UUID or let DB generate
        const tableToSave = { ...table };
        if (tableToSave.id && !this.isValidUUID(tableToSave.id)) {
          console.log(`🔧 Removing non-UUID id from category table: ${tableToSave.id}`);
          delete tableToSave.id;
        }
        
        await this.supabaseAdapter.saveCategoryTable(categoryId, tableToSave);
        console.log(`✅ Category table migrated for: ${categoryId}`);
      }
    }

    console.log(`✅ Migrated ${categoryIds.length} category tables`);
  }

  /**
   * Validate that migration was successful
   */
  private async validateMigration(originalData: PricingMigrationData): Promise<boolean> {
    try {
      // Validate configuration
      const migratedConfig = await this.supabaseAdapter.loadConfigurationAsync();
      if (migratedConfig.modelo !== originalData.configuracao.modelo) {
        console.error('❌ Configuration validation failed');
        return false;
      }

      // Validate global table
      if (originalData.tabelaGlobal) {
        const migratedGlobalTable = await this.supabaseAdapter.loadGlobalTableAsync();
        if (!migratedGlobalTable || migratedGlobalTable.nome !== originalData.tabelaGlobal.nome) {
          console.error('❌ Global table validation failed');
          return false;
        }
      }

      // Validate category tables
      const categoryIds = Object.keys(originalData.tabelasCategorias);
      for (const categoryId of categoryIds) {
        const originalTable = originalData.tabelasCategorias[categoryId];
        const migratedTable = await this.supabaseAdapter.loadCategoryTableAsync(categoryId);
        
        if (!migratedTable || migratedTable.nome !== originalTable.nome) {
          console.error(`❌ Category table validation failed for: ${categoryId}`);
          return false;
        }
      }

      console.log('✅ Migration validation passed');
      return true;
    } catch (error) {
      console.error('❌ Migration validation error:', error);
      return false;
    }
  }

  /**
   * Create backup of local data
   */
  private async createBackup(): Promise<string> {
    try {
      const data = this.collectLocalData();
      const backupKey = `pricing_backup_${Date.now()}`;
      const backupData = JSON.stringify(data);
      
      localStorage.setItem(backupKey, backupData);
      console.log(`📦 Backup created: ${backupKey}`);
      
      return backupKey;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }

  /**
   * Rollback migration (restore from backup)
   */
  async rollbackMigration(backupKey: string): Promise<boolean> {
    try {
      const backupData = localStorage.getItem(backupKey);
      if (!backupData) {
        throw new Error('Backup not found');
      }

      const data: PricingMigrationData = JSON.parse(backupData);
      
      // Restore configuration
      await PricingConfigurationService.saveConfiguration(data.configuracao);
      
      // Restore global table
      if (data.tabelaGlobal) {
        await PricingConfigurationService.saveGlobalTable(data.tabelaGlobal);
      }

      // Restore category tables
      const categoryIds = Object.keys(data.tabelasCategorias);
      for (const categoryId of categoryIds) {
        const table = data.tabelasCategorias[categoryId];
        if (table) {
          await PricingConfigurationService.saveCategoryTable(categoryId, table);
        }
      }

      // Remove migration marker
      localStorage.removeItem(MIGRATION_KEY);

      console.log('✅ Migration rollback completed');
      toast.success('Dados restaurados com sucesso!');
      
      return true;
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      toast.error('Erro ao restaurar dados');
      return false;
    }
  }

  /**
   * Clean up local data after successful migration
   */
  cleanupLocalData(): void {
    try {
      localStorage.removeItem(PRICING_STORAGE_KEYS.CONFIGURACAO);
      localStorage.removeItem(PRICING_STORAGE_KEYS.TABELA_GLOBAL);
      
      // Note: We don't remove CATEGORIAS_PREFIX as it might contain other data
      // The category tables are embedded within the categories structure
      
      console.log('🧹 Local pricing data cleaned up');
    } catch (error) {
      console.error('Error cleaning up local data:', error);
    }
  }

  /**
   * Check if a string is a valid UUID
   */
  private isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  /**
   * Force reset migration status (for testing)
   */
  resetMigrationStatus(): void {
    localStorage.removeItem(MIGRATION_KEY);
    localStorage.removeItem(MIGRATION_IN_PROGRESS_KEY);
    this.migrationInProgress = false;
    this.toastShown = false;
    console.log('🔄 Migration status reset');
  }
}

// Export singleton instance
export const pricingMigrationService = new PricingMigrationService();
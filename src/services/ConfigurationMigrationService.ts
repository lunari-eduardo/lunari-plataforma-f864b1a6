/**
 * Serviço de migração de configurações localStorage → Supabase
 * Executa migração automática e transparente para o usuário
 */

import { supabase } from '@/integrations/supabase/client';
import { storage } from '@/utils/localStorage';
import { toast } from 'sonner';
import { DEFAULT_CATEGORIAS } from '@/types/configuration';
import type { Categoria } from '@/types/configuration';

const MIGRATION_STORAGE_KEY = 'migration_status_categorias';
const LOCALSTORAGE_KEYS = {
  CATEGORIAS: 'configuracoes_categorias'
} as const;

export class ConfigurationMigrationService {
  
  /**
   * Verifica se a migração de categorias já foi executada
   */
  private static hasMigrated(): boolean {
    return storage.load(MIGRATION_STORAGE_KEY, false);
  }

  /**
   * Marca migração como concluída
   */
  private static markMigrated(): void {
    storage.save(MIGRATION_STORAGE_KEY, true);
  }

  /**
   * Carrega categorias do localStorage
   */
  private static loadLocalStorageCategorias(): Categoria[] {
    const saved = storage.load(LOCALSTORAGE_KEYS.CATEGORIAS, []);
    return saved.length > 0 ? saved : DEFAULT_CATEGORIAS;
  }

  /**
   * Migra categorias do localStorage para Supabase
   */
  static async migrateCategorias(): Promise<boolean> {
    try {
      // Verifica se usuário está logado
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.log('User not authenticated, skipping migration');
        return false;
      }

      // Verifica se migração já foi executada
      if (this.hasMigrated()) {
        console.log('Migration already completed');
        return true;
      }

      // Verifica se há dados no Supabase
      const { data: existingData } = await supabase
        .from('categorias')
        .select('id')
        .limit(1);

      if (existingData && existingData.length > 0) {
        console.log('Data already exists in Supabase, marking as migrated');
        this.markMigrated();
        return true;
      }

      // Carrega dados do localStorage
      const localCategorias = this.loadLocalStorageCategorias();
      console.log(`Found ${localCategorias.length} categorias in localStorage`);

      // Prepara dados para inserção no Supabase
      const categoriasData = localCategorias.map(categoria => ({
        id: categoria.id,
        user_id: user.user.id,
        nome: categoria.nome,
        cor: categoria.cor
      }));

      // Insere no Supabase
      const { error } = await supabase
        .from('categorias')
        .insert(categoriasData);

      if (error) {
        console.error('Error migrating categorias:', error);
        throw error;
      }

      // Marca migração como concluída
      this.markMigrated();
      
      // Remove dados do localStorage
      this.cleanupLocalStorage();

      console.log(`Successfully migrated ${localCategorias.length} categorias to Supabase`);
      toast.success('Configurações migradas para a nuvem com sucesso!');
      
      return true;
    } catch (error) {
      console.error('Migration failed:', error);
      toast.error('Erro na migração. Usando dados locais temporariamente.');
      return false;
    }
  }

  /**
   * Remove dados migrados do localStorage
   */
  private static cleanupLocalStorage(): void {
    try {
      // Remove apenas após confirmação da migração
      storage.remove(LOCALSTORAGE_KEYS.CATEGORIAS);
      console.log('localStorage cleanup completed');
    } catch (error) {
      console.error('Error during localStorage cleanup:', error);
    }
  }

  /**
   * Força uma nova migração (útil para testes)
   */
  static resetMigrationStatus(): void {
    storage.remove(MIGRATION_STORAGE_KEY);
  }

  /**
   * Executa migração completa do sistema
   */
  static async migrateAll(): Promise<void> {
    console.log('Starting configuration migration...');
    await this.migrateCategorias();
    // TODO: Adicionar migração de pacotes, produtos, etapas
  }
}
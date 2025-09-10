/**
 * Serviço de migração de configurações localStorage → Supabase
 * Executa migração automática e transparente para o usuário
 */

import { supabase } from '@/integrations/supabase/client';
import { storage } from '@/utils/localStorage';
import { toast } from 'sonner';
import { DEFAULT_CATEGORIAS, DEFAULT_PACOTES, DEFAULT_PRODUTOS, DEFAULT_ETAPAS } from '@/types/configuration';
import type { Categoria, Pacote, Produto, EtapaTrabalho } from '@/types/configuration';

const MIGRATION_STORAGE_KEY = 'migration_status_complete';
const LOCALSTORAGE_KEYS = {
  CATEGORIAS: 'configuracoes_categorias',
  PACOTES: 'configuracoes_pacotes',
  PRODUTOS: 'configuracoes_produtos',
  ETAPAS: 'lunari_workflow_status'
} as const;

// Mapeamento de IDs antigos para novos UUIDs
const ID_MAPPING = new Map<string, string>();

export class ConfigurationMigrationService {
  
  /**
   * Verifica se a migração já foi executada
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
   * Gera UUID válido ou usa o existente se já for UUID
   */
  private static generateOrKeepUUID(oldId: string): string {
    // Se já for um UUID válido, manter
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(oldId)) {
      return oldId;
    }
    
    // Se já temos mapeamento, usar
    if (ID_MAPPING.has(oldId)) {
      return ID_MAPPING.get(oldId)!;
    }
    
    // Gerar novo UUID
    const newUUID = crypto.randomUUID();
    ID_MAPPING.set(oldId, newUUID);
    return newUUID;
  }

  /**
   * Carrega dados do localStorage com fallback para defaults
   */
  private static loadLocalData() {
    const categorias = storage.load(LOCALSTORAGE_KEYS.CATEGORIAS, DEFAULT_CATEGORIAS);
    const pacotes = storage.load(LOCALSTORAGE_KEYS.PACOTES, DEFAULT_PACOTES);
    const produtos = storage.load(LOCALSTORAGE_KEYS.PRODUTOS, DEFAULT_PRODUTOS);
    const etapas = storage.load(LOCALSTORAGE_KEYS.ETAPAS, DEFAULT_ETAPAS);

    return { categorias, pacotes, produtos, etapas };
  }

  /**
   * Migra categorias para Supabase
   */
  private static async migrateCategoriasInternal(categorias: Categoria[], userId: string): Promise<boolean> {
    try {
      // Verifica se há dados existentes
      const { data: existing } = await supabase
        .from('categorias')
        .select('id')
        .limit(1);

      if (existing && existing.length > 0) {
        console.log('Categorias already exist in Supabase');
        return true;
      }

      // Prepara dados com UUIDs válidos
      const categoriasData = categorias.map(categoria => ({
        id: this.generateOrKeepUUID(categoria.id),
        user_id: userId,
        nome: categoria.nome,
        cor: categoria.cor
      }));

      const { error } = await supabase
        .from('categorias')
        .insert(categoriasData);

      if (error) throw error;

      console.log(`Migrated ${categoriasData.length} categorias to Supabase`);
      return true;
    } catch (error) {
      console.error('Error migrating categorias:', error);
      return false;
    }
  }

  /**
   * Remove dados do localStorage após migração bem-sucedida
   */
  private static cleanupLocalStorage(): void {
    try {
      Object.values(LOCALSTORAGE_KEYS).forEach(key => {
        storage.remove(key);
      });
      // Remove também chaves antigas do sistema de preços
      storage.remove('configuracao_modelos_de_preco');
      console.log('localStorage cleanup completed');
    } catch (error) {
      console.error('Error during localStorage cleanup:', error);
    }
  }

  /**
   * Executa migração completa do sistema
   */
  static async migrateAll(): Promise<boolean> {
    try {
      // Verifica autenticação
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

      console.log('Starting complete configuration migration...');
      
      // Carrega dados do localStorage
      const localData = this.loadLocalData();
      
      // Por enquanto, migra apenas categorias (outras entidades serão adicionadas gradualmente)
      const categoriasOk = await this.migrateCategoriasInternal(localData.categorias, user.user.id);

      if (categoriasOk) {
        // Marca migração como concluída
        this.markMigrated();
        
        // Remove dados do localStorage
        this.cleanupLocalStorage();

        console.log('Complete migration successful');
        toast.success('Configurações migradas para a nuvem!');
        
        return true;
      } else {
        throw new Error('Migration failed');
      }
    } catch (error) {
      console.error('Complete migration failed:', error);
      toast.error('Erro na migração. Usando dados locais temporariamente.');
      return false;
    }
  }

  /**
   * Força uma nova migração (útil para testes)
   */
  static resetMigrationStatus(): void {
    storage.remove(MIGRATION_STORAGE_KEY);
    ID_MAPPING.clear();
  }

  /**
   * Migração individual de categorias (mantida para compatibilidade)
   */
  static async migrateCategorias(): Promise<boolean> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return false;

    const categorias = storage.load(LOCALSTORAGE_KEYS.CATEGORIAS, DEFAULT_CATEGORIAS);
    return await this.migrateCategoriasInternal(categorias, user.user.id);
  }
}
/**
 * Serviço de Configurações - Abstração para persistência de dados
 * Prioriza Supabase quando autenticado, com fallback para localStorage
 */

import { SupabaseConfigurationAdapterAsync } from '@/adapters/SupabaseConfigurationAdapterAsync';
import { ConfigurationMigrationService } from './ConfigurationMigrationService';
import { InitialDataService } from './InitialDataService';
import { supabase } from '@/integrations/supabase/client';
import type { ConfigurationStorageAdapter } from '@/adapters/ConfigurationStorageAdapter';
import type { 
  Categoria, 
  Pacote, 
  Produto, 
  EtapaTrabalho
} from '@/types/configuration';

/**
 * ConfigurationService - Abstração para persistência de configurações
 * 
 * Usa adapter pattern para abstrair a persistência,
 * prioritizando Supabase quando usuário está autenticado.
 */
class ConfigurationService {
  private adapter: ConfigurationStorageAdapter;
  private asyncAdapter: SupabaseConfigurationAdapterAsync | null = null;
  private initialized = false;
  
  constructor(adapter?: ConfigurationStorageAdapter) {
    // FORÇA USO EXCLUSIVO DO SUPABASE - Requer autenticação
    console.warn('⚠️ ConfigurationService: Requer autenticação Supabase para funcionar corretamente');
    this.adapter = adapter || {
      loadCategorias: () => [],
      saveCategorias: async () => {},
      loadPacotes: () => [],
      savePacotes: async () => {},
      loadProdutos: () => [],
      saveProdutos: async () => {},
      loadEtapas: () => [],
      saveEtapas: async () => {}
    } as ConfigurationStorageAdapter;
    
    // Listen to auth changes to reinitialize adapter
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        console.log('🔄 User signed in, resetting adapter for reinitialization');
        this.asyncAdapter = null;
        this.initialized = false;
      }
    });
  }

  /**
   * Inicializa o serviço com o adapter correto baseado no estado de autenticação
   */
  async initialize(): Promise<void> {
    // Allow re-initialization until asyncAdapter is set
    if (this.initialized && this.asyncAdapter) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      
      if (user.user) {
        console.log('User authenticated, enabling async Supabase adapter');
        this.asyncAdapter = new SupabaseConfigurationAdapterAsync();
        
        // Executa migração completa se necessário
        await ConfigurationMigrationService.migrateAll();
        
        // Inicializa dados padrão se usuário for novo
        await InitialDataService.initializeDefaultDataIfNeeded();
      } else {
        console.log('User not authenticated, using localStorage adapter only');
        this.asyncAdapter = null;
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing configuration service:', error);
      // Fallback para localStorage em caso de erro
      this.asyncAdapter = null;
      this.initialized = true;
    }
  }
  
  // ============= OPERAÇÕES DE CATEGORIAS =============
  
  loadCategorias(): Categoria[] {
    // Synchronous for compatibility, initialize in background
    this.initialize().catch(console.error);
    const result = this.adapter.loadCategorias();
    return Array.isArray(result) ? result : [];
  }

  async loadCategoriasAsync(): Promise<Categoria[]> {
    await this.initialize();
    if (this.asyncAdapter) {
      return await this.asyncAdapter.loadCategorias();
    }
    return this.adapter.loadCategorias();
  }

  async saveCategorias(categorias: Categoria[]): Promise<void> {
    await this.initialize();
    if (this.asyncAdapter) {
      await this.asyncAdapter.saveCategorias(categorias);
    } else {
      await this.adapter.saveCategorias(categorias);
    }
  }

  async deleteCategoriaById(id: string): Promise<void> {
    await this.initialize();
    if (this.asyncAdapter) {
      await this.asyncAdapter.deleteCategoriaById(id);
    } else {
      throw new Error('Delete operation requires Supabase authentication');
    }
  }

  async syncCategorias(categorias: Categoria[]): Promise<void> {
    await this.initialize();
    if (this.asyncAdapter) {
      await this.asyncAdapter.syncCategorias(categorias);
    } else {
      await this.adapter.saveCategorias(categorias);
    }
  }

  // ============= OPERAÇÕES DE PACOTES =============
  
  loadPacotes(): Pacote[] {
    this.initialize().catch(console.error);
    return this.adapter.loadPacotes();
  }

  async loadPacotesAsync(): Promise<Pacote[]> {
    await this.initialize();
    if (this.asyncAdapter) {
      return await this.asyncAdapter.loadPacotes();
    }
    return this.adapter.loadPacotes();
  }

  async savePacotes(pacotes: Pacote[]): Promise<void> {
    await this.initialize();
    if (this.asyncAdapter) {
      await this.asyncAdapter.savePacotes(pacotes);
    } else {
      await this.adapter.savePacotes(pacotes);
    }
  }

  async deletePacoteById(id: string): Promise<void> {
    await this.initialize();
    if (this.asyncAdapter) {
      await this.asyncAdapter.deletePacoteById(id);
    } else {
      throw new Error('Delete operation requires Supabase authentication');
    }
  }

  async syncPacotes(pacotes: Pacote[]): Promise<void> {
    await this.initialize();
    if (this.asyncAdapter) {
      await this.asyncAdapter.syncPacotes(pacotes);
    } else {
      await this.adapter.savePacotes(pacotes);
    }
  }

  // ============= OPERAÇÕES DE PRODUTOS =============
  
  loadProdutos(): Produto[] {
    this.initialize().catch(console.error);
    return this.adapter.loadProdutos();
  }

  async loadProdutosAsync(): Promise<Produto[]> {
    await this.initialize();
    if (this.asyncAdapter) {
      return await this.asyncAdapter.loadProdutos();
    }
    return this.adapter.loadProdutos();
  }

  async saveProdutos(produtos: Produto[]): Promise<void> {
    await this.initialize();
    if (this.asyncAdapter) {
      await this.asyncAdapter.saveProdutos(produtos);
    } else {
      await this.adapter.saveProdutos(produtos);
    }
  }

  async deleteProdutoById(id: string): Promise<void> {
    await this.initialize();
    if (this.asyncAdapter) {
      await this.asyncAdapter.deleteProdutoById(id);
    } else {
      throw new Error('Delete operation requires Supabase authentication');
    }
  }

  async syncProdutos(produtos: Produto[]): Promise<void> {
    await this.initialize();
    if (this.asyncAdapter) {
      await this.asyncAdapter.syncProdutos(produtos);
    } else {
      await this.adapter.saveProdutos(produtos);
    }
  }

  // ============= OPERAÇÕES DE ETAPAS =============

  loadEtapas(): EtapaTrabalho[] {
    this.initialize().catch(console.error);
    return this.adapter.loadEtapas();
  }

  async loadEtapasAsync(): Promise<EtapaTrabalho[]> {
    await this.initialize();
    if (this.asyncAdapter) {
      return await this.asyncAdapter.loadEtapas();
    }
    return this.adapter.loadEtapas();
  }

  async saveEtapas(etapas: EtapaTrabalho[]): Promise<void> {
    await this.initialize();
    if (this.asyncAdapter) {
      await this.asyncAdapter.saveEtapas(etapas);
    } else {
      await this.adapter.saveEtapas(etapas);
    }
  }

  async deleteEtapaById(id: string): Promise<void> {
    await this.initialize();
    if (this.asyncAdapter) {
      await this.asyncAdapter.deleteEtapaById(id);
    } else {
      throw new Error('Delete operation requires Supabase authentication');
    }
  }

  async syncEtapas(etapas: EtapaTrabalho[]): Promise<void> {
    await this.initialize();
    if (this.asyncAdapter) {
      await this.asyncAdapter.syncEtapas(etapas);
    } else {
      await this.adapter.saveEtapas(etapas);
    }
  }
  
  // ============= MIGRAÇÃO DE ADAPTER =============
  
  /**
   * Permite trocar o adapter em runtime (útil para migração)
   */
  setAdapter(newAdapter: ConfigurationStorageAdapter): void {
    this.adapter = newAdapter;
  }

  // ============= OPERAÇÕES UTILITÁRIAS =============
  
  generateId(): string {
    return crypto.randomUUID();
  }

  validateCategoria(categoria: Omit<Categoria, 'id'>): { valid: boolean; error?: string } {
    if (!categoria.nome?.trim()) {
      return { valid: false, error: 'O nome da categoria não pode estar vazio' };
    }
    return { valid: true };
  }

  validatePacote(pacote: Omit<Pacote, 'id'>): { valid: boolean; error?: string } {
    if (!pacote.nome?.trim()) {
      return { valid: false, error: 'O nome do pacote não pode estar vazio' };
    }
    if (!pacote.categoria_id) {
      return { valid: false, error: 'Selecione uma categoria para o pacote' };
    }
    if (pacote.valor_base <= 0) {
      return { valid: false, error: 'O valor base deve ser maior que zero' };
    }
    return { valid: true };
  }

  validateProduto(produto: Omit<Produto, 'id'>): { valid: boolean; error?: string } {
    if (!produto.nome?.trim()) {
      return { valid: false, error: 'O nome do produto não pode estar vazio' };
    }
    return { valid: true };
  }

  validateEtapa(etapa: Omit<EtapaTrabalho, 'id' | 'ordem'>): { valid: boolean; error?: string } {
    if (!etapa.nome?.trim()) {
      return { valid: false, error: 'O nome da etapa não pode estar vazio' };
    }
    return { valid: true };
  }

  // ============= VERIFICAÇÕES DE DEPENDÊNCIA =============
  
  canDeleteCategoria(categoriaId: string, pacotes: Pacote[]): boolean {
    return !pacotes.some(pacote => pacote.categoria_id === categoriaId);
  }

  canDeleteProduto(produtoId: string, pacotes: Pacote[]): boolean {
    return !pacotes.some(pacote => 
      pacote.produtosIncluidos.some(p => p.produtoId === produtoId)
    );
  }
}

// Instância singleton
export const configurationService = new ConfigurationService();

// Exportação padrão para compatibilidade
export default configurationService;
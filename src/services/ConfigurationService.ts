/**
 * Serviço de Configurações - Abstração para persistência de dados
 * Preparado para migração futura para Supabase usando adapter pattern
 */

import { SupabaseConfigurationAdapterAsync } from '@/adapters/SupabaseConfigurationAdapterAsync';
import { LocalStorageConfigurationAdapter } from '@/adapters/LocalStorageConfigurationAdapter';
import { ConfigurationMigrationService } from './ConfigurationMigrationService';
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
 * facilitando migração futura para Supabase mantendo a mesma API.
 */
class ConfigurationService {
  private adapter: ConfigurationStorageAdapter;
  private asyncAdapter: SupabaseConfigurationAdapterAsync | null = null;
  private initialized = false;
  
  constructor(adapter?: ConfigurationStorageAdapter) {
    // Por padrão usa LocalStorage, mas pode ser injetado outro adapter
    this.adapter = adapter || new LocalStorageConfigurationAdapter();
  }

  /**
   * Inicializa o serviço com o adapter correto baseado no estado de autenticação
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      
      if (user.user) {
        console.log('User authenticated, enabling async Supabase adapter');
        this.asyncAdapter = new SupabaseConfigurationAdapterAsync();
        
        // Executa migração se necessário
        await ConfigurationMigrationService.migrateCategorias();
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
  
  // ============= OPERAÇÕES DE DADOS =============
  
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

  loadPacotes(): Pacote[] {
    return this.adapter.loadPacotes();
  }

  savePacotes(pacotes: Pacote[]): void {
    this.adapter.savePacotes(pacotes);
  }

  loadProdutos(): Produto[] {
    return this.adapter.loadProdutos();
  }

  saveProdutos(produtos: Produto[]): void {
    this.adapter.saveProdutos(produtos);
  }

  loadEtapas(): EtapaTrabalho[] {
    return this.adapter.loadEtapas();
  }

  saveEtapas(etapas: EtapaTrabalho[]): void {
    this.adapter.saveEtapas(etapas);
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
    return String(Date.now());
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
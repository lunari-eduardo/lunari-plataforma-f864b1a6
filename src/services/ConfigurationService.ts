/**
 * Serviço de Configurações - Abstração para persistência de dados
 * Preparado para migração futura para Supabase usando adapter pattern
 */

import { LocalStorageConfigurationAdapter } from '@/adapters/LocalStorageConfigurationAdapter';
import { SupabaseConfigurationAdapter } from '@/adapters/SupabaseConfigurationAdapter';
import type { ConfigurationStorageAdapter } from '@/adapters/ConfigurationStorageAdapter';
import type { 
  Categoria, 
  Pacote, 
  Produto, 
  EtapaTrabalho
} from '@/types/configuration';
import { supabase } from '@/integrations/supabase/client';

/**
 * ConfigurationService - Abstração para persistência de configurações
 * 
 * Usa adapter pattern para abstrair a persistência.
 * Automaticamente usa Supabase quando usuário está autenticado,
 * senão usa LocalStorage como fallback.
 */
class ConfigurationService {
  private adapter: ConfigurationStorageAdapter;
  private supabaseAdapter: SupabaseConfigurationAdapter;
  private localAdapter: LocalStorageConfigurationAdapter;
  
  constructor(adapter?: ConfigurationStorageAdapter) {
    this.localAdapter = new LocalStorageConfigurationAdapter();
    this.supabaseAdapter = new SupabaseConfigurationAdapter();
    
    // Se adapter específico foi injetado, usa ele
    if (adapter) {
      this.adapter = adapter;
    } else {
      // Senão determina automaticamente baseado na autenticação
      this.adapter = this.localAdapter; // Padrão inicial
      this.initializeAdapter();
    }
  }

  private async initializeAdapter() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('🔄 [ConfigurationService] Usuário autenticado, usando Supabase');
        this.adapter = this.supabaseAdapter;
      } else {
        console.log('🏪 [ConfigurationService] Usuário não autenticado, usando LocalStorage');
        this.adapter = this.localAdapter;
      }
    } catch (error) {
      console.error('❌ [ConfigurationService] Erro ao verificar autenticação:', error);
      this.adapter = this.localAdapter; // Fallback
    }
  }
  
  // ============= OPERAÇÕES DE DADOS =============
  
  loadCategorias(): Categoria[] {
    return this.adapter.loadCategorias();
  }

  async saveCategoriasAsync(categorias: Categoria[]): Promise<void> {
    await this.adapter.saveCategorias(categorias);
  }

  saveCategorias(categorias: Categoria[]): void {
    // Para compatibilidade com código existente
    this.adapter.saveCategorias(categorias);
  }

  loadPacotes(): Pacote[] {
    return this.adapter.loadPacotes();
  }

  async savePacotesAsync(pacotes: Pacote[]): Promise<void> {
    await this.adapter.savePacotes(pacotes);
  }

  savePacotes(pacotes: Pacote[]): void {
    // Para compatibilidade com código existente
    this.adapter.savePacotes(pacotes);
  }

  loadProdutos(): Produto[] {
    return this.adapter.loadProdutos();
  }

  async saveProdutosAsync(produtos: Produto[]): Promise<void> {
    await this.adapter.saveProdutos(produtos);
  }

  saveProdutos(produtos: Produto[]): void {
    // Para compatibilidade com código existente
    this.adapter.saveProdutos(produtos);
  }

  loadEtapas(): EtapaTrabalho[] {
    return this.adapter.loadEtapas();
  }

  async saveEtapasAsync(etapas: EtapaTrabalho[]): Promise<void> {
    await this.adapter.saveEtapas(etapas);
  }

  saveEtapas(etapas: EtapaTrabalho[]): void {
    // Para compatibilidade com código existente
    this.adapter.saveEtapas(etapas);
  }

  // ============= MÉTODOS DE CARREGAMENTO ASSÍNCRONO =============

  async loadConfigurationsAsync(): Promise<{
    categorias: Categoria[];
    pacotes: Pacote[];
    produtos: Produto[];
    etapas: EtapaTrabalho[];
  }> {
    // Se está usando Supabase, carrega dados assíncronos
    if (this.adapter === this.supabaseAdapter) {
      const [categorias, pacotes, produtos, etapas] = await Promise.all([
        this.supabaseAdapter.loadCategoriasAsync(),
        this.supabaseAdapter.loadPacotesAsync(),
        this.supabaseAdapter.loadProdutosAsync(),
        this.supabaseAdapter.loadEtapasAsync()
      ]);

      return { categorias, pacotes, produtos, etapas };
    }

    // Se está usando LocalStorage, dados são síncronos
    return {
      categorias: this.adapter.loadCategorias(),
      pacotes: this.adapter.loadPacotes(),
      produtos: this.adapter.loadProdutos(),
      etapas: this.adapter.loadEtapas()
    };
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
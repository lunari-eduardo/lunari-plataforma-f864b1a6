/**
 * Serviço de Configurações - Abstração para persistência de dados
 * Preparado para migração futura para Supabase
 */

import { storage } from '@/utils/localStorage';
import { saveConfigWithNotification } from '@/utils/configNotification';
import type { 
  Categoria, 
  Pacote, 
  Produto, 
  EtapaTrabalho,
  CONFIGURATION_STORAGE_KEYS
} from '@/types/configuration';
import {
  DEFAULT_CATEGORIAS,
  DEFAULT_PACOTES,
  DEFAULT_PRODUTOS, 
  DEFAULT_ETAPAS
} from '@/types/configuration';

// Chaves de storage centralizadas
const STORAGE_KEYS = {
  CATEGORIAS: 'configuracoes_categorias',
  PACOTES: 'configuracoes_pacotes',
  PRODUTOS: 'configuracoes_produtos', 
  ETAPAS: 'lunari_workflow_status'
} as const;

/**
 * ConfigurationService - Abstração para persistência de configurações
 * 
 * Este serviço abstrai a persistência de dados de configuração,
 * facilitando a migração futura para Supabase mantendo a mesma API.
 */
class ConfigurationService {
  // ============= CATEGORIAS =============
  
  loadCategorias(): Categoria[] {
    const saved = storage.load(STORAGE_KEYS.CATEGORIAS, []);
    return saved.length > 0 ? saved : DEFAULT_CATEGORIAS;
  }

  saveCategorias(categorias: Categoria[]): void {
    saveConfigWithNotification(STORAGE_KEYS.CATEGORIAS, categorias);
  }

  // ============= PACOTES =============
  
  loadPacotes(): Pacote[] {
    const saved = storage.load(STORAGE_KEYS.PACOTES, []);
    return saved.length > 0 ? saved : DEFAULT_PACOTES;
  }

  savePacotes(pacotes: Pacote[]): void {
    saveConfigWithNotification(STORAGE_KEYS.PACOTES, pacotes);
  }

  // ============= PRODUTOS =============
  
  loadProdutos(): Produto[] {
    const saved = storage.load(STORAGE_KEYS.PRODUTOS, []);
    return saved.length > 0 ? saved : DEFAULT_PRODUTOS;
  }

  saveProdutos(produtos: Produto[]): void {
    saveConfigWithNotification(STORAGE_KEYS.PRODUTOS, produtos);
  }

  // ============= ETAPAS DE TRABALHO =============
  
  loadEtapas(): EtapaTrabalho[] {
    // Migração silenciosa: verifica se há dados no formato antigo
    const oldData = storage.load('workflow_status', []);
    const newData = storage.load(STORAGE_KEYS.ETAPAS, []);
    
    // Se há dados antigos mas não há novos, migra
    if (oldData.length > 0 && newData.length === 0) {
      storage.save(STORAGE_KEYS.ETAPAS, oldData);
      return oldData.length > 0 ? oldData : DEFAULT_ETAPAS;
    }
    
    return newData.length > 0 ? newData : DEFAULT_ETAPAS;
  }

  saveEtapas(etapas: EtapaTrabalho[]): void {
    storage.save(STORAGE_KEYS.ETAPAS, etapas);
    // Remove dados antigos após salvar
    storage.remove('workflow_status');
    // Dispara evento para notificar outras partes da aplicação
    window.dispatchEvent(new Event('workflowStatusUpdated'));
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
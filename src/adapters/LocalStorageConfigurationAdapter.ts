/**
 * Implementação do adapter para localStorage
 * Mantém toda a lógica atual de persistência local
 */

import { storage } from '@/utils/localStorage';
import { saveConfigWithNotification } from '@/utils/configNotification';
import type { ConfigurationStorageAdapter } from './ConfigurationStorageAdapter';
import type { 
  Categoria, 
  Pacote, 
  Produto, 
  EtapaTrabalho 
} from '@/types/configuration';

const STORAGE_KEYS = {
  CATEGORIAS: 'configuracoes_categorias',
  PACOTES: 'configuracoes_pacotes',
  PRODUTOS: 'configuracoes_produtos', 
  ETAPAS: 'lunari_workflow_status'
} as const;

export class LocalStorageConfigurationAdapter implements ConfigurationStorageAdapter {
  // ============= CATEGORIAS =============
  
  loadCategorias(): Categoria[] {
    return storage.load(STORAGE_KEYS.CATEGORIAS, []);
  }

  async saveCategorias(categorias: Categoria[]): Promise<void> {
    saveConfigWithNotification(STORAGE_KEYS.CATEGORIAS, categorias);
  }

  // ============= PACOTES =============
  
  loadPacotes(): Pacote[] {
    return storage.load(STORAGE_KEYS.PACOTES, []);
  }

  async savePacotes(pacotes: Pacote[]): Promise<void> {
    saveConfigWithNotification(STORAGE_KEYS.PACOTES, pacotes);
  }

  // ============= PRODUTOS =============
  
  loadProdutos(): Produto[] {
    return storage.load(STORAGE_KEYS.PRODUTOS, []);
  }

  async saveProdutos(produtos: Produto[]): Promise<void> {
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
      return oldData;
    }
    
    return newData;
  }

  async saveEtapas(etapas: EtapaTrabalho[]): Promise<void> {
    storage.save(STORAGE_KEYS.ETAPAS, etapas);
    // Remove dados antigos após salvar
    storage.remove('workflow_status');
    // Dispara evento para notificar outras partes da aplicação
    window.dispatchEvent(new Event('workflowStatusUpdated'));
  }
}
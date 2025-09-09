/**
 * Implementação do adapter para Supabase (preparação futura)
 * Stub para facilitar migração quando integração Supabase estiver ativa
 */

import type { ConfigurationStorageAdapter } from './ConfigurationStorageAdapter';
import type { 
  Categoria, 
  Pacote, 
  Produto, 
  EtapaTrabalho 
} from '@/types/configuration';
import {
  DEFAULT_CATEGORIAS,
  DEFAULT_PACOTES,
  DEFAULT_PRODUTOS, 
  DEFAULT_ETAPAS
} from '@/types/configuration';

export class SupabaseConfigurationAdapter implements ConfigurationStorageAdapter {
  
  // TODO: Implementar quando integração Supabase estiver ativa
  // Por enquanto retorna dados padrão
  
  loadCategorias(): Categoria[] {
    console.warn('SupabaseConfigurationAdapter: Supabase não configurado, usando dados padrão');
    return DEFAULT_CATEGORIAS;
  }

  async saveCategorias(categorias: Categoria[]): Promise<void> {
    console.warn('SupabaseConfigurationAdapter: Supabase não configurado');
    // TODO: Implementar persistência no Supabase
  }

  loadPacotes(): Pacote[] {
    console.warn('SupabaseConfigurationAdapter: Supabase não configurado, usando dados padrão');
    return DEFAULT_PACOTES;
  }

  async savePacotes(pacotes: Pacote[]): Promise<void> {
    console.warn('SupabaseConfigurationAdapter: Supabase não configurado');
    // TODO: Implementar persistência no Supabase
  }

  loadProdutos(): Produto[] {
    console.warn('SupabaseConfigurationAdapter: Supabase não configurado, usando dados padrão');
    return DEFAULT_PRODUTOS;
  }

  async saveProdutos(produtos: Produto[]): Promise<void> {
    console.warn('SupabaseConfigurationAdapter: Supabase não configurado');
    // TODO: Implementar persistência no Supabase
  }

  loadEtapas(): EtapaTrabalho[] {
    console.warn('SupabaseConfigurationAdapter: Supabase não configurado, usando dados padrão');
    return DEFAULT_ETAPAS;
  }

  async saveEtapas(etapas: EtapaTrabalho[]): Promise<void> {
    console.warn('SupabaseConfigurationAdapter: Supabase não configurado');
    // TODO: Implementar persistência no Supabase
  }
}
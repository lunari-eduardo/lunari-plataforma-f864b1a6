/**
 * Adapter interface para abstração da persistência de dados de configuração
 * Permite migração transparente entre localStorage e Supabase
 */

import type { 
  Categoria, 
  Pacote, 
  Produto, 
  EtapaTrabalho 
} from '@/types/configuration';

export interface ConfigurationStorageAdapter {
  // Categorias
  loadCategorias(): Categoria[];
  saveCategorias(categorias: Categoria[]): Promise<void> | void;
  
  // Pacotes
  loadPacotes(): Pacote[];
  savePacotes(pacotes: Pacote[]): Promise<void> | void;
  
  // Produtos
  loadProdutos(): Produto[];
  saveProdutos(produtos: Produto[]): Promise<void> | void;
  
  // Etapas
  loadEtapas(): EtapaTrabalho[];
  saveEtapas(etapas: EtapaTrabalho[]): Promise<void> | void;
}
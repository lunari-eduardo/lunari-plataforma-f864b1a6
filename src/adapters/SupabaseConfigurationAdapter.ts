/**
 * Implementação do adapter para Supabase
 * Persiste configurações no banco de dados com isolamento por usuário
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  
  // ============= CATEGORIAS =============
  
  loadCategorias(): Categoria[] {
    // For synchronous compatibility, return empty array during first load
    // The hook will handle async loading properly
    try {
      console.warn('SupabaseConfigurationAdapter: Using sync method, data may be empty on first load');
      return DEFAULT_CATEGORIAS;
    } catch (error) {
      console.error('Error in sync loadCategorias:', error);
      return DEFAULT_CATEGORIAS;
    }
  }

  async saveCategorias(categorias: Categoria[]): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      // Upsert todas as categorias
      const categoriasData = categorias.map(categoria => ({
        id: categoria.id,
        user_id: user.user.id,
        nome: categoria.nome,
        cor: categoria.cor
      }));

      const { error } = await supabase
        .from('categorias')
        .upsert(categoriasData, { 
          onConflict: 'id'
        });

      if (error) {
        console.error('Error saving categorias to Supabase:', error);
        throw error;
      }

      console.log(`Successfully saved ${categorias.length} categorias to Supabase`);
    } catch (error) {
      console.error('Failed to save categorias:', error);
      toast.error('Erro ao salvar categorias. Dados podem não estar sincronizados.');
      throw error;
    }
  }

  // ============= PACOTES =============
  
  loadPacotes(): Pacote[] {
    console.warn('SupabaseConfigurationAdapter: Pacotes migration not implemented yet');
    return DEFAULT_PACOTES;
  }

  async savePacotes(pacotes: Pacote[]): Promise<void> {
    console.warn('SupabaseConfigurationAdapter: Pacotes migration not implemented yet');
  }

  // ============= PRODUTOS =============
  
  loadProdutos(): Produto[] {
    console.warn('SupabaseConfigurationAdapter: Produtos migration not implemented yet');
    return DEFAULT_PRODUTOS;
  }

  async saveProdutos(produtos: Produto[]): Promise<void> {
    console.warn('SupabaseConfigurationAdapter: Produtos migration not implemented yet');
  }

  // ============= ETAPAS =============
  
  loadEtapas(): EtapaTrabalho[] {
    console.warn('SupabaseConfigurationAdapter: Etapas migration not implemented yet');
    return DEFAULT_ETAPAS;
  }

  async saveEtapas(etapas: EtapaTrabalho[]): Promise<void> {
    console.warn('SupabaseConfigurationAdapter: Etapas migration not implemented yet');
  }
}
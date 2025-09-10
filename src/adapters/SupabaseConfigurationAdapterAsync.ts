/**
 * Supabase Configuration Adapter - Async operations
 * Handles all configuration data persistence to Supabase
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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

export class SupabaseConfigurationAdapterAsync {
  
  // ============= CATEGORIAS =============
  
  async loadCategorias(): Promise<Categoria[]> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.warn('User not authenticated, returning default categorias');
        return DEFAULT_CATEGORIAS;
      }

      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('nome');

      if (error) {
        console.error('Error loading categorias from Supabase:', error);
        throw error;
      }

      // Se não há categorias, retorna padrões (primeiro login)  
      if (!data || data.length === 0) {
        console.log('No categorias found, returning defaults');
        return DEFAULT_CATEGORIAS;
      }

      // Converte formato Supabase para formato da aplicação
      return data.map(row => ({
        id: row.id,
        nome: row.nome,
        cor: row.cor,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error) {
      console.error('Failed to load categorias:', error);
      throw error;
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
  
  async loadPacotes(): Promise<Pacote[]> {
    console.log('loadPacotes: Not implemented yet, returning defaults');
    return DEFAULT_PACOTES;
  }

  async savePacotes(pacotes: Pacote[]): Promise<void> {
    console.log('savePacotes: Not implemented yet');
  }

  // ============= PRODUTOS =============
  
  async loadProdutos(): Promise<Produto[]> {
    console.log('loadProdutos: Not implemented yet, returning defaults');
    return DEFAULT_PRODUTOS;
  }

  async saveProdutos(produtos: Produto[]): Promise<void> {
    console.log('saveProdutos: Not implemented yet');
  }

  // ============= ETAPAS =============
  
  async loadEtapas(): Promise<EtapaTrabalho[]> {
    console.log('loadEtapas: Not implemented yet, returning defaults');
    return DEFAULT_ETAPAS;
  }

  async saveEtapas(etapas: EtapaTrabalho[]): Promise<void> {
    console.log('saveEtapas: Not implemented yet');
  }
}
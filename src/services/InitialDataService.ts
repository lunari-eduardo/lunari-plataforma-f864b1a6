/**
 * Service for initializing default data for new users
 * Detects empty tables and populates with default configuration data
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  DEFAULT_CATEGORIAS, 
  DEFAULT_PACOTES, 
  DEFAULT_PRODUTOS, 
  DEFAULT_ETAPAS 
} from '@/types/configuration';
import type { 
  Categoria, 
  Pacote, 
  Produto, 
  EtapaTrabalho 
} from '@/types/configuration';

export class InitialDataService {
  private static initialized = false;
  
  /**
   * Checks if user is new (no data in Supabase) and initializes default data
   */
  static async initializeDefaultDataIfNeeded(): Promise<boolean> {
    if (this.initialized) return false;
    
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.log('🚀 User not authenticated, skipping initialization');
        return false;
      }

      console.log('🚀 Checking if user needs default data initialization...');
      
      // Check if all tables are empty
      const isEmpty = await this.isUserEmpty(user.user.id);
      
      if (isEmpty) {
        console.log('🚀 New user detected, initializing default data...');
        await this.populateDefaultData(user.user.id);
        this.initialized = true;
        return true;
      } else {
        console.log('🚀 Existing user detected, skipping initialization');
        this.initialized = true;
        return false;
      }
    } catch (error) {
      console.error('❌ Error in initializeDefaultDataIfNeeded:', error);
      return false;
    }
  }

  /**
   * Checks if user has any configuration data
   */
  private static async isUserEmpty(userId: string): Promise<boolean> {
    try {
      const [categorias, pacotes, produtos, etapas] = await Promise.all([
        supabase.from('categorias').select('id', { count: 'exact' }).eq('user_id', userId).limit(1),
        supabase.from('pacotes').select('id', { count: 'exact' }).eq('user_id', userId).limit(1),
        supabase.from('produtos').select('id', { count: 'exact' }).eq('user_id', userId).limit(1),
        supabase.from('etapas_trabalho').select('id', { count: 'exact' }).eq('user_id', userId).limit(1)
      ]);

      const isEmpty = (
        (categorias.count === 0 || !categorias.data?.length) &&
        (pacotes.count === 0 || !pacotes.data?.length) &&
        (produtos.count === 0 || !produtos.data?.length) &&
        (etapas.count === 0 || !etapas.data?.length)
      );

      console.log('🔍 User emptiness check:', {
        categorias: categorias.count,
        pacotes: pacotes.count,
        produtos: produtos.count,
        etapas: etapas.count,
        isEmpty
      });

      return isEmpty;
    } catch (error) {
      console.error('❌ Error checking if user is empty:', error);
      return false; // Assume not empty on error to avoid unnecessary initialization
    }
  }

  /**
   * Populates all default data for a new user
   */
  private static async populateDefaultData(userId: string): Promise<void> {
    try {
      console.log('📝 Populating default data for user:', userId);
      
      // Prepare data with user_id and timestamps
      const now = new Date().toISOString();
      
      const categoriasData = DEFAULT_CATEGORIAS.map(categoria => ({
        id: categoria.id,
        user_id: userId,
        nome: categoria.nome,
        cor: categoria.cor,
        created_at: now,
        updated_at: now
      }));

      const produtosData = DEFAULT_PRODUTOS.map(produto => ({
        id: produto.id,
        user_id: userId,
        nome: produto.nome,
        preco_custo: produto.preco_custo,
        preco_venda: produto.preco_venda,
        created_at: now,
        updated_at: now
      }));

      // Fix category IDs in packages to match DEFAULT_CATEGORIAS
      const fixedPackages = DEFAULT_PACOTES.map(pacote => {
        let categoria_id = pacote.categoria_id;
        
        // Map old category IDs to new ones
        const categoryMap: Record<string, string> = {
          "ca5496f9-83fd-4b47-9331-d8cc17e39950": "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c8f", // Família
          "a895b7bf-b224-467f-8cf4-4dbed9a51657": "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c90", // Casamento
          "09481ef5-dc55-4f52-9ca8-cd7fd01675f2": "018fded5-6b5c-7a2f-8c3d-9e4f5a6b7c91"  // Aniversário
        };
        
        if (categoryMap[categoria_id]) {
          categoria_id = categoryMap[categoria_id];
        }
        
        return { ...pacote, categoria_id };
      });

      const pacotesData = fixedPackages.map(pacote => ({
        id: pacote.id,
        user_id: userId,
        nome: pacote.nome,
        categoria_id: pacote.categoria_id,
        valor_base: pacote.valor_base,
        valor_foto_extra: pacote.valor_foto_extra,
        produtos_incluidos: pacote.produtosIncluidos as any, // Cast to Json for Supabase
        created_at: now,
        updated_at: now
      }));

      const etapasData = DEFAULT_ETAPAS.map(etapa => ({
        id: etapa.id,
        user_id: userId,
        nome: etapa.nome,
        cor: etapa.cor,
        ordem: etapa.ordem,
        created_at: now,
        updated_at: now
      }));

      // Insert all data (order matters due to foreign keys)
      await Promise.all([
        supabase.from('categorias').insert(categoriasData),
        supabase.from('produtos').insert(produtosData),
        supabase.from('etapas_trabalho').insert(etapasData)
      ]);

      // Insert packages last (depends on categories)
      await supabase.from('pacotes').insert(pacotesData);

      console.log('✅ Default data populated successfully:', {
        categorias: categoriasData.length,
        produtos: produtosData.length,
        pacotes: pacotesData.length,
        etapas: etapasData.length
      });

    } catch (error) {
      console.error('❌ Error populating default data:', error);
      throw error;
    }
  }

  /**
   * Reset initialization flag (for testing or re-initialization)
   */
  static resetInitialization(): void {
    this.initialized = false;
  }
}
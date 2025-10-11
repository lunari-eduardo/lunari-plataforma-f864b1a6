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

export class SupabaseConfigurationAdapterAsync {
  
  // ============= CATEGORIAS =============
  
  async loadCategorias(): Promise<Categoria[]> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.warn('User not authenticated, returning default categorias');
        return [];
      }

      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('nome');

      if (error) {
        console.error('Error loading categorias from Supabase:', error);
        throw error;
      }

      // Se não há categorias, retorna array vazio (primeiro login)  
      if (!data || data.length === 0) {
        console.log('🏷️ No categorias found, returning empty array');
        return [];
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

      // ✅ Deduplicar por ID para evitar "ON CONFLICT DO UPDATE"
      const uniqueCategorias = Array.from(
        new Map(categorias.map(c => [c.id, c])).values()
      );

      if (uniqueCategorias.length < categorias.length) {
        console.log(`💾 Removed ${categorias.length - uniqueCategorias.length} duplicate categorias`);
      }

      // Upsert todas as categorias
      const categoriasData = uniqueCategorias.map(categoria => ({
        id: categoria.id,
        user_id: user.user.id,
        nome: categoria.nome,
        cor: categoria.cor,
        updated_at: new Date().toISOString()
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

      console.log(`✅ Successfully saved ${uniqueCategorias.length} categorias to Supabase`);
    } catch (error) {
      console.error('Failed to save categorias:', error);
      toast.error('Erro ao salvar categorias. Dados podem não estar sincronizados.');
      throw error;
    }
  }

  async deleteCategoriaById(id: string): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('categorias')
        .delete()
        .eq('id', id)
        .eq('user_id', user.user.id);

      if (error) {
        console.error('Error deleting categoria from Supabase:', error);
        throw error;
      }

      console.log(`Successfully deleted categoria ${id} from Supabase`);
    } catch (error) {
      console.error('Failed to delete categoria:', error);
      throw error;
    }
  }

  async syncCategorias(categorias: Categoria[]): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      // Get current categorias in Supabase
      const { data: supabaseCategorias, error: fetchError } = await supabase
        .from('categorias')
        .select('id')
        .eq('user_id', user.user.id);

      if (fetchError) {
        console.error('Error fetching categorias from Supabase:', fetchError);
        throw fetchError;
      }

      const currentIds = categorias.map(cat => cat.id);
      const supabaseIds = (supabaseCategorias || []).map(cat => cat.id);
      
      // Find categorias that exist in Supabase but not in current state (should be deleted)
      const toDelete = supabaseIds.filter(id => !currentIds.includes(id));
      
      // Delete orphaned categorias
      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('categorias')
          .delete()
          .in('id', toDelete)
          .eq('user_id', user.user.id);

        if (deleteError) {
          console.error('Error deleting orphaned categorias:', deleteError);
          throw deleteError;
        }

        console.log(`Deleted ${toDelete.length} orphaned categorias from Supabase`);
      }

      // Upsert current categorias if any exist
      if (categorias.length > 0) {
        await this.saveCategorias(categorias);
      }

      console.log(`Successfully synced ${categorias.length} categorias with Supabase`);
    } catch (error) {
      console.error('Failed to sync categorias:', error);
      throw error;
    }
  }

  // ============= PACOTES =============
  
  async loadPacotes(): Promise<Pacote[]> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.log('📦 User not authenticated, returning default pacotes');
        return [];
      }

      const { data, error } = await (supabase as any)
        .from('pacotes')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('📦 Error loading pacotes from Supabase:', error);
        return [];
      }

      if (!data || data.length === 0) {
        console.log('📦 No pacotes found, returning empty array');
        return [];
      }

      // Transform Supabase data to match our Pacote interface
      const pacotes: Pacote[] = data.map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        nome: item.nome,
        categoria_id: item.categoria_id,
        valor_base: Number(item.valor_base),
        valor_foto_extra: Number(item.valor_foto_extra),
        produtosIncluidos: Array.isArray(item.produtos_incluidos) ? item.produtos_incluidos : [],
        created_at: item.created_at,
        updated_at: item.updated_at
      }));

      console.log(`📦 Loaded ${pacotes.length} pacotes from Supabase`);
      return pacotes;
    } catch (error) {
      console.error('📦 Unexpected error loading pacotes:', error);
      return [];
    }
  }

  async savePacotes(pacotes: Pacote[]): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      if (pacotes.length === 0) {
        console.log('📦 No pacotes to save');
        return;
      }

      // ✅ Deduplicar por ID para evitar "ON CONFLICT DO UPDATE"
      const uniquePacotes = Array.from(
        new Map(pacotes.map(p => [p.id, p])).values()
      );

      if (uniquePacotes.length < pacotes.length) {
        console.log(`📦 Removed ${pacotes.length - uniquePacotes.length} duplicate pacotes`);
      }

      // Transform to Supabase format
      const supabaseData = uniquePacotes.map(pacote => ({
        id: pacote.id,
        user_id: user.user.id,
        nome: pacote.nome,
        categoria_id: pacote.categoria_id,
        valor_base: pacote.valor_base,
        valor_foto_extra: pacote.valor_foto_extra,
        produtos_incluidos: pacote.produtosIncluidos,
        created_at: pacote.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error } = await (supabase as any)
        .from('pacotes')
        .upsert(supabaseData, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('📦 Error saving pacotes to Supabase:', error);
        throw error;
      }

      console.log(`📦 Successfully saved ${uniquePacotes.length} pacotes to Supabase`);
    } catch (error) {
      console.error('📦 Error in savePacotes:', error);
      throw error;
    }
  }

  async deletePacoteById(id: string): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      const { error } = await (supabase as any)
        .from('pacotes')
        .delete()
        .eq('id', id)
        .eq('user_id', user.user.id);

      if (error) {
        console.error('📦 Error deleting pacote from Supabase:', error);
        throw error;
      }

      console.log(`📦 Successfully deleted pacote ${id} from Supabase`);
    } catch (error) {
      console.error('📦 Error in deletePacoteById:', error);
      throw error;
    }
  }

  async syncPacotes(pacotes: Pacote[]): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.log('📦 User not authenticated, skipping sync');
        return;
      }

      // Get current pacotes from Supabase
      const { data: currentData, error: fetchError } = await (supabase as any)
        .from('pacotes')
        .select('id')
        .eq('user_id', user.user.id);

      if (fetchError) {
        console.error('📦 Error fetching current pacotes:', fetchError);
        throw fetchError;
      }

      const currentIds = new Set(currentData?.map((item: any) => item.id) || []);
      const newIds = new Set(pacotes.map(p => p.id));

      // Delete orphaned records
      const toDelete = [...currentIds].filter((id: string) => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error: deleteError } = await (supabase as any)
          .from('pacotes')
          .delete()
          .in('id', toDelete)
          .eq('user_id', user.user.id);

        if (deleteError) {
          console.error('📦 Error deleting orphaned pacotes:', deleteError);
        } else {
          console.log(`📦 Deleted ${toDelete.length} orphaned pacotes`);
        }
      }

      // Upsert current pacotes
      if (pacotes.length > 0) {
        await this.savePacotes(pacotes);
      }

      console.log('📦 Pacotes sync completed');
    } catch (error) {
      console.error('📦 Error in syncPacotes:', error);
      throw error;
    }
  }

  // ============= PRODUTOS =============
  
  async loadProdutos(): Promise<Produto[]> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.log('🛍️ User not authenticated, returning default produtos');
        return [];
      }

      const { data, error } = await (supabase as any)
        .from('produtos')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('🛍️ Error loading produtos from Supabase:', error);
        return [];
      }

      if (!data || data.length === 0) {
        console.log('🛍️ No produtos found, returning empty array');
        return [];
      }

      // Transform Supabase data to match our Produto interface
      const produtos: Produto[] = data.map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        nome: item.nome,
        preco_custo: Number(item.preco_custo),
        preco_venda: Number(item.preco_venda),
        created_at: item.created_at,
        updated_at: item.updated_at
      }));

      console.log(`🛍️ Loaded ${produtos.length} produtos from Supabase`);
      return produtos;
    } catch (error) {
      console.error('🛍️ Unexpected error loading produtos:', error);
      return [];
    }
  }

  async saveProdutos(produtos: Produto[]): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      if (produtos.length === 0) {
        console.log('🛍️ No produtos to save');
        return;
      }

      // ✅ Deduplicar por ID para evitar "ON CONFLICT DO UPDATE"
      const uniqueProdutos = Array.from(
        new Map(produtos.map(p => [p.id, p])).values()
      );

      if (uniqueProdutos.length < produtos.length) {
        console.log(`🛍️ Removed ${produtos.length - uniqueProdutos.length} duplicate produtos`);
      }

      // Transform to Supabase format
      const supabaseData = uniqueProdutos.map(produto => ({
        id: produto.id,
        user_id: user.user.id,
        nome: produto.nome,
        preco_custo: produto.preco_custo,
        preco_venda: produto.preco_venda,
        created_at: produto.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error } = await (supabase as any)
        .from('produtos')
        .upsert(supabaseData, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('🛍️ Error saving produtos to Supabase:', error);
        throw error;
      }

      console.log(`🛍️ Successfully saved ${uniqueProdutos.length} produtos to Supabase`);
    } catch (error) {
      console.error('🛍️ Error in saveProdutos:', error);
      throw error;
    }
  }

  async deleteProdutoById(id: string): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      const { error } = await (supabase as any)
        .from('produtos')
        .delete()
        .eq('id', id)
        .eq('user_id', user.user.id);

      if (error) {
        console.error('🛍️ Error deleting produto from Supabase:', error);
        throw error;
      }

      console.log(`🛍️ Successfully deleted produto ${id} from Supabase`);
    } catch (error) {
      console.error('🛍️ Error in deleteProdutoById:', error);
      throw error;
    }
  }

  async syncProdutos(produtos: Produto[]): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.log('🛍️ User not authenticated, skipping sync');
        return;
      }

      // Get current produtos from Supabase
      const { data: currentData, error: fetchError } = await (supabase as any)
        .from('produtos')
        .select('id')
        .eq('user_id', user.user.id);

      if (fetchError) {
        console.error('🛍️ Error fetching current produtos:', fetchError);
        throw fetchError;
      }

      const currentIds = new Set(currentData?.map((item: any) => item.id) || []);
      const newIds = new Set(produtos.map(p => p.id));

      // Delete orphaned records
      const toDelete = [...currentIds].filter((id: string) => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error: deleteError } = await (supabase as any)
          .from('produtos')
          .delete()
          .in('id', toDelete)
          .eq('user_id', user.user.id);

        if (deleteError) {
          console.error('🛍️ Error deleting orphaned produtos:', deleteError);
        } else {
          console.log(`🛍️ Deleted ${toDelete.length} orphaned produtos`);
        }
      }

      // Upsert current produtos
      if (produtos.length > 0) {
        await this.saveProdutos(produtos);
      }

      console.log('🛍️ Produtos sync completed');
    } catch (error) {
      console.error('🛍️ Error in syncProdutos:', error);
      throw error;
    }
  }

  // ============= ETAPAS =============
  
  async loadEtapas(): Promise<EtapaTrabalho[]> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.log('📋 User not authenticated, returning default etapas');
        return [];
      }

      const { data, error } = await (supabase as any)
        .from('etapas_trabalho')
        .select('*')
        .eq('user_id', user.user.id)
        .order('ordem', { ascending: true });

      if (error) {
        console.error('📋 Error loading etapas from Supabase:', error);
        return [];
      }

      if (!data || data.length === 0) {
        console.log('📋 No etapas found, returning empty array');
        return [];
      }

      // Transform Supabase data to match our EtapaTrabalho interface
      const etapas: EtapaTrabalho[] = data.map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        nome: item.nome,
        cor: item.cor,
        ordem: Number(item.ordem),
        created_at: item.created_at,
        updated_at: item.updated_at
      }));

      console.log(`📋 Loaded ${etapas.length} etapas from Supabase`);
      return etapas;
    } catch (error) {
      console.error('📋 Unexpected error loading etapas:', error);
        return [];
    }
  }

  async saveEtapas(etapas: EtapaTrabalho[]): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      if (etapas.length === 0) {
        console.log('📋 No etapas to save');
        return;
      }

      // ✅ Deduplicar por ID para evitar "ON CONFLICT DO UPDATE"
      const uniqueEtapas = Array.from(
        new Map(etapas.map(e => [e.id, e])).values()
      );

      if (uniqueEtapas.length < etapas.length) {
        console.log(`📋 Removed ${etapas.length - uniqueEtapas.length} duplicate etapas`);
      }

      // Transform to Supabase format
      const supabaseData = uniqueEtapas.map(etapa => ({
        id: etapa.id,
        user_id: user.user.id,
        nome: etapa.nome,
        cor: etapa.cor,
        ordem: etapa.ordem,
        created_at: etapa.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error } = await (supabase as any)
        .from('etapas_trabalho')
        .upsert(supabaseData, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('📋 Error saving etapas to Supabase:', error);
        throw error;
      }

      console.log(`📋 Successfully saved ${uniqueEtapas.length} etapas to Supabase`);
    } catch (error) {
      console.error('📋 Error in saveEtapas:', error);
      throw error;
    }
  }

  async deleteEtapaById(id: string): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      const { error } = await (supabase as any)
        .from('etapas_trabalho')
        .delete()
        .eq('id', id)
        .eq('user_id', user.user.id);

      if (error) {
        console.error('📋 Error deleting etapa from Supabase:', error);
        throw error;
      }

      console.log(`📋 Successfully deleted etapa ${id} from Supabase`);
    } catch (error) {
      console.error('📋 Error in deleteEtapaById:', error);
      throw error;
    }
  }

  async syncEtapas(etapas: EtapaTrabalho[]): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.log('📋 User not authenticated, skipping sync');
        return;
      }

      // Get current etapas from Supabase
      const { data: currentData, error: fetchError } = await (supabase as any)
        .from('etapas_trabalho')
        .select('id')
        .eq('user_id', user.user.id);

      if (fetchError) {
        console.error('📋 Error fetching current etapas:', fetchError);
        throw fetchError;
      }

      const currentIds = new Set(currentData?.map((item: any) => item.id) || []);
      const newIds = new Set(etapas.map(e => e.id));

      // Delete orphaned records
      const toDelete = [...currentIds].filter((id: string) => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error: deleteError } = await (supabase as any)
          .from('etapas_trabalho')
          .delete()
          .in('id', toDelete)
          .eq('user_id', user.user.id);

        if (deleteError) {
          console.error('📋 Error deleting orphaned etapas:', deleteError);
        } else {
          console.log(`📋 Deleted ${toDelete.length} orphaned etapas`);
        }
      }

      // Upsert current etapas
      if (etapas.length > 0) {
        await this.saveEtapas(etapas);
      }

      console.log('📋 Etapas sync completed');
    } catch (error) {
      console.error('📋 Error in syncEtapas:', error);
      throw error;
    }
  }
}
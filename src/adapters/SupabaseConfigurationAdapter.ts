/**
 * Implementação do adapter para Supabase
 * CRUD completo com RLS e isolamento por usuário
 */

import { supabase } from '@/integrations/supabase/client';

// Tipos temporários para evitar erros de compilação
type SupabaseTable = any;
type SupabaseResponse<T> = { data: T[] | null; error: any };
import type { ConfigurationStorageAdapter } from './ConfigurationStorageAdapter';
import type { 
  Categoria, 
  Pacote, 
  Produto, 
  EtapaTrabalho,
  ProdutoIncluido
} from '@/types/configuration';

export class SupabaseConfigurationAdapter implements ConfigurationStorageAdapter {
  
  // ============= CATEGORIAS =============
  
  loadCategorias(): Categoria[] {
    // Retorna array vazio - dados carregados assincronamente
    return [];
  }

  async saveCategorias(categorias: Categoria[]): Promise<void> {
    console.log('🔄 [SupabaseAdapter] Salvando categorias:', categorias.length);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('❌ [SupabaseAdapter] Usuário não autenticado');
      return;
    }

    // Primeiro, remove todas as categorias existentes do usuário
    await (supabase as any)
      .from('categorias')
      .delete()
      .eq('user_id', user.id);

    // Depois, insere todas as categorias
    if (categorias.length > 0) {
      const categoriasComUserId = categorias.map(categoria => ({
        ...categoria,
        user_id: user.id
      }));

      const { error } = await (supabase as any)
        .from('categorias')
        .insert(categoriasComUserId);

      if (error) {
        console.error('❌ [SupabaseAdapter] Erro ao salvar categorias:', error);
        throw error;
      }
    }

    console.log('✅ [SupabaseAdapter] Categorias salvas com sucesso');
  }

  // ============= PACOTES =============
  
  loadPacotes(): Pacote[] {
    // Retorna array vazio - dados carregados assincronamente
    return [];
  }

  async savePacotes(pacotes: Pacote[]): Promise<void> {
    console.log('🔄 [SupabaseAdapter] Salvando pacotes:', pacotes.length);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('❌ [SupabaseAdapter] Usuário não autenticado');
      return;
    }

    // Remove pacotes existentes
    await (supabase as any)
      .from('pacotes')
      .delete()
      .eq('user_id', user.id);

    // Remove relacionamentos existentes
    await (supabase as any)
      .from('pacote_produtos')
      .delete()
      .in('pacote_id', 
        (await (supabase as any)
          .from('pacotes')
          .select('id')
          .eq('user_id', user.id)
        ).data?.map((p: any) => p.id) || []
      );

    if (pacotes.length > 0) {
      // Insere pacotes
      const pacotesComUserId = pacotes.map(pacote => ({
        id: pacote.id,
        user_id: user.id,
        nome: pacote.nome,
        categoria_id: pacote.categoria_id,
        valor_base: pacote.valor_base,
        valor_foto_extra: pacote.valor_foto_extra
      }));

      const { error: pacotesError } = await (supabase as any)
        .from('pacotes')
        .insert(pacotesComUserId);

      if (pacotesError) {
        console.error('❌ [SupabaseAdapter] Erro ao salvar pacotes:', pacotesError);
        throw pacotesError;
      }

      // Insere relacionamentos pacote-produtos
      const relacionamentos: any[] = [];
      pacotes.forEach(pacote => {
        pacote.produtosIncluidos.forEach(produto => {
          relacionamentos.push({
            pacote_id: pacote.id,
            produto_id: produto.produtoId,
            quantidade: produto.quantidade
          });
        });
      });

      if (relacionamentos.length > 0) {
        const { error: relError } = await (supabase as any)
          .from('pacote_produtos')
          .insert(relacionamentos);

        if (relError) {
          console.error('❌ [SupabaseAdapter] Erro ao salvar relacionamentos:', relError);
          throw relError;
        }
      }
    }

    console.log('✅ [SupabaseAdapter] Pacotes salvos com sucesso');
  }

  // ============= PRODUTOS =============
  
  loadProdutos(): Produto[] {
    // Retorna array vazio - dados carregados assincronamente
    return [];
  }

  async saveProdutos(produtos: Produto[]): Promise<void> {
    console.log('🔄 [SupabaseAdapter] Salvando produtos:', produtos.length);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('❌ [SupabaseAdapter] Usuário não autenticado');
      return;
    }

    // Remove produtos existentes
    await (supabase as any)
      .from('produtos')
      .delete()
      .eq('user_id', user.id);

    if (produtos.length > 0) {
      const produtosComUserId = produtos.map(produto => ({
        ...produto,
        user_id: user.id
      }));

      const { error } = await (supabase as any)
        .from('produtos')
        .insert(produtosComUserId);

      if (error) {
        console.error('❌ [SupabaseAdapter] Erro ao salvar produtos:', error);
        throw error;
      }
    }

    console.log('✅ [SupabaseAdapter] Produtos salvos com sucesso');
  }

  // ============= ETAPAS =============
  
  loadEtapas(): EtapaTrabalho[] {
    // Retorna array vazio - dados carregados assincronamente
    return [];
  }

  async saveEtapas(etapas: EtapaTrabalho[]): Promise<void> {
    console.log('🔄 [SupabaseAdapter] Salvando etapas:', etapas.length);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('❌ [SupabaseAdapter] Usuário não autenticado');
      return;
    }

    // Remove etapas existentes
    await (supabase as any)
      .from('etapas_trabalho')
      .delete()
      .eq('user_id', user.id);

    if (etapas.length > 0) {
      const etapasComUserId = etapas.map(etapa => ({
        ...etapa,
        user_id: user.id
      }));

      const { error } = await (supabase as any)
        .from('etapas_trabalho')
        .insert(etapasComUserId);

      if (error) {
        console.error('❌ [SupabaseAdapter] Erro ao salvar etapas:', error);
        throw error;
      }
    }

    console.log('✅ [SupabaseAdapter] Etapas salvas com sucesso');
  }

  // ============= MÉTODOS DE CARREGAMENTO ASSÍNCRONO =============

  async loadCategoriasAsync(): Promise<Categoria[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await (supabase as any)
      .from('categorias')
      .select('*')
      .eq('user_id', user.id)
      .order('nome');

    if (error) {
      console.error('❌ [SupabaseAdapter] Erro ao carregar categorias:', error);
      return [];
    }

    return data || [];
  }

  async loadPacotesAsync(): Promise<Pacote[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Carrega pacotes
    const { data: pacotesData, error: pacotesError } = await (supabase as any)
      .from('pacotes')
      .select('*')
      .eq('user_id', user.id)
      .order('nome');

    if (pacotesError) {
      console.error('❌ [SupabaseAdapter] Erro ao carregar pacotes:', pacotesError);
      return [];
    }

    if (!pacotesData || pacotesData.length === 0) return [];

    // Carrega relacionamentos
    const { data: relData, error: relError } = await (supabase as any)
      .from('pacote_produtos')
      .select('*')
      .in('pacote_id', pacotesData.map((p: any) => p.id));

    if (relError) {
      console.error('❌ [SupabaseAdapter] Erro ao carregar relacionamentos:', relError);
      return pacotesData.map((p: any) => ({ ...p, produtosIncluidos: [] }));
    }

    // Monta pacotes com produtos incluídos
    return pacotesData.map((pacote: any) => ({
      ...pacote,
      produtosIncluidos: (relData || [])
        .filter((rel: any) => rel.pacote_id === pacote.id)
        .map((rel: any) => ({
          produtoId: rel.produto_id,
          quantidade: rel.quantidade
        }))
    }));
  }

  async loadProdutosAsync(): Promise<Produto[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await (supabase as any)
      .from('produtos')
      .select('*')
      .eq('user_id', user.id)
      .order('nome');

    if (error) {
      console.error('❌ [SupabaseAdapter] Erro ao carregar produtos:', error);
      return [];
    }

    return data || [];
  }

  async loadEtapasAsync(): Promise<EtapaTrabalho[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await (supabase as any)
      .from('etapas_trabalho')
      .select('*')
      .eq('user_id', user.id)
      .order('ordem');

    if (error) {
      console.error('❌ [SupabaseAdapter] Erro ao carregar etapas:', error);
      return [];
    }

    return data || [];
  }
}
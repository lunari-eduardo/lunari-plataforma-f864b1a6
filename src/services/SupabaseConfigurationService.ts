import { supabase } from '@/integrations/supabase/client';
import type { 
  Categoria, 
  Pacote, 
  Produto, 
  EtapaTrabalho 
} from '@/types/configuration';

export class SupabaseConfigurationService {
  // ============= CATEGORIAS =============
  
  async loadCategorias(): Promise<Categoria[]> {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('nome');
    
    if (error) {
      console.error('Error loading categorias:', error);
      return [];
    }
    
    return data.map(item => ({
      id: item.id,
      nome: item.nome,
      cor: item.cor
    }));
  }

  async saveCategorias(categorias: Categoria[]): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // Delete existing categorias for this user
    await supabase
      .from('categorias')
      .delete()
      .eq('user_id', user.id);

    // Insert new categorias
    if (categorias.length > 0) {
      const { error } = await supabase
        .from('categorias')
        .insert(categorias.map(categoria => ({
          user_id: user.id,
          nome: categoria.nome,
          cor: categoria.cor
        })));

      if (error) {
        console.error('Error saving categorias:', error);
        throw error;
      }
    }
  }

  // ============= PACOTES =============
  
  async loadPacotes(): Promise<Pacote[]> {
    const { data, error } = await supabase
      .from('pacotes')
      .select(`
        *,
        categorias (
          nome
        )
      `)
      .order('nome');
    
    if (error) {
      console.error('Error loading pacotes:', error);
      return [];
    }
    
    return data.map(item => ({
      id: item.id,
      nome: item.nome,
      categoria_id: item.categoria_id,
      valor_base: item.valor_base,
      valor_foto_extra: item.valor_foto_extra,
      produtosIncluidos: Array.isArray(item.produtos_incluidos) ? item.produtos_incluidos as any : []
    }));
  }

  async savePacotes(pacotes: Pacote[]): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // Delete existing pacotes for this user
    await supabase
      .from('pacotes')
      .delete()
      .eq('user_id', user.id);

    // Insert new pacotes
    if (pacotes.length > 0) {
      for (const pacote of pacotes) {
        const { error } = await supabase
          .from('pacotes')
          .insert({
            user_id: user.id,
            nome: pacote.nome,
            categoria_id: pacote.categoria_id,
            valor_base: pacote.valor_base,
            valor_foto_extra: pacote.valor_foto_extra,
            produtos_incluidos: JSON.parse(JSON.stringify(pacote.produtosIncluidos || []))
          });

        if (error) {
          console.error('Error saving pacote:', error);
          throw error;
        }
      }
    }
  }

  // ============= PRODUTOS =============
  
  async loadProdutos(): Promise<Produto[]> {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .order('nome');
    
    if (error) {
      console.error('Error loading produtos:', error);
      return [];
    }
    
    return data.map(item => ({
      id: item.id,
      nome: item.nome,
      preco_custo: item.preco_custo,
      preco_venda: item.preco_venda
    }));
  }

  async saveProdutos(produtos: Produto[]): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // Delete existing produtos for this user
    await supabase
      .from('produtos')
      .delete()
      .eq('user_id', user.id);

    // Insert new produtos
    if (produtos.length > 0) {
      const { error } = await supabase
        .from('produtos')
        .insert(produtos.map(produto => ({
          user_id: user.id,
          nome: produto.nome,
          preco_custo: produto.preco_custo,
          preco_venda: produto.preco_venda
        })));

      if (error) {
        console.error('Error saving produtos:', error);
        throw error;
      }
    }
  }

  // ============= ETAPAS DE TRABALHO =============
  
  async loadEtapas(): Promise<EtapaTrabalho[]> {
    const { data, error } = await supabase
      .from('etapas_trabalho')
      .select('*')
      .order('ordem');
    
    if (error) {
      console.error('Error loading etapas:', error);
      return [];
    }
    
    return data.map(item => ({
      id: item.id,
      nome: item.nome,
      cor: item.cor,
      ordem: item.ordem
    }));
  }

  async saveEtapas(etapas: EtapaTrabalho[]): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // Delete existing etapas for this user
    await supabase
      .from('etapas_trabalho')
      .delete()
      .eq('user_id', user.id);

    // Insert new etapas
    if (etapas.length > 0) {
      const { error } = await supabase
        .from('etapas_trabalho')
        .insert(etapas.map((etapa, index) => ({
          user_id: user.id,
          nome: etapa.nome,
          cor: etapa.cor,
          ordem: index
        })));

      if (error) {
        console.error('Error saving etapas:', error);
        throw error;
      }
    }
  }

  // ============= HELPER METHODS =============
  
  private async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }
}

export const supabaseConfigurationService = new SupabaseConfigurationService();
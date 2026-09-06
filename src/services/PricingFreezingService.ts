/**
 * Serviço para congelamento de regras de precificação
 * Garante que mudanças nos preços não afetam sessões passadas
 */

import {
  RegrasCongeladas,
  PacoteCongelado,
  ProdutoCongelado,
  PrecificacaoFotoExtra,
  IntegridadeIssue,
} from './pricing-freezing/types';

import {
  congelarRegrasPrecoFotoExtra,
  congelarRegrasPrecoFotoExtraAsync,
  congelarDadosProdutos,
  resolverTabelaCategoria,
  resolverTabelaCategoriaAsync,
} from './pricing-freezing/freezingCore';

import {
  calcularValorFotoExtraComRegrasCongeladas,
  obterDadosPacoteCongelados,
  obterDadosProdutosCongelados,
  calcularValorPorTabela,
} from './pricing-freezing/calculationCore';

import {
  migrarSessoesExistentes,
  corrigirSessoesInconsistentes,
  corrigirSessoesComTabelasNull,
  corrigirModeloCategoria,
  corrigirSessoesModeloFixo,
  verificarIntegridade,
} from './pricing-freezing/migrationService';

export type {
  RegrasCongeladas,
  PacoteCongelado,
  ProdutoCongelado,
  PrecificacaoFotoExtra,
  IntegridadeIssue,
};

class PricingFreezingService {
  /**
   * Congela dados completos de pacote e produtos para uma sessão
   */
  async congelarDadosCompletos(pacoteId?: string, categoria?: string): Promise<RegrasCongeladas> {
    try {
      console.log('📦 Congelando dados completos para pacote:', pacoteId, 'categoria:', categoria);
      
      const regras: RegrasCongeladas = {
        modelo: 'completo',
        dataCongelamento: new Date().toISOString(),
        precificacaoFotoExtra: { modelo: 'fixo' }
      };

      let categoriaIdResolvido: string | undefined;
      if (pacoteId) {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: user } = await supabase.auth.getUser();
        
        if (user?.user) {
          const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(pacoteId);
          console.log(`📦 Buscando pacote por ${isUuid ? 'ID (UUID)' : 'NOME'}:`, pacoteId);
          
          let query = supabase
            .from('pacotes')
            .select(`
              *,
              categorias (
                id,
                nome
              )
            `)
            .eq('user_id', user.user.id);
          
          if (isUuid) {
            query = query.eq('id', pacoteId);
          } else {
            query = query.eq('nome', pacoteId);
          }
          
          const { data: pacote, error: pacoteError } = await query.maybeSingle();

          if (pacoteError) {
            console.error('❌ Erro ao buscar pacote:', pacoteError);
          } else if (pacote) {
            console.log('✅ Pacote encontrado:', pacote.nome);
            categoriaIdResolvido = pacote.categoria_id;
            regras.pacote = {
              id: pacote.id,
              nome: pacote.nome,
              valorBase: Number(pacote.valor_base) || 0,
              valorFotoExtra: Number(pacote.valor_foto_extra) || 0,
              fotosIncluidas: Number(pacote.fotos_incluidas) || 0,
              categoria: (pacote as any).categorias?.nome || categoria || '',
              categoriaId: pacote.categoria_id,
              produtosIncluidos: Array.isArray(pacote.produtos_incluidos) ? pacote.produtos_incluidos : []
            };

            const produtosIncluidos = pacote.produtos_incluidos;
            if (produtosIncluidos && Array.isArray(produtosIncluidos) && produtosIncluidos.length > 0) {
              regras.produtos = await congelarDadosProdutos(produtosIncluidos as any[]);
              console.log('📦 Produtos congelados:', regras.produtos.length);
            } else {
              regras.produtos = [];
              console.log('🧹 Produtos limpos (pacote sem produtos incluídos)');
            }

            console.log('✅ Dados do pacote congelados:', regras.pacote);
          }
        }
      }

      regras.precificacaoFotoExtra = await congelarRegrasPrecoFotoExtraAsync(categoria, categoriaIdResolvido, regras.pacote);

      console.log('📦 Dados completos congelados:', regras);
      return regras;
    } catch (error) {
      console.error('❌ Erro ao congelar dados completos:', error);
      return {
        modelo: 'completo',
        dataCongelamento: new Date().toISOString(),
        precificacaoFotoExtra: congelarRegrasPrecoFotoExtra()
      };
    }
  }

  /**
   * Congela apenas regras de preço de foto extra (compatibilidade com versão antiga)  
   */
  congelarRegrasAtuais(categoria?: string): RegrasCongeladas {
    const precificacaoFotoExtra = congelarRegrasPrecoFotoExtra(categoria);
    
    return {
      modelo: 'completo',
      dataCongelamento: new Date().toISOString(),
      precificacaoFotoExtra
    };
  }

  /**
   * Recongela apenas produtos mantendo outros dados estáveis
   */
  async recongelarProdutos(regrasAtuais?: RegrasCongeladas, novosProdutos?: any[]): Promise<RegrasCongeladas> {
    try {
      if (!regrasAtuais) {
        return this.congelarDadosCompletos();
      }

      const regrasAtualizadas = { ...regrasAtuais };
      
      if (novosProdutos) {
        regrasAtualizadas.produtos = await congelarDadosProdutos(novosProdutos);
        regrasAtualizadas.dataCongelamento = new Date().toISOString();
        console.log('📦 Produtos recongelados:', regrasAtualizadas.produtos);
      }

      return regrasAtualizadas;
    } catch (error) {
      console.error('❌ Erro ao recongelar produtos:', error);
      return regrasAtuais || {
        modelo: 'completo',
        dataCongelamento: new Date().toISOString(),
        precificacaoFotoExtra: congelarRegrasPrecoFotoExtra()
      };
    }
  }

  /**
   * Re-freeze only photo extra pricing model with current pricing rules
   */
  async recongelarApenasModeloPrecificacao(regrasAtuais: RegrasCongeladas, categoria?: string): Promise<RegrasCongeladas> {
    console.log('🎯 Smart re-freezing: updating only photo extra pricing model', { categoria });
    const regrasAtualizadas = { ...regrasAtuais };
    console.log('📊 Freezing current photo extra pricing model for category:', categoria);
    regrasAtualizadas.precificacaoFotoExtra = congelarRegrasPrecoFotoExtra(categoria);
    console.log('✅ Photo extra pricing model updated with current rules:', (regrasAtualizadas as any).modeloPrecoFotoExtra);
    return regrasAtualizadas;
  }

  /**
   * Calcula o valor da foto extra usando regras congeladas
   */
  calcularValorFotoExtraComRegrasCongeladas(
    quantidade: number, 
    regrasCongeladas: RegrasCongeladas
  ): { valorUnitario: number; valorTotal: number } {
    return calcularValorFotoExtraComRegrasCongeladas(quantidade, regrasCongeladas);
  }

  /**
   * Obtém dados de pacote congelados
   */
  obterDadosPacoteCongelados(regrasCongeladas?: RegrasCongeladas, pacoteId?: string): PacoteCongelado | null {
    return obterDadosPacoteCongelados(regrasCongeladas, pacoteId);
  }

  /**
   * Obtém dados de produtos congelados
   */
  obterDadosProdutosCongelados(regrasCongeladas?: RegrasCongeladas): ProdutoCongelado[] {
    return obterDadosProdutosCongelados(regrasCongeladas);
  }

  /**
   * FASE 4: Migra sessões existentes para incluir dados completos congelados
   */
  async migrarSessoesExistentes(): Promise<{ migrated: number; skipped: number }> {
    return migrarSessoesExistentes((pacoteId, categoria) => this.congelarDadosCompletos(pacoteId, categoria));
  }

  /**
   * Corrige sessões existentes com dados inconsistentes de foto extra
   */
  async corrigirSessoesInconsistentes(): Promise<{ corrected: number; skipped: number }> {
    return corrigirSessoesInconsistentes();
  }

  /**
   * Corrige sessões com modelo categoria que podem ter tabelas null
   */
  async corrigirSessoesComTabelasNull(): Promise<{ corrected: number; skipped: number }> {
    return corrigirSessoesComTabelasNull((pacoteId, categoria) => this.congelarDadosCompletos(pacoteId, categoria));
  }

  /**
   * Corrige sessões com modelo categoria que podem ter tabelas incorretas
   */
  async corrigirModeloCategoria(): Promise<{ corrected: number; skipped: number }> {
    return corrigirModeloCategoria((pacoteId, categoria) => this.congelarDadosCompletos(pacoteId, categoria));
  }

  /**
   * Corrige sessões com modelo fixo sem valorFixo definido
   */
  async corrigirSessoesModeloFixo(): Promise<{ migrated: number; skipped: number }> {
    return corrigirSessoesModeloFixo();
  }

  /**
   * Verifica integridade dos dados congelados
   */
  async verificarIntegridade(): Promise<IntegridadeIssue[]> {
    return verificarIntegridade();
  }
}

export const pricingFreezingService = new PricingFreezingService();
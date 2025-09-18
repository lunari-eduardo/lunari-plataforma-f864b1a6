/**
 * Serviço para congelamento de regras de precificação
 * Garante que mudanças nos preços não afetam sessões passadas
 */

import { obterConfiguracaoPrecificacao, obterTabelaGlobal, obterTabelaCategoria } from '@/utils/precificacaoUtils';

export interface RegrasCongeladas extends Record<string, any> {
  modelo: 'completo';
  dataCongelamento: string;
  pacote?: {
    id: string;
    nome: string;
    valorBase: number;
    valorFotoExtra: number;
    categoria: string;
    categoriaId?: string;
    produtosIncluidos?: any[];
  };
  produtos?: Array<{
    id: string;
    nome: string;
    valorUnitario: number;
    quantidade: number;
    tipo: 'incluso' | 'manual';
  }>;
  precificacaoFotoExtra: {
    modelo: 'fixo' | 'global' | 'categoria';
    valorFixo?: number;
    tabelaGlobal?: any;
    tabelaCategoria?: any;
  };
}

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
        precificacaoFotoExtra: this.congelarRegrasPrecoFotoExtra(categoria)
      };

      // Congela dados do pacote se ID fornecido
      if (pacoteId) {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: user } = await supabase.auth.getUser();
        
        if (user?.user) {
          const { data: pacote } = await supabase
            .from('pacotes')
            .select(`
              *,
              categorias (
                id,
                nome
              )
            `)
            .eq('id', pacoteId)
            .eq('user_id', user.user.id)
            .single();

          if (pacote) {
            regras.pacote = {
              id: pacote.id,
              nome: pacote.nome,
              valorBase: Number(pacote.valor_base) || 0,
              valorFotoExtra: Number(pacote.valor_foto_extra) || 0,
              categoria: (pacote as any).categorias?.nome || categoria || '',
              categoriaId: pacote.categoria_id,
              produtosIncluidos: Array.isArray(pacote.produtos_incluidos) ? pacote.produtos_incluidos : []
            };

            // Congela dados detalhados dos produtos incluídos
            const produtosIncluidos = pacote.produtos_incluidos;
            if (produtosIncluidos && Array.isArray(produtosIncluidos)) {
              regras.produtos = await this.congelarDadosProdutos(produtosIncluidos as any[]);
            }

            console.log('✅ Dados do pacote congelados:', regras.pacote);
          }
        }
      }

      console.log('📦 Dados completos congelados:', regras);
      return regras;
    } catch (error) {
      console.error('❌ Erro ao congelar dados completos:', error);
      // Fallback para regra básica
      return {
        modelo: 'completo',
        dataCongelamento: new Date().toISOString(),
        precificacaoFotoExtra: this.congelarRegrasPrecoFotoExtra(categoria)
      };
    }
  }

  /**
   * Congela apenas regras de preço de foto extra (compatibilidade com versão antiga)
   */
  congelarRegrasAtuais(categoria?: string): RegrasCongeladas {
    const precificacaoFotoExtra = this.congelarRegrasPrecoFotoExtra(categoria);
    
    return {
      modelo: 'completo',
      dataCongelamento: new Date().toISOString(),
      precificacaoFotoExtra
    };
  }

  /**
   * Congela regras específicas de precificação de foto extra
   */
  private congelarRegrasPrecoFotoExtra(categoria?: string) {
    const config = obterConfiguracaoPrecificacao();
    
    const regras: any = {
      modelo: config.modelo
    };

    switch (config.modelo) {
      case 'fixo':
        regras.valorFixo = 35; // Valor padrão caso não exista na config
        break;
      
      case 'global':
        const tabelaGlobal = obterTabelaGlobal();
        regras.tabelaGlobal = tabelaGlobal;
        break;
      
      case 'categoria':
        if (categoria) {
          const tabelaCategoria = obterTabelaCategoria(categoria);
          regras.tabelaCategoria = tabelaCategoria;
        }
        break;
    }

    return regras;
  }

  /**
   * Congela dados detalhados dos produtos
   */
  private async congelarDadosProdutos(produtosIncluidos: any[]): Promise<any[]> {
    try {
      if (!Array.isArray(produtosIncluidos) || produtosIncluidos.length === 0) {
        return [];
      }

      const { supabase } = await import('@/integrations/supabase/client');
      const { data: user } = await supabase.auth.getUser();
      
      if (!user?.user) return produtosIncluidos;

      const produtosCongelados = [];

      for (const produtoItem of produtosIncluidos) {
        if (produtoItem.produtoId) {
          // Buscar dados completos do produto
          const { data: produto } = await supabase
            .from('produtos')
            .select('*')
            .eq('id', produtoItem.produtoId)
            .eq('user_id', user.user.id)
            .single();

          if (produto) {
            produtosCongelados.push({
              id: produto.id,
              nome: produto.nome,
              valorUnitario: Number(produto.preco_venda) || 0,
              quantidade: produtoItem.quantidade || 1,
              tipo: produtoItem.tipo || 'incluso'
            });
          }
        } else {
          // Produto manual ou sem ID, congelar como está
          produtosCongelados.push({
            id: produtoItem.id || `manual_${Date.now()}_${Math.random()}`,
            nome: produtoItem.nome || produtoItem.produto || 'Produto',
            valorUnitario: Number(produtoItem.valorUnitario) || Number(produtoItem.valor) || 0,
            quantidade: produtoItem.quantidade || 1,
            tipo: produtoItem.tipo || 'manual'
          });
        }
      }

      return produtosCongelados;
    } catch (error) {
      console.error('❌ Erro ao congelar dados dos produtos:', error);
      return produtosIncluidos;
    }
  }

  /**
   * Calcula o valor da foto extra usando regras congeladas
   */
  calcularValorFotoExtraComRegrasCongeladas(
    quantidade: number, 
    regrasCongeladas: RegrasCongeladas
  ): { valorUnitario: number; valorTotal: number } {
    let valorUnitario = 0;

    // Para regras completas, usar dados específicos de foto extra
    const regrasPrecoFoto = regrasCongeladas.precificacaoFotoExtra || regrasCongeladas;

    // Se temos valor congelado no pacote, usar ele
    if (regrasCongeladas.pacote?.valorFotoExtra) {
      valorUnitario = regrasCongeladas.pacote.valorFotoExtra;
    } else {
      // Usar lógica de precificação baseada no modelo
      switch (regrasPrecoFoto.modelo) {
        case 'fixo':
          valorUnitario = regrasPrecoFoto.valorFixo || 0;
          break;
        
        case 'global':
        case 'categoria':
          const tabela = regrasPrecoFoto.modelo === 'global' 
            ? regrasPrecoFoto.tabelaGlobal 
            : regrasPrecoFoto.tabelaCategoria;
            
          if (tabela?.faixas?.length > 0) {
            const faixasOrdenadas = [...tabela.faixas].sort((a, b) => a.min - b.min);
            
            // Encontra a faixa correta para a quantidade
            for (const faixa of faixasOrdenadas) {
              if (quantidade >= faixa.min && (faixa.max === null || quantidade <= faixa.max)) {
                valorUnitario = faixa.valor;
                break;
              }
            }
            
            // Se não encontrou, usa a última faixa
            if (valorUnitario === 0 && faixasOrdenadas.length > 0) {
              valorUnitario = faixasOrdenadas[faixasOrdenadas.length - 1].valor;
            }
          }
          break;
      }
    }

    return {
      valorUnitario,
      valorTotal: valorUnitario * quantidade
    };
  }

  /**
   * Obtém dados de pacote congelados ou resolve dinamicamente
   */
  obterDadosPacoteCongelados(regrasCongeladas?: RegrasCongeladas, pacoteId?: string) {
    if (regrasCongeladas?.pacote) {
      return regrasCongeladas.pacote;
    }
    
    // Fallback: resolver dinamicamente se não há dados congelados
    return null;
  }

  /**
   * Obtém dados de produtos congelados
   */
  obterDadosProdutosCongelados(regrasCongeladas?: RegrasCongeladas) {
    if (regrasCongeladas?.produtos) {
      return regrasCongeladas.produtos;
    }
    
    return [];
  }

  /**
   * Migra sessões existentes para incluir dados completos congelados
   */
  async migrarSessoesExistentes() {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: user } = await supabase.auth.getUser();
      
      if (!user?.user) {
        throw new Error('User not authenticated');
      }

      // Busca todas as sessões que precisam de migração
      const { data: sessions, error } = await supabase
        .from('clientes_sessoes')
        .select('id, categoria, pacote, regras_congeladas')
        .eq('user_id', user.user.id);

      if (error) throw error;

      console.log(`📦 Verificando ${sessions?.length || 0} sessões para migração de dados congelados...`);

      let migrated = 0;
      let skipped = 0;

      // Para cada sessão, verifica se precisa de migração
      for (const session of sessions || []) {
        try {
          let needsUpdate = false;
          let regrasCongeladas = session.regras_congeladas;

          // Se não tem regras congeladas ou está no formato antigo
          if (!regrasCongeladas || (typeof regrasCongeladas === 'object' && 
              regrasCongeladas !== null && !Array.isArray(regrasCongeladas) &&
              (regrasCongeladas as any).modelo !== 'completo')) {
            regrasCongeladas = await this.congelarDadosCompletos(session.pacote, session.categoria);
            needsUpdate = true;
          }

          if (needsUpdate) {
            await supabase
              .from('clientes_sessoes')
              .update({ regras_congeladas: regrasCongeladas as any })
              .eq('id', session.id)
              .eq('user_id', user.user.id);
            
            migrated++;
          } else {
            skipped++;
          }
        } catch (sessionError) {
          console.error('❌ Erro ao migrar sessão:', session.id, sessionError);
        }
      }
      
      console.log(`✅ Migração de dados congelados concluída: ${migrated} migradas, ${skipped} ignoradas`);
      return { migrated, skipped };
      
    } catch (error) {
      console.error('❌ Erro na migração de dados congelados:', error);
      throw error;
    }
  }

  /**
   * Verifica integridade dos dados congelados
   */
  async verificarIntegridade() {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: user } = await supabase.auth.getUser();
      
      if (!user?.user) {
        throw new Error('User not authenticated');
      }

      const { data: sessions, error } = await supabase
        .from('clientes_sessoes')
        .select('id, pacote, regras_congeladas')
        .eq('user_id', user.user.id);

      if (error) throw error;

      const issues = [];

      for (const session of sessions || []) {
        if (!session.regras_congeladas) {
          issues.push({
            sessionId: session.id,
            issue: 'Sem dados congelados',
            severity: 'warning'
          });
        } else if (session.regras_congeladas && typeof session.regras_congeladas === 'object' && 
                   session.regras_congeladas !== null && !Array.isArray(session.regras_congeladas) &&
                   (session.regras_congeladas as any).modelo !== 'completo') {
          issues.push({
            sessionId: session.id,
            issue: 'Formato de dados congelados desatualizado',
            severity: 'info'
          });
        }
      }

      return issues;
    } catch (error) {
      console.error('❌ Erro na verificação de integridade:', error);
      throw error;
    }
  }
}

export const pricingFreezingService = new PricingFreezingService();
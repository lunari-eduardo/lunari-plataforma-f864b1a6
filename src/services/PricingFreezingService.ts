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
        // Para modelo fixo, o valor será determinado pelo pacote específico
        // Não definimos valorFixo aqui para forçar uso do valor do pacote
        console.log('📦 Modelo fixo: valor será determinado pelo pacote específico');
        break;
      
      case 'global':
        const tabelaGlobal = obterTabelaGlobal();
        regras.tabelaGlobal = tabelaGlobal;
        console.log('📊 Tabela global congelada:', tabelaGlobal?.nome);
        break;
      
      case 'categoria':
        if (categoria) {
          const tabelaCategoria = this.resolverTabelaCategoria(categoria);
          regras.tabelaCategoria = tabelaCategoria;
          console.log('📊 Tabela categoria congelada:', tabelaCategoria?.nome, 'para categoria:', categoria, 'resolvida:', !!tabelaCategoria);
        }
        break;
    }

    return regras;
  }

  /**
   * Resolve tabela de categoria por ID ou nome
   */
  private resolverTabelaCategoria(categoria: string) {
    try {
      // Primeiro, tentar como ID
      let tabelaCategoria = obterTabelaCategoria(categoria);
      
      if (!tabelaCategoria) {
        // Se não encontrou, pode ser um nome - tentar resolver o ID
        const categorias = this.obterCategorias();
        const categoriaObj = categorias.find((cat: any) => cat.nome === categoria);
        
        if (categoriaObj?.id) {
          tabelaCategoria = obterTabelaCategoria(categoriaObj.id);
          console.log('📋 Categoria resolvida por nome:', categoria, '→ ID:', categoriaObj.id);
        }
      }
      
      if (!tabelaCategoria) {
        console.warn('⚠️ Tabela de categoria não encontrada para:', categoria);
      }
      
      return tabelaCategoria;
    } catch (error) {
      console.error('❌ Erro ao resolver tabela categoria:', categoria, error);
      return null;
    }
  }

  /**
   * Obtém categorias do localStorage
   */
  private obterCategorias() {
    try {
      const { PRICING_STORAGE_KEYS } = require('@/types/pricing');
      const categorias = localStorage.getItem(PRICING_STORAGE_KEYS.CATEGORIAS_PREFIX);
      return categorias ? JSON.parse(categorias) : [];
    } catch (error) {
      console.error('❌ Erro ao obter categorias:', error);
      return [];
    }
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

    console.log('💰 Calculando valor foto extra:', {
      quantidade,
      modelo: regrasPrecoFoto.modelo,
      valorPacote: regrasCongeladas.pacote?.valorFotoExtra,
      valorFixo: regrasPrecoFoto.valorFixo
    });

    // PRIORIDADE 1: Se temos valor congelado no pacote (modelo fixo), usar SEMPRE
    if (regrasCongeladas.pacote?.valorFotoExtra !== undefined) {
      valorUnitario = regrasCongeladas.pacote.valorFotoExtra;
      console.log('✅ Usando valor do pacote congelado:', valorUnitario);
    } else {
      // PRIORIDADE 2: Usar lógica de precificação baseada no modelo
      switch (regrasPrecoFoto.modelo) {
        case 'fixo':
          // Para modelo fixo sem valor de pacote, usar valor configurado ou 0
          valorUnitario = regrasPrecoFoto.valorFixo || 0;
          console.log('⚠️ Modelo fixo sem valor de pacote, usando valorFixo:', valorUnitario);
          break;
        
        case 'global':
          const tabelaGlobal = regrasPrecoFoto.tabelaGlobal;
          if (tabelaGlobal?.faixas?.length > 0) {
            valorUnitario = this.calcularValorPorTabela(quantidade, tabelaGlobal);
            console.log('📊 Valor calculado por tabela global:', valorUnitario, 'para quantidade:', quantidade);
          } else {
            console.warn('⚠️ Tabela global não encontrada ou vazia');
          }
          break;
          
        case 'categoria':
          const tabelaCategoria = regrasPrecoFoto.tabelaCategoria;
          if (tabelaCategoria?.faixas?.length > 0) {
            valorUnitario = this.calcularValorPorTabela(quantidade, tabelaCategoria);
            console.log('📊 Valor calculado por tabela categoria:', valorUnitario, 'para quantidade:', quantidade, 'tabela:', tabelaCategoria.nome);
          } else {
            console.warn('⚠️ Tabela de categoria não encontrada ou vazia para modelo categoria');
            // Para modelo categoria sem tabela, não usar fallback do modelo fixo
            valorUnitario = 0;
          }
          break;
      }
    }

    const resultado = {
      valorUnitario,
      valorTotal: valorUnitario * quantidade
    };

    console.log('✅ Resultado final foto extra:', resultado);
    return resultado;
  }

  /**
   * Calcula valor por tabela de preços progressivos
   */
  private calcularValorPorTabela(quantidade: number, tabela: any): number {
    if (!tabela?.faixas?.length) return 0;
    
    const faixasOrdenadas = [...tabela.faixas].sort((a, b) => a.min - b.min);
    
    // Encontra a faixa correta para a quantidade
    for (const faixa of faixasOrdenadas) {
      if (quantidade >= faixa.min && (faixa.max === null || quantidade <= faixa.max)) {
        return faixa.valor;
      }
    }
    
    // Se não encontrou faixa específica, usa a última faixa
    return faixasOrdenadas[faixasOrdenadas.length - 1].valor;
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
   * Recongela apenas produtos mantendo outros dados estáveis
   */
  async recongelarProdutos(regrasAtuais?: RegrasCongeladas, novosProdutos?: any[]): Promise<RegrasCongeladas> {
    try {
      // Se não há regras atuais, criar novas
      if (!regrasAtuais) {
        return this.congelarDadosCompletos();
      }

      // Manter dados existentes e atualizar apenas produtos
      const regrasAtualizadas = { ...regrasAtuais };
      
      if (novosProdutos) {
        regrasAtualizadas.produtos = await this.congelarDadosProdutos(novosProdutos);
        regrasAtualizadas.dataCongelamento = new Date().toISOString();
        console.log('📦 Produtos recongelados:', regrasAtualizadas.produtos);
      }

      return regrasAtualizadas;
    } catch (error) {
      console.error('❌ Erro ao recongelar produtos:', error);
      return regrasAtuais || {
        modelo: 'completo',
        dataCongelamento: new Date().toISOString(),
        precificacaoFotoExtra: this.congelarRegrasPrecoFotoExtra()
      };
    }
  }

  /**
   * Corrige sessões existentes com dados inconsistentes de foto extra
   */
  async corrigirSessoesInconsistentes() {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: user } = await supabase.auth.getUser();
      
      if (!user?.user) {
        throw new Error('User not authenticated');
      }

      console.log('🔧 Iniciando correção de sessões com dados inconsistentes...');

      const { data: sessions, error } = await supabase
        .from('clientes_sessoes')
        .select('id, categoria, pacote, regras_congeladas')
        .eq('user_id', user.user.id);

      if (error) throw error;

      let corrected = 0;
      let skipped = 0;

      for (const session of sessions || []) {
        try {
          const regras = session.regras_congeladas as RegrasCongeladas;
          
          // Verifica se precisa de correção
          if (regras?.precificacaoFotoExtra?.modelo === 'fixo' && 
              regras.precificacaoFotoExtra.valorFixo === 35 && 
              regras.pacote?.valorFotoExtra && 
              regras.pacote.valorFotoExtra !== 35) {
            
            console.log('🔧 Corrigindo sessão:', session.id, {
              valorIncorreto: regras.precificacaoFotoExtra.valorFixo,
              valorCorreto: regras.pacote.valorFotoExtra
            });

            // Remove o valorFixo hardcoded para forçar uso do valor do pacote
            const regrasCorrigidas = { ...regras };
            delete regrasCorrigidas.precificacaoFotoExtra.valorFixo;
            regrasCorrigidas.dataCongelamento = new Date().toISOString();

            await supabase
              .from('clientes_sessoes')
              .update({ regras_congeladas: regrasCorrigidas as any })
              .eq('id', session.id)
              .eq('user_id', user.user.id);
            
            corrected++;
          } else {
            skipped++;
          }
        } catch (sessionError) {
          console.error('❌ Erro ao corrigir sessão:', session.id, sessionError);
        }
      }
      
      console.log(`✅ Correção concluída: ${corrected} corrigidas, ${skipped} ignoradas`);
      return { corrected, skipped };
      
    } catch (error) {
      console.error('❌ Erro na correção de sessões:', error);
      throw error;
    }
  }

  /**
   * Corrige sessões com modelo categoria que podem ter tabelas incorretas
   */
  async corrigirModeloCategoria() {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: user } = await supabase.auth.getUser();
      
      if (!user?.user) {
        throw new Error('User not authenticated');
      }

      console.log('🔧 Iniciando correção específica para modelo categoria...');

      const { data: sessions, error } = await supabase
        .from('clientes_sessoes')
        .select('id, categoria, pacote, regras_congeladas')
        .eq('user_id', user.user.id);

      if (error) throw error;

      let corrected = 0;
      let skipped = 0;

      for (const session of sessions || []) {
        try {
          const regras = session.regras_congeladas as RegrasCongeladas;
          
          // Verifica se é modelo categoria e se precisa de correção
          if (regras?.precificacaoFotoExtra?.modelo === 'categoria' && session.categoria) {
            const tabelaAtual = regras.precificacaoFotoExtra.tabelaCategoria;
            const tabelaCorreta = this.resolverTabelaCategoria(session.categoria);
            
            // Se não tem tabela ou a tabela está diferente, corrigir
            if (!tabelaAtual || (tabelaCorreta && tabelaAtual?.id !== tabelaCorreta?.id)) {
              console.log('🔧 Corrigindo tabela categoria para sessão:', session.id, {
                categoria: session.categoria,
                tabelaAtual: tabelaAtual?.nome || 'nenhuma',
                tabelaCorreta: tabelaCorreta?.nome || 'não encontrada'
              });

              const regrasCorrigidas = { ...regras };
              regrasCorrigidas.precificacaoFotoExtra.tabelaCategoria = tabelaCorreta;
              regrasCorrigidas.dataCongelamento = new Date().toISOString();

              await supabase
                .from('clientes_sessoes')
                .update({ regras_congeladas: regrasCorrigidas as any })
                .eq('id', session.id)
                .eq('user_id', user.user.id);
              
              corrected++;
            } else {
              skipped++;
            }
          } else {
            skipped++;
          }
        } catch (sessionError) {
          console.error('❌ Erro ao corrigir sessão categoria:', session.id, sessionError);
        }
      }
      
      console.log(`✅ Correção modelo categoria concluída: ${corrected} corrigidas, ${skipped} ignoradas`);
      return { corrected, skipped };
      
    } catch (error) {
      console.error('❌ Erro na correção modelo categoria:', error);
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

  /**
   * Re-freeze only photo extra pricing model with current pricing rules
   * Preserves package and product data, updates only photo extra pricing
   */
  async recongelarApenasModeloPrecificacao(regrasAtuais: RegrasCongeladas, categoria?: string): Promise<RegrasCongeladas> {
    console.log('🎯 Smart re-freezing: updating only photo extra pricing model', { categoria });
    
    // Keep ALL existing frozen data
    const regrasAtualizadas = { ...regrasAtuais };
    
    // Update ONLY the photo extra pricing model with current rules
    console.log('📊 Freezing current photo extra pricing model for category:', categoria);
    regrasAtualizadas.precificacaoFotoExtra = this.congelarRegrasPrecoFotoExtra(categoria);
    
    console.log('✅ Photo extra pricing model updated with current rules:', regrasAtualizadas.modeloPrecoFotoExtra);
    return regrasAtualizadas;
  }
}

export const pricingFreezingService = new PricingFreezingService();
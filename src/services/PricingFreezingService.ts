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
    fotosIncluidas?: number; // Número máximo de fotos que o cliente pode selecionar
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
    produzido?: boolean;
    entregue?: boolean;
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
      
      // Criar objeto base de regras (precificacao será preenchida de forma assíncrona)
      const regras: RegrasCongeladas = {
        modelo: 'completo',
        dataCongelamento: new Date().toISOString(),
        precificacaoFotoExtra: { modelo: 'fixo' } // Temporário, será atualizado abaixo
      };

      // Congela dados do pacote se ID fornecido
      let categoriaIdResolvido: string | undefined;
      if (pacoteId) {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: user } = await supabase.auth.getUser();
        
        if (user?.user) {
          // BLOCO A: Detectar se é UUID ou nome
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
          
          // BLOCO A: Usar .eq('id', ...) para UUID ou .eq('nome', ...) para nome
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

            // Congela dados detalhados dos produtos incluídos
            const produtosIncluidos = pacote.produtos_incluidos;
            if (produtosIncluidos && Array.isArray(produtosIncluidos) && produtosIncluidos.length > 0) {
              regras.produtos = await this.congelarDadosProdutos(produtosIncluidos as any[]);
              console.log('📦 Produtos congelados:', regras.produtos.length);
            } else {
              // Explicitly clear products when package has none
              regras.produtos = [];
              console.log('🧹 Produtos limpos (pacote sem produtos incluídos)');
            }

            console.log('✅ Dados do pacote congelados:', regras.pacote);
          }
        }
      }

      // Congela regras de precificação de foto extra de forma ASSÍNCRONA
      regras.precificacaoFotoExtra = await this.congelarRegrasPrecoFotoExtraAsync(categoria, categoriaIdResolvido, regras.pacote);

      console.log('📦 Dados completos congelados:', regras);
      return regras;
    } catch (error) {
      console.error('❌ Erro ao congelar dados completos:', error);
      // Fallback para regra básica
      return {
        modelo: 'completo',
        dataCongelamento: new Date().toISOString(),
        precificacaoFotoExtra: this.congelarRegrasPrecoFotoExtra()
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
   * Congela regras específicas de precificação de foto extra (VERSÃO ASSÍNCRONA)
   */
  private async congelarRegrasPrecoFotoExtraAsync(categoria?: string, categoriaId?: string, pacoteDados?: any) {
    const config = obterConfiguracaoPrecificacao();
    
    const regras: any = {
      modelo: config.modelo
    };

    switch (config.modelo) {
      case 'fixo':
        regras.valorFixo = pacoteDados?.valorFotoExtra || 0;
        console.log('📦 Modelo fixo: valor congelado do pacote:', regras.valorFixo);
        break;
      
      case 'global':
        const tabelaGlobal = obterTabelaGlobal();
        regras.tabelaGlobal = tabelaGlobal;
        console.log('📊 Tabela global congelada:', tabelaGlobal?.nome);
        break;
      
      case 'categoria':
        if (categoria || categoriaId) {
          const tabelaCategoria = await this.resolverTabelaCategoriaAsync(categoria, categoriaId);
          
          // 🆕 NOVA LÓGICA: Verificar flag usar_valor_fixo_pacote
          if (tabelaCategoria?.usar_valor_fixo_pacote) {
            // Se flag ativa, congelar como modelo FIXO em vez de categoria
            regras.modelo = 'fixo';
            regras.valorFixo = pacoteDados?.valorFotoExtra || 0;
            console.log('📦 Categoria com flag fixo ativa: usando valorFixo do pacote:', regras.valorFixo);
          } else {
            // Comportamento atual: usar tabela progressiva
            regras.tabelaCategoria = tabelaCategoria;
            console.log('📊 Tabela categoria congelada (ASYNC):', tabelaCategoria?.nome, 'para categoria:', categoria || categoriaId, 'resolvida:', !!tabelaCategoria);
          }
        } else {
          console.warn('⚠️ Modelo categoria mas sem categoria ou categoriaId fornecido');
        }
        break;
    }

    return regras;
  }

  /**
   * Congela regras específicas de precificação de foto extra (VERSÃO SÍNCRONA - para compatibilidade)
   */
  private congelarRegrasPrecoFotoExtra(categoria?: string) {
    const config = obterConfiguracaoPrecificacao();
    
    const regras: any = {
      modelo: config.modelo
    };

    switch (config.modelo) {
      case 'fixo':
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
          
          // 🆕 NOVA LÓGICA: Verificar flag usar_valor_fixo_pacote (versão sync)
          if (tabelaCategoria?.usar_valor_fixo_pacote) {
            // Se flag ativa, modelo será tratado como fixo
            regras.modelo = 'fixo';
            console.log('📦 Categoria com flag fixo ativa (SYNC): será usado valor do pacote');
          } else {
            regras.tabelaCategoria = tabelaCategoria;
            console.log('📊 Tabela categoria congelada (SYNC):', tabelaCategoria?.nome, 'para categoria:', categoria, 'resolvida:', !!tabelaCategoria);
          }
        }
        break;
    }

    return regras;
  }

  /**
   * Resolve tabela de categoria por ID ou nome - VERSÃO ASSÍNCRONA
   */
  private async resolverTabelaCategoriaAsync(categoria?: string, categoriaId?: string) {
    try {
      const { PricingConfigurationService } = await import('@/services/PricingConfigurationService');
      const adapter = (PricingConfigurationService as any).adapter;
      
      if (!adapter || typeof adapter.loadCategoryTableAsync !== 'function') {
        console.warn('⚠️ Adapter não suporta loadCategoryTableAsync, usando fallback síncrono');
        return categoria ? this.resolverTabelaCategoria(categoria) : null;
      }

      // Usar categoriaId se disponível
      let id = categoriaId;
      
      // Se não temos ID, precisamos resolver pelo nome
      if (!id && categoria) {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user) {
          console.warn('⚠️ Usuário não autenticado');
          return null;
        }

        const { data: cat } = await supabase
          .from('categorias')
          .select('id')
          .eq('nome', categoria)
          .eq('user_id', user.user.id)
          .maybeSingle();
        
        id = cat?.id;
      }

      if (!id) {
        console.warn('⚠️ Não foi possível resolver categoriaId para:', categoria);
        return null;
      }

      // Carregar tabela de forma assíncrona
      const tabela = await adapter.loadCategoryTableAsync(id);
      console.log('✅ Tabela categoria carregada de forma ASSÍNCRONA:', tabela?.nome, 'para ID:', id);
      return tabela;
    } catch (error) {
      console.error('❌ Erro ao resolver tabela categoria de forma assíncrona:', error);
      return null;
    }
  }

  /**
   * Resolve tabela de categoria por ID ou nome - versão síncrona para compatibilidade
   */
  private resolverTabelaCategoria(categoria: string) {
    try {
      // Para manter compatibilidade, usar o adaptador síncrono por enquanto
      let tabelaCategoria = obterTabelaCategoria(categoria);
      
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

      // Sanitiza etapas preservando id/nome/done (evita objetos malformados).
      const sanitizeEtapas = (raw: any): any[] | undefined => {
        if (!Array.isArray(raw) || raw.length === 0) return undefined;
        return raw
          .filter((e) => e && typeof e === 'object')
          .map((e: any) => ({
            id: String(e.id ?? ''),
            nome: String(e.nome ?? ''),
            done: !!e.done,
          }));
      };

      const produtosCongelados: any[] = [];

      for (const produtoItem of produtosIncluidos) {
        const etapas = sanitizeEtapas(produtoItem.etapas);
        const fluxo = produtoItem.fluxo === 'custom' ? 'custom' : 'padrao';
        // CRÍTICO: manter o `id` original do item (uuid gerado pelo modal)
        // para que o consumidor visual case por id. `produtoId` vai como
        // referência ao catálogo (`produtos.id`).
        const baseId = produtoItem.id
          || (produtoItem.produtoId ? `pi_${produtoItem.produtoId}` : `manual_${Date.now()}_${Math.random()}`);

        if (produtoItem.produtoId) {
          const { data: produto } = await supabase
            .from('produtos')
            .select('*')
            .eq('id', produtoItem.produtoId)
            .eq('user_id', user.user.id)
            .single();

          if (produto) {
            const congelado: any = {
              id: baseId,
              produtoId: produto.id,
              nome: produto.nome,
              valorUnitario: Number(produto.preco_venda) || 0,
              quantidade: produtoItem.quantidade || 1,
              tipo: produtoItem.tipo || 'incluso',
              fluxo,
              produzido: produtoItem.produzido || false,
              entregue: produtoItem.entregue || false,
            };
            if (etapas) congelado.etapas = etapas;
            if (typeof produtoItem.prazoEntrega === 'string' && /^\d{4}-\d{2}-\d{2}/.test(produtoItem.prazoEntrega)) {
              congelado.prazoEntrega = produtoItem.prazoEntrega.slice(0, 10);
            }
            produtosCongelados.push(congelado);
          }
        } else {
          const congelado: any = {
            id: baseId,
            nome: produtoItem.nome || produtoItem.produto || 'Produto',
            valorUnitario: Number(produtoItem.valorUnitario) || Number(produtoItem.valor) || 0,
            quantidade: produtoItem.quantidade || 1,
            tipo: produtoItem.tipo || 'manual',
            fluxo,
            produzido: produtoItem.produzido || false,
            entregue: produtoItem.entregue || false,
          };
          if (etapas) congelado.etapas = etapas;
          if (typeof produtoItem.prazoEntrega === 'string' && /^\d{4}-\d{2}-\d{2}/.test(produtoItem.prazoEntrega)) {
            congelado.prazoEntrega = produtoItem.prazoEntrega.slice(0, 10);
          }
          produtosCongelados.push(congelado);
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

    // Respeitar o modelo escolhido - não forçar valor do pacote para outros modelos
    switch (regrasPrecoFoto.modelo) {
      case 'fixo':
        // Para modelo fixo, usar valor do pacote ou valor fixo configurado
        if (regrasCongeladas.pacote?.valorFotoExtra !== undefined) {
          valorUnitario = regrasCongeladas.pacote.valorFotoExtra;
          console.log('✅ Modelo fixo: usando valor do pacote congelado:', valorUnitario);
        } else {
          valorUnitario = regrasPrecoFoto.valorFixo || 0;
          console.log('⚠️ Modelo fixo: usando valorFixo configurado:', valorUnitario);
        }
        break;
      
      case 'global':
        const tabelaGlobal = regrasPrecoFoto.tabelaGlobal;
        if (tabelaGlobal?.faixas?.length > 0) {
          valorUnitario = this.calcularValorPorTabela(quantidade, tabelaGlobal);
          console.log('📊 Modelo global: valor calculado por tabela:', valorUnitario, 'para quantidade:', quantidade);
        } else {
          console.warn('⚠️ Modelo global: tabela global não encontrada ou vazia');
          valorUnitario = 0;
        }
        break;
        
      case 'categoria':
        let tabelaCategoria = regrasPrecoFoto.tabelaCategoria;
        
        // FALLBACK: Se tabela está null, tentar recarregar do cache
        if (!tabelaCategoria?.faixas?.length && regrasCongeladas.pacote?.categoriaId) {
          console.warn('⚠️ Tabela categoria null nas regras, tentando recarregar do cache...');
          tabelaCategoria = obterTabelaCategoria(regrasCongeladas.pacote.categoriaId);
          
          if (tabelaCategoria) {
            console.log('✅ Tabela categoria recuperada do cache:', tabelaCategoria.nome);
          }
        }
        
        if (tabelaCategoria?.faixas?.length > 0) {
          valorUnitario = this.calcularValorPorTabela(quantidade, tabelaCategoria);
          console.log('📊 Modelo categoria: valor calculado por tabela:', valorUnitario, 'para quantidade:', quantidade, 'tabela:', tabelaCategoria.nome);
        } else {
          console.error('❌ ERRO: Tabela categoria não disponível. CategoriaId:', regrasCongeladas.pacote?.categoriaId);
          valorUnitario = 0;
        }
        break;
      
      default:
        console.warn('⚠️ Modelo de preço desconhecido:', regrasPrecoFoto.modelo);
        valorUnitario = 0;
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
   * FASE 4: Migra sessões existentes para incluir dados completos congelados
   * Busca TODAS as sessões SEM regras_congeladas completas
   */
  async migrarSessoesExistentes() {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: user } = await supabase.auth.getUser();
      
      if (!user?.user) {
        throw new Error('User not authenticated');
      }

      // FASE 4: Buscar TODAS as sessões SEM regras_congeladas completas
      const { data: sessions, error } = await supabase
        .from('clientes_sessoes')
        .select('id, categoria, pacote, regras_congeladas')
        .eq('user_id', user.user.id)
        .or('regras_congeladas.is.null,regras_congeladas->pacote.is.null');

      if (error) throw error;

      console.log(`📦 [FASE 4] Verificando ${sessions?.length || 0} sessões SEM dados congelados completos...`);

      let migrated = 0;
      let skipped = 0;

      // Para cada sessão, recongelar dados
      for (const session of sessions || []) {
        try {
          console.log(`🔄 Recongelando sessão: ${session.id} - pacote: ${session.pacote}`);
          
          const regrasCongeladas = await this.congelarDadosCompletos(
            session.pacote,
            session.categoria
          );
          
          await supabase
            .from('clientes_sessoes')
            .update({ regras_congeladas: regrasCongeladas as any })
            .eq('id', session.id)
            .eq('user_id', user.user.id);
          
          migrated++;
          console.log(`✅ Sessão ${session.id} recongelada com sucesso`);
        } catch (sessionError) {
          console.error('❌ Erro ao migrar sessão:', session.id, sessionError);
          skipped++;
        }
      }
      
      console.log(`✅ [FASE 4] Migração concluída: ${migrated} recongeladas, ${skipped} com erro`);
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
   * Corrige sessões com modelo categoria que podem ter tabelas null
   */
  async corrigirSessoesComTabelasNull() {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: user } = await supabase.auth.getUser();
      
      if (!user?.user) {
        throw new Error('User not authenticated');
      }

      console.log('🔧 Iniciando correção de sessões com tabelas null...');

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
          
          // Verifica se tem problema com tabela categoria null
          if (regras?.precificacaoFotoExtra?.modelo === 'categoria' && 
              !regras.precificacaoFotoExtra.tabelaCategoria) {
            
            console.log('🔧 Recongelando sessão com tabela null:', session.id, 'categoria:', session.categoria);

            // Recongela com método assíncrono
            const regrasCorrigidas = await this.congelarDadosCompletos(
              session.pacote,
              session.categoria
            );

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
      
      console.log(`✅ Correção de tabelas null concluída: ${corrected} corrigidas, ${skipped} ignoradas`);
      return { corrected, skipped };
      
    } catch (error) {
      console.error('❌ Erro na correção de sessões com tabelas null:', error);
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
            
            // Se não tem tabela, precisa recongelar
            if (!tabelaAtual) {
              console.log('🔧 Recongelando sessão sem tabela categoria:', session.id, 'categoria:', session.categoria);

              const regrasCorrigidas = await this.congelarDadosCompletos(
                session.pacote,
                session.categoria
              );

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
   * Corrige sessões com modelo fixo sem valorFixo definido
   */
  async corrigirSessoesModeloFixo(): Promise<{ migrated: number; skipped: number }> {
    console.log('🔧 Iniciando correção de sessões com modelo fixo...');
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: user } = await supabase.auth.getUser();
      
      if (!user?.user) {
        throw new Error('User not authenticated');
      }

      const { data: sessoes, error } = await supabase
        .from('clientes_sessoes')
        .select('*')
        .eq('user_id', user.user.id)
        .not('regras_congeladas', 'is', null);

      if (error) {
        console.error('❌ Erro ao buscar sessões:', error);
        return { migrated: 0, skipped: 0 };
      }

      let migrated = 0;
      let skipped = 0;

      for (const sessao of sessoes || []) {
        try {
          const regras = sessao.regras_congeladas as RegrasCongeladas;
          
          // Verificar se é modelo fixo sem valorFixo
          if (
            regras?.precificacaoFotoExtra?.modelo === 'fixo' &&
            (regras.precificacaoFotoExtra.valorFixo === undefined ||
             regras.precificacaoFotoExtra.valorFixo === 0)
          ) {
            // Pegar valor do pacote congelado
            const valorFotoExtra = regras.pacote?.valorFotoExtra || 0;
            
            if (valorFotoExtra > 0) {
              const regrasAtualizadas = {
                ...regras,
                precificacaoFotoExtra: {
                  ...regras.precificacaoFotoExtra,
                  valorFixo: valorFotoExtra
                }
              };

              const { error: updateError } = await supabase
                .from('clientes_sessoes')
                .update({ regras_congeladas: regrasAtualizadas })
                .eq('id', sessao.id)
                .eq('user_id', user.user.id);

              if (updateError) {
                console.error(`❌ Erro ao atualizar sessão ${sessao.id}:`, updateError);
                skipped++;
              } else {
                console.log(`✅ Sessão ${sessao.id} corrigida: R$ ${valorFotoExtra}`);
                migrated++;
              }
            } else {
              skipped++;
            }
          } else {
            skipped++;
          }
        } catch (error) {
          console.error(`❌ Erro ao processar sessão ${sessao.id}:`, error);
          skipped++;
        }
      }

      console.log(`✅ Correção concluída: ${migrated} sessões atualizadas, ${skipped} ignoradas`);
      return { migrated, skipped };
    } catch (error) {
      console.error('❌ Erro na correção de modelo fixo:', error);
      return { migrated: 0, skipped: 0 };
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
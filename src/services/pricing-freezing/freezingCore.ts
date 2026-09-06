/**
 * Núcleo de congelamento de regras de precificação e dados de produtos
 */

import { obterConfiguracaoPrecificacao, obterTabelaGlobal, obterTabelaCategoria } from '@/utils/precificacaoUtils';
import { PrecificacaoFotoExtra, ProdutoCongelado } from './types';

/**
 * Resolve tabela de categoria por ID ou nome - versão síncrona para compatibilidade
 */
export function resolverTabelaCategoria(categoria: string) {
  try {
    const tabelaCategoria = obterTabelaCategoria(categoria);
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
 * Resolve tabela de categoria por ID ou nome - VERSÃO ASSÍNCRONA
 */
export async function resolverTabelaCategoriaAsync(categoria?: string, categoriaId?: string) {
  try {
    const { PricingConfigurationService } = await import('@/services/PricingConfigurationService');
    const adapter = (PricingConfigurationService as any).adapter;
    
    if (!adapter || typeof adapter.loadCategoryTableAsync !== 'function') {
      console.warn('⚠️ Adapter não suporta loadCategoryTableAsync, usando fallback síncrono');
      return categoria ? resolverTabelaCategoria(categoria) : null;
    }

    let id = categoriaId;
    
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

    const tabela = await adapter.loadCategoryTableAsync(id);
    console.log('✅ Tabela categoria carregada de forma ASSÍNCRONA:', tabela?.nome, 'para ID:', id);
    return tabela;
  } catch (error) {
    console.error('❌ Erro ao resolver tabela categoria de forma assíncrona:', error);
    return null;
  }
}

/**
 * Congela regras específicas de precificação de foto extra (VERSÃO SÍNCRONA - para compatibilidade)
 */
export function congelarRegrasPrecoFotoExtra(categoria?: string): PrecificacaoFotoExtra {
  const config = obterConfiguracaoPrecificacao();
  
  const regras: PrecificacaoFotoExtra = {
    modelo: config.modelo
  };

  switch (config.modelo) {
    case 'fixo':
      console.log('📦 Modelo fixo: valor será determinado pelo pacote específico');
      break;
    
    case 'global': {
      const tabelaGlobal = obterTabelaGlobal();
      regras.tabelaGlobal = tabelaGlobal;
      console.log('📊 Tabela global congelada:', tabelaGlobal?.nome);
      break;
    }
    
    case 'categoria': {
      if (categoria) {
        const tabelaCategoria = resolverTabelaCategoria(categoria);
        
        if (tabelaCategoria?.usar_valor_fixo_pacote) {
          regras.modelo = 'fixo';
          console.log('📦 Categoria com flag fixo ativa (SYNC): será usado valor do pacote');
        } else {
          regras.tabelaCategoria = tabelaCategoria;
          console.log('📊 Tabela categoria congelada (SYNC):', tabelaCategoria?.nome, 'para categoria:', categoria);
        }
      }
      break;
    }
  }

  return regras;
}

/**
 * Congela regras específicas de precificação de foto extra (VERSÃO ASSÍNCRONA)
 * Consulta diretamente o Supabase com fallback resiliente
 */
export async function congelarRegrasPrecoFotoExtraAsync(
  categoria?: string,
  categoriaId?: string,
  pacoteDados?: any
): Promise<PrecificacaoFotoExtra> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    let modelo: 'fixo' | 'global' | 'categoria' = 'fixo';

    if (userId) {
      const { data: modeloData } = await supabase
        .from('modelo_de_preco')
        .select('modelo')
        .eq('user_id', userId)
        .maybeSingle();

      if (modeloData?.modelo) {
        modelo = modeloData.modelo as 'fixo' | 'global' | 'categoria';
      }
    }

    const regras: PrecificacaoFotoExtra = {
      modelo
    };

    switch (modelo) {
      case 'fixo':
        regras.valorFixo = pacoteDados?.valorFotoExtra || 0;
        console.log('📦 Modelo fixo: valor congelado do pacote:', regras.valorFixo);
        break;

      case 'global': {
        let tabelaGlobal = null;
        if (userId) {
          const { data: tgData } = await supabase
            .from('tabelas_precos')
            .select('*')
            .eq('user_id', userId)
            .eq('tipo', 'global')
            .maybeSingle();

          if (tgData) {
            tabelaGlobal = {
              id: tgData.id,
              user_id: tgData.user_id,
              nome: tgData.nome,
              faixas: Array.isArray(tgData.faixas)
                ? (tgData.faixas as any[]).map((f: any) => ({
                    min: f.min ?? f.de ?? 1,
                    max: f.max ?? (f.ate === 999999 ? null : (f.ate ?? null)),
                    valor: f.valor ?? f.valor_foto_extra ?? 0,
                  }))
                : [],
              usar_valor_fixo_pacote: tgData.usar_valor_fixo_pacote ?? false,
              created_at: tgData.created_at,
              updated_at: tgData.updated_at
            };
          }
        }

        if (tabelaGlobal) {
          regras.tabelaGlobal = tabelaGlobal;
          console.log('📊 Tabela global congelada (DB):', tabelaGlobal.nome);
        } else {
          regras.modelo = 'fixo';
          regras.valorFixo = pacoteDados?.valorFotoExtra || 0;
          console.warn('⚠️ Modelo global sem tabela configurada no DB, fallback para fixo');
        }
        break;
      }

      case 'categoria': {
        let tabelaCategoria = null;
        let resolvedCatId = categoriaId;

        if (userId) {
          if (!resolvedCatId && categoria) {
            const { data: cat } = await supabase
              .from('categorias')
              .select('id')
              .eq('nome', categoria)
              .eq('user_id', userId)
              .maybeSingle();
            resolvedCatId = cat?.id;
          }

          if (resolvedCatId) {
            const { data: tcData } = await supabase
              .from('tabelas_precos')
              .select('*')
              .eq('user_id', userId)
              .eq('tipo', 'categoria')
              .eq('categoria_id', resolvedCatId)
              .maybeSingle();

            if (tcData) {
              tabelaCategoria = {
                id: tcData.id,
                user_id: tcData.user_id,
                nome: tcData.nome,
                faixas: Array.isArray(tcData.faixas)
                  ? (tcData.faixas as any[]).map((f: any) => ({
                      min: f.min ?? f.de ?? 1,
                      max: f.max ?? (f.ate === 999999 ? null : (f.ate ?? null)),
                      valor: f.valor ?? f.valor_foto_extra ?? 0,
                    }))
                  : [],
                usar_valor_fixo_pacote: tcData.usar_valor_fixo_pacote ?? false,
                created_at: tcData.created_at,
                updated_at: tcData.updated_at
              };
            }
          }
        }

        if (tabelaCategoria) {
          if (tabelaCategoria.usar_valor_fixo_pacote) {
            regras.modelo = 'fixo';
            regras.valorFixo = pacoteDados?.valorFotoExtra || 0;
            console.log('📦 Categoria com flag fixo ativa: usando valorFixo do pacote:', regras.valorFixo);
          } else {
            regras.tabelaCategoria = tabelaCategoria;
            console.log('📊 Tabela categoria congelada (DB):', tabelaCategoria.nome, 'para cat:', resolvedCatId);
          }
        } else {
          regras.modelo = 'fixo';
          regras.valorFixo = pacoteDados?.valorFotoExtra || 0;
          console.warn('⚠️ Modelo categoria sem tabela configurada para a categoria, fallback para fixo');
        }
        break;
      }
    }

    return regras;
  } catch (e) {
    console.error('❌ Erro no congelamento assíncrono de foto extra:', e);
    return {
      modelo: 'fixo',
      valorFixo: pacoteDados?.valorFotoExtra || 0
    };
  }
}

/**
 * Congela dados detalhados dos produtos incluídos
 */
export async function congelarDadosProdutos(produtosIncluidos: any[]): Promise<ProdutoCongelado[]> {
  try {
    if (!Array.isArray(produtosIncluidos) || produtosIncluidos.length === 0) {
      return [];
    }

    const { supabase } = await import('@/integrations/supabase/client');
    const { data: user } = await supabase.auth.getUser();

    if (!user?.user) return produtosIncluidos;

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

    const produtosCongelados: ProdutoCongelado[] = [];

    for (const produtoItem of produtosIncluidos) {
      const etapas = sanitizeEtapas(produtoItem.etapas);
      const fluxo = produtoItem.fluxo === 'custom' ? 'custom' : 'padrao';
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
          const congelado: ProdutoCongelado = {
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
          const anyDone = Array.isArray(etapas) && etapas.some((e: any) => e.done);
          const startedFlag = !!produtoItem.started || anyDone;
          congelado.started = startedFlag;
          if (startedFlag) {
            congelado.startedAt =
              (typeof produtoItem.startedAt === 'string' && produtoItem.startedAt) ||
              new Date().toISOString();
          }
          produtosCongelados.push(congelado);
        }
      } else {
        const congelado: ProdutoCongelado = {
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
        const anyDone2 = Array.isArray(etapas) && etapas.some((e: any) => e.done);
        const startedFlag2 = !!produtoItem.started || anyDone2;
        congelado.started = startedFlag2;
        if (startedFlag2) {
          congelado.startedAt =
            (typeof produtoItem.startedAt === 'string' && produtoItem.startedAt) ||
            new Date().toISOString();
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

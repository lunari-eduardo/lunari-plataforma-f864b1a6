/**
 * Demonstrativo financeiro — fonte única.
 *
 * Extraído de useExtratoCalculationsSupabase para permitir que qualquer tela
 * (ex.: bloco "Resumo Financeiro" do Fluxo) calcule o demonstrativo para um
 * período arbitrário (mês selecionado ou ano inteiro) sem instanciar outro
 * useExtrato — que era a causa do demonstrativo ficar preso no mês corrente.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DemonstrativoSimplificado } from '@/types/extrato';
import { RegimeContabil } from '@/hooks/useExtratoSupabase';
import { GRUPOS_DESPESAS } from '@/constants/extratoConstants';

export interface SessionProductItem {
  id: string;
  sessionId?: string;
  total: number;
}

export const DEMONSTRATIVO_VAZIO: DemonstrativoSimplificado = {
  receitas: { sessoes: 0, fotosExtras: 0, produtos: 0, naoOperacionais: 0, totalReceitas: 0 },
  despesas: { categorias: [], totalDespesas: 0 },
  resumoFinal: { receitaTotal: 0, despesaTotal: 0, resultadoLiquido: 0, margemLiquida: 0 },
};

/**
 * Busca a relação de produtos físicos incluídos nas sessões de um determinado período.
 */
export async function fetchSessoesProdutos(
  dataInicio: string,
  dataFim: string
): Promise<SessionProductItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: sessoesProds, error } = await supabase
    .from('clientes_sessoes')
    .select('id, session_id, produtos_incluidos')
    .eq('user_id', user.id)
    .gte('data_sessao', dataInicio)
    .lte('data_sessao', dataFim)
    .not('produtos_incluidos', 'is', null)
    .or('status.is.null,status.neq.cancelado,status.neq.historico');

  if (error || !sessoesProds) return [];

  const list: SessionProductItem[] = [];
  sessoesProds.forEach((s: any) => {
    let totalProdSess = 0;
    if (Array.isArray(s.produtos_incluidos)) {
      s.produtos_incluidos.forEach((p: any) => {
        if (p?.tipo === 'manual' || (p?.quantidade && p?.valorUnitario)) {
          totalProdSess += (Number(p.quantidade) || 0) * (Number(p.valorUnitario) || 0);
        }
      });
    }
    if (totalProdSess > 0) {
      list.push({ id: s.id, sessionId: s.session_id, total: totalProdSess });
    }
  });

  return list;
}

/**
 * Hook para obter a lista de produtos de sessões de um período.
 */
export function useSessoesProdutos(dataInicio?: string, dataFim?: string, enabled = true) {
  return useQuery({
    queryKey: ['sessoes-produtos-dre', dataInicio, dataFim],
    queryFn: () => fetchSessoesProdutos(dataInicio || '', dataFim || ''),
    enabled: enabled && !!dataInicio && !!dataFim,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Calcula o Demonstrativo Financeiro diretamente a partir de um conjunto de linhas de extrato.
 * Fonte única de verdade usada tanto para cálculos em memória (respeitando todos os filtros ativos)
 * quanto para queries diretas no banco.
 */
export function calcularDemonstrativoDeLinhas(
  linhas: any[],
  regime: RegimeContabil = 'caixa',
  produtosSessoes?: SessionProductItem[]
): DemonstrativoSimplificado {
  if (!linhas || linhas.length === 0) {
    return DEMONSTRATIVO_VAZIO;
  }

  // 1. Filtrar pelo regime contábil
  // Se todas as linhas tiverem status diferente de Pago (ex: usuário filtrou explicitamente "A Receber" ou "Faturado"),
  // respeitamos o filtro explícito do usuário. Caso contrário, aplicamos a regra contábil do regime:
  // - Caixa: apenas status 'Pago'
  // - Competência: 'Pago' e 'Faturado' (reconhece faturamento/prestação do serviço gerado no período)
  const hasSpecificStatusFilter = linhas.length > 0 && linhas.every((l) => l.status !== 'Pago');
  const linhasEfetivas = hasSpecificStatusFilter
    ? linhas
    : linhas.filter((l) => (regime === 'caixa' ? l.status === 'Pago' : l.status === 'Pago' || l.status === 'Faturado'));

  // 2. RECEITAS
  const entradas = linhasEfetivas.filter((l) => l.tipo === 'entrada');
  const estornos = linhasEfetivas.filter(
    (l) => l.tipo === 'saida' && (l.categoria === 'Estorno' || l.natureza === 'estorno' || l.descricao?.toLowerCase().includes('estorno'))
  );
  const totalEstornos = estornos.reduce((sum, l) => sum + Math.abs(Number(l.valor) || 0), 0);

  let receitaSessoes = 0;
  let receitaFotosExtras = 0;
  let receitaProdutos = 0;
  let receitaNaoOperacional = 0;
  let outrasReceitas = 0;

  entradas.forEach((l) => {
    const val = Math.abs(Number(l.valor) || 0);
    const cat = l.categoria || '';
    const orig = l.origem || '';
    const esc = l.escopo || '';
    const desc = (l.descricao || '').toLowerCase();

    // Fotos extras vendidas em galeria ou avulsas
    if (
      orig === 'gallery' ||
      esc === 'fotos_extras' ||
      desc.includes('foto extra') ||
      desc.includes('fotos extras') ||
      desc.includes('[extras')
    ) {
      receitaFotosExtras += val;
    } else if (
      // Produtos físicos vendidos avulsos ou explicitamente categorizados como produtos
      cat === 'Receita com produtos' ||
      cat === 'Produtos' ||
      cat === 'Venda de Produtos'
    ) {
      receitaProdutos += val;
    } else if (
      cat === 'Receita Não Operacional' ||
      cat === 'Receita Extra'
    ) {
      receitaNaoOperacional += val;
    } else if (
      orig === 'workflow' ||
      orig === 'venda_avulsa' ||
      cat === 'Receita de Serviços' ||
      cat === 'Receita Operacional' ||
      esc === 'sessao' ||
      esc === 'sinal' ||
      esc === 'sessao_e_extras' ||
      esc === 'avulso'
    ) {
      receitaSessoes += val;
    } else {
      // Qualquer outra receita não mapeada entra para não perder centavos
      outrasReceitas += val;
    }
  });

  // Se houver outras receitas não categorizadas, agregamos à receita de serviços/sessões
  receitaSessoes += outrasReceitas;

  // Desdobramento de produtos físicos embutidos nas sessões
  if (produtosSessoes && produtosSessoes.length > 0) {
    const sessoesPresentes = new Set<string>();
    entradas.forEach((l) => {
      const sId = l.sessionId || l.session_id;
      if (sId) sessoesPresentes.add(sId);
      const refId = l.referenciaId || l.id;
      if (refId) {
        sessoesPresentes.add(refId);
        if (refId.startsWith('cs_')) sessoesPresentes.add(refId.replace('cs_', ''));
      }
    });

    let totalProdutosDesmembrados = 0;
    produtosSessoes.forEach((sp) => {
      const estaPresente =
        sessoesPresentes.size === 0 ||
        (sp.sessionId && sessoesPresentes.has(sp.sessionId)) ||
        (sp.id && sessoesPresentes.has(sp.id)) ||
        (sp.id && sessoesPresentes.has(`cs_${sp.id}`));

      if (estaPresente) {
        totalProdutosDesmembrados += sp.total;
      }
    });

    const desmembramentoEfetivo = Math.min(receitaSessoes, totalProdutosDesmembrados);
    receitaSessoes -= desmembramentoEfetivo;
    receitaProdutos += desmembramentoEfetivo;
  }

  // Abatimento de estornos na receita bruta
  const totalReceitasBrutas = receitaSessoes + receitaFotosExtras + receitaProdutos + receitaNaoOperacional;
  const totalReceitas = Math.max(0, totalReceitasBrutas - totalEstornos);

  // Ajuste fino por rubrica para estornos específicos (ex: estorno de galeria)
  let estornosRestantes = totalEstornos;
  const estornosFotosExtras = estornos
    .filter((e) => e.origem === 'gallery' || e.escopo === 'fotos_extras' || e.descricao?.toLowerCase().includes('foto'))
    .reduce((sum, e) => sum + Math.abs(Number(e.valor) || 0), 0);
  if (estornosFotosExtras > 0) {
    receitaFotosExtras = Math.max(0, receitaFotosExtras - estornosFotosExtras);
    estornosRestantes = Math.max(0, estornosRestantes - estornosFotosExtras);
  }
  if (estornosRestantes > 0) {
    receitaSessoes = Math.max(0, receitaSessoes - estornosRestantes);
  }

  // 3. DESPESAS AGRUPADAS
  // Saídas que não sejam estorno (estorno é redução de receita)
  const saidasDespesas = linhasEfetivas.filter(
    (l) =>
      l.tipo === 'saida' &&
      l.categoria !== 'Estorno' &&
      l.natureza !== 'estorno' &&
      !l.descricao?.toLowerCase().includes('estorno')
  );

  // Mapear por grupo de despesa
  const gruposMap: Record<string, Record<string, number>> = {};

  saidasDespesas.forEach((l) => {
    let grupo = l.categoria;
    if (!grupo || grupo === 'Despesas de Gateway') {
      grupo = 'Taxas de Gateway';
    }

    if (!gruposMap[grupo]) {
      gruposMap[grupo] = {};
    }

    const itemNome = l.descricao || l.categoria || 'Despesa';
    gruposMap[grupo][itemNome] = (gruposMap[grupo][itemNome] || 0) + Math.abs(Number(l.valor) || 0);
  });

  // Ordem canônica dos grupos conhecidos, seguida de qualquer grupo personalizado
  const ordemPadrao: string[] = [...GRUPOS_DESPESAS, 'Taxas de Gateway'];
  const todosGrupos = Array.from(new Set([...ordemPadrao, ...Object.keys(gruposMap)]));

  const categorias: Array<{
    grupo: string;
    itens: Array<{ nome: string; valor: number }>;
    total: number;
  }> = [];

  todosGrupos.forEach((grupo) => {
    const itensObj = gruposMap[grupo];
    if (!itensObj) return;

    const itens = Object.entries(itensObj)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);

    const total = itens.reduce((sum, it) => sum + it.valor, 0);
    if (total > 0) {
      categorias.push({ grupo, itens, total });
    }
  });

  const totalDespesas = categorias.reduce((sum, cat) => sum + cat.total, 0);
  const resultadoLiquido = totalReceitas - totalDespesas;
  const margemLiquida = totalReceitas > 0 ? (resultadoLiquido / totalReceitas) * 100 : 0;

  return {
    receitas: {
      sessoes: receitaSessoes,
      fotosExtras: receitaFotosExtras,
      produtos: receitaProdutos,
      naoOperacionais: receitaNaoOperacional,
      totalReceitas,
    },
    despesas: { categorias, totalDespesas },
    resumoFinal: {
      receitaTotal: totalReceitas,
      despesaTotal: totalDespesas,
      resultadoLiquido,
      margemLiquida,
    },
  };
}

export async function fetchDemonstrativo(
  dataInicio: string,
  dataFim: string,
  regime: RegimeContabil = 'caixa'
): Promise<DemonstrativoSimplificado> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const dataColumn = regime === 'competencia' ? 'data_competencia' : 'data';

  let query = supabase
    .from('extrato_unificado')
    .select('tipo, origem, categoria, descricao, valor, status, escopo, natureza, session_id')
    .eq('user_id', user.id)
    .gte(dataColumn, dataInicio)
    .lte(dataColumn, dataFim);

  if (regime === 'caixa') {
    query = query.eq('status', 'Pago');
  } else {
    query = query.in('status', ['Pago', 'Faturado']);
  }

  const [extratoRes, sessoesProds] = await Promise.all([
    query,
    fetchSessoesProdutos(dataInicio, dataFim),
  ]);

  if (extratoRes.error) throw extratoRes.error;

  return calcularDemonstrativoDeLinhas(extratoRes.data || [], regime, sessoesProds);
}

export function useDemonstrativoFinanceiro(
  dataInicio: string,
  dataFim: string,
  regime: RegimeContabil = 'caixa',
  enabled = true
) {
  const { data, isLoading } = useQuery({
    queryKey: ['demonstrativo-financeiro-v5', regime, dataInicio, dataFim],
    queryFn: () => fetchDemonstrativo(dataInicio, dataFim, regime),
    enabled: enabled && !!dataInicio && !!dataFim,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  return {
    demonstrativo: data || DEMONSTRATIVO_VAZIO,
    isLoading,
  };
}

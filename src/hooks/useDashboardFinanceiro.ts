import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { FinancialEngine } from '@/services/FinancialEngine';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { useWorkflowMetrics } from '@/hooks/useWorkflowMetrics';
import { getCurrentDateString, parseDateFromStorage } from '@/utils/dateUtils';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

// Interfaces específicas para o Dashboard
interface KPIsData {
  totalReceita: number;
  valorPrevisto: number;
  aReceber: number;
  totalDespesas: number;
  totalLucro: number;
  saldoTotal: number;
}

interface MetasData {
  metaReceita: number;
  metaLucro: number;
  receitaAtual: number;
  lucroAtual: number;
}

interface DadosMensais {
  mes: string;
  receita: number;
  lucro: number;
}

interface CategoriaGasto {
  categoria: string;
  valor: number;
}

interface EvolucaoCategoria {
  mes: string;
  valor: number;
}

interface ComposicaoDespesas {
  grupo: string;
  valor: number;
  percentual: number;
}

interface HistoricalGoal {
  ano: number;
  metaFaturamento: number;
  metaLucro: number;
  dataCriacao: string;
  margemLucroDesejada: number;
}

export function useDashboardFinanceiro() {
  // ============= FUNÇÕES DE TRANSFORMAÇÃO DE DADOS =============
  
  // Função para converter valores monetários formatados para números
  const parseMonetaryValue = (value: string | number): number => {
    if (typeof value === 'number') return value;
    if (!value || typeof value !== 'string') return 0;
    
    // Remove "R$", espaços, pontos (milhares) e substitui vírgula por ponto
    const cleanValue = value
      .replace(/R\$\s*/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  };

  // ============= CARREGAMENTO DE DADOS SIMPLIFICADO =============
  
  // Usar cache de métricas do workflow ao invés de recalcular
  const { getMonthlyMetrics, getAnnualMetrics, getAvailableYears } = useWorkflowMetrics();

  // Carregar transações financeiras do localStorage
  const { itensFinanceiros } = useNovoFinancas();
  const transacoesFinanceiras = useMemo(() => {
    return FinancialEngine.loadTransactions();
  }, []);

  // Criar mapeamento de transações com dados dos itens financeiros
  const transacoesComItens = useMemo(() => {
    return transacoesFinanceiras.map(transacao => {
      const item = itensFinanceiros.find(item => item.id === transacao.itemId);
      return {
        ...transacao,
        valor: parseMonetaryValue(transacao.valor),
        item: item || null
      };
    });
  }, [transacoesFinanceiras, itensFinanceiros]);

  // ============= NOVO SISTEMA DE FILTROS =============

  // Seletor de ano dinâmico - usar anos disponíveis do cache de métricas + transações
  const anosDisponiveis = useMemo(() => {
    const anosWorkflow = getAvailableYears();
    const anosTransacoes = new Set<number>();
    
    // Extrair anos das transações financeiras
    transacoesFinanceiras.forEach(transacao => {
      if (!transacao.dataVencimento || typeof transacao.dataVencimento !== 'string') {
        return;
      }
      const ano = parseInt(transacao.dataVencimento.split('-')[0]);
      if (!isNaN(ano)) {
        anosTransacoes.add(ano);
      }
    });
    
    // Combinar anos únicos e ordenar
    const todosAnos = new Set([...anosWorkflow, ...anosTransacoes]);
    
    if (todosAnos.size === 0) {
      todosAnos.add(new Date().getFullYear());
    }
    
    return Array.from(todosAnos).sort((a, b) => b - a);
  }, [getAvailableYears, transacoesFinanceiras]);

  // Estados dos filtros
  const [anoSelecionado, setAnoSelecionado] = useState(() => {
    return anosDisponiveis[0]?.toString() || new Date().getFullYear().toString();
  });

  const [mesSelecionado, setMesSelecionado] = useState<string>('ano-completo'); // 'ano-completo' = Ano Completo

  // ============= FILTROS POR PERÍODO =============

  const transacoesFiltradas = useMemo(() => {
    const ano = parseInt(anoSelecionado);
    let filtradas = transacoesComItens.filter(transacao => {
      if (!transacao.dataVencimento || typeof transacao.dataVencimento !== 'string') {
        return false;
      }
      const anoTransacao = parseInt(transacao.dataVencimento.split('-')[0]);
      return anoTransacao === ano;
    });

    // Aplicar filtro de mês se selecionado
    if (mesSelecionado && mesSelecionado !== 'ano-completo') {
      const mesNumero = parseInt(mesSelecionado);
      filtradas = filtradas.filter(transacao => {
        if (!transacao.dataVencimento || typeof transacao.dataVencimento !== 'string') {
          return false;
        }
        const mesTransacao = parseInt(transacao.dataVencimento.split('-')[1]);
        return mesTransacao === mesNumero;
      });
    }

    return filtradas;
  }, [transacoesComItens, anoSelecionado, mesSelecionado]);

  // ============= CÁLCULOS DE MÉTRICAS =============
  
  const kpisData = useMemo((): KPIsData => {
    const ano = parseInt(anoSelecionado);
    
    // ============= USAR CACHE DE MÉTRICAS DO WORKFLOW =============
    let receitaOperacional = 0;
    let valorPrevisto = 0;
    let aReceber = 0;
    
    if (mesSelecionado && mesSelecionado !== 'ano-completo') {
      // Buscar métricas do mês específico
      const mesNumero = parseInt(mesSelecionado);
      const metricas = getMonthlyMetrics(ano, mesNumero);
      if (metricas) {
        receitaOperacional = metricas.receita;
        valorPrevisto = metricas.previsto;
        aReceber = metricas.aReceber;
      }
    } else {
      // Buscar métricas anuais (soma de todos os meses)
      const metricas = getAnnualMetrics(ano);
      receitaOperacional = metricas.receita;
      valorPrevisto = metricas.previsto;
      aReceber = metricas.aReceber;
    }
    
    // ============= RECEITAS EXTRAS DAS TRANSAÇÕES =============
    const receitasExtras = transacoesFiltradas
      .filter(t => t.status === 'Pago' && t.item?.grupo_principal === 'Receita Não Operacional')
      .reduce((sum, t) => sum + t.valor, 0);

    const totalReceita = receitaOperacional + receitasExtras;

    // ============= DESPESAS DAS TRANSAÇÕES =============
    const totalDespesas = transacoesFiltradas
      .filter(t => t.status === 'Pago' && t.item && ['Despesa Fixa', 'Despesa Variável', 'Investimento'].includes(t.item.grupo_principal))
      .reduce((sum, t) => sum + t.valor, 0);

    // ============= CÁLCULOS FINAIS =============
    const totalLucro = totalReceita - totalDespesas;
    const saldoTotal = totalLucro;

    return {
      totalReceita,
      valorPrevisto,
      aReceber,
      totalDespesas,
      totalLucro,
      saldoTotal
    };
  }, [anoSelecionado, mesSelecionado, getMonthlyMetrics, getAnnualMetrics, transacoesFiltradas]);

  // ============= CÁLCULOS ESPECÍFICOS PARA ROI =============
  
  const roiData = useMemo(() => {
    // Despesas de investimento (somente)
    const totalInvestimento = transacoesFiltradas
      .filter(t => t.status === 'Pago' && t.item?.grupo_principal === 'Investimento')
      .reduce((sum, t) => sum + t.valor, 0);

    // ROI = (Lucro Total / Despesas de Investimento) * 100
    const roi = totalInvestimento > 0 ? (kpisData.totalLucro / totalInvestimento) * 100 : 0;

    return {
      totalInvestimento,
      roi: Math.max(0, roi) // Garante que não seja negativo
    };
  }, [transacoesFiltradas, kpisData.totalLucro]);

  // ============= METAS HISTÓRICAS =============
  
  const metasData = useMemo((): MetasData => {
    const anoSelecionadoNum = parseInt(anoSelecionado);
    
    // Carregar metas históricas
    const historicalGoals: HistoricalGoal[] = storage.load(STORAGE_KEYS.HISTORICAL_GOALS, []);
    
    // Buscar meta específica para o ano selecionado
    const metaDoAno = historicalGoals.find(goal => goal.ano === anoSelecionadoNum);
    
    let metaReceita = 100000; // Meta padrão
    let metaLucro = 30000; // Meta padrão
    
    if (metaDoAno) {
      metaReceita = metaDoAno.metaFaturamento;
      metaLucro = metaDoAno.metaLucro;
    } else {
      // Fallback: usar cálculo atual da precificação se não há meta histórica
      const metasPrecificacao = storage.load('precificacao_metas', {
        margemLucroDesejada: 30
      });
      
      const custosFixosData = storage.load('precificacao_custos_fixos', {
        gastosPessoais: [],
        percentualProLabore: 30,
        custosEstudio: [],
        equipamentos: []
      });
      
      // Calcular custos fixos totais mensais
      const totalGastosPessoais = custosFixosData.gastosPessoais.reduce((sum: number, item: any) => sum + (item.valor || 0), 0);
      const proLaboreCalculado = totalGastosPessoais * (1 + custosFixosData.percentualProLabore / 100);
      const totalCustosEstudio = custosFixosData.custosEstudio.reduce((sum: number, item: any) => sum + (item.valor || 0), 0);
      const totalDepreciacaoMensal = custosFixosData.equipamentos.reduce((sum: number, eq: any) => {
        const depreciacaoMensal = eq.valorPago / (eq.vidaUtil * 12);
        return sum + depreciacaoMensal;
      }, 0);
      
      const custosFixosMensais = proLaboreCalculado + totalCustosEstudio + totalDepreciacaoMensal;
      
      if (custosFixosMensais > 0) {
        const faturamentoMinimoAnual = custosFixosMensais * 12;
        metaReceita = faturamentoMinimoAnual / (1 - metasPrecificacao.margemLucroDesejada / 100);
        metaLucro = metaReceita - faturamentoMinimoAnual;
      }
    }
    
    // Ajustar metas se filtro de mês específico estiver ativo
    if (mesSelecionado && mesSelecionado !== 'ano-completo') {
      metaReceita = metaReceita / 12; // Meta proporcional do mês
      metaLucro = metaLucro / 12; // Meta proporcional do mês
    }
    
    return {
      metaReceita,
      metaLucro,
      receitaAtual: kpisData.totalReceita,
      lucroAtual: kpisData.totalLucro
    };
  }, [kpisData, anoSelecionado, mesSelecionado]);

  // ============= DADOS PARA GRÁFICOS =============
  
  const dadosMensais = useMemo((): DadosMensais[] => {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const dadosPorMes: Record<number, { receita: number; despesas: number }> = {};

    // Inicializar todos os meses
    for (let i = 1; i <= 12; i++) {
      dadosPorMes[i] = { receita: 0, despesas: 0 };
    }

    // Dados apenas para o ano selecionado (ignorar filtro de mês aqui)
    const ano = parseInt(anoSelecionado);
    
    // Buscar receitas operacionais por mês usando cache de métricas
    for (let mes = 1; mes <= 12; mes++) {
      const metricas = getMonthlyMetrics(ano, mes);
      if (metricas) {
        dadosPorMes[mes].receita += metricas.receita;
      }
    }
    
    const transacoesDoAno = transacoesComItens.filter(transacao => {
      if (!transacao.dataVencimento || typeof transacao.dataVencimento !== 'string') {
        return false;
      }
      const anoTransacao = parseInt(transacao.dataVencimento.split('-')[0]);
      return anoTransacao === ano;
    });

    // Agregar transações por mês
    transacoesDoAno.filter(t => t.status === 'Pago').forEach(transacao => {
      if (!transacao.dataVencimento || typeof transacao.dataVencimento !== 'string') {
        return;
      }
      const mes = parseInt(transacao.dataVencimento.split('-')[1]);
      
      if (transacao.item?.grupo_principal === 'Receita Não Operacional') {
        dadosPorMes[mes].receita += transacao.valor;
      } else if (transacao.item && ['Despesa Fixa', 'Despesa Variável', 'Investimento'].includes(transacao.item.grupo_principal)) {
        dadosPorMes[mes].despesas += transacao.valor;
      }
    });

    return meses.map((nome, index) => {
      const dadosMes = dadosPorMes[index + 1];
      return {
        mes: nome,
        receita: dadosMes.receita,
        lucro: dadosMes.receita - dadosMes.despesas
      };
    });
  }, [anoSelecionado, transacoesComItens, getMonthlyMetrics]);

  // ============= COMPOSIÇÃO DE DESPESAS =============
  
  const composicaoDespesas = useMemo((): ComposicaoDespesas[] => {
    const grupos: Record<string, number> = {
      'Despesas Fixas': 0,
      'Despesas Variáveis': 0,
      'Investimentos': 0
    };

    transacoesFiltradas
      .filter(t => t.status === 'Pago' && t.item)
      .forEach(transacao => {
        if (transacao.item?.grupo_principal === 'Despesa Fixa') {
          grupos['Despesas Fixas'] += transacao.valor;
        } else if (transacao.item?.grupo_principal === 'Despesa Variável') {
          grupos['Despesas Variáveis'] += transacao.valor;
        } else if (transacao.item?.grupo_principal === 'Investimento') {
          grupos['Investimentos'] += transacao.valor;
        }
      });

    const totalDespesas = Object.values(grupos).reduce((sum, valor) => sum + valor, 0);

    return Object.entries(grupos)
      .filter(([_, valor]) => valor > 0)
      .map(([grupo, valor]) => ({
        grupo,
        valor,
        percentual: totalDespesas > 0 ? (valor / totalDespesas) * 100 : 0
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [transacoesFiltradas]);

  // ============= EVOLUÇÃO DE CATEGORIA ESPECÍFICA =============
  
  const categoriasDisponiveis = useMemo(() => {
    const categorias = new Set<string>();
    
    // Usar transações do ano inteiro (não filtradas por mês) para ter todas as categorias
    const ano = parseInt(anoSelecionado);
    const transacoesDoAno = transacoesComItens.filter(transacao => {
      if (!transacao.dataVencimento || typeof transacao.dataVencimento !== 'string') {
        return false;
      }
      const anoTransacao = parseInt(transacao.dataVencimento.split('-')[0]);
      return anoTransacao === ano;
    });
    
    transacoesDoAno.forEach(transacao => {
      if (transacao.item?.nome) {
        categorias.add(transacao.item.nome);
      }
    });

    const categoriasArray = Array.from(categorias);
    return categoriasArray.length > 0 ? categoriasArray : ['Aluguel'];
  }, [transacoesComItens, anoSelecionado]);

  const [categoriaSelecionada, setCategoriaSelecionada] = useState(() => 
    categoriasDisponiveis[0] || 'Aluguel'
  );

  const evolucaoCategoria = useMemo((): Record<string, EvolucaoCategoria[]> => {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const evolucoes: Record<string, EvolucaoCategoria[]> = {};

    // Usar transações do ano inteiro para gráfico de evolução
    const ano = parseInt(anoSelecionado);
    const transacoesDoAno = transacoesComItens.filter(transacao => {
      if (!transacao.dataVencimento || typeof transacao.dataVencimento !== 'string') {
        return false;
      }
      const anoTransacao = parseInt(transacao.dataVencimento.split('-')[0]);
      return anoTransacao === ano;
    });

    categoriasDisponiveis.forEach(categoria => {
      const dadosPorMes: Record<number, number> = {};
      
      // Inicializar todos os meses
      for (let i = 1; i <= 12; i++) {
        dadosPorMes[i] = 0;
      }

      // Agregar dados por mês para esta categoria
      transacoesDoAno
        .filter(t => t.status === 'Pago' && t.item?.nome === categoria)
        .forEach(transacao => {
          if (!transacao.dataVencimento || typeof transacao.dataVencimento !== 'string') {
            return;
          }
          const mes = parseInt(transacao.dataVencimento.split('-')[1]);
          if (!isNaN(mes) && mes >= 1 && mes <= 12) {
            dadosPorMes[mes] += transacao.valor;
          }
        });

      evolucoes[categoria] = meses.map((nome, index) => ({
        mes: nome,
        valor: dadosPorMes[index + 1]
      }));
    });

    return evolucoes;
  }, [transacoesComItens, categoriasDisponiveis, anoSelecionado]);

  // ============= FUNÇÕES AUXILIARES =============
  
  const getNomeMes = (numeroMes: string) => {
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const numero = parseInt(numeroMes);
    return meses[numero - 1] || '';
  };

  const getNomeMesCurto = (numeroMes: string) => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
                   'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const numero = parseInt(numeroMes);
    return meses[numero - 1] || '';
  };

  // Função para excluir meta anual
  const excluirMetaAnual = useCallback(() => {
    const anoSelecionadoNum = parseInt(anoSelecionado);
    const historicalGoals: HistoricalGoal[] = storage.load(STORAGE_KEYS.HISTORICAL_GOALS, []);
    
    // Remover meta do ano selecionado
    const novasMetasHistoricas = historicalGoals.filter(goal => goal.ano !== anoSelecionadoNum);
    
    // Salvar no localStorage
    storage.save(STORAGE_KEYS.HISTORICAL_GOALS, novasMetasHistoricas);
  }, [anoSelecionado]);

  // ============= DEBUG (OTIMIZADO) =============
  
  // ✅ CORREÇÃO: Remover useEffect de debug que causava loop infinito
  // useEffect(() => {
  //   console.log('🔍 Dashboard Debug (REFATORADO):', {
  //     anoSelecionado,
  //     mesSelecionado,
  //     anosDisponiveis,
  //     workflowItemsFiltrados: workflowItemsFiltrados.length,
  //     transacoesFiltradas: transacoesFiltradas.length,
  //     kpisData,
  //     metasData
  //   });
  // }, [anoSelecionado, mesSelecionado, anosDisponiveis, workflowItemsFiltrados, transacoesFiltradas, kpisData, metasData]);

  // ============= RETORNO DO HOOK =============
  
  return {
    // Estados dos filtros
    anoSelecionado,
    setAnoSelecionado,
    mesSelecionado,
    setMesSelecionado,
    anosDisponiveis,
    categoriaSelecionada,
    setCategoriaSelecionada,
    categoriasDisponiveis,
    
    // Dados calculados
    kpisData,
    metasData,
    dadosMensais,
    evolucaoCategoria,
    composicaoDespesas,
    roiData,
    
    // Funções auxiliares
    getNomeMes,
    getNomeMesCurto,
    excluirMetaAnual,
    
    // Dados filtrados
    transacoesFiltradas
  };
}
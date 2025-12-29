import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAppContext } from '@/contexts/AppContext';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { useWorkflowMetrics } from '@/hooks/useWorkflowMetrics';
import { useWorkflowMetricsRealtime } from '@/hooks/useWorkflowMetricsRealtime';
import { useWorkflowMetricsByYear } from '@/hooks/useWorkflowMetricsByYear';
import { getCurrentDateString, parseDateFromStorage } from '@/utils/dateUtils';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { GoalsIntegrationService } from '@/services/GoalsIntegrationService';
import { pricingFinancialIntegrationService } from '@/services/PricingFinancialIntegrationService';
import { EQUIPMENT_SYNC_EVENT, EQUIPMENT_FORCE_SCAN_EVENT } from '@/hooks/useEquipmentSync';

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

interface TransacaoComItem {
  id: string;
  itemId: string;
  valor: number;
  dataVencimento: string;
  status: string;
  observacoes?: string;
  item?: {
    id: string;
    nome: string;
    grupo_principal: string;
  } | null;
}

export function useDashboardFinanceiro() {
  // Estados para modal de equipamentos
  const [equipmentModalOpen, setEquipmentModalOpen] = useState(false);
  const [equipmentData, setEquipmentData] = useState<{
    nome: string;
    valor: number;
    data: string;
    allTransactionIds: string[];
  } | null>(null);
  
  // Estado para forçar recálculo quando cache for atualizado
  const [cacheVersion, setCacheVersion] = useState(0);

  // Listener para equipamentos detectados + cache updates
  useEffect(() => {
    const handleEquipmentDetected = (event: CustomEvent) => {
      const candidate = event.detail;
      console.log('🔧 [Dashboard] Equipamento detectado:', candidate);
      
      setEquipmentData({
        nome: candidate.observacoes || candidate.nome,
        valor: candidate.valor,
        data: candidate.data,
        allTransactionIds: candidate.allTransactionIds || [candidate.transacaoId]
      });
      setEquipmentModalOpen(true);
    };

    const handleCacheUpdate = () => {
      console.log('📊 [Dashboard] Cache do workflow foi atualizado, recalculando...');
      setCacheVersion(prev => prev + 1);
    };

    window.addEventListener(EQUIPMENT_SYNC_EVENT, handleEquipmentDetected as EventListener);
    window.addEventListener('workflowMetricsUpdated', handleCacheUpdate);
    window.addEventListener('workflowCacheRecalculated', handleCacheUpdate);
    
    return () => {
      window.removeEventListener(EQUIPMENT_SYNC_EVENT, handleEquipmentDetected as EventListener);
      window.removeEventListener('workflowMetricsUpdated', handleCacheUpdate);
      window.removeEventListener('workflowCacheRecalculated', handleCacheUpdate);
    };
  }, []);

  const handleEquipmentModalClose = useCallback(() => {
    if (equipmentData?.allTransactionIds) {
      pricingFinancialIntegrationService.markEquipmentTransactionsAsProcessed(
        equipmentData.allTransactionIds
      );
    }
    setEquipmentModalOpen(false);
    setEquipmentData(null);
  }, [equipmentData]);

  const triggerEquipmentScan = useCallback(() => {
    const event = new CustomEvent(EQUIPMENT_FORCE_SCAN_EVENT);
    window.dispatchEvent(event);
  }, []);

  // ============= FUNÇÕES DE TRANSFORMAÇÃO DE DADOS =============
  
  const parseMonetaryValue = (value: string | number): number => {
    if (typeof value === 'number') return value;
    if (!value || typeof value !== 'string') return 0;
    
    const cleanValue = value
      .replace(/R\$\s*/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  };

  // ============= CARREGAMENTO DE DADOS =============
  
  const { getAvailableYears } = useWorkflowMetrics();
  const { itensFinanceiros, transacoes: transacoesFinanceiras } = useNovoFinancas();

  // Criar Maps para lookup O(1)
  const itensMap = useMemo(() => {
    return new Map(itensFinanceiros.map(item => [item.id, item]));
  }, [itensFinanceiros]);

  // ============= NOVO SISTEMA DE FILTROS =============

  const anosDisponiveis = useMemo(() => {
    const anosWorkflow = getAvailableYears();
    const anosTransacoes = new Set<number>();
    
    transacoesFinanceiras.forEach(transacao => {
      if (!transacao.dataVencimento || typeof transacao.dataVencimento !== 'string') {
        return;
      }
      const ano = parseInt(transacao.dataVencimento.split('-')[0]);
      if (!isNaN(ano)) {
        anosTransacoes.add(ano);
      }
    });
    
    const todosAnos = new Set([...anosWorkflow, ...anosTransacoes]);
    
    if (todosAnos.size === 0) {
      todosAnos.add(new Date().getFullYear());
    }
    
    return Array.from(todosAnos).sort((a, b) => b - a);
  }, [getAvailableYears, transacoesFinanceiras]);

  const [anoSelecionado, setAnoSelecionado] = useState(() => {
    return anosDisponiveis[0]?.toString() || new Date().getFullYear().toString();
  });

  const [mesSelecionado, setMesSelecionado] = useState<string>('ano-completo');

  // ============= QUERY DEDICADA PARA TRANSAÇÕES DO ANO (DASHBOARD) =============
  
  const ano = parseInt(anoSelecionado);
  const mesNumero = mesSelecionado !== 'ano-completo' ? parseInt(mesSelecionado) : undefined;

  // Query dedicada para transações do ano inteiro (independente do filtro de mês das abas)
  const { data: transacoesDoAno = [] } = useQuery({
    queryKey: ['dashboard-transactions-year', ano],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const startDate = `${ano}-01-01`;
      const endDate = `${ano}-12-31`;
      
      const { data, error } = await supabase
        .from('fin_transactions')
        .select(`
          id,
          item_id,
          valor,
          data_vencimento,
          status,
          observacoes,
          fin_items_master (
            id,
            nome,
            grupo_principal
          )
        `)
        .eq('user_id', user.id)
        .gte('data_vencimento', startDate)
        .lte('data_vencimento', endDate)
        .order('data_vencimento', { ascending: true });
      
      if (error) {
        console.error('Erro ao buscar transações do ano:', error);
        return [];
      }
      
      // Transformar para formato interno
      return (data || []).map(t => ({
        id: t.id,
        itemId: t.item_id,
        valor: t.valor,
        dataVencimento: t.data_vencimento,
        status: t.status,
        observacoes: t.observacoes,
        item: t.fin_items_master ? {
          id: (t.fin_items_master as any).id,
          nome: (t.fin_items_master as any).nome,
          grupo_principal: (t.fin_items_master as any).grupo_principal
        } : null
      })) as TransacaoComItem[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchOnWindowFocus: false
  });

  // ============= MÉTRICAS EM TEMPO REAL DO WORKFLOW =============
  
  // Hook de métricas do workflow por mês (para gráficos anuais)
  const workflowMetricsByYear = useWorkflowMetricsByYear(ano);
  
  // Hook de métricas em tempo real (para KPIs dinâmicos)
  const workflowMetrics = useWorkflowMetricsRealtime(ano, mesNumero);

  // Calcular período anterior para comparação
  const periodoAnterior = useMemo(() => {
    if (mesSelecionado && mesSelecionado !== 'ano-completo') {
      const mesAtual = parseInt(mesSelecionado);
      if (mesAtual === 1) {
        return { ano: ano - 1, mes: 12 };
      } else {
        return { ano, mes: mesAtual - 1 };
      }
    } else {
      return { ano: ano - 1, mes: undefined };
    }
  }, [ano, mesSelecionado]);

  const workflowMetricsAnterior = useWorkflowMetricsRealtime(
    periodoAnterior.ano, 
    periodoAnterior.mes
  );

  // ============= FILTROS POR PERÍODO (PARA KPIs DINÂMICOS) =============

  // Transações filtradas pelo período selecionado (para KPIs)
  const transacoesFiltradasPorPeriodo = useMemo(() => {
    let filtradas = transacoesDoAno;

    // Aplicar filtro de mês se selecionado
    if (mesSelecionado && mesSelecionado !== 'ano-completo') {
      const mesNum = parseInt(mesSelecionado);
      filtradas = filtradas.filter(transacao => {
        if (!transacao.dataVencimento) return false;
        const mesTransacao = parseInt(transacao.dataVencimento.split('-')[1]);
        return mesTransacao === mesNum;
      });
    }

    return filtradas;
  }, [transacoesDoAno, mesSelecionado]);

  // ============= CÁLCULOS DE MÉTRICAS (KPIs DINÂMICOS) =============
  
  const kpisData = useMemo((): KPIsData => {
    // FONTE: Workflow em tempo real (filtrado por período)
    const receitaOperacional = workflowMetrics.receita;
    const valorPrevisto = workflowMetrics.previsto;
    const aReceber = workflowMetrics.aReceber;
    
    // RECEITAS NÃO OPERACIONAIS (filtradas pelo período)
    const receitasExtras = transacoesFiltradasPorPeriodo
      .filter(t => t.status === 'Pago' && t.item?.grupo_principal === 'Receita Não Operacional')
      .reduce((sum, t) => sum + t.valor, 0);

    // TOTAL DE RECEITAS
    const totalReceita = receitaOperacional + receitasExtras;

    // DESPESAS (filtradas pelo período)
    const totalDespesas = transacoesFiltradasPorPeriodo
      .filter(t => t.status === 'Pago' && t.item && ['Despesa Fixa', 'Despesa Variável', 'Investimento'].includes(t.item.grupo_principal))
      .reduce((sum, t) => sum + t.valor, 0);

    // CÁLCULOS FINAIS
    const totalLucro = totalReceita - totalDespesas;
    const saldoTotal = totalLucro;

    console.log(`📊 KPIs (${anoSelecionado}/${mesSelecionado}):`, {
      receitaOperacional: receitaOperacional.toFixed(2),
      receitasExtras: receitasExtras.toFixed(2), 
      totalReceita: totalReceita.toFixed(2),
      totalDespesas: totalDespesas.toFixed(2),
      fonte: 'supabase-realtime + query-anual'
    });

    return {
      totalReceita,
      valorPrevisto,
      aReceber,
      totalDespesas,
      totalLucro,
      saldoTotal
    };
  }, [workflowMetrics, transacoesFiltradasPorPeriodo, anoSelecionado, mesSelecionado]);

  // ============= ROI (SEMPRE DADOS ANUAIS) =============
  
  const roiData = useMemo(() => {
    // Usar transações do ANO INTEIRO (não filtradas por mês)
    const totalInvestimento = transacoesDoAno
      .filter(t => t.status === 'Pago' && t.item?.grupo_principal === 'Investimento')
      .reduce((sum, t) => sum + t.valor, 0);

    // Calcular lucro anual para ROI
    const receitaAnual = workflowMetricsByYear.totalAnual.receita + 
      transacoesDoAno
        .filter(t => t.status === 'Pago' && t.item?.grupo_principal === 'Receita Não Operacional')
        .reduce((sum, t) => sum + t.valor, 0);
    
    const despesasAnuais = transacoesDoAno
      .filter(t => t.status === 'Pago' && t.item && ['Despesa Fixa', 'Despesa Variável', 'Investimento'].includes(t.item.grupo_principal))
      .reduce((sum, t) => sum + t.valor, 0);
    
    const lucroAnual = receitaAnual - despesasAnuais;

    const roi = totalInvestimento > 0 ? (lucroAnual / totalInvestimento) * 100 : 0;

    return {
      totalInvestimento,
      roi: Math.max(0, roi)
    };
  }, [transacoesDoAno, workflowMetricsByYear]);

  // ============= COMPARAÇÕES PERÍODO ANTERIOR =============
  
  const comparisonData = useMemo(() => {
    let labelComparacao = '';
    
    if (mesSelecionado && mesSelecionado !== 'ano-completo') {
      labelComparacao = 'em comparação ao mês anterior';
    } else {
      labelComparacao = 'em comparação ao ano anterior';
    }
    
    let receitaAnterior = workflowMetricsAnterior.receita;
    let despesasAnterior = 0;
    
    // Transações do período anterior (buscar da query de transações do ano)
    const transacoesAnterior = transacoesDoAno.filter(transacao => {
      if (!transacao.dataVencimento) return false;
      const [anoTransacao, mesTransacao] = transacao.dataVencimento.split('-').map(Number);
      
      if (periodoAnterior.mes) {
        return anoTransacao === periodoAnterior.ano && mesTransacao === periodoAnterior.mes;
      } else {
        return anoTransacao === periodoAnterior.ano;
      }
    });
    
    const receitasExtrasAnterior = transacoesAnterior
      .filter(t => t.status === 'Pago' && t.item?.grupo_principal === 'Receita Não Operacional')
      .reduce((sum, t) => sum + t.valor, 0);
    
    receitaAnterior += receitasExtrasAnterior;
    
    despesasAnterior = transacoesAnterior
      .filter(t => t.status === 'Pago' && t.item && ['Despesa Fixa', 'Despesa Variável', 'Investimento'].includes(t.item.grupo_principal))
      .reduce((sum, t) => sum + t.valor, 0);
    
    const lucroAnterior = receitaAnterior - despesasAnterior;
    
    const calcularVariacao = (atual: number, anterior: number): number | null => {
      if (anterior === 0) return atual > 0 ? 100 : null;
      return ((atual - anterior) / anterior) * 100;
    };
    
    return {
      labelComparacao,
      variacaoReceita: calcularVariacao(kpisData.totalReceita, receitaAnterior),
      variacaoLucro: calcularVariacao(kpisData.totalLucro, lucroAnterior),
      variacaoDespesas: calcularVariacao(kpisData.totalDespesas, despesasAnterior)
    };
  }, [anoSelecionado, mesSelecionado, kpisData, transacoesDoAno, workflowMetricsAnterior, periodoAnterior]);

  // ============= METAS =============
  
  const metasData = useMemo((): MetasData => {
    const anoSelecionadoNum = parseInt(anoSelecionado);
    
    const historicalGoals: HistoricalGoal[] = storage.load(STORAGE_KEYS.HISTORICAL_GOALS, []);
    const metaDoAno = historicalGoals.find(goal => goal.ano === anoSelecionadoNum);
    
    let metaReceita = 0;
    let metaLucro = 0;
    
    if (metaDoAno) {
      metaReceita = metaDoAno.metaFaturamento;
      metaLucro = metaDoAno.metaLucro;
    } else {
      try {
        const goalsData = GoalsIntegrationService.getAnnualGoals();
        metaReceita = goalsData.revenue;
        metaLucro = goalsData.profit;
      } catch (error) {
        console.warn('Erro ao carregar metas da precificação:', error);
        metaReceita = 100000;
        metaLucro = 30000;
      }
    }
    
    // Ajustar metas se filtro de mês específico
    if (mesSelecionado && mesSelecionado !== 'ano-completo') {
      metaReceita = metaReceita / 12;
      metaLucro = metaLucro / 12;
    }
    
    return {
      metaReceita,
      metaLucro,
      receitaAtual: kpisData.totalReceita,
      lucroAtual: kpisData.totalLucro
    };
  }, [kpisData, anoSelecionado, mesSelecionado]);

  // ============= DADOS PARA GRÁFICOS (SEMPRE ANUAIS) =============
  
  const dadosMensais = useMemo((): DadosMensais[] => {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const dadosPorMes: Record<number, { receita: number; despesas: number }> = {};

    // Inicializar todos os meses
    for (let i = 1; i <= 12; i++) {
      dadosPorMes[i] = { receita: 0, despesas: 0 };
    }

    // RECEITA OPERACIONAL: usar dados reais por mês do workflow
    workflowMetricsByYear.metricsPorMes.forEach(m => {
      dadosPorMes[m.mes].receita += m.receita;
    });
    
    // RECEITAS NÃO OPERACIONAIS + DESPESAS: usar transações do ano inteiro
    transacoesDoAno.filter(t => t.status === 'Pago').forEach(transacao => {
      if (!transacao.dataVencimento) return;
      const mes = parseInt(transacao.dataVencimento.split('-')[1]);
      
      if (transacao.item?.grupo_principal === 'Receita Não Operacional') {
        dadosPorMes[mes].receita += transacao.valor;
      } else if (transacao.item && ['Despesa Fixa', 'Despesa Variável', 'Investimento'].includes(transacao.item.grupo_principal)) {
        dadosPorMes[mes].despesas += transacao.valor;
      }
    });

    // Se mês específico selecionado, ainda mostrar todos os meses para contexto
    // mas destacar o mês selecionado no componente de gráfico
    return meses.map((nome, index) => {
      const dadosMes = dadosPorMes[index + 1];
      return {
        mes: nome,
        receita: dadosMes.receita,
        lucro: dadosMes.receita - dadosMes.despesas
      };
    });
  }, [workflowMetricsByYear, transacoesDoAno]);

  // ============= COMPOSIÇÃO DE DESPESAS (SEMPRE ANUAL) =============
  
  const composicaoDespesas = useMemo((): ComposicaoDespesas[] => {
    const grupos: Record<string, number> = {
      'Despesas Fixas': 0,
      'Despesas Variáveis': 0,
      'Investimentos': 0
    };

    // Usar transações do ANO INTEIRO (não filtradas por mês)
    transacoesDoAno
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
  }, [transacoesDoAno]);

  // ============= EVOLUÇÃO DE CATEGORIA ESPECÍFICA =============
  
  const categoriasDisponiveis = useMemo(() => {
    const categorias = new Set<string>();
    
    transacoesDoAno.forEach(transacao => {
      if (transacao.item?.nome) {
        categorias.add(transacao.item.nome);
      }
    });

    const categoriasArray = Array.from(categorias);
    return categoriasArray.length > 0 ? categoriasArray : ['Aluguel'];
  }, [transacoesDoAno]);

  const [categoriaSelecionada, setCategoriaSelecionada] = useState(() => 
    categoriasDisponiveis[0] || 'Aluguel'
  );

  const evolucaoCategoria = useMemo((): Record<string, EvolucaoCategoria[]> => {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const evolucoes: Record<string, EvolucaoCategoria[]> = {};

    categoriasDisponiveis.forEach(categoria => {
      const dadosPorMes: Record<number, number> = {};
      
      for (let i = 1; i <= 12; i++) {
        dadosPorMes[i] = 0;
      }

      transacoesDoAno
        .filter(t => t.status === 'Pago' && t.item?.nome === categoria)
        .forEach(transacao => {
          if (!transacao.dataVencimento) return;
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
  }, [transacoesDoAno, categoriasDisponiveis]);

  // ============= DESPESAS POR CATEGORIA DETALHADA =============
  
  const categoriasDetalhadas = useMemo(() => {
    const categoriaMap: Record<string, number> = {};

    // Usar dados anuais para ranking de categorias
    transacoesDoAno
      .filter(t => t.status === 'Pago' && t.item?.nome && 
        ['Despesa Fixa', 'Despesa Variável', 'Investimento'].includes(t.item.grupo_principal || ''))
      .forEach(transacao => {
        const categoria = transacao.item!.nome;
        categoriaMap[categoria] = (categoriaMap[categoria] || 0) + transacao.valor;
      });

    return Object.entries(categoriaMap)
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [transacoesDoAno]);

  // Transações filtradas para exportar (compatibilidade)
  const transacoesFiltradas = transacoesFiltradasPorPeriodo;

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

  const excluirMetaAnual = useCallback(() => {
    const anoSelecionadoNum = parseInt(anoSelecionado);
    const historicalGoals: HistoricalGoal[] = storage.load(STORAGE_KEYS.HISTORICAL_GOALS, []);
    
    const novasMetasHistoricas = historicalGoals.filter(goal => goal.ano !== anoSelecionadoNum);
    
    storage.save(STORAGE_KEYS.HISTORICAL_GOALS, novasMetasHistoricas);
  }, [anoSelecionado]);

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
    comparisonData,
    categoriasDetalhadas,
    
    // Funções auxiliares
    getNomeMes,
    getNomeMesCurto,
    excluirMetaAnual,
    triggerEquipmentScan,
    
    // Dados filtrados
    transacoesFiltradas,
    
    // Estados do modal de equipamentos
    equipmentModalOpen,
    equipmentData,
    handleEquipmentModalClose
  };
}

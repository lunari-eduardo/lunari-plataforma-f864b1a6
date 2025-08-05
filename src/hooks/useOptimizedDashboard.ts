import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { FinancialEngine } from '@/services/FinancialEngine';
import { RevenueCache } from '@/services/RevenueCache';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

// Interfaces otimizadas para cache
interface CachedKPIsData {
  totalReceita: number;
  totalDespesas: number;
  totalLucro: number;
  saldoTotal: number;
  lastCalculated: string;
}

interface CachedMetasData {
  metaReceita: number;
  metaLucro: number;
  receitaAtual: number;
  lucroAtual: number;
}

interface OptimizedDashboardData {
  kpisData: CachedKPIsData;
  metasData: CachedMetasData;
  dadosMensais: Array<{
    mes: string;
    receita: number;
    lucro: number;
  }>;
  composicaoDespesas: Array<{
    grupo: string;
    valor: number;
    percentual: number;
  }>;
  evolucaoCategoria: Record<string, Array<{
    mes: string;
    valor: number;
  }>>;
}

/**
 * Hook otimizado para dashboard financeiro com cache de receitas
 * Preparado para migração Supabase com estruturas compatíveis
 */
export function useOptimizedDashboard() {
  // ============= DADOS PRIMÁRIOS (NÃO-FILTRADOS) =============
  
  const { allWorkflowItems } = useAppContext(); // ✅ Usar dados não-filtrados
  const { itensFinanceiros } = useNovoFinancas();

  // Transações financeiras
  const transacoesFinanceiras = useMemo(() => {
    return FinancialEngine.loadTransactions();
  }, []);

  const transacoesComItens = useMemo(() => {
    return transacoesFinanceiras.map(transacao => {
      const item = itensFinanceiros.find(item => item.id === transacao.itemId);
      return {
        ...transacao,
        item: item || null
      };
    });
  }, [transacoesFinanceiras, itensFinanceiros]);

  // ============= SISTEMA DE FILTROS OTIMIZADO =============
  
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>();
    
    // Anos do workflow (dados não-filtrados)
    allWorkflowItems.forEach(item => {
      try {
        const year = new Date(item.data).getFullYear();
        if (!isNaN(year)) anos.add(year);
      } catch {}
    });
    
    // Anos das transações financeiras
    transacoesFinanceiras.forEach(transacao => {
      if (transacao.dataVencimento && typeof transacao.dataVencimento === 'string') {
        const ano = parseInt(transacao.dataVencimento.split('-')[0]);
        if (!isNaN(ano)) anos.add(ano);
      }
    });
    
    // Anos do cache de receitas
    RevenueCache.getAvailableYears().forEach(year => anos.add(year));
    
    return anos.size === 0 ? [new Date().getFullYear()] : Array.from(anos).sort((a, b) => b - a);
  }, [allWorkflowItems, transacoesFinanceiras]);

  const [anoSelecionado, setAnoSelecionado] = useState(() => {
    return anosDisponiveis[0]?.toString() || new Date().getFullYear().toString();
  });

  const [mesSelecionado, setMesSelecionado] = useState<string>('ano-completo');

  // ============= SISTEMA DE CACHE INTELIGENTE =============
  
  // Função para invalidar e recalcular cache quando dados mudarem
  const invalidateAndRecalculateCache = useCallback((year: number) => {
    console.log(`🔄 Recalculando cache para ano ${year}`);
    RevenueCache.recalculateYearCache(year, allWorkflowItems, transacoesComItens);
  }, [allWorkflowItems, transacoesComItens]);

  // Invalidar cache quando dados mudarem
  useEffect(() => {
    const currentYear = parseInt(anoSelecionado);
    if (!isNaN(currentYear)) {
      // Delay para evitar cálculos excessivos
      const timeoutId = setTimeout(() => {
        invalidateAndRecalculateCache(currentYear);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [anoSelecionado, invalidateAndRecalculateCache]);

  // ============= DADOS FILTRADOS OTIMIZADOS =============
  
  const workflowItemsFiltrados = useMemo(() => {
    const ano = parseInt(anoSelecionado);
    let filtrados = allWorkflowItems.filter(item => {
      try {
        const itemYear = new Date(item.data).getFullYear();
        return itemYear === ano;
      } catch {
        return false;
      }
    });

    if (mesSelecionado && mesSelecionado !== 'ano-completo') {
      const mesNumero = parseInt(mesSelecionado);
      filtrados = filtrados.filter(item => {
        const mesItem = new Date(item.data).getMonth() + 1;
        return mesItem === mesNumero;
      });
    }

    return filtrados;
  }, [allWorkflowItems, anoSelecionado, mesSelecionado]);

  const transacoesFiltradas = useMemo(() => {
    const ano = parseInt(anoSelecionado);
    let filtradas = transacoesComItens.filter(transacao => {
      if (!transacao.dataVencimento || typeof transacao.dataVencimento !== 'string') {
        return false;
      }
      const anoTransacao = parseInt(transacao.dataVencimento.split('-')[0]);
      return anoTransacao === ano;
    });

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

  // ============= CÁLCULOS OTIMIZADOS COM CACHE =============
  
  const kpisData = useMemo((): CachedKPIsData => {
    // Tentar usar cache primeiro
    const ano = parseInt(anoSelecionado);
    
    if (mesSelecionado === 'ano-completo') {
      const yearSummary = RevenueCache.getYearSummary(ano);
      if (yearSummary.mesesComDados > 0) {
        const totalDespesas = transacoesFiltradas
          .filter(t => t.status === 'Pago' && t.item && t.item.grupo_principal !== 'Receita Não Operacional')
          .reduce((sum, t) => sum + t.valor, 0);

        return {
          totalReceita: yearSummary.totalReceita,
          totalDespesas,
          totalLucro: yearSummary.totalReceita - totalDespesas,
          saldoTotal: yearSummary.totalReceita - totalDespesas,
          lastCalculated: new Date().toISOString()
        };
      }
    }

    // Fallback: cálculo em tempo real
    const receitaOperacional = workflowItemsFiltrados.reduce((sum, item) => sum + item.valorPago, 0);
    const receitasExtras = transacoesFiltradas
      .filter(t => t.status === 'Pago' && t.item?.grupo_principal === 'Receita Não Operacional')
      .reduce((sum, t) => sum + t.valor, 0);
    const totalReceita = receitaOperacional + receitasExtras;
    const totalDespesas = transacoesFiltradas
      .filter(t => t.status === 'Pago' && t.item && t.item.grupo_principal !== 'Receita Não Operacional')
      .reduce((sum, t) => sum + t.valor, 0);

    return {
      totalReceita,
      totalDespesas,
      totalLucro: totalReceita - totalDespesas,
      saldoTotal: totalReceita - totalDespesas,
      lastCalculated: new Date().toISOString()
    };
  }, [workflowItemsFiltrados, transacoesFiltradas, anoSelecionado, mesSelecionado]);

  // ============= METAS OTIMIZADAS =============
  
  const metasData = useMemo((): CachedMetasData => {
    const anoSelecionadoNum = parseInt(anoSelecionado);
    
    // Carregar metas históricas
    const historicalGoals = storage.load(STORAGE_KEYS.HISTORICAL_GOALS, []);
    const metaDoAno = historicalGoals.find((goal: any) => goal.ano === anoSelecionadoNum);
    
    let metaReceita = 100000;
    let metaLucro = 30000;
    
    if (metaDoAno) {
      metaReceita = metaDoAno.metaFaturamento;
      metaLucro = metaDoAno.metaLucro;
    }
    
    // Ajustar metas para mês específico
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

  // ============= DADOS PARA GRÁFICOS (OTIMIZADOS) =============
  
  const dadosMensais = useMemo(() => {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const ano = parseInt(anoSelecionado);
    
    return meses.map((nome, index) => {
      const month = index + 1;
      const cachedData = RevenueCache.getMonthlyRevenue(ano, month);
      
      if (cachedData) {
        // Usar dados do cache
        return {
          mes: nome,
          receita: cachedData.totalReceita,
          lucro: cachedData.totalReceita - (cachedData as any).totalDespesas || 0
        };
      }
      
      // Fallback: cálculo em tempo real
      const workflowMes = allWorkflowItems
        .filter(item => {
          try {
            const itemDate = new Date(item.data);
            return itemDate.getFullYear() === ano && itemDate.getMonth() + 1 === month;
          } catch {
            return false;
          }
        })
        .reduce((sum, item) => sum + item.valorPago, 0);

      return {
        mes: nome,
        receita: workflowMes,
        lucro: workflowMes // Simplificado para performance
      };
    });
  }, [allWorkflowItems, anoSelecionado]);

  // ============= CATEGORIAS E EVOLUÇÃO =============
  
  const categoriasDisponiveis = useMemo(() => {
    const categorias = new Set<string>();
    const ano = parseInt(anoSelecionado);
    
    transacoesComItens
      .filter(t => {
        if (!t.dataVencimento || typeof t.dataVencimento !== 'string') return false;
        const anoTransacao = parseInt(t.dataVencimento.split('-')[0]);
        return anoTransacao === ano;
      })
      .forEach(transacao => {
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

  // ============= FUNÇÕES AUXILIARES =============
  
  const getNomeMes = (numeroMes: string) => {
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const numero = parseInt(numeroMes);
    return meses[numero - 1] || '';
  };

  const clearAllCache = useCallback(() => {
    RevenueCache.clearCache();
    console.log('🗑️ Cache de receitas limpo');
  }, []);

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
    
    // Dados calculados (otimizados)
    kpisData,
    metasData,
    dadosMensais,
    
    // Funções auxiliares
    getNomeMes,
    clearAllCache,
    invalidateAndRecalculateCache,
    
    // Dados filtrados
    workflowItemsFiltrados,
    transacoesFiltradas,
    
    // Status do cache
    cacheStatus: {
      isUsingCache: true,
      lastUpdated: kpisData.lastCalculated
    }
  };
}
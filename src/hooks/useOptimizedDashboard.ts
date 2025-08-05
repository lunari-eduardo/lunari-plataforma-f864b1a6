import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { FinancialEngine } from '@/services/FinancialEngine';
import { SimpleRevenueCalculator } from '@/services/SimpleRevenueCalculator';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

// Interfaces simplificadas
interface KPIsData {
  totalReceita: number;
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

/**
 * Hook simplificado para dashboard financeiro
 * Usa dados não-filtrados do AppContext diretamente
 */
export function useOptimizedDashboard() {
  // ============= DADOS PRIMÁRIOS (NÃO-FILTRADOS) =============
  
  const { projetos } = useAppContext(); // ✅ CORREÇÃO: Usar dados RAW diretamente
  
  // Debug: Log dos dados não-filtrados
  console.log(`🔍 [useOptimizedDashboard] Total projetos RAW: ${projetos.length}`);
  
  // ✅ DEBUG CRÍTICO: Verificar integridade dos dados recebidos
  useEffect(() => {
    if (projetos.length > 0) {
      SimpleRevenueCalculator.debugReceitas(projetos);
    }
  }, [projetos]);
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

  // ============= SISTEMA DE FILTROS SIMPLIFICADO =============
  
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>();
    
    // ✅ CORREÇÃO: Anos dos projetos (dados RAW não-filtrados)
    projetos.forEach(projeto => {
      try {
        const year = projeto.dataAgendada.getFullYear();
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
    
    return anos.size === 0 ? [new Date().getFullYear()] : Array.from(anos).sort((a, b) => b - a);
  }, [projetos, transacoesFinanceiras]);

  const [anoSelecionado, setAnoSelecionado] = useState(() => {
    return anosDisponiveis[0]?.toString() || new Date().getFullYear().toString();
  });

  const [mesSelecionado, setMesSelecionado] = useState<string>('ano-completo');

  // ============= DADOS FILTRADOS SIMPLIFICADOS =============
  
  // ✅ CORREÇÃO: Filtrar projetos diretamente (não mais WorkflowItems)
  const projetosFiltrados = useMemo(() => {
    const ano = parseInt(anoSelecionado);
    let filtrados = projetos.filter(projeto => {
      try {
        const projetoYear = projeto.dataAgendada.getFullYear();
        return projetoYear === ano;
      } catch {
        return false;
      }
    });

    if (mesSelecionado && mesSelecionado !== 'ano-completo') {
      const mesNumero = parseInt(mesSelecionado);
      filtrados = filtrados.filter(projeto => {
        try {
          const mesProjeto = projeto.dataAgendada.getMonth() + 1;
          return mesProjeto === mesNumero;
        } catch {
          return false;
        }
      });
    }

    return filtrados;
  }, [projetos, anoSelecionado, mesSelecionado]);

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

  // ============= CÁLCULOS SIMPLIFICADOS (DIRETOS) =============
  
  const kpisData = useMemo((): KPIsData => {
    // ✅ CORREÇÃO FINAL: Usar projetos RAW com SimpleRevenueCalculator
    const filtros = {
      year: parseInt(anoSelecionado),
      ...(mesSelecionado !== 'ano-completo' && { month: parseInt(mesSelecionado) })
    };

    // ✅ RECEITA OPERACIONAL: Soma de todos os valorPago dos projetos filtrados
    const receitaOperacional = SimpleRevenueCalculator.calcularReceita(projetos, filtros);
    
    // Debug para verificar cálculo
    console.log(`💰 [useOptimizedDashboard] Receita operacional calculada: R$ ${receitaOperacional.toFixed(2)}`);
    
    // ✅ RECEITAS EXTRAS: Transações de "Receita Não Operacional"
    const receitasExtras = transacoesFiltradas
      .filter(t => t.status === 'Pago' && t.item?.grupo_principal === 'Receita Não Operacional')
      .reduce((sum, t) => sum + t.valor, 0);
      
    // ✅ TOTAL RECEITA: Fórmula correta conforme especificação
    const totalReceita = receitaOperacional + receitasExtras;
    
    // ✅ DESPESAS: Todas as transações pagas que não são receitas
    const totalDespesas = transacoesFiltradas
      .filter(t => t.status === 'Pago' && t.item && t.item.grupo_principal !== 'Receita Não Operacional')
      .reduce((sum, t) => sum + t.valor, 0);

    console.log(`🔍 [useOptimizedDashboard] KPIs calculados - Receita Op.: R$ ${receitaOperacional.toFixed(2)}, Receitas Extra: R$ ${receitasExtras.toFixed(2)}, Total: R$ ${totalReceita.toFixed(2)}`);

    return {
      totalReceita,
      totalDespesas,
      totalLucro: totalReceita - totalDespesas,
      saldoTotal: totalReceita - totalDespesas
    };
  }, [projetos, transacoesFiltradas, anoSelecionado, mesSelecionado]);

  // ============= METAS SIMPLIFICADAS =============
  
  const metasData = useMemo((): MetasData => {
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

  // ============= DADOS PARA GRÁFICOS (SIMPLIFICADOS) =============
  
  const dadosMensais = useMemo(() => {
    const ano = parseInt(anoSelecionado);
    
    // ✅ CORREÇÃO FINAL: Usar projetos RAW para gráficos mensais
    return SimpleRevenueCalculator.obterDadosMensais(projetos, ano);
  }, [projetos, anoSelecionado]);

  // ============= COMPOSIÇÃO DE DESPESAS =============
  
  const composicaoDespesas = useMemo(() => {
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

  const evolucaoCategoria = useMemo((): Record<string, Array<{mes: string; valor: number}>> => {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const evolucoes: Record<string, Array<{mes: string; valor: number}>> = {};

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

  // Cache functions simplified (for compatibility)
  const clearAllCache = () => {
    console.log('🗑️ Cache simplificado limpo');
  };

  const invalidateAndRecalculateCache = () => {
    console.log('🔄 Função de cache simplificada');
  };

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
    composicaoDespesas,
    evolucaoCategoria,
    
    // Funções auxiliares
    getNomeMes,
    clearAllCache,
    invalidateAndRecalculateCache,
    
    // Dados filtrados
    projetosFiltrados,
    transacoesFiltradas
  };
}
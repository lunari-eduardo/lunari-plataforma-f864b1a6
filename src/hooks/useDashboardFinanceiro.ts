import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { FinancialEngine } from '@/services/FinancialEngine';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { useUnifiedWorkflowData } from '@/hooks/useUnifiedWorkflowData';
import { getCurrentDateString } from '@/utils/dateUtils';
import { storage } from '@/utils/localStorage';

// Interfaces específicas para o Dashboard
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

export function useDashboardFinanceiro() {
  // ============= OBTER DADOS DAS FONTES PRIMÁRIAS =============
  
  const { unifiedWorkflowData, getAvailableYears, filterByYear } = useUnifiedWorkflowData();
  const { itensFinanceiros } = useNovoFinancas();
  
  // Carregar transações financeiras diretamente do FinancialEngine
  const transacoesFinanceiras = useMemo(() => {
    return FinancialEngine.loadTransactions();
  }, []);

  // Criar mapeamento de transações com dados dos itens financeiros
  const transacoesComItens = useMemo(() => {
    return transacoesFinanceiras.map(transacao => {
      const item = itensFinanceiros.find(item => item.id === transacao.itemId);
      return {
        ...transacao,
        item: item || null
      };
    });
  }, [transacoesFinanceiras, itensFinanceiros]);

  // ============= SELETOR DE ANO DINÂMICO =============
  
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>();
    
    // Extrair anos dos dados unificados do workflow
    const anosWorkflow = getAvailableYears();
    anosWorkflow.forEach(ano => anos.add(ano));
    
    // Extrair anos das transações financeiras
    transacoesFinanceiras.forEach(transacao => {
      if (!transacao.dataVencimento || typeof transacao.dataVencimento !== 'string') {
        return;
      }
      const ano = parseInt(transacao.dataVencimento.split('-')[0]);
      if (!isNaN(ano)) {
        anos.add(ano);
      }
    });
    
    // Se não há dados, incluir ano atual
    if (anos.size === 0) {
      const anoAtual = new Date().getFullYear();
      anos.add(anoAtual);
    }
    
    // Converter para array e ordenar (mais recente primeiro)
    return Array.from(anos).sort((a, b) => b - a);
  }, [unifiedWorkflowData, transacoesFinanceiras, getAvailableYears]);

  // Estado do ano selecionado (padrão: mais recente)
  const [anoSelecionado, setAnoSelecionado] = useState(() => {
    return anosDisponiveis[0]?.toString() || new Date().getFullYear().toString();
  });

  // ============= FILTROS POR ANO =============
  
  const workflowItemsFiltrados = useMemo(() => {
    const ano = parseInt(anoSelecionado);
    return filterByYear(ano);
  }, [filterByYear, anoSelecionado]);

  const transacoesFiltradas = useMemo(() => {
    const ano = parseInt(anoSelecionado);
    return transacoesComItens.filter(transacao => {
      if (!transacao.dataVencimento || typeof transacao.dataVencimento !== 'string') {
        return false;
      }
      const anoTransacao = parseInt(transacao.dataVencimento.split('-')[0]);
      return anoTransacao === ano;
    });
  }, [transacoesComItens, anoSelecionado]);

  // ============= CÁLCULOS DE MÉTRICAS ANUAIS =============
  
  const kpisData = useMemo((): KPIsData => {
    // TOTAL RECEITA = Receita Operacional (valorPago do Workflow) + Receitas Extras (transações)
    const receitaOperacional = workflowItemsFiltrados.reduce((sum, item) => sum + item.valorPago, 0);
    
    const receitasExtras = transacoesFiltradas
      .filter(t => t.status === 'Pago' && t.item?.grupo_principal === 'Receita Não Operacional')
      .reduce((sum, t) => sum + t.valor, 0);

    const totalReceita = receitaOperacional + receitasExtras;

    // TOTAL DESPESAS = Todas as despesas pagas (Fixas + Variáveis + Investimentos)
    const totalDespesas = transacoesFiltradas
      .filter(t => t.status === 'Pago' && t.item && t.item.grupo_principal !== 'Receita Não Operacional')
      .reduce((sum, t) => sum + t.valor, 0);

    // TOTAL LUCRO = Receita - Despesas
    const totalLucro = totalReceita - totalDespesas;

    // SALDO TOTAL = Mesmo que lucro (para simplicidade inicial)
    const saldoTotal = totalLucro;

    return {
      totalReceita,
      totalDespesas,
      totalLucro,
      saldoTotal
    };
  }, [workflowItemsFiltrados, transacoesFiltradas]);

  // ============= DADOS PARA GRÁFICOS =============
  
  const dadosMensais = useMemo((): DadosMensais[] => {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const dadosPorMes: Record<number, { receita: number; despesas: number }> = {};

    // Inicializar todos os meses
    for (let i = 1; i <= 12; i++) {
      dadosPorMes[i] = { receita: 0, despesas: 0 };
    }

    // Agregrar receitas operacionais por mês
    workflowItemsFiltrados.forEach(item => {
      const mes = new Date(item.data).getMonth() + 1;
      dadosPorMes[mes].receita += item.valorPago;
    });

    // Agregar transações por mês
    transacoesFiltradas.filter(t => t.status === 'Pago').forEach(transacao => {
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
  }, [workflowItemsFiltrados, transacoesFiltradas]);

  // ============= CUSTOS POR CATEGORIA =============
  
  const custosFixos = useMemo((): CategoriaGasto[] => {
    const custosPorCategoria: Record<string, number> = {};
    
    transacoesFiltradas
      .filter(t => t.status === 'Pago' && t.item?.grupo_principal === 'Despesa Fixa')
      .forEach(transacao => {
        const categoria = transacao.item?.nome || 'Categoria Não Identificada';
        custosPorCategoria[categoria] = (custosPorCategoria[categoria] || 0) + transacao.valor;
      });

    return Object.entries(custosPorCategoria).map(([categoria, valor]) => ({
      categoria,
      valor
    }));
  }, [transacoesFiltradas]);

  const custosVariaveis = useMemo((): CategoriaGasto[] => {
    const custosPorCategoria: Record<string, number> = {};
    
    transacoesFiltradas
      .filter(t => t.status === 'Pago' && t.item?.grupo_principal === 'Despesa Variável')
      .forEach(transacao => {
        const categoria = transacao.item?.nome || 'Categoria Não Identificada';
        custosPorCategoria[categoria] = (custosPorCategoria[categoria] || 0) + transacao.valor;
      });

    return Object.entries(custosPorCategoria).map(([categoria, valor]) => ({
      categoria,
      valor
    }));
  }, [transacoesFiltradas]);

  const investimentos = useMemo((): CategoriaGasto[] => {
    const custosPorCategoria: Record<string, number> = {};
    
    transacoesFiltradas
      .filter(t => t.status === 'Pago' && t.item?.grupo_principal === 'Investimento')
      .forEach(transacao => {
        const categoria = transacao.item?.nome || 'Categoria Não Identificada';
        custosPorCategoria[categoria] = (custosPorCategoria[categoria] || 0) + transacao.valor;
      });

    return Object.entries(custosPorCategoria).map(([categoria, valor]) => ({
      categoria,
      valor
    }));
  }, [transacoesFiltradas]);

  // ============= EVOLUÇÃO DE CATEGORIA ESPECÍFICA =============
  
  const categoriasDisponiveis = useMemo(() => {
    const categorias = new Set<string>();
    
    transacoesFiltradas.forEach(transacao => {
      if (transacao.item?.nome) {
        categorias.add(transacao.item.nome);
      }
    });

    const categoriasArray = Array.from(categorias);
    // Se não há categorias, retornar pelo menos uma categoria padrão para evitar erro
    return categoriasArray.length > 0 ? categoriasArray : ['Aluguel'];
  }, [transacoesFiltradas]);

  const [categoriaSelecionada, setCategoriaSelecionada] = useState(() => 
    categoriasDisponiveis[0] || 'Aluguel'
  );

  const evolucaoCategoria = useMemo((): Record<string, EvolucaoCategoria[]> => {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const evolucoes: Record<string, EvolucaoCategoria[]> = {};

    categoriasDisponiveis.forEach(categoria => {
      const dadosPorMes: Record<number, number> = {};
      
      // Inicializar todos os meses
      for (let i = 1; i <= 12; i++) {
        dadosPorMes[i] = 0;
      }

      // Agregar dados por mês para esta categoria
      transacoesFiltradas
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
  }, [transacoesFiltradas, categoriasDisponiveis]);

  // ============= METAS BASEADAS EM PRECIFICAÇÃO =============
  
  const metasData = useMemo((): MetasData => {
    // Carregar dados das metas de precificação
    const metasPrecificacao = storage.load('precificacao_metas', {
      margemLucroDesejada: 30
    });
    
    // Carregar custos fixos totais da estrutura de custos
    const custosFixosData = storage.load('custosFixos', {
      custosEstudio: [],
      gastosPessoais: []
    });
    
    // Calcular custos fixos totais mensais
    const custosEstudioTotal = custosFixosData.custosEstudio.reduce((sum: number, item: any) => sum + (item.valor || 0), 0);
    const gastosPessoaisTotal = custosFixosData.gastosPessoais.reduce((sum: number, item: any) => sum + (item.valor || 0), 0);
    const custosFixosMensais = custosEstudioTotal + gastosPessoaisTotal;
    
    // Cálculos baseados na fórmula de precificação
    const faturamentoMinimoAnual = custosFixosMensais * 12;
    const metaFaturamentoAnual = faturamentoMinimoAnual / (1 - metasPrecificacao.margemLucroDesejada / 100);
    const metaLucroAnual = metaFaturamentoAnual - faturamentoMinimoAnual;
    
    return {
      metaReceita: metaFaturamentoAnual,
      metaLucro: metaLucroAnual,
      receitaAtual: kpisData.totalReceita,
      lucroAtual: kpisData.totalLucro
    };
  }, [kpisData]);

  // ============= DEBUG DETALHADO =============
  
  useEffect(() => {
    console.log('🔍 Dashboard Debug (UNIFICADO):', {
      unifiedWorkflowData: unifiedWorkflowData.length,
      transacoesFinanceiras: transacoesFinanceiras.length,
      anoSelecionado,
      anosDisponiveis,
      workflowItemsFiltrados: workflowItemsFiltrados.length,
      transacoesFiltradas: transacoesFiltradas.length,
      kpisData
    });
    
    if (unifiedWorkflowData.length > 0) {
      console.log('📊 Exemplo unifiedWorkflowData:', unifiedWorkflowData[0]);
      console.log('💰 Receitas operacionais filtradas:', workflowItemsFiltrados.map(i => ({ 
        nome: i.nome, 
        valorPago: i.valorPago, 
        fonte: i.fonte,
        data: i.data 
      })));
    }
    
    if (transacoesFinanceiras.length > 0) {
      console.log('💰 Exemplo transação:', transacoesFinanceiras[0]);
    }
    
    // Debug específico para receitas operacionais
    const receitaOperacional = workflowItemsFiltrados.reduce((sum, item) => sum + item.valorPago, 0);
    console.log('💎 Receita Operacional Calculada:', {
      total: receitaOperacional,
      breakdown: workflowItemsFiltrados.map(i => ({
        nome: i.nome,
        valorPago: i.valorPago,
        data: i.data
      }))
    });
  }, [unifiedWorkflowData, transacoesFinanceiras, anoSelecionado, anosDisponiveis, workflowItemsFiltrados, transacoesFiltradas, kpisData]);

  // ============= RETORNO DO HOOK =============
  
  return {
    // Estados
    anoSelecionado,
    setAnoSelecionado,
    anosDisponiveis,
    categoriaSelecionada,
    setCategoriaSelecionada,
    categoriasDisponiveis,
    
    // Dados calculados
    kpisData,
    metasData,
    dadosMensais,
    custosFixos,
    custosVariaveis,
    investimentos,
    evolucaoCategoria,
    
    // Dados filtrados
    workflowItemsFiltrados,
    transacoesFiltradas
  };
}
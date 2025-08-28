import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  LinhaExtrato, 
  ResumoExtrato, 
  FiltrosExtrato, 
  PreferenciasExtrato,
  ExtratoModoData,
  ExtratoTipo,
  ExtratoOrigem,
  ExtratoStatus,
  DemonstrativoSimplificado
} from '@/types/extrato';
import { FinancialEngine } from '@/services/FinancialEngine';
import { useNovoFinancas } from '@/hooks/useNovoFinancas';
import { useAppContext } from '@/contexts/AppContext';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { getCurrentDateString } from '@/utils/dateUtils';

const PREFERENCIAS_KEY = 'lunari_extrato_preferencias';

// Preferências padrão
const PREFERENCIAS_DEFAULT: PreferenciasExtrato = {
  modoData: 'competencia',
  filtrosDefault: {
    tipo: 'todos',
    origem: 'todos',
    status: 'todos'
  },
  colunasSelecionadas: ['data', 'tipo', 'descricao', 'origem', 'categoria', 'valor', 'status'],
  ordenacao: {
    campo: 'data',
    direcao: 'desc'
  }
};

export function useExtrato() {
  // ============= HOOKS E DADOS =============
  const { itensFinanceiros, cartoes } = useNovoFinancas();
  const { clientes } = useAppContext();

  // Estados
  const [preferencias, setPreferencias] = useState<PreferenciasExtrato>(() => {
    return storage.load(PREFERENCIAS_KEY, PREFERENCIAS_DEFAULT);
  });

  const [filtros, setFiltros] = useState<FiltrosExtrato>(() => {
    const hoje = getCurrentDateString();
    const [ano, mes] = hoje.split('-');
    const inicioMes = `${ano}-${mes}-01`;
    const proximoMes = parseInt(mes) === 12 ? `${parseInt(ano) + 1}-01-01` : `${ano}-${(parseInt(mes) + 1).toString().padStart(2, '0')}-01`;
    const fimMes = new Date(new Date(proximoMes).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    return {
      dataInicio: inicioMes,
      dataFim: fimMes,
      ...preferencias.filtrosDefault
    };
  });

  // ============= PERSISTÊNCIA DE PREFERÊNCIAS =============
  useEffect(() => {
    storage.save(PREFERENCIAS_KEY, preferencias);
  }, [preferencias]);

  // ============= CARREGAMENTO DE DADOS =============

  // Função para resolver nome do cliente com fallbacks robustos
  const resolveClienteNome = useCallback((session: any): string => {
    // 1. Tentar session.cliente?.nome
    if (session.cliente?.nome) {
      return session.cliente.nome;
    }
    
    // 2. Tentar buscar por clienteId na lista de clientes
    if (session.clienteId && clientes) {
      const cliente = clientes.find(c => c.id === session.clienteId);
      if (cliente?.nome) {
        return cliente.nome;
      }
    }
    
    // 3. Tentar session.clienteNome
    if (session.clienteNome) {
      return session.clienteNome;
    }
    
    // 4. Tentar session.nome (pode ser nome do cliente em alguns casos)
    if (session.nome && !session.nome.includes('Projeto') && !session.nome.includes('Sessão')) {
      return session.nome;
    }
    
    // 5. Retornar string vazia se não encontrar nada
    return '';
  }, [clientes]);

  // Carregar transações financeiras
  const transacoesFinanceiras = useMemo(() => {
    return FinancialEngine.loadTransactions();
  }, []);

  // Carregar pagamentos do workflow
  const pagamentosWorkflow = useMemo(() => {
    const sessions = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
    const pagamentos: any[] = [];
    const processedPayments = new Set(); // Para evitar duplicações
    
    sessions.forEach((session: any) => {
      if (session.pagamentos && Array.isArray(session.pagamentos)) {
        session.pagamentos.forEach((pagamento: any) => {
          // Criar chave única para o pagamento
          const paymentKey = `${session.id}_${pagamento.id || pagamento.valor}_${pagamento.dataVencimento || pagamento.data}`;
          
          // Só adicionar se não foi processado antes
          if (!processedPayments.has(paymentKey)) {
            processedPayments.add(paymentKey);
            pagamentos.push({
              ...pagamento,
              sessionId: session.id,
              clienteNome: resolveClienteNome(session),
              projetoNome: session.nome || 'Projeto sem nome',
              categoriaId: session.categoriaId,
              origem: 'workflow'
            });
          }
        });
      }
    });
    
    return pagamentos;
  }, [resolveClienteNome]);

  // ============= CONVERSÃO PARA LINHAS DO EXTRATO =============

  const linhasExtrato = useMemo((): LinhaExtrato[] => {
    const linhas: LinhaExtrato[] = [];

    // 1. TRANSAÇÕES FINANCEIRAS
    transacoesFinanceiras.forEach(transacao => {
      const item = itensFinanceiros.find(i => i.id === transacao.itemId);
      const cartao = transacao.cartaoCreditoId ? cartoes.find(c => c.id === transacao.cartaoCreditoId) : null;
      
      // Determinar data baseada no modo selecionado
      let dataEfetiva = transacao.dataVencimento;
      if (preferencias.modoData === 'caixa' && transacao.status === 'Pago') {
        // Para modo caixa, usar data de pagamento (por enquanto usamos vencimento)
        // TODO: adicionar campo dataPagamento nas transações futuras
        dataEfetiva = transacao.dataVencimento;
      }

      // Determinar tipo (entrada/saída) baseado no grupo
      const tipo: ExtratoTipo = item?.grupo_principal === 'Receita Não Operacional' ? 'entrada' : 'saida';

      linhas.push({
        id: `fin_${transacao.id}`,
        data: dataEfetiva,
        tipo,
        descricao: item?.nome || 'Item removido',
        origem: cartao ? 'cartao' : 'financeiro',
        categoria: item?.grupo_principal,
        parcela: transacao.parcelaInfo,
        valor: transacao.valor,
        status: transacao.status as ExtratoStatus,
        observacoes: transacao.observacoes,
        cartao: cartao?.nome,
        referenciaId: transacao.id,
        referenciaOrigem: cartao ? 'cartao' : 'financeiro'
      });
    });

    // 2. PAGAMENTOS DO WORKFLOW (RECEITAS OPERACIONAIS)
    pagamentosWorkflow.forEach(pagamento => {
      // Determinar data baseada no modo selecionado
      let dataEfetiva = pagamento.dataVencimento || pagamento.data;
      if (preferencias.modoData === 'caixa' && pagamento.statusPagamento === 'pago' && pagamento.data) {
        dataEfetiva = pagamento.data;
      } else if (preferencias.modoData === 'competencia' && pagamento.dataVencimento) {
        dataEfetiva = pagamento.dataVencimento;
      }

      // Converter status para formato do extrato  
      let status: ExtratoStatus = 'Agendado';
      
      // Verificar múltiplos campos para determinar se está pago
      if (pagamento.statusPagamento === 'pago' || 
          (pagamento.data && pagamento.data !== '') ||
          (pagamento.tipo === 'pago')) {
        status = 'Pago';
      } else if (pagamento.dataVencimento && pagamento.dataVencimento <= getCurrentDateString()) {
        status = 'Faturado';
      } else if (pagamento.statusPagamento === 'atrasado') {
        status = 'Faturado'; // Tratamos como faturado mas vencido
      }

      linhas.push({
        id: `wf_${pagamento.id}`,
        data: dataEfetiva,
        tipo: 'entrada',
        descricao: `Pagamento - ${pagamento.projetoNome}`,
        origem: 'workflow',
        cliente: pagamento.clienteNome,
        projeto: pagamento.projetoNome,
        parcela: (pagamento.numeroParcela && pagamento.totalParcelas) ? {
          atual: pagamento.numeroParcela,
          total: pagamento.totalParcelas
        } : null,
        valor: pagamento.valor,
        status,
        observacoes: pagamento.observacoes,
        referenciaId: pagamento.sessionId,
        referenciaOrigem: 'workflow'
      });
    });

    return linhas;
  }, [transacoesFinanceiras, pagamentosWorkflow, itensFinanceiros, cartoes, preferencias.modoData]);

  // ============= APLICAÇÃO DE FILTROS =============

  const linhasFiltradas = useMemo(() => {
    let resultado = [...linhasExtrato];

    // Filtro por período
    if (filtros.dataInicio) {
      resultado = resultado.filter(linha => linha.data >= filtros.dataInicio);
    }
    if (filtros.dataFim) {
      resultado = resultado.filter(linha => linha.data <= filtros.dataFim);
    }

    // Filtro por tipo
    if (filtros.tipo && filtros.tipo !== 'todos') {
      resultado = resultado.filter(linha => linha.tipo === filtros.tipo);
    }

    // Filtro por origem
    if (filtros.origem && filtros.origem !== 'todos') {
      resultado = resultado.filter(linha => linha.origem === filtros.origem);
    }

    // Filtro por status
    if (filtros.status && filtros.status !== 'todos') {
      resultado = resultado.filter(linha => linha.status === filtros.status);
    }

    // Filtro por cliente
    if (filtros.cliente) {
      resultado = resultado.filter(linha => 
        linha.cliente?.toLowerCase().includes(filtros.cliente!.toLowerCase())
      );
    }

    // Filtro por busca geral
    if (filtros.busca) {
      const busca = filtros.busca.toLowerCase();
      resultado = resultado.filter(linha => 
        linha.descricao.toLowerCase().includes(busca) ||
        linha.categoria?.toLowerCase().includes(busca) ||
        linha.cliente?.toLowerCase().includes(busca) ||
        linha.projeto?.toLowerCase().includes(busca) ||
        linha.observacoes?.toLowerCase().includes(busca)
      );
    }

    // Aplicar ordenação
    resultado.sort((a, b) => {
      const campo = preferencias.ordenacao.campo;
      const direcao = preferencias.ordenacao.direcao === 'asc' ? 1 : -1;

      let valorA: any, valorB: any;

      switch (campo) {
        case 'data':
          valorA = new Date(a.data).getTime();
          valorB = new Date(b.data).getTime();
          break;
        case 'valor':
          valorA = a.valor;
          valorB = b.valor;
          break;
        case 'descricao':
          valorA = a.descricao.toLowerCase();
          valorB = b.descricao.toLowerCase();
          break;
        default:
          valorA = a[campo as keyof LinhaExtrato] || '';
          valorB = b[campo as keyof LinhaExtrato] || '';
      }

      if (valorA < valorB) return -1 * direcao;
      if (valorA > valorB) return 1 * direcao;
      return 0;
    });

    return resultado;
  }, [linhasExtrato, filtros, preferencias.ordenacao]);

  // ============= CÁLCULO DO RESUMO =============

  const resumo = useMemo((): ResumoExtrato => {
    const entradas = linhasFiltradas.filter(l => l.tipo === 'entrada');
    const saidas = linhasFiltradas.filter(l => l.tipo === 'saida');
    
    const totalEntradas = entradas.reduce((sum, l) => sum + l.valor, 0);
    const totalSaidas = saidas.reduce((sum, l) => sum + l.valor, 0);
    const saldoPeriodo = totalEntradas - totalSaidas;
    
    const totalAReceber = linhasFiltradas.filter(l => l.status === 'Faturado').reduce((sum, l) => sum + l.valor, 0);
    const totalAgendado = linhasFiltradas.filter(l => l.status === 'Agendado').reduce((sum, l) => sum + l.valor, 0);
    const totalPago = linhasFiltradas.filter(l => l.status === 'Pago').reduce((sum, l) => sum + l.valor, 0);
    
    const ticketMedioEntradas = entradas.length > 0 ? totalEntradas / entradas.length : 0;
    const totalGeral = totalPago + totalAReceber + totalAgendado;
    const percentualPago = totalGeral > 0 ? (totalPago / totalGeral) * 100 : 0;

    return {
      totalEntradas,
      totalSaidas,
      saldoPeriodo,
      totalAReceber,
      totalAgendado,
      totalPago,
      ticketMedioEntradas,
      percentualPago
    };
  }, [linhasFiltradas]);

  // ============= SALDO ACUMULADO =============

  const linhasComSaldo = useMemo(() => {
    let saldoAcumulado = 0;
    
    return linhasFiltradas.map(linha => {
      if (linha.status === 'Pago') {
        saldoAcumulado += linha.tipo === 'entrada' ? linha.valor : -linha.valor;
      }
      
      return {
        ...linha,
        saldoAcumulado
      };
    });
  }, [linhasFiltradas]);

  // ============= FUNÇÕES DE CONTROLE =============

  const atualizarFiltros = useCallback((novosFiltros: Partial<FiltrosExtrato>) => {
    setFiltros(prev => ({ ...prev, ...novosFiltros }));
  }, []);

  const atualizarPreferencias = useCallback((novasPreferencias: Partial<PreferenciasExtrato>) => {
    setPreferencias(prev => ({ ...prev, ...novasPreferencias }));
  }, []);

  const alternarModoData = useCallback(() => {
    const novoModo: ExtratoModoData = preferencias.modoData === 'caixa' ? 'competencia' : 'caixa';
    atualizarPreferencias({ modoData: novoModo });
  }, [preferencias.modoData, atualizarPreferencias]);

  const limparFiltros = useCallback(() => {
    const hoje = getCurrentDateString();
    const [ano, mes] = hoje.split('-');
    const inicioMes = `${ano}-${mes}-01`;
    const proximoMes = parseInt(mes) === 12 ? `${parseInt(ano) + 1}-01-01` : `${ano}-${(parseInt(mes) + 1).toString().padStart(2, '0')}-01`;
    const fimMes = new Date(new Date(proximoMes).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    setFiltros({
      dataInicio: inicioMes,
      dataFim: fimMes,
      ...preferencias.filtrosDefault
    });
  }, [preferencias.filtrosDefault]);

  // ============= DRILL-DOWN =============

  const abrirOrigem = useCallback((linha: LinhaExtrato) => {
    // TODO: Implementar abertura de modais específicos baseado na origem
    console.log('Abrir origem:', linha);
  }, []);

  // ============= EXPORTAÇÃO =============

  const prepararDadosExportacao = useCallback(() => {
    return {
      periodo: {
        inicio: filtros.dataInicio,
        fim: filtros.dataFim
      },
      resumo,
      linhas: linhasComSaldo,
      filtrosAplicados: filtros,
      modoData: preferencias.modoData
    };
  }, [filtros, resumo, linhasComSaldo, preferencias.modoData]);

  // ============= DEMONSTRATIVO SIMPLIFICADO =============

  const calcularDemonstrativoSimplificado = useCallback((): DemonstrativoSimplificado => {
    // 1. CALCULAR RECEITAS
    const receitaSessoes = pagamentosWorkflow
      .filter(p => {
        const data = p.dataVencimento || p.data;
        return data >= filtros.dataInicio && data <= filtros.dataFim && 
               (p.statusPagamento === 'pago' || p.data);
      })
      .reduce((sum, p) => {
        // Receita de sessão = valor total menos produtos extras
        const valorSessao = p.valor - (p.valorProdutoExtra || 0);
        return sum + Math.max(0, valorSessao);
      }, 0);

    const receitaProdutos = pagamentosWorkflow
      .filter(p => {
        const data = p.dataVencimento || p.data;
        return data >= filtros.dataInicio && data <= filtros.dataFim && 
               (p.statusPagamento === 'pago' || p.data);
      })
      .reduce((sum, p) => sum + (p.valorProdutoExtra || 0), 0);

    const receitaNaoOperacional = transacoesFinanceiras
      .filter(t => {
        const item = itensFinanceiros.find(i => i.id === t.itemId);
        return item?.grupo_principal === 'Receita Não Operacional' &&
               t.dataVencimento >= filtros.dataInicio && 
               t.dataVencimento <= filtros.dataFim &&
               t.status === 'Pago';
      })
      .reduce((sum, t) => sum + t.valor, 0);

    const totalReceitas = receitaSessoes + receitaProdutos + receitaNaoOperacional;

    // 2. CALCULAR DESPESAS POR CATEGORIA
    const categorias: Array<{
      grupo: string;
      itens: Array<{ nome: string; valor: number; }>;
      total: number;
    }> = [];

    // Agrupar transações por grupo principal
    const gruposDespesas = ['Despesa Fixa', 'Despesa Variável', 'Investimento'];
    
    gruposDespesas.forEach(grupo => {
      const transacoesGrupo = transacoesFinanceiras.filter(t => {
        const item = itensFinanceiros.find(i => i.id === t.itemId);
        return item?.grupo_principal === grupo &&
               t.dataVencimento >= filtros.dataInicio && 
               t.dataVencimento <= filtros.dataFim &&
               t.status === 'Pago';
      });

      if (transacoesGrupo.length > 0) {
        // Agrupar por item financeiro
        const itensPorNome: Record<string, number> = {};
        
        transacoesGrupo.forEach(t => {
          const item = itensFinanceiros.find(i => i.id === t.itemId);
          const nome = item?.nome || 'Item removido';
          itensPorNome[nome] = (itensPorNome[nome] || 0) + t.valor;
        });

        const itens = Object.entries(itensPorNome).map(([nome, valor]) => ({
          nome,
          valor
        }));

        const total = itens.reduce((sum, item) => sum + item.valor, 0);

        categorias.push({
          grupo,
          itens,
          total
        });
      }
    });

    const totalDespesas = categorias.reduce((sum, cat) => sum + cat.total, 0);

    // 3. CALCULAR RESUMO FINAL
    const resultadoLiquido = totalReceitas - totalDespesas;
    const margemLiquida = totalReceitas > 0 ? (resultadoLiquido / totalReceitas) * 100 : 0;

    return {
      receitas: {
        sessoes: receitaSessoes,
        produtos: receitaProdutos,
        naoOperacionais: receitaNaoOperacional,
        totalReceitas
      },
      despesas: {
        categorias,
        totalDespesas
      },
      resumoFinal: {
        receitaTotal: totalReceitas,
        despesaTotal: totalDespesas,
        resultadoLiquido,
        margemLiquida
      }
    };
  }, [pagamentosWorkflow, transacoesFinanceiras, itensFinanceiros, filtros]);

  const demonstrativo = calcularDemonstrativoSimplificado();

  // ============= NOVO MÉTODO: CALCULAR DEMONSTRATIVO PARA PERÍODO ESPECÍFICO =============
  
  const calcularDemonstrativoParaPeriodo = useCallback((dataInicio: string, dataFim: string): DemonstrativoSimplificado => {
    // Filtrar pagamentos do workflow para o período
    const pagamentosPeriodo = pagamentosWorkflow.filter(p => {
      const data = p.dataVencimento || p.data;
      return data >= dataInicio && data <= dataFim && 
             (p.statusPagamento === 'pago' || p.data);
    });

    // Filtrar transações financeiras para o período
    const transacoesPeriodo = transacoesFinanceiras.filter(t => {
      return t.dataVencimento >= dataInicio && 
             t.dataVencimento <= dataFim &&
             t.status === 'Pago';
    });

    // 1. CALCULAR RECEITAS
    const receitaSessoes = pagamentosPeriodo.reduce((sum, p) => {
      const valorSessao = p.valor - (p.valorProdutoExtra || 0);
      return sum + Math.max(0, valorSessao);
    }, 0);

    const receitaProdutos = pagamentosPeriodo.reduce((sum, p) => sum + (p.valorProdutoExtra || 0), 0);

    const receitaNaoOperacional = transacoesPeriodo
      .filter(t => {
        const item = itensFinanceiros.find(i => i.id === t.itemId);
        return item?.grupo_principal === 'Receita Não Operacional';
      })
      .reduce((sum, t) => sum + t.valor, 0);

    const totalReceitas = receitaSessoes + receitaProdutos + receitaNaoOperacional;

    // 2. CALCULAR DESPESAS POR CATEGORIA
    const categorias: Array<{
      grupo: string;
      itens: Array<{ nome: string; valor: number; }>;
      total: number;
    }> = [];

    const gruposDespesas = ['Despesa Fixa', 'Despesa Variável', 'Investimento'];
    
    gruposDespesas.forEach(grupo => {
      const transacoesGrupo = transacoesPeriodo.filter(t => {
        const item = itensFinanceiros.find(i => i.id === t.itemId);
        return item?.grupo_principal === grupo;
      });

      if (transacoesGrupo.length > 0) {
        const itensPorNome: Record<string, number> = {};
        
        transacoesGrupo.forEach(t => {
          const item = itensFinanceiros.find(i => i.id === t.itemId);
          const nome = item?.nome || 'Item removido';
          itensPorNome[nome] = (itensPorNome[nome] || 0) + t.valor;
        });

        const itens = Object.entries(itensPorNome).map(([nome, valor]) => ({
          nome,
          valor
        }));

        const total = itens.reduce((sum, item) => sum + item.valor, 0);

        categorias.push({
          grupo,
          itens,
          total
        });
      }
    });

    const totalDespesas = categorias.reduce((sum, cat) => sum + cat.total, 0);

    // 3. CALCULAR RESUMO FINAL
    const resultadoLiquido = totalReceitas - totalDespesas;
    const margemLiquida = totalReceitas > 0 ? (resultadoLiquido / totalReceitas) * 100 : 0;

    return {
      receitas: {
        sessoes: receitaSessoes,
        produtos: receitaProdutos,
        naoOperacionais: receitaNaoOperacional,
        totalReceitas
      },
      despesas: {
        categorias,
        totalDespesas
      },
      resumoFinal: {
        receitaTotal: totalReceitas,
        despesaTotal: totalDespesas,
        resultadoLiquido,
        margemLiquida
      }
    };
  }, [pagamentosWorkflow, transacoesFinanceiras, itensFinanceiros]);

  return {
    // Dados
    linhas: linhasComSaldo,
    resumo,
    demonstrativo,
    
    // Estados
    filtros,
    preferencias,
    
    // Funções
    atualizarFiltros,
    atualizarPreferencias,
    alternarModoData,
    limparFiltros,
    abrirOrigem,
    prepararDadosExportacao,
    calcularDemonstrativoParaPeriodo
  };
}
import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  LinhaExtrato, 
  ResumoExtrato, 
  FiltrosExtrato, 
  PreferenciasExtrato,
  ExtratoModoData,
  ExtratoTipo,
  ExtratoOrigem,
  ExtratoStatus 
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
  const { } = useAppContext();

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

  // Carregar transações financeiras
  const transacoesFinanceiras = useMemo(() => {
    return FinancialEngine.loadTransactions();
  }, []);

  // Carregar pagamentos do workflow
  const pagamentosWorkflow = useMemo(() => {
    const sessions = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
    const pagamentos: any[] = [];
    
    sessions.forEach((session: any) => {
      if (session.pagamentos && Array.isArray(session.pagamentos)) {
        session.pagamentos.forEach((pagamento: any) => {
          pagamentos.push({
            ...pagamento,
            sessionId: session.id,
            clienteNome: session.cliente?.nome || 'Cliente não identificado',
            projetoNome: session.nome || 'Projeto sem nome',
            categoriaId: session.categoriaId,
            origem: 'workflow'
          });
        });
      }
    });
    
    return pagamentos;
  }, []);

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

  return {
    // Dados
    linhas: linhasComSaldo,
    resumo,
    
    // Estados
    filtros,
    preferencias,
    
    // Funções
    atualizarFiltros,
    atualizarPreferencias,
    alternarModoData,
    limparFiltros,
    abrirOrigem,
    prepararDadosExportacao
  };
}
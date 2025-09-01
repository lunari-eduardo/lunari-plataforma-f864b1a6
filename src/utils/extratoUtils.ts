/**
 * Utilitários para manipulação de dados do extrato
 */

import { LinhaExtrato, ExtratoStatus } from '@/types/extrato';
import { getCurrentDateString } from '@/utils/dateUtils';

// ============= NORMALIZAÇÃO DE DATAS =============

export const normalizeDate = (dateString: string): string => {
  if (!dateString) return '';
  // Garantir formato YYYY-MM-DD
  if (dateString.includes('T')) {
    return dateString.split('T')[0];
  }
  return dateString;
};

export const getDefaultPeriod = () => {
  const hoje = getCurrentDateString();
  const [ano, mes] = hoje.split('-');
  const inicioMes = `${ano}-${mes}-01`;
  const proximoMes = parseInt(mes) === 12 
    ? `${parseInt(ano) + 1}-01-01` 
    : `${ano}-${(parseInt(mes) + 1).toString().padStart(2, '0')}-01`;
  const fimMes = new Date(new Date(proximoMes).getTime() - 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  
  return { inicioMes, fimMes };
};

// ============= RESOLUÇÃO DE DADOS =============

export const resolveClienteNome = (session: any, clientes: any[]): string => {
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
};

export const getPagamentoEffectiveDate = (pagamento: any): string => {
  // Priorizar data da sessão para pagamentos do workflow
  // 1. Data de vencimento (se definida)
  if (pagamento.dataVencimento) {
    return normalizeDate(pagamento.dataVencimento);
  }
  // 2. Data da sessão (sessionDate, sessionDataCompleta, sessionDataInicio)
  if (pagamento.sessionDate) {
    return normalizeDate(pagamento.sessionDate);
  }
  if (pagamento.sessionDataCompleta) {
    return normalizeDate(pagamento.sessionDataCompleta);
  }
  if (pagamento.sessionDataInicio) {
    return normalizeDate(pagamento.sessionDataInicio);
  }
  // 3. Fallback para data do pagamento
  return normalizeDate(pagamento.data || '');
};

export const getTransacaoEffectiveDate = (transacao: any): string => {
  // Usar sempre data de vencimento para transações financeiras
  return normalizeDate(transacao.dataVencimento);
};

// ============= CONVERSÃO DE STATUS =============

export const convertPagamentoStatus = (pagamento: any): ExtratoStatus => {
  // Verificar múltiplos campos para determinar se está pago
  if (pagamento.statusPagamento === 'pago' || 
      (pagamento.data && pagamento.data !== '') ||
      (pagamento.tipo === 'pago')) {
    return 'Pago';
  } 
  
  if (pagamento.dataVencimento && pagamento.dataVencimento <= getCurrentDateString()) {
    return 'Faturado';
  } 
  
  if (pagamento.statusPagamento === 'atrasado') {
    return 'Faturado'; // Tratamos como faturado mas vencido
  }
  
  return 'Agendado';
};

// ============= CÁLCULO DE SALDO =============

export const calcularSaldoAcumulado = (linhas: LinhaExtrato[]) => {
  let saldoAcumulado = 0;
  
  return linhas.map(linha => {
    if (linha.status === 'Pago') {
      saldoAcumulado += linha.tipo === 'entrada' ? linha.valor : -linha.valor;
    }
    
    return {
      ...linha,
      saldoAcumulado
    };
  });
};

// ============= ORDENAÇÃO =============

export const ordenarLinhas = (
  linhas: LinhaExtrato[], 
  campo: string, 
  direcao: 'asc' | 'desc'
): LinhaExtrato[] => {
  return [...linhas].sort((a, b) => {
    const multiplicador = direcao === 'asc' ? 1 : -1;
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

    if (valorA < valorB) return -1 * multiplicador;
    if (valorA > valorB) return 1 * multiplicador;
    return 0;
  });
};

// ============= FILTROS =============

export const aplicarFiltrosPeriodo = (
  linhas: LinhaExtrato[],
  dataInicio?: string,
  dataFim?: string
): LinhaExtrato[] => {
  let resultado = [...linhas];

  if (dataInicio) {
    resultado = resultado.filter(linha => linha.data >= dataInicio);
  }
  if (dataFim) {
    resultado = resultado.filter(linha => linha.data <= dataFim);
  }

  return resultado;
};

export const aplicarFiltrosBusca = (
  linhas: LinhaExtrato[],
  busca: string
): LinhaExtrato[] => {
  if (!busca) return linhas;
  
  const buscaLower = busca.toLowerCase();
  return linhas.filter(linha => 
    linha.descricao.toLowerCase().includes(buscaLower) ||
    linha.categoria?.toLowerCase().includes(buscaLower) ||
    linha.cliente?.toLowerCase().includes(buscaLower) ||
    linha.projeto?.toLowerCase().includes(buscaLower) ||
    linha.observacoes?.toLowerCase().includes(buscaLower)
  );
};
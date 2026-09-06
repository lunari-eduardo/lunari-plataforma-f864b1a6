import { SessionPaymentExtended } from '@/types/sessionPayments';

export interface SessionPaymentsManagerProps {
  sessionData: any;
  onPaymentUpdate?: (sessionId: string, totalPaid: number, fullPaymentsArray?: any[]) => void;
  displayMode?: 'modal' | 'card';
  isOpen?: boolean;
  onClose?: () => void;
}

// Convert existing payments to extended format
export function convertExistingPayments(payments: any[]): SessionPaymentExtended[] {
  if (!payments || !Array.isArray(payments)) return [];
  return payments.map(p => {
    let tipo = p.tipo || 'pago';
    let statusPagamento = p.statusPagamento || 'pago';

    if (p.dataVencimento && !p.data) {
      tipo = 'agendado';
      statusPagamento = 'pendente';
    }

    if (p.numeroParcela && p.totalParcelas) {
      tipo = 'parcelado';
      if (!p.data) {
        statusPagamento = 'pendente';
      }
    }

    let origem = p.origem || 'manual';
    if (p.numeroParcela && p.totalParcelas && origem !== 'parcelado') {
      origem = 'parcelado';
    }

    let finalidade: SessionPaymentExtended['finalidade'] = p.finalidade;
    const obs = (p.observacoes || '').toLowerCase();
    if (!finalidade) {
      if (tipo === 'estorno' || statusPagamento === 'estornado') finalidade = 'estorno';
      else if (origem === 'credito' || obs.includes('crédito do cliente')) finalidade = 'credito';
      else if (/(foto[s]?\s+extra|\[extras)/i.test(obs)) finalidade = 'fotos_extras';
      else if (/(sess[ãoa]o\s*\+\s*extras|sessao_e_extras)/i.test(obs)) finalidade = 'sessao_e_extras';
      else if (/(sinal|entrada|arras|reserva)/i.test(obs)) finalidade = 'sinal';
      else if (/(venda\s+avulsa|avulso)/i.test(obs)) finalidade = 'avulso';
      else finalidade = 'sessao';
    }

    return {
      id: p.id || `legacy-${Date.now()}-${Math.random()}`,
      valor: typeof p.valor === 'number' ? p.valor : parseFloat(String(p.valor || '0')),
      data: p.data || '',
      dataVencimento: p.dataVencimento,
      tipo: tipo as 'pago' | 'agendado' | 'parcelado',
      statusPagamento: statusPagamento as 'pendente' | 'pago' | 'atrasado' | 'cancelado',
      numeroParcela: p.numeroParcela,
      totalParcelas: p.totalParcelas,
      origem: origem as 'agenda' | 'workflow_rapido' | 'manual' | 'parcelado',
      finalidade,
      editavel: p.origem !== 'agenda' && p.editavel !== false,
      forma_pagamento: p.forma_pagamento,
      observacoes: p.observacoes,
    };
  });
}

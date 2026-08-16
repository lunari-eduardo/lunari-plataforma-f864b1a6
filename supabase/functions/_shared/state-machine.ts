// supabase/functions/_shared/state-machine.ts
// Máquina de estados formal e normalização de eventos de gateways de pagamento

import { StatusCobranca } from './payment-types.ts';

/**
 * Matriz de transições de status válidas para o subsistema de pagamentos.
 * Garante que eventos fora de ordem não corrompam o estado e que eventos
 * pós-pagamento (estornos, contestações e antecipações) sejam aceitos.
 */
export const VALID_TRANSITIONS: Record<StatusCobranca, StatusCobranca[]> = {
  pendente: ['processando', 'pago', 'recusado', 'expirado', 'cancelado', 'falha'],
  processando: ['pago', 'recusado', 'falha', 'cancelado'],
  pago: ['estornado', 'chargeback', 'parcialmente_estornado'],
  recusado: ['pendente', 'processando', 'pago'], // Permite nova tentativa no mesmo link
  expirado: [],
  cancelado: [],
  estornado: [],
  chargeback: [],
  parcialmente_estornado: ['estornado'],
  falha: ['pendente', 'processando'],
};

/**
 * Verifica se a transição entre o status atual e o novo status é permitida.
 * Transições para o mesmo status são sempre permitidas (idempotência).
 */
export function canTransition(currentStatus: string | null | undefined, nextStatus: StatusCobranca): boolean {
  if (!currentStatus) return true;
  if (currentStatus === nextStatus) return true;

  const validNext = VALID_TRANSITIONS[currentStatus as StatusCobranca];
  if (!validNext) return false;

  return validNext.includes(nextStatus);
}

/**
 * Verifica se o estado é terminal (não aceita novas transições de pagamento).
 */
export function isTerminalState(status: string | null | undefined): boolean {
  if (!status) return false;
  return ['estornado', 'chargeback', 'cancelado', 'expirado'].includes(status);
}

export interface NormalizedGatewayEvent {
  nextStatus: StatusCobranca;
  isPaymentConfirmed: boolean;
  isRefund: boolean;
  isChargeback: boolean;
  rawStatus?: string;
  amountPaid?: number;
  transactionId?: string;
}

/**
 * Normaliza eventos e payloads dos gateways suportados para os status canônicos do Lunari.
 */
export function normalizeGatewayStatus(
  provider: 'mercadopago' | 'infinitepay' | 'asaas',
  eventOrStatus: string,
  payload?: any
): NormalizedGatewayEvent {
  const normEvent = (eventOrStatus || '').toUpperCase().trim();

  if (provider === 'asaas') {
    switch (normEvent) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        return { nextStatus: 'pago', isPaymentConfirmed: true, isRefund: false, isChargeback: false, rawStatus: normEvent };
      case 'PAYMENT_ANTICIPATED':
        return { nextStatus: 'pago', isPaymentConfirmed: true, isRefund: false, isChargeback: false, rawStatus: normEvent };
      case 'PAYMENT_REFUNDED':
        return { nextStatus: 'estornado', isPaymentConfirmed: false, isRefund: true, isChargeback: false, rawStatus: normEvent };
      case 'PAYMENT_CHARGEBACK_REQUESTED':
        return { nextStatus: 'chargeback', isPaymentConfirmed: false, isRefund: false, isChargeback: true, rawStatus: normEvent };
      case 'PAYMENT_DELETED':
        return { nextStatus: 'cancelado', isPaymentConfirmed: false, isRefund: false, isChargeback: false, rawStatus: normEvent };
      case 'PAYMENT_OVERDUE':
        return { nextStatus: 'expirado', isPaymentConfirmed: false, isRefund: false, isChargeback: false, rawStatus: normEvent };
      default:
        return { nextStatus: 'processando', isPaymentConfirmed: false, isRefund: false, isChargeback: false, rawStatus: normEvent };
    }
  }

  if (provider === 'mercadopago') {
    const mpStatus = (payload?.status || eventOrStatus || '').toLowerCase().trim();
    switch (mpStatus) {
      case 'approved':
        return { nextStatus: 'pago', isPaymentConfirmed: true, isRefund: false, isChargeback: false, rawStatus: mpStatus };
      case 'refunded':
        return { nextStatus: 'estornado', isPaymentConfirmed: false, isRefund: true, isChargeback: false, rawStatus: mpStatus };
      case 'charged_back':
        return { nextStatus: 'chargeback', isPaymentConfirmed: false, isRefund: false, isChargeback: true, rawStatus: mpStatus };
      case 'rejected':
        return { nextStatus: 'recusado', isPaymentConfirmed: false, isRefund: false, isChargeback: false, rawStatus: mpStatus };
      case 'cancelled':
        return { nextStatus: 'cancelado', isPaymentConfirmed: false, isRefund: false, isChargeback: false, rawStatus: mpStatus };
      case 'in_process':
      case 'in_mediation':
        return { nextStatus: 'processando', isPaymentConfirmed: false, isRefund: false, isChargeback: false, rawStatus: mpStatus };
      case 'pending':
      default:
        return { nextStatus: 'pendente', isPaymentConfirmed: false, isRefund: false, isChargeback: false, rawStatus: mpStatus };
    }
  }

  if (provider === 'infinitepay') {
    const paidAmount = Number(payload?.paid_amount || 0);
    const ipStatus = (payload?.status || eventOrStatus || '').toLowerCase().trim();

    if (paidAmount > 0 || ipStatus === 'paid' || ipStatus === 'approved') {
      return {
        nextStatus: 'pago',
        isPaymentConfirmed: true,
        isRefund: false,
        isChargeback: false,
        amountPaid: paidAmount > 0 ? paidAmount / 100 : undefined,
        rawStatus: ipStatus,
      };
    }

    if (ipStatus === 'refunded') {
      return { nextStatus: 'estornado', isPaymentConfirmed: false, isRefund: true, isChargeback: false, rawStatus: ipStatus };
    }

    return { nextStatus: 'pendente', isPaymentConfirmed: false, isRefund: false, isChargeback: false, rawStatus: ipStatus };
  }

  return { nextStatus: 'pendente', isPaymentConfirmed: false, isRefund: false, isChargeback: false };
}

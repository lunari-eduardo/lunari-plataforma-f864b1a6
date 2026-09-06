import { getSessionBinding, SessionBinding } from './payment-supabase/sessionBinding';
import {
  paymentExists,
  saveSinglePaymentToSupabase,
  saveSinglePaymentTracked,
  saveMultiplePayments,
} from './payment-supabase/singlePaymentService';
import {
  updateSinglePayment,
  savePendingPayments,
  updatePendingPayment,
  markPaymentAsPaid,
} from './payment-supabase/pendingPaymentService';
import {
  deletePaymentFromSupabase,
  refundPayment,
} from './payment-supabase/deleteRefundService';

export type { SessionBinding };

/**
 * Serviço centralizado para gerenciar pagamentos no Supabase
 * 
 * IMPORTANTE: 
 * - clientes_sessoes.id (UUID) = chave primária, usada no workflow UI
 * - clientes_sessoes.session_id (text) = identificador legível (workflow-timestamp-random)
 * - clientes_transacoes.session_id = armazena session_id (text) para vinculação
 * 
 * Este serviço aceita tanto UUID quanto session_id (text) e resolve automaticamente.
 */
export class PaymentSupabaseService {
  /**
   * Buscar dados da sessão através de UUID ou session_id (text)
   */
  static async getSessionBinding(sessionKey: string): Promise<SessionBinding | null> {
    return getSessionBinding(sessionKey);
  }

  /**
   * Salvar um único pagamento em clientes_transacoes
   */
  static async saveSinglePaymentToSupabase(
    sessionKey: string,
    payment: {
      valor: number;
      data: string;
      observacoes?: string;
      forma_pagamento?: string;
    }
  ): Promise<boolean> {
    return saveSinglePaymentToSupabase(sessionKey, payment);
  }

  /**
   * Update an existing payment in Supabase with fallback for legacy data
   */
  static async updateSinglePayment(
    sessionKey: string,
    paymentId: string,
    payment: {
      valor?: number;
      data?: string;
      observacoes?: string;
      forma_pagamento?: string;
    }
  ): Promise<boolean> {
    return updateSinglePayment(sessionKey, paymentId, payment);
  }

  /**
   * Salvar pagamentos pendentes (parcelas/agendamentos) no Supabase
   */
  static async savePendingPayments(
    sessionKey: string,
    payments: Array<{
      paymentId: string;
      valor: number;
      dataVencimento: string;
      numeroParcela?: number;
      totalParcelas?: number;
      observacoes?: string;
      tipo: 'agendado' | 'parcelado';
    }>
  ): Promise<boolean> {
    return savePendingPayments(sessionKey, payments);
  }

  /**
   * Atualizar pagamento pendente (editar valores/vencimento sem marcar como pago)
   */
  static async updatePendingPayment(
    sessionKey: string,
    paymentId: string,
    updates: {
      valor?: number;
      dataVencimento?: string;
      observacoes?: string;
      numeroParcela?: number;
      totalParcelas?: number;
    }
  ): Promise<boolean> {
    return updatePendingPayment(sessionKey, paymentId, updates);
  }

  /**
   * Atualizar pagamento pendente para pago (marca como realizado)
   */
  static async markPaymentAsPaid(
    sessionKey: string,
    paymentId: string,
    dataPagamento: string,
    valor?: number,
    observacoes?: string
  ): Promise<boolean> {
    return markPaymentAsPaid(sessionKey, paymentId, dataPagamento, valor, observacoes);
  }

  /**
   * Verificar se um pagamento já existe no Supabase (por paymentId OU intentKey)
   */
  static async paymentExists(
    sessionKey: string,
    paymentId: string,
    options?: {
      binding?: SessionBinding;
      intentKey?: string;
    }
  ): Promise<boolean> {
    return paymentExists(sessionKey, paymentId, options);
  }

  /**
   * Deletar um pagamento específico do Supabase
   */
  static async deletePaymentFromSupabase(sessionKey: string, paymentId: string): Promise<boolean> {
    return deletePaymentFromSupabase(sessionKey, paymentId);
  }

  /**
   * Estornar um pagamento: cria uma transação de estorno referenciando o original
   */
  static async refundPayment(
    sessionKey: string,
    paymentId: string,
    valor: number,
    motivo?: string,
    options?: { keepAsCredit?: boolean }
  ): Promise<boolean> {
    return refundPayment(sessionKey, paymentId, valor, motivo, options);
  }

  /**
   * Salvar um único pagamento específico (evita duplicação) com paymentId para rastreamento
   */
  static async saveSinglePaymentTracked(
    sessionKey: string,
    paymentId: string,
    payment: {
      valor: number;
      data: string;
      observacoes?: string;
      forma_pagamento?: string;
    },
    options?: {
      binding?: SessionBinding;
      intentKey?: string;
      cobrancaId?: string;
    }
  ): Promise<boolean> {
    return saveSinglePaymentTracked(sessionKey, paymentId, payment, options);
  }

  /**
   * Salvar múltiplos pagamentos
   */
  static async saveMultiplePayments(
    sessionKey: string,
    payments: Array<{
      valor: number;
      data: string;
      observacoes?: string;
      forma_pagamento?: string;
    }>
  ): Promise<boolean> {
    return saveMultiplePayments(sessionKey, payments);
  }
}

/**
 * Domain — Pagamentos da sessão (visão do workflow).
 * Re-exporta o shape canônico de `types/workflow` para um único lugar.
 */

export type PaymentTipo = "pago" | "agendado" | "parcelado" | "estorno";
export type PaymentStatus = "pendente" | "pago" | "atrasado" | "cancelado" | "estornado";
export type PaymentOrigem =
  | "agenda"
  | "workflow_rapido"
  | "manual"
  | "parcelado"
  | "supabase"
  | "mercadopago"
  | "infinitepay"
  | "asaas";

export interface SessionPayment {
  id: string;
  valor: number;
  data: string;
  forma_pagamento?: string;
  observacoes?: string;
  tipo: PaymentTipo;
  statusPagamento: PaymentStatus;
  dataVencimento?: string;
  numeroParcela?: number;
  totalParcelas?: number;
  origem: PaymentOrigem;
  editavel: boolean;
}

/** Situação consolidada para filtro do header (pago / pendente). */
export type PaymentFilterStatus = "pago" | "pendente";

export function derivePaymentFilterStatus(
  valorTotalCentavos: number,
  valorPagoCentavos: number,
): PaymentFilterStatus {
  if (valorTotalCentavos <= 0) return "pago";
  return valorPagoCentavos >= valorTotalCentavos ? "pago" : "pendente";
}

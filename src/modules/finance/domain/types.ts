/**
 * Tipos canônicos do módulo Finance.
 * Onda 1 — pura definição, sem efeitos.
 *
 * Espelha tabelas:
 *  - `fin_transactions` → Transacao
 *  - `financial_items`  → ItemFinanceiro
 *  - `metas_personalizadas` → MetaPersonalizada
 *  - View `extrato_unificado` → re-exporta `LinhaExtrato` de `@/types/extrato`
 */

export type Grupo =
  | "Despesa Fixa"
  | "Despesa Variável"
  | "Investimento"
  | "Receita Não Operacional"
  | "Receita Operacional";

export type StatusTransacao = "Agendado" | "Faturado" | "Pago";

export type FormaPagamento =
  | "dinheiro"
  | "pix"
  | "transferencia"
  | "boleto"
  | "cartao_debito"
  | "cartao_credito";

export type ModoLancamento = "unico" | "parcelado" | "recorrente" | "cartao";

export interface ItemFinanceiro {
  id: string;
  nome: string;
  grupo: Grupo;
  userId: string;
  ativo: boolean;
  criadoEm: string;
}

export interface Transacao {
  id: string;
  itemId: string;
  /** Valor canônico da parcela/lançamento (column `valor`). */
  valor: number;
  /** Valor efetivamente pago (gerado por trigger). Read-only. */
  valorPago?: number;
  /** Valor total agregado (gerado por trigger). Read-only. */
  valorTotal?: number;
  /** Status financeiro derivado por trigger. NUNCA enviar no write. */
  status: StatusTransacao;
  dataVencimento: string; // YYYY-MM-DD
  dataCompetencia?: string; // YYYY-MM-DD
  dataPagamento?: string;
  observacoes?: string | null;
  parcelaAtual?: number | null;
  parcelaTotal?: number | null;
  formaPagamento?: FormaPagamento | null;
  cartaoId?: string | null;
  userId: string;
  criadoEm: string;
  atualizadoEm?: string;
}

export interface MetaPersonalizada {
  id: string;
  userId: string;
  ano: number;
  mes: number;
  /** "__geral__" para meta global, ou itemId/categoria id. */
  categoria: string;
  metaFaturamento: number;
  metaLucro: number;
  criadoEm: string;
  atualizadoEm?: string;
}

export type RegimeContabil = "caixa" | "competencia";

export interface ResumoFinanceiro {
  receitaOperacional: number;
  totalReceitasExtras: number;
  totalDespesas: number;
  lucroLiquido: number;
  custoPrevisto: number;
  custoTotal: number;
  resultadoMensal: number;
}

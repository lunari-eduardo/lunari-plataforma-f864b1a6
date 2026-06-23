/**
 * Workflow feature — entry-point único.
 * Onda 1: expõe domain + store. Demais camadas chegam nas próximas ondas.
 */

// Domain
export type { WorkflowSession, WorkflowSessionClienteEmbed } from "./domain/session";
export { getSessionYearMonth, monthBucketKey, validateSessionInvariants } from "./domain/session";

export type { SessionPayment, PaymentTipo, PaymentStatus, PaymentOrigem, PaymentFilterStatus } from "./domain/payment";
export { derivePaymentFilterStatus } from "./domain/payment";

export { toReais, toCentavos, fromCentavos, formatBRL } from "./domain/money";

export { deriveValorTotal, deriveRestante, recalcFotosExtras, recalcSessionValorTotal } from "./domain/pricing";

export type { WorkflowFilterInput } from "./domain/filters";
export { applyFilters, countSituacao } from "./domain/filters";

export type { SortDirection, WorkflowSortField } from "./domain/sort";
export { sortSessions, defaultDateSort } from "./domain/sort";

// Store
export { workflowStore } from "./store/workflowStore";
export type { WorkflowStore } from "./store/workflowStore";
export {
  selectMonthSessions,
  selectFilteredSorted,
  selectMonthMetrics,
  selectSituacaoCounts,
} from "./store/selectors";
export type { MonthMetrics } from "./store/selectors";

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

// Data (Onda 2)
export { sessionsRepo, transactionsRepo, workflowRpc } from "./data";
export type {
  SessionsRepo,
  TransactionsRepo,
  WorkflowTransacao,
  WorkflowRpc,
  WorkflowDeleteAction,
  WorkflowDeleteResult,
} from "./data";

// Realtime (Onda 3 — flag VITE_WORKFLOW_REALTIME_V2)
export { WorkflowRealtimeBridge, useWorkflowRealtimeV2 } from "./realtime";

// AI surface (Onda 6)
export {
  listWorkflowAITools,
  workflowAIToolMap,
  buildWorkflowPageSnapshot,
  snapshotForActiveMonth,
  debugSnapshot,
  canUserRun,
  needsHumanApproval,
  listWorkflowCapabilityIds,
  WORKFLOW_PERMISSIONS,
  REQUIRES_APPROVAL,
} from "./ai";
export type { WorkflowAITool, WorkflowPageSnapshot, WorkflowPermission } from "./ai";

// Legacy hook shim — temporário até 6.2/6.3 migrarem para capabilities + repos.
// NÃO use em código novo. Importe capabilities de `@/features/workflow` (queries/commands).
export { useWorkflowRealtime } from "@/hooks/useWorkflowRealtime";

/**
 * Entry-point público do módulo Finance.
 *
 * Ondas entregues:
 *  - 1: domain + stores
 *  - 2: ports + infra Supabase
 *  - 3: realtime unificado
 *  - 4: application (commands + queries) — registrados no registry global
 */

export * from "./domain/types";
export * from "./domain/events";
export * from "./domain/nature";
export * from "./domain/group";
export * as financeRules from "./domain/rules";
export * as financeSelectors from "./domain/selectors";
export * as financeKpis from "./domain/selectorsByNature";

export { transactionsStore } from "./presentation/store/transactionsStore";
export { itemsStore } from "./presentation/store/itemsStore";

// Ports (tipos abstratos)
export type * from "./ports";

// Infra Supabase (impl default)
export {
  supabaseTransactionsRepo,
  supabaseItemsRepo,
  supabaseExtratoRepo,
  supabaseGoalsRepo,
} from "./infrastructure/supabase";

// Realtime
export { financeRealtime } from "./infrastructure/realtime/financeRealtimeChannel";
export { FinanceRealtimeBridge } from "./infrastructure/realtime/FinanceRealtimeBridge";

// Eventos (declaration merging em LunariEvents)
import "./application/events";

// Capabilities — efeito colateral: registram-se no registry global
import "./application/commands/createTransaction";
import "./application/commands/updateTransaction";
import "./application/commands/deleteTransaction";
import "./application/commands/markTransactionPaid";
import "./application/commands/markTransactionPending";
import "./application/commands/createFinancialItem";
import "./application/commands/setGoal";
import "./application/queries/listFinancialItems";
import "./application/queries/listGoals";
import "./application/queries/goalsProgress";
import "./application/queries/listExtrato";
import "./application/queries/extratoSummary";
import "./application/queries/dashboardKpis";

// Re-export para uso direto
export { createTransaction } from "./application/commands/createTransaction";
export { updateTransaction } from "./application/commands/updateTransaction";
export { deleteTransaction } from "./application/commands/deleteTransaction";
export { markTransactionPaid } from "./application/commands/markTransactionPaid";
export { markTransactionPending } from "./application/commands/markTransactionPending";
export { createFinancialItem } from "./application/commands/createFinancialItem";
export { setGoal } from "./application/commands/setGoal";
export { listFinancialItems } from "./application/queries/listFinancialItems";
export { listGoals } from "./application/queries/listGoals";
export { goalsProgress } from "./application/queries/goalsProgress";
export { listExtrato } from "./application/queries/listExtrato";
export { extratoSummary } from "./application/queries/extratoSummary";
export { dashboardKpis } from "./application/queries/dashboardKpis";


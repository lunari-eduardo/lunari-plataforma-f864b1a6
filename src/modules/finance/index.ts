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
import "./application/commands/createCategory";
import "./application/commands/setGoal";
import "./application/commands/grantClientCredit";
import "./application/commands/applyClientCredit";
import "./application/commands/revokeClientCredit";
import "./application/queries/listFinancialItems";
import "./application/queries/listGoals";
import "./application/queries/goalsProgress";
import "./application/queries/listExtrato";
import "./application/queries/extratoSummary";
import "./application/queries/dashboardKpis";
import "./application/queries/listNatures";
import "./application/queries/listGroups";
import "./application/queries/listCategories";
import "./application/queries/kpisByNature";
import "./application/queries/kpisByNatureRange";
import "./application/queries/getClientCredit";

// Re-export para uso direto
export { createTransaction } from "./application/commands/createTransaction";
export { updateTransaction } from "./application/commands/updateTransaction";
export { deleteTransaction } from "./application/commands/deleteTransaction";
export { markTransactionPaid } from "./application/commands/markTransactionPaid";
export { markTransactionPending } from "./application/commands/markTransactionPending";
export { createFinancialItem } from "./application/commands/createFinancialItem";
export { createCategory } from "./application/commands/createCategory";
export { setGoal } from "./application/commands/setGoal";
export { grantClientCredit } from "./application/commands/grantClientCredit";
export { applyClientCredit } from "./application/commands/applyClientCredit";
export { revokeClientCredit } from "./application/commands/revokeClientCredit";
export { listFinancialItems } from "./application/queries/listFinancialItems";
export { listGoals } from "./application/queries/listGoals";
export { goalsProgress } from "./application/queries/goalsProgress";
export { listExtrato } from "./application/queries/listExtrato";
export { extratoSummary } from "./application/queries/extratoSummary";
export { dashboardKpis } from "./application/queries/dashboardKpis";
export { listNatures } from "./application/queries/listNatures";
export { listGroups } from "./application/queries/listGroups";
export { listCategories } from "./application/queries/listCategories";
export { kpisByNature } from "./application/queries/kpisByNature";
export { kpisByNatureRange } from "./application/queries/kpisByNatureRange";
export { getClientCredit } from "./application/queries/getClientCredit";


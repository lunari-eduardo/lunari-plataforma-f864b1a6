/**
 * Entry-point público do módulo Finance.
 *
 * Onda 1 entregue:
 *  - domain/{types,events,rules,selectors}
 *  - presentation/store/{transactionsStore,itemsStore}
 *
 * Próxima: Onda 2 (ports + infra Supabase).
 */

export * from "./domain/types";
export * from "./domain/events";
export * as financeRules from "./domain/rules";
export * as financeSelectors from "./domain/selectors";

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

// Realtime (Onda 3)
export { financeRealtime } from "./infrastructure/realtime/financeRealtimeChannel";
export { FinanceRealtimeBridge } from "./infrastructure/realtime/FinanceRealtimeBridge";

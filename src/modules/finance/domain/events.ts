/**
 * Catálogo de eventos do módulo Finance.
 * Publicados via shared event-bus; consumidos por Notificações, Dashboard, Lu.
 */

import type { Transacao, ItemFinanceiro, MetaPersonalizada } from "./types";

export type FinanceEvent =
  | { type: "finance.transaction.created"; transaction: Transacao; actor: "user" | "automation" | "ai" }
  | { type: "finance.transaction.updated"; id: string; patch: Partial<Transacao>; actor: "user" | "automation" | "ai" }
  | { type: "finance.transaction.deleted"; id: string; actor: "user" | "automation" | "ai" }
  | { type: "finance.transaction.paid"; id: string; at: string; actor: "user" | "automation" | "ai" }
  | { type: "finance.transaction.reopened"; id: string; actor: "user" | "automation" | "ai" }
  | { type: "finance.item.created"; item: ItemFinanceiro; actor: "user" | "automation" | "ai" }
  | { type: "finance.goal.upserted"; goal: MetaPersonalizada; actor: "user" | "automation" | "ai" };

export type FinanceEventType = FinanceEvent["type"];

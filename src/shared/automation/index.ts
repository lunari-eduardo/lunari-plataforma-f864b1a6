/**
 * Automation Engine v1 (ADR-006) — port + store.
 *
 * Automation é a ÚNICA engine autorizada a chamar `Kernel.execute`
 * autonomamente. Nunca dispara sem uma regra explícita do fotógrafo
 * (`automation_rules.enabled = true`) e sempre respeita o kill-switch
 * global (`app_settings.automation_enabled`).
 *
 * Regras invioláveis:
 *  - Uma proposta só executa com sucesso UMA vez (unique index em
 *    `automation_runs(user_id, proposal_id) WHERE status='ok'`).
 *  - Toda tentativa é logada em `automation_runs` — sucesso, falha,
 *    denied, approval_required ou skipped.
 *  - Automation só considera propostas `status='accepted'` (usuário
 *    já disse "sim") cuja severidade &le; `rule.severity_max`.
 */

import { supabase } from "@/integrations/supabase/client";

export type AutomationRunStatus =
  | "ok"
  | "failed"
  | "skipped"
  | "denied"
  | "approval_required";

export interface AutomationRule {
  id: string;
  user_id: string;
  capability_id: string;
  source_kind: string | null;
  severity_max: "info" | "warn" | "crit";
  enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: string;
  user_id: string;
  rule_id: string | null;
  proposal_id: string | null;
  capability_id: string;
  actor: string;
  status: AutomationRunStatus;
  result: unknown;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export interface AutomationRuleUpsert {
  id?: string;
  capabilityId: string;
  sourceKind?: string | null;
  severityMax?: "info" | "warn" | "crit";
  enabled?: boolean;
  notes?: string | null;
}

export interface AutomationRunInsert {
  ruleId: string | null;
  proposalId: string | null;
  capabilityId: string;
  actor: string;
  status: AutomationRunStatus;
  result?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface AutomationStore {
  listRules(userId: string, filter?: { enabled?: boolean }): Promise<AutomationRule[]>;
  upsertRule(userId: string, row: AutomationRuleUpsert): Promise<AutomationRule>;
  deleteRule(userId: string, id: string): Promise<boolean>;
  listRuns(userId: string, filter?: { limit?: number }): Promise<AutomationRun[]>;
  recordRun(userId: string, row: AutomationRunInsert): Promise<AutomationRun | null>;
  isKillSwitchOn(): Promise<boolean>;
  /** Retorna IDs de propostas já executadas com sucesso — para pular no tick. */
  listAlreadyExecuted(userId: string, proposalIds: string[]): Promise<Set<string>>;
}

const SEVERITY_ORDER: Record<"info" | "warn" | "crit", number> = { info: 0, warn: 1, crit: 2 };
export function severityAllowed(
  proposalSeverity: "info" | "warn" | "crit",
  ruleMax: "info" | "warn" | "crit",
): boolean {
  return SEVERITY_ORDER[proposalSeverity] <= SEVERITY_ORDER[ruleMax];
}

export const automationStore: AutomationStore = {
  async listRules(userId, filter) {
    let q = supabase
      .from("automation_rules")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (typeof filter?.enabled === "boolean") q = q.eq("enabled", filter.enabled);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as AutomationRule[];
  },

  async upsertRule(userId, row) {
    const payload = {
      ...(row.id ? { id: row.id } : {}),
      user_id: userId,
      capability_id: row.capabilityId,
      source_kind: row.sourceKind ?? null,
      severity_max: row.severityMax ?? "info",
      enabled: row.enabled ?? false,
      notes: row.notes ?? null,
    };
    const { data, error } = await supabase
      .from("automation_rules")
      .upsert(payload, { onConflict: "user_id,capability_id,source_kind" })
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as AutomationRule;
  },

  async deleteRule(userId, id) {
    const { error, count } = await supabase
      .from("automation_rules")
      .delete({ count: "exact" })
      .eq("user_id", userId)
      .eq("id", id);
    if (error) throw error;
    return (count ?? 0) > 0;
  },

  async listRuns(userId, filter) {
    const { data, error } = await supabase
      .from("automation_runs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(filter?.limit ?? 50);
    if (error) throw error;
    return (data ?? []) as unknown as AutomationRun[];
  },

  async recordRun(userId, row) {
    const payload = {
      user_id: userId,
      rule_id: row.ruleId,
      proposal_id: row.proposalId,
      capability_id: row.capabilityId,
      actor: row.actor,
      status: row.status,
      result: (row.result ?? null) as never,
      error_code: row.errorCode ?? null,
      error_message: row.errorMessage ?? null,
    };
    const { data, error } = await supabase
      .from("automation_runs")
      .insert(payload)
      .select("*")
      .maybeSingle();
    if (error) {
      // Duplicate on unique index (proposta já executada) — não é erro real.
      if ((error as { code?: string }).code === "23505") return null;
      throw error;
    }
    return (data as unknown as AutomationRun) ?? null;
  },

  async isKillSwitchOn() {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "automation_enabled")
      .maybeSingle();
    if (error) throw error;
    // kill-switch "ON" = automação HABILITADA. default: false.
    return (data?.value as unknown) === true;
  },

  async listAlreadyExecuted(userId, proposalIds) {
    if (proposalIds.length === 0) return new Set();
    const { data, error } = await supabase
      .from("automation_runs")
      .select("proposal_id")
      .eq("user_id", userId)
      .eq("status", "ok")
      .in("proposal_id", proposalIds);
    if (error) throw error;
    return new Set((data ?? []).map((r) => r.proposal_id as string).filter(Boolean));
  },
};

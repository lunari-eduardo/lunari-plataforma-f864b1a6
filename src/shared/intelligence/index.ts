/**
 * Intelligence Engine v1 (ADR-004) — port + store.
 *
 * A engine LÊ Observation/Context/Memory/Knowledge e PRODUZ significado
 * (sinais interpretados). NUNCA decide ação. Decision consome Intelligence.
 *
 * Regras invioláveis:
 *  - Sinais são idempotentes por `(user_id, kind, scope_key)`.
 *  - Recomputação sobrescreve o sinal anterior sem histórico (é derivado).
 *  - `reasons` é lista curta de strings humanas (auditável, ≤ 4KB — CHECK no banco).
 */

import { supabase } from "@/integrations/supabase/client";

export type IntelligenceKind =
  | "session.health"
  | "finance.anomaly.month"
  | "client.at_risk";

export type IntelligenceSeverity = "info" | "warn" | "crit";

export interface IntelligenceSignal {
  id: string;
  user_id: string;
  kind: IntelligenceKind;
  scope_key: string;
  severity: IntelligenceSeverity;
  score: number;
  reasons: string[];
  inputs_hash: string | null;
  computed_at: string;
  expires_at: string;
}

export interface IntelligenceUpsert {
  userId: string;
  kind: IntelligenceKind;
  scopeKey: string;
  severity: IntelligenceSeverity;
  score: number;
  reasons: string[];
  inputsHash?: string | null;
  expiresAt?: string | null;
}

export interface IntelligenceStore {
  list(
    userId: string,
    filter?: { kind?: IntelligenceKind; onlyActive?: boolean; limit?: number },
  ): Promise<IntelligenceSignal[]>;
  upsertMany(userId: string, signals: IntelligenceUpsert[]): Promise<IntelligenceSignal[]>;
  clearKindScope(userId: string, kind: IntelligenceKind, scopeKey?: string): Promise<number>;
}

function ensureReasonsSize(reasons: string[]): void {
  const size = JSON.stringify(reasons ?? []).length;
  if (size > 4096) {
    throw new Error(`intelligence reasons excede 4KB (${size} bytes) — enxute.`);
  }
}

export const intelligenceStore: IntelligenceStore = {
  async list(userId, filter) {
    let q = supabase
      .from("intelligence_signals")
      .select("*")
      .eq("user_id", userId)
      .order("computed_at", { ascending: false });
    if (filter?.kind) q = q.eq("kind", filter.kind);
    if (filter?.onlyActive) q = q.gt("expires_at", new Date().toISOString());
    if (filter?.limit) q = q.limit(filter.limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as IntelligenceSignal[];
  },

  async upsertMany(userId, signals) {
    if (signals.length === 0) return [];
    const rows = signals.map((s) => {
      ensureReasonsSize(s.reasons);
      return {
        user_id: userId,
        kind: s.kind,
        scope_key: s.scopeKey,
        severity: s.severity,
        score: s.score,
        reasons: s.reasons as never,
        inputs_hash: s.inputsHash ?? null,
        computed_at: new Date().toISOString(),
        expires_at:
          s.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    });
    const { data, error } = await supabase
      .from("intelligence_signals")
      .upsert(rows, { onConflict: "user_id,kind,scope_key" })
      .select("*");
    if (error) throw error;
    return (data ?? []) as unknown as IntelligenceSignal[];
  },

  async clearKindScope(userId, kind, scopeKey) {
    let q = supabase
      .from("intelligence_signals")
      .delete({ count: "exact" })
      .eq("user_id", userId)
      .eq("kind", kind);
    if (scopeKey) q = q.eq("scope_key", scopeKey);
    const { error, count } = await q;
    if (error) throw error;
    return count ?? 0;
  },
};

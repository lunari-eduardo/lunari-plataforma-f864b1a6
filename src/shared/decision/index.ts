/**
 * Decision Engine v1 (ADR-004) — port + store.
 *
 * Decision LÊ Intelligence + Context + Policy e PRODUZ propostas concretas
 * (`capability_id + input + rationale`). NUNCA executa. A execução ocorre
 * via Kernel, sempre disparada por humano (v1) — Automation (Onda 12)
 * poderá disparar autonomamente no futuro (ADR-006).
 *
 * Regras invioláveis:
 *  - Propostas são idempotentes por (user_id, capability_id, source_kind, source_scope_key).
 *  - Recomputar sobrescreve computed_at/severity/score/rationale; NÃO ressuscita
 *    propostas `dismissed` (usuário já rejeitou).
 *  - `rationale` ≤ 4KB, `input` ≤ 8KB (CHECKs no banco).
 */

import { supabase } from "@/integrations/supabase/client";

export type DecisionStatus = "open" | "dismissed" | "accepted" | "expired";
export type DecisionSeverity = "info" | "warn" | "crit";

export interface DecisionProposal {
  id: string;
  user_id: string;
  capability_id: string;
  input: Record<string, unknown>;
  rationale: string[];
  source_kind: string;
  source_scope_key: string;
  severity: DecisionSeverity;
  score: number;
  status: DecisionStatus;
  computed_at: string;
  expires_at: string;
}

export interface DecisionUpsert {
  userId: string;
  capabilityId: string;
  input: Record<string, unknown>;
  rationale: string[];
  sourceKind: string;
  sourceScopeKey: string;
  severity: DecisionSeverity;
  score: number;
  expiresAt?: string | null;
}

export interface DecisionStore {
  list(
    userId: string,
    filter?: { status?: DecisionStatus; onlyActive?: boolean; limit?: number },
  ): Promise<DecisionProposal[]>;
  upsertMany(userId: string, proposals: DecisionUpsert[]): Promise<DecisionProposal[]>;
  setStatus(userId: string, id: string, status: DecisionStatus): Promise<DecisionProposal | null>;
}

function ensureSizes(rationale: string[], input: Record<string, unknown>): void {
  const r = JSON.stringify(rationale ?? []).length;
  if (r > 4096) throw new Error(`decision rationale excede 4KB (${r} bytes)`);
  const i = JSON.stringify(input ?? {}).length;
  if (i > 8192) throw new Error(`decision input excede 8KB (${i} bytes)`);
}

export const decisionStore: DecisionStore = {
  async list(userId, filter) {
    let q = supabase
      .from("decision_proposals")
      .select("*")
      .eq("user_id", userId)
      .order("computed_at", { ascending: false });
    if (filter?.status) q = q.eq("status", filter.status);
    if (filter?.onlyActive) {
      q = q.eq("status", "open").gt("expires_at", new Date().toISOString());
    }
    if (filter?.limit) q = q.limit(filter.limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as DecisionProposal[];
  },

  async upsertMany(userId, proposals) {
    if (proposals.length === 0) return [];
    // 1) Buscar propostas dismissed para respeitar rejeições anteriores.
    const keys = proposals.map((p) => ({
      capability_id: p.capabilityId,
      source_kind: p.sourceKind,
      source_scope_key: p.sourceScopeKey,
    }));
    const capIds = Array.from(new Set(keys.map((k) => k.capability_id)));
    const { data: existing, error: exErr } = await supabase
      .from("decision_proposals")
      .select("capability_id, source_kind, source_scope_key, status")
      .eq("user_id", userId)
      .in("capability_id", capIds);
    if (exErr) throw exErr;
    const dismissed = new Set(
      (existing ?? [])
        .filter((r) => r.status === "dismissed")
        .map((r) => `${r.capability_id}|${r.source_kind}|${r.source_scope_key}`),
    );

    const rows = proposals
      .filter(
        (p) => !dismissed.has(`${p.capabilityId}|${p.sourceKind}|${p.sourceScopeKey}`),
      )
      .map((p) => {
        ensureSizes(p.rationale, p.input);
        return {
          user_id: userId,
          capability_id: p.capabilityId,
          input: p.input as never,
          rationale: p.rationale as never,
          source_kind: p.sourceKind,
          source_scope_key: p.sourceScopeKey,
          severity: p.severity,
          score: p.score,
          status: "open" as const,
          computed_at: new Date().toISOString(),
          expires_at:
            p.expiresAt ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        };
      });
    if (rows.length === 0) return [];
    const { data, error } = await supabase
      .from("decision_proposals")
      .upsert(rows, { onConflict: "user_id,capability_id,source_kind,source_scope_key" })
      .select("*");
    if (error) throw error;
    return (data ?? []) as unknown as DecisionProposal[];
  },

  async setStatus(userId, id, status) {
    const { data, error } = await supabase
      .from("decision_proposals")
      .update({ status })
      .eq("user_id", userId)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as DecisionProposal) ?? null;
  },
};

/**
 * Learning Engine v1 (ADR-005) — port + store.
 *
 * Learning LÊ Decision (accepted/dismissed history) e Observation (futuro)
 * e PRODUZ patches: sugestões de mudanças em Memory ou de "mute" de fontes
 * de sinal com baixa aceitação. NUNCA aplica patches automaticamente —
 * humano confirma via `learning.patches.apply`.
 *
 * Regras invioláveis:
 *  - Patterns são idempotentes por (user_id, capability_id, source_kind).
 *  - Patches idempotentes por (user_id, pattern_id, patch_kind, target).
 *  - Learning nunca escreve em Memory diretamente; apenas propõe o patch.
 *  - Aplicação de patch chama capability específica (memory.remember, etc.).
 */

import { supabase } from "@/integrations/supabase/client";

export type LearningPatternStatus = "active" | "muted";
export type LearningPatchStatus = "open" | "applied" | "dismissed";
export type LearningPatchKind =
  | "memory.remember"
  | "memory.forget"
  | "decision.mute_source";

export interface LearningPattern {
  id: string;
  user_id: string;
  capability_id: string;
  source_kind: string;
  accepted_count: number;
  dismissed_count: number;
  sample_size: number;
  acceptance_rate: number;
  signal_strength: number;
  status: LearningPatternStatus;
  last_computed_at: string;
  created_at: string;
  updated_at: string;
}

export interface LearningPatch {
  id: string;
  user_id: string;
  pattern_id: string;
  patch_kind: LearningPatchKind;
  target: string;
  payload: Record<string, unknown>;
  rationale: string[];
  status: LearningPatchStatus;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LearningPatternUpsert {
  capabilityId: string;
  sourceKind: string;
  acceptedCount: number;
  dismissedCount: number;
}

export interface LearningPatchUpsert {
  patternId: string;
  patchKind: LearningPatchKind;
  target: string;
  payload: Record<string, unknown>;
  rationale: string[];
}

export interface LearningStore {
  listPatterns(
    userId: string,
    filter?: { status?: LearningPatternStatus; limit?: number },
  ): Promise<LearningPattern[]>;
  upsertPatterns(
    userId: string,
    rows: LearningPatternUpsert[],
  ): Promise<LearningPattern[]>;
  setPatternStatus(
    userId: string,
    id: string,
    status: LearningPatternStatus,
  ): Promise<LearningPattern | null>;
  listPatches(
    userId: string,
    filter?: { status?: LearningPatchStatus; limit?: number },
  ): Promise<LearningPatch[]>;
  upsertPatches(userId: string, rows: LearningPatchUpsert[]): Promise<LearningPatch[]>;
  setPatchStatus(
    userId: string,
    id: string,
    status: LearningPatchStatus,
  ): Promise<LearningPatch | null>;
}

/** Signal strength: |acceptance_rate - 0.5| * 2, ponderada por sample_size (Wilson-lite). */
export function computeSignalStrength(accepted: number, dismissed: number): {
  rate: number;
  strength: number;
  sample: number;
} {
  const n = accepted + dismissed;
  if (n === 0) return { rate: 0, strength: 0, sample: 0 };
  const rate = accepted / n;
  const confidence = Math.min(1, n / 10); // 10 amostras = confiança máxima
  const strength = Math.abs(rate - 0.5) * 2 * confidence;
  return { rate: Number(rate.toFixed(4)), strength: Number(strength.toFixed(4)), sample: n };
}

function ensurePatchSize(payload: Record<string, unknown>): void {
  const size = JSON.stringify(payload ?? {}).length;
  if (size > 8192) throw new Error(`learning patch payload excede 8KB (${size} bytes)`);
}

export const learningStore: LearningStore = {
  async listPatterns(userId, filter) {
    let q = supabase
      .from("learning_patterns")
      .select("*")
      .eq("user_id", userId)
      .order("signal_strength", { ascending: false });
    if (filter?.status) q = q.eq("status", filter.status);
    if (filter?.limit) q = q.limit(filter.limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as LearningPattern[];
  },

  async upsertPatterns(userId, rows) {
    if (rows.length === 0) return [];
    const payload = rows.map((r) => {
      const { rate, strength, sample } = computeSignalStrength(
        r.acceptedCount,
        r.dismissedCount,
      );
      return {
        user_id: userId,
        capability_id: r.capabilityId,
        source_kind: r.sourceKind,
        accepted_count: r.acceptedCount,
        dismissed_count: r.dismissedCount,
        sample_size: sample,
        acceptance_rate: rate,
        signal_strength: strength,
        last_computed_at: new Date().toISOString(),
      };
    });
    const { data, error } = await supabase
      .from("learning_patterns")
      .upsert(payload, { onConflict: "user_id,capability_id,source_kind" })
      .select("*");
    if (error) throw error;
    return (data ?? []) as unknown as LearningPattern[];
  },

  async setPatternStatus(userId, id, status) {
    const { data, error } = await supabase
      .from("learning_patterns")
      .update({ status })
      .eq("user_id", userId)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as LearningPattern) ?? null;
  },

  async listPatches(userId, filter) {
    let q = supabase
      .from("learning_patches")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (filter?.status) q = q.eq("status", filter.status);
    if (filter?.limit) q = q.limit(filter.limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as LearningPatch[];
  },

  async upsertPatches(userId, rows) {
    if (rows.length === 0) return [];
    const payload = rows.map((r) => {
      ensurePatchSize(r.payload);
      return {
        user_id: userId,
        pattern_id: r.patternId,
        patch_kind: r.patchKind,
        target: r.target,
        payload: r.payload as never,
        rationale: r.rationale as never,
        status: "open" as const,
      };
    });
    const { data, error } = await supabase
      .from("learning_patches")
      .upsert(payload, {
        onConflict: "user_id,pattern_id,patch_kind,target",
        ignoreDuplicates: false,
      })
      .select("*");
    if (error) throw error;
    return (data ?? []) as unknown as LearningPatch[];
  },

  async setPatchStatus(userId, id, status) {
    const patch: Record<string, unknown> = { status };
    if (status === "applied") patch.applied_at = new Date().toISOString();
    const { data, error } = await supabase
      .from("learning_patches")
      .update(patch)
      .eq("user_id", userId)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as LearningPatch) ?? null;
  },
};

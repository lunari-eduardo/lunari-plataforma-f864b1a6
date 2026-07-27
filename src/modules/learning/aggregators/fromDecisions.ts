/**
 * Onda 11 — Learning Engine v1: recomputação de padrões a partir de decisions.
 *
 * Agrega `decision_proposals` do usuário nos últimos 90 dias por
 * (capability_id, source_kind), contando `accepted` vs `dismissed`.
 * Ignora `open` e `expired`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { LearningPatternUpsert } from "@/shared/learning";

const WINDOW_DAYS = 90;

export async function recomputePatternsFromDecisions(
  userId: string,
): Promise<LearningPatternUpsert[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400 * 1000).toISOString();
  const { data, error } = await supabase
    .from("decision_proposals")
    .select("capability_id, source_kind, status, computed_at")
    .eq("user_id", userId)
    .gt("computed_at", since)
    .in("status", ["accepted", "dismissed"])
    .limit(1000);
  if (error) throw error;

  const agg = new Map<string, LearningPatternUpsert>();
  for (const row of data ?? []) {
    const key = `${row.capability_id}|${row.source_kind}`;
    const prev = agg.get(key) ?? {
      capabilityId: row.capability_id,
      sourceKind: row.source_kind,
      acceptedCount: 0,
      dismissedCount: 0,
    };
    if (row.status === "accepted") prev.acceptedCount += 1;
    else if (row.status === "dismissed") prev.dismissedCount += 1;
    agg.set(key, prev);
  }
  return Array.from(agg.values());
}

import type { LearningPattern, LearningPatchUpsert } from "@/shared/learning";

/**
 * Regras heurísticas: dado um pattern com sinal suficiente, propõe patches.
 *
 * - sample_size ≥ 5 é o mínimo para propor.
 * - acceptance_rate ≥ 0.8 → memory.remember (preferência: favorecer capability).
 * - acceptance_rate ≤ 0.2 → decision.mute_source (silenciar fonte para essa capability).
 * - Casos intermediários não geram patch.
 */
export function derivePatchesFromPattern(pattern: LearningPattern): LearningPatchUpsert[] {
  if (pattern.sample_size < 5) return [];
  const patches: LearningPatchUpsert[] = [];
  if (pattern.acceptance_rate >= 0.8) {
    patches.push({
      patternId: pattern.id,
      patchKind: "memory.remember",
      target: `preference.decision.favor.${pattern.capability_id}`,
      payload: {
        scope: "user",
        key: `preference.decision.favor.${pattern.capability_id}`,
        value: {
          capability_id: pattern.capability_id,
          source_kind: pattern.source_kind,
          acceptance_rate: pattern.acceptance_rate,
          sample_size: pattern.sample_size,
        },
      },
      rationale: [
        `Usuário aceitou ${pattern.accepted_count}/${pattern.sample_size} propostas para ${pattern.capability_id}.`,
        `Taxa de aceitação: ${(pattern.acceptance_rate * 100).toFixed(0)}%.`,
        "Sugestão: marcar como preferência para priorizar em rankings futuros.",
      ],
    });
  } else if (pattern.acceptance_rate <= 0.2) {
    patches.push({
      patternId: pattern.id,
      patchKind: "decision.mute_source",
      target: `${pattern.capability_id}|${pattern.source_kind}`,
      payload: {
        capability_id: pattern.capability_id,
        source_kind: pattern.source_kind,
        dismissed_count: pattern.dismissed_count,
      },
      rationale: [
        `Usuário rejeitou ${pattern.dismissed_count}/${pattern.sample_size} propostas para ${pattern.capability_id}.`,
        `Taxa de aceitação: ${(pattern.acceptance_rate * 100).toFixed(0)}%.`,
        "Sugestão: silenciar essa combinação de fonte + capability.",
      ],
    });
  }
  return patches;
}

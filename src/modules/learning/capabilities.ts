import { z } from "zod";
import { defineQuery, defineCommand } from "@/shared/capability";
import { ok, err, domainError } from "@/shared/result";
import {
  learningStore,
  type LearningPatternStatus,
  type LearningPatchStatus,
} from "@/shared/learning";
import { memoryStore } from "@/shared/memory";
import { recomputePatternsFromDecisions } from "./aggregators/fromDecisions";
import { derivePatchesFromPattern } from "./proposers/patternToPatch";

/**
 * Onda 11 — Learning Engine v1 (ADR-005).
 *
 * Learning LÊ o histórico de decisões (accepted/dismissed) e propõe patches
 * para Memory ou "mutes" para Decision. NUNCA aplica automaticamente:
 * `learning.patches.apply` exige aprovação humana.
 *
 * Capabilities:
 *   learning.patterns.list  — lista padrões detectados.
 *   learning.recompute      — reagrega decisions → patterns → patches.
 *   learning.patches.list   — lista patches propostos.
 *   learning.patches.apply  — aplica patch (approval).
 *   learning.patches.dismiss — rejeita patch (approval).
 */

const PatternStatus = z.enum(["active", "muted"]);
const PatchStatus = z.enum(["open", "applied", "dismissed"]);
const PatchKind = z.enum(["memory.remember", "memory.forget", "decision.mute_source"]);

const PatternSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  capability_id: z.string(),
  source_kind: z.string(),
  accepted_count: z.number(),
  dismissed_count: z.number(),
  sample_size: z.number(),
  acceptance_rate: z.number(),
  signal_strength: z.number(),
  status: PatternStatus,
  last_computed_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const PatchSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  pattern_id: z.string(),
  patch_kind: PatchKind,
  target: z.string(),
  payload: z.record(z.unknown()),
  rationale: z.array(z.string()),
  status: PatchStatus,
  applied_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const learningPatternsListCapability = defineQuery({
  id: "learning.patterns.list",
  title: "Listar padrões aprendidos",
  description:
    "Lista padrões (`capability_id + source_kind`) com contagens de aceitação/rejeição do usuário. Somente leitura.",
  input: z.object({
    status: PatternStatus.optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  output: z.object({ patterns: z.array(PatternSchema) }),
  permissions: ["learning:read"],
  costHint: "cheap",
  async handler(input, ctx) {
    if (!ctx.user?.id) {
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    }
    try {
      const patterns = await learningStore.listPatterns(ctx.user.id, {
        status: input.status as LearningPatternStatus | undefined,
        limit: input.limit,
      });
      return ok({ patterns: patterns as never });
    } catch (e) {
      return err(
        domainError("LEARNING_READ_FAILED", "Não foi possível ler os padrões.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

export const learningRecomputeCapability = defineCommand({
  id: "learning.recompute",
  title: "Recomputar aprendizado",
  description:
    "Agrega decisões aceitas/rejeitadas dos últimos 90 dias, atualiza padrões e materializa patches sugeridos. Idempotente.",
  input: z.object({}).optional().default({}),
  output: z.object({
    patternsWritten: z.number().int(),
    patchesWritten: z.number().int(),
  }),
  permissions: ["learning:write"],
  costHint: "medium",
  sideEffects: ["db:learning_patterns.write", "db:learning_patches.write"],
  idempotencyKey: () => "learning.recompute",
  async handler(_input, ctx) {
    if (!ctx.user?.id) {
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    }
    try {
      const upserts = await recomputePatternsFromDecisions(ctx.user.id);
      const patterns = await learningStore.upsertPatterns(ctx.user.id, upserts);
      const patchInputs = patterns.flatMap((p) => derivePatchesFromPattern(p));
      const patches = await learningStore.upsertPatches(ctx.user.id, patchInputs);
      return ok({ patternsWritten: patterns.length, patchesWritten: patches.length });
    } catch (e) {
      return err(
        domainError("LEARNING_RECOMPUTE_FAILED", "Não foi possível recomputar aprendizado.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

export const learningPatchesListCapability = defineQuery({
  id: "learning.patches.list",
  title: "Listar patches propostos",
  description:
    "Lista patches gerados pelo Learning. Cada patch descreve uma mudança sugerida em Memory ou 'mute' de fonte de sinal. NUNCA é aplicado automaticamente.",
  input: z.object({
    status: PatchStatus.optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  output: z.object({ patches: z.array(PatchSchema) }),
  permissions: ["learning:read"],
  costHint: "cheap",
  async handler(input, ctx) {
    if (!ctx.user?.id) {
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    }
    try {
      const patches = await learningStore.listPatches(ctx.user.id, {
        status: (input.status as LearningPatchStatus | undefined) ?? undefined,
        limit: input.limit,
      });
      return ok({ patches: patches as never });
    } catch (e) {
      return err(
        domainError("LEARNING_READ_FAILED", "Não foi possível ler os patches.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

export const learningPatchesApplyCapability = defineCommand({
  id: "learning.patches.apply",
  title: "Aplicar patch de aprendizado",
  description:
    "Aplica um patch proposto: memory.remember grava em Memory; decision.mute_source marca o pattern como 'muted' para silenciar futuras propostas.",
  input: z.object({ id: z.string().uuid() }),
  output: z.object({ patch: PatchSchema.nullable() }),
  permissions: ["learning:write"],
  costHint: "cheap",
  sideEffects: [
    "db:learning_patches.write",
    "db:learning_patterns.write",
    "db:memory_entries.write",
  ],
  async handler(input, ctx) {
    if (!ctx.user?.id) {
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    }
    try {
      const list = await learningStore.listPatches(ctx.user.id, { limit: 200 });
      const patch = list.find((p) => p.id === input.id) ?? null;
      if (!patch) {
        return err(
          domainError("LEARNING_PATCH_NOT_FOUND", "Patch não encontrado.", { retriable: false }),
        );
      }
      if (patch.status !== "open") {
        return ok({ patch: patch as never });
      }

      if (patch.patch_kind === "memory.remember") {
        const payload = patch.payload as {
          scope?: "user" | "project" | "assistant";
          key?: string;
          value?: unknown;
        };
        if (!payload?.scope || !payload?.key) {
          return err(
            domainError("LEARNING_PATCH_INVALID", "Payload memory.remember inválido.", {
              retriable: false,
            }),
          );
        }
        await memoryStore.set({
          userId: ctx.user.id,
          scope: payload.scope,
          key: payload.key,
          value: payload.value,
          source: "inferred",
          confidence: 0.8,
        });
      } else if (patch.patch_kind === "memory.forget") {
        const payload = patch.payload as { scope?: "user" | "project" | "assistant"; key?: string };
        if (payload?.scope && payload?.key) {
          await memoryStore.forget(ctx.user.id, payload.scope, payload.key);
        }
      } else if (patch.patch_kind === "decision.mute_source") {
        await learningStore.setPatternStatus(ctx.user.id, patch.pattern_id, "muted");
      }

      const updated = await learningStore.setPatchStatus(ctx.user.id, patch.id, "applied");
      return ok({ patch: (updated as never) ?? null });
    } catch (e) {
      return err(
        domainError("LEARNING_APPLY_FAILED", "Não foi possível aplicar o patch.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

export const learningPatchesDismissCapability = defineCommand({
  id: "learning.patches.dismiss",
  title: "Rejeitar patch de aprendizado",
  description: "Marca um patch como rejeitado. Ele deixa de aparecer até nova recomputação.",
  input: z.object({ id: z.string().uuid() }),
  output: z.object({ patch: PatchSchema.nullable() }),
  permissions: ["learning:write"],
  costHint: "cheap",
  sideEffects: ["db:learning_patches.write"],
  async handler(input, ctx) {
    if (!ctx.user?.id) {
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    }
    try {
      const patch = await learningStore.setPatchStatus(ctx.user.id, input.id, "dismissed");
      return ok({ patch: (patch as never) ?? null });
    } catch (e) {
      return err(
        domainError("LEARNING_DISMISS_FAILED", "Não foi possível rejeitar o patch.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

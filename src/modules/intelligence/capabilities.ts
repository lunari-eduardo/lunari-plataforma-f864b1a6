import { z } from "zod";
import { defineQuery, defineCommand } from "@/shared/capability";
import { ok, err, domainError } from "@/shared/result";
import { intelligenceStore, type IntelligenceKind } from "@/shared/intelligence";
import { analyzeSessionHealth } from "./analyzers/sessionHealth";
import { analyzeFinanceAnomaly } from "./analyzers/financeAnomaly";
import { analyzeClientAtRisk } from "./analyzers/clientAtRisk";

/**
 * Onda 9 — Intelligence Engine v1 (ADR-004).
 *
 * Intelligence LÊ (Observation/Context/Memory) e PRODUZ significado.
 * Nunca decide ação — Decision Engine (Onda 10) consumirá esses sinais.
 *
 * `intelligence.list`    — lista sinais materializados (ativos por padrão).
 * `intelligence.refresh` — recomputa sinais de um `kind` (idempotente).
 */

const KindSchema = z.enum(["session.health", "finance.anomaly.month", "client.at_risk"]);
const SignalSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  kind: KindSchema,
  scope_key: z.string(),
  severity: z.enum(["info", "warn", "crit"]),
  score: z.number(),
  reasons: z.array(z.string()),
  inputs_hash: z.string().nullable(),
  computed_at: z.string(),
  expires_at: z.string(),
});

export const intelligenceListCapability = defineQuery({
  id: "intelligence.list",
  title: "Listar sinais interpretados",
  description:
    "Lista sinais materializados pela Intelligence Engine (health, anomalias, risco). Sem decisão de ação.",
  input: z.object({
    kind: KindSchema.optional(),
    onlyActive: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  output: z.object({ signals: z.array(SignalSchema) }),
  permissions: ["intelligence:read"],
  costHint: "cheap",
  async handler(input, ctx) {
    if (!ctx.user?.id) {
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    }
    try {
      const signals = await intelligenceStore.list(ctx.user.id, {
        kind: input.kind as IntelligenceKind | undefined,
        onlyActive: input.onlyActive ?? true,
        limit: input.limit,
      });
      return ok({ signals: signals as never });
    } catch (e) {
      return err(
        domainError("INTELLIGENCE_READ_FAILED", "Não foi possível ler os sinais.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

async function runAnalyzer(kind: IntelligenceKind, userId: string) {
  if (kind === "session.health") return analyzeSessionHealth(userId);
  if (kind === "finance.anomaly.month") return analyzeFinanceAnomaly(userId);
  return analyzeClientAtRisk(userId);
}

export const intelligenceRefreshCapability = defineCommand({
  id: "intelligence.refresh",
  title: "Recomputar sinais",
  description:
    "Recomputa sinais de um `kind` para o usuário atual. Idempotente por (user_id, kind, scope_key).",
  input: z.object({
    kind: KindSchema,
  }),
  output: z.object({
    kind: KindSchema,
    written: z.number().int(),
    signals: z.array(SignalSchema),
  }),
  permissions: ["intelligence:write"],
  costHint: "moderate",
  sideEffects: ["db.intelligence_signals.write"],
  idempotencyKey: (input) => `intelligence.refresh:${input.kind}`,
  async handler(input, ctx) {
    if (!ctx.user?.id) {
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    }
    try {
      const upserts = await runAnalyzer(input.kind as IntelligenceKind, ctx.user.id);
      const written = await intelligenceStore.upsertMany(ctx.user.id, upserts);
      return ok({
        kind: input.kind,
        written: written.length,
        signals: written as never,
      });
    } catch (e) {
      return err(
        domainError("INTELLIGENCE_REFRESH_FAILED", "Não foi possível recomputar sinais.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

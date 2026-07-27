import { z } from "zod";
import { defineQuery, defineCommand } from "@/shared/capability";
import { ok, err, domainError } from "@/shared/result";
import { decisionStore, type DecisionStatus } from "@/shared/decision";
import { intelligenceStore } from "@/shared/intelligence";
import { proposeFromSessionHealth } from "./proposers/sessionHealth";
import { proposeFromFinanceAnomaly } from "./proposers/financeAnomaly";
import { proposeFromClientAtRisk } from "./proposers/clientAtRisk";

/**
 * Onda 10 — Decision Engine v1 (ADR-004).
 *
 * Decision LÊ Intelligence + Context + Policy e PRODUZ propostas concretas
 * (`capability_id + input + rationale`). NUNCA executa. Humano aciona via UI
 * (Hub) ou Automation (Onda 12) fará isso autonomamente no futuro.
 *
 * `decision.list`     — lista propostas ativas (default) ou por status.
 * `decision.propose`  — recomputa propostas a partir dos sinais atuais.
 * `decision.dismiss`  — usuário rejeita proposta (não volta a aparecer).
 * `decision.accept`   — marca como aceita (execução real é responsabilidade do caller).
 */

const StatusSchema = z.enum(["open", "dismissed", "accepted", "expired"]);
const SeveritySchema = z.enum(["info", "warn", "crit"]);
const ProposalSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  capability_id: z.string(),
  input: z.record(z.unknown()),
  rationale: z.array(z.string()),
  source_kind: z.string(),
  source_scope_key: z.string(),
  severity: SeveritySchema,
  score: z.number(),
  status: StatusSchema,
  computed_at: z.string(),
  expires_at: z.string(),
});

export const decisionListCapability = defineQuery({
  id: "decision.list",
  title: "Listar propostas de ação",
  description:
    "Lista propostas geradas pelo Decision Engine (`capability_id + input + rationale`). Nunca executa.",
  input: z.object({
    status: StatusSchema.optional(),
    onlyActive: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  output: z.object({ proposals: z.array(ProposalSchema) }),
  permissions: ["decision:read"],
  costHint: "cheap",
  async handler(input, ctx) {
    if (!ctx.user?.id) {
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    }
    try {
      const proposals = await decisionStore.list(ctx.user.id, {
        status: input.status as DecisionStatus | undefined,
        onlyActive: input.onlyActive ?? (input.status ? false : true),
        limit: input.limit,
      });
      return ok({ proposals: proposals as never });
    } catch (e) {
      return err(
        domainError("DECISION_READ_FAILED", "Não foi possível ler as propostas.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

export const decisionProposeCapability = defineCommand({
  id: "decision.propose",
  title: "Recomputar propostas",
  description:
    "Lê sinais ativos da Intelligence e materializa propostas de ação. Idempotente; respeita propostas previamente rejeitadas pelo usuário.",
  input: z.object({}).optional().default({}),
  output: z.object({
    written: z.number().int(),
    proposals: z.array(ProposalSchema),
  }),
  permissions: ["decision:write"],
  costHint: "medium",
  sideEffects: ["db:decision_proposals.write"],
  idempotencyKey: () => `decision.propose`,
  async handler(_input, ctx) {
    if (!ctx.user?.id) {
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    }
    try {
      const signals = await intelligenceStore.list(ctx.user.id, { onlyActive: true, limit: 200 });
      const upserts = signals.flatMap((s) => {
        if (s.kind === "session.health") return proposeFromSessionHealth(ctx.user!.id, s);
        if (s.kind === "finance.anomaly.month")
          return proposeFromFinanceAnomaly(ctx.user!.id, s);
        if (s.kind === "client.at_risk") return proposeFromClientAtRisk(ctx.user!.id, s);
        return [];
      });
      const written = await decisionStore.upsertMany(ctx.user.id, upserts);
      return ok({ written: written.length, proposals: written as never });
    } catch (e) {
      return err(
        domainError("DECISION_PROPOSE_FAILED", "Não foi possível recomputar propostas.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

export const decisionDismissCapability = defineCommand({
  id: "decision.dismiss",
  title: "Rejeitar proposta",
  description: "Marca uma proposta como rejeitada. Ela não voltará a ser proposta.",
  input: z.object({ id: z.string().uuid() }),
  output: z.object({ proposal: ProposalSchema.nullable() }),
  permissions: ["decision:write"],
  costHint: "cheap",
  sideEffects: ["db:decision_proposals.write"],
  async handler(input, ctx) {
    if (!ctx.user?.id) {
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    }
    try {
      const p = await decisionStore.setStatus(ctx.user.id, input.id, "dismissed");
      return ok({ proposal: (p as never) ?? null });
    } catch (e) {
      return err(
        domainError("DECISION_DISMISS_FAILED", "Não foi possível rejeitar a proposta.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

export const decisionAcceptCapability = defineCommand({
  id: "decision.accept",
  title: "Marcar proposta como aceita",
  description:
    "Marca proposta como aceita. A execução real da capability sugerida é responsabilidade do caller (Kernel).",
  input: z.object({ id: z.string().uuid() }),
  output: z.object({ proposal: ProposalSchema.nullable() }),
  permissions: ["decision:write"],
  costHint: "cheap",
  sideEffects: ["db:decision_proposals.write"],
  async handler(input, ctx) {
    if (!ctx.user?.id) {
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    }
    try {
      const p = await decisionStore.setStatus(ctx.user.id, input.id, "accepted");
      return ok({ proposal: (p as never) ?? null });
    } catch (e) {
      return err(
        domainError("DECISION_ACCEPT_FAILED", "Não foi possível aceitar a proposta.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

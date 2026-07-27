import { z } from "zod";
import { defineQuery, defineCommand } from "@/shared/capability";
import { ok, err, domainError, isErr } from "@/shared/result";
import {
  automationStore,
  severityAllowed,
  type AutomationRule,
} from "@/shared/automation";
import { decisionStore, type DecisionProposal } from "@/shared/decision";
import { kernel, automationActor, isKernelApprovalRequired } from "@/shared/kernel";
import type { AuthUser } from "@/shared/ports";

/**
 * Onda 12 — Automation Engine v1 (ADR-006).
 *
 * Automation é a ÚNICA engine autorizada a chamar `Kernel.execute`
 * autonomamente. Sempre com `actor.channel="automation"`. Sempre gravando
 * em `automation_runs` (auditoria). Sempre respeitando kill-switch global.
 *
 * `automation.rules.list`   — lista regras do usuário.
 * `automation.rules.upsert` — cria/edita regra (exige aprovação humana).
 * `automation.rules.delete` — remove regra (exige aprovação humana).
 * `automation.runs.list`    — histórico auditável de execuções automáticas.
 * `automation.tick`         — dispara propostas aceitas que casam com regras
 *                             habilitadas. Idempotente por proposta.
 */

const SeveritySchema = z.enum(["info", "warn", "crit"]);

const RuleSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  capability_id: z.string(),
  source_kind: z.string().nullable(),
  severity_max: SeveritySchema,
  enabled: z.boolean(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const RunSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  rule_id: z.string().nullable(),
  proposal_id: z.string().nullable(),
  capability_id: z.string(),
  actor: z.string(),
  status: z.enum(["ok", "failed", "skipped", "denied", "approval_required"]),
  result: z.unknown(),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  created_at: z.string(),
});

export const automationRulesListCapability = defineQuery({
  id: "automation.rules.list",
  title: "Listar regras de automação",
  description:
    "Lista as regras declaradas pelo fotógrafo que autorizam Automation a executar propostas aceitas.",
  input: z.object({ enabled: z.boolean().optional() }).optional().default({}),
  output: z.object({ rules: z.array(RuleSchema) }),
  permissions: ["automation:read"],
  costHint: "cheap",
  async handler(input, ctx) {
    if (!ctx.user?.id)
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    try {
      const rules = await automationStore.listRules(ctx.user.id, input);
      return ok({ rules: rules as never });
    } catch (e) {
      return err(
        domainError("AUTOMATION_READ_FAILED", "Falha ao ler regras.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

export const automationRulesUpsertCapability = defineCommand({
  id: "automation.rules.upsert",
  title: "Criar/atualizar regra de automação",
  description:
    "Cria ou atualiza uma regra que autoriza Automation a executar propostas de uma capability específica.",
  input: z.object({
    id: z.string().uuid().optional(),
    capabilityId: z.string().min(1),
    sourceKind: z.string().nullable().optional(),
    severityMax: SeveritySchema.optional(),
    enabled: z.boolean().optional(),
    notes: z.string().max(500).nullable().optional(),
  }),
  output: z.object({ rule: RuleSchema }),
  permissions: ["automation:write"],
  costHint: "cheap",
  sideEffects: ["db:automation_rules.write"],
  async handler(input, ctx) {
    if (!ctx.user?.id)
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    try {
      const rule = await automationStore.upsertRule(ctx.user.id, input);
      return ok({ rule: rule as never });
    } catch (e) {
      return err(
        domainError("AUTOMATION_UPSERT_FAILED", "Falha ao salvar regra.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

export const automationRulesDeleteCapability = defineCommand({
  id: "automation.rules.delete",
  title: "Remover regra de automação",
  description: "Remove uma regra de automação. Execuções passadas ficam preservadas.",
  input: z.object({ id: z.string().uuid() }),
  output: z.object({ deleted: z.boolean() }),
  permissions: ["automation:write"],
  costHint: "cheap",
  sideEffects: ["db:automation_rules.write"],
  async handler(input, ctx) {
    if (!ctx.user?.id)
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    try {
      const deleted = await automationStore.deleteRule(ctx.user.id, input.id);
      return ok({ deleted });
    } catch (e) {
      return err(
        domainError("AUTOMATION_DELETE_FAILED", "Falha ao remover regra.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

export const automationRunsListCapability = defineQuery({
  id: "automation.runs.list",
  title: "Histórico de execuções automáticas",
  description: "Lista as últimas execuções automáticas do Automation Engine (auditoria).",
  input: z.object({ limit: z.number().int().min(1).max(200).optional() }).optional().default({}),
  output: z.object({ runs: z.array(RunSchema) }),
  permissions: ["automation:read"],
  costHint: "cheap",
  async handler(input, ctx) {
    if (!ctx.user?.id)
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    try {
      const runs = await automationStore.listRuns(ctx.user.id, input);
      return ok({ runs: runs as never });
    } catch (e) {
      return err(
        domainError("AUTOMATION_READ_FAILED", "Falha ao ler histórico.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

function matchRule(rules: AutomationRule[], p: DecisionProposal): AutomationRule | null {
  for (const r of rules) {
    if (!r.enabled) continue;
    if (r.capability_id !== p.capability_id) continue;
    if (r.source_kind && r.source_kind !== p.source_kind) continue;
    if (!severityAllowed(p.severity, r.severity_max)) continue;
    return r;
  }
  return null;
}

export const automationTickCapability = defineCommand({
  id: "automation.tick",
  title: "Executar propostas elegíveis",
  description:
    "Dispara Kernel.execute para cada proposta 'accepted' que casa com uma regra habilitada. Idempotente por proposta.",
  input: z.object({ limit: z.number().int().min(1).max(100).optional() }).optional().default({}),
  output: z.object({
    considered: z.number().int(),
    executed: z.number().int(),
    skipped: z.number().int(),
    failed: z.number().int(),
    killSwitchOn: z.boolean(),
  }),
  permissions: ["automation:execute"],
  costHint: "medium",
  sideEffects: ["db:automation_runs.write", "kernel:dispatch"],
  idempotencyKey: () => "automation.tick",
  async handler(input, ctx) {
    if (!ctx.user?.id)
      return err(domainError("UNAUTHORIZED", "Sessão necessária.", { retriable: false }));
    const userId = ctx.user.id;
    const user = ctx.user as AuthUser;

    try {
      const killOn = await automationStore.isKillSwitchOn();
      if (!killOn) {
        return ok({ considered: 0, executed: 0, skipped: 0, failed: 0, killSwitchOn: false });
      }

      const [proposals, rules] = await Promise.all([
        decisionStore.list(userId, { status: "accepted", limit: input.limit ?? 50 }),
        automationStore.listRules(userId, { enabled: true }),
      ]);

      const already = await automationStore.listAlreadyExecuted(
        userId,
        proposals.map((p) => p.id),
      );

      let executed = 0;
      let skipped = 0;
      let failed = 0;

      for (const p of proposals) {
        if (already.has(p.id)) {
          skipped++;
          continue;
        }
        const rule = matchRule(rules, p);
        if (!rule) {
          skipped++;
          continue;
        }

        const actorLabel = `automation:${rule.id}`;
        const res = await kernel.execute(p.capability_id, p.input, {
          actor: automationActor(user),
        });

        if (isErr(res)) {
          const isApproval = res.error.code === "APPROVAL_REQUIRED";
          const isDenied = res.error.code === "FORBIDDEN";
          await automationStore.recordRun(userId, {
            ruleId: rule.id,
            proposalId: p.id,
            capabilityId: p.capability_id,
            actor: actorLabel,
            status: isApproval ? "approval_required" : isDenied ? "denied" : "failed",
            errorCode: res.error.code,
            errorMessage: res.error.message,
          });
          if (isApproval || isDenied) skipped++;
          else failed++;
        } else if (isKernelApprovalRequired(res.value)) {
          await automationStore.recordRun(userId, {
            ruleId: rule.id,
            proposalId: p.id,
            capabilityId: p.capability_id,
            actor: actorLabel,
            status: "approval_required",
            errorCode: "APPROVAL_REQUIRED",
            errorMessage: "Policy exige aprovação humana — Automation não executa.",
          });
          skipped++;
        } else {
          await automationStore.recordRun(userId, {
            ruleId: rule.id,
            proposalId: p.id,
            capabilityId: p.capability_id,
            actor: actorLabel,
            status: "ok",
            result: res.value,
          });
          executed++;
        }
      }

      return ok({
        considered: proposals.length,
        executed,
        skipped,
        failed,
        killSwitchOn: true,
      });
    } catch (e) {
      return err(
        domainError("AUTOMATION_TICK_FAILED", "Falha ao processar tick.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

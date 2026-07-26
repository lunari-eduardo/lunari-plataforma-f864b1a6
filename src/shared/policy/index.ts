/**
 * Policy Engine — Onda 2 (ADR-0009).
 *
 * Fonte única de "quem pode o quê". Substitui a autorização/aprovação
 * dispersa entre `authorize()`, `needsApproval` per-capability, e o
 * `approvalRegistry`. Esses continuam existindo por retrocompatibilidade,
 * mas TODA decisão canônica passa por `evaluatePolicy(ctx)`.
 *
 * DSL mínima com 4 verbos:
 *   - `allow`            → autoriza (default é implícito: allow)
 *   - `deny`             → nega com motivo
 *   - `requireApproval`  → autoriza porém exige aprovação humana
 *   - `audit`            → força auditoria (default de commands = on-success)
 *
 * Precedência (mais específica vence, ordem determinística):
 *   1. `deny`             (qualquer módulo)
 *   2. `requireApproval`  (agrega motivos)
 *   3. `allow`            (default se nenhum outro)
 *
 * Rules são funções puras `(ctx) => PolicyMatch | null`. Registradas em
 * módulo (`policies/*.ts`) via `registerPolicy(rule)`. O Kernel invoca
 * `evaluatePolicy` antes de cada dispatch.
 */

import type { AuthUser } from "@/shared/ports";
import type { Capability } from "@/shared/capability/types";

export type PolicyChannel = "web" | "assistant" | "mcp" | "system" | "test";

export interface PolicyContext {
  user: AuthUser | null;
  channel: PolicyChannel;
  runtime: "client" | "server";
  capability: Pick<Capability, "id" | "kind" | "permissions" | "sideEffects">;
  input: unknown;
}

export type PolicyEffect = "allow" | "deny" | "requireApproval" | "audit";

export interface PolicyMatch {
  effect: PolicyEffect;
  /** Motivo curto — usado em erros/UI/auditoria. */
  reason?: string;
  /** Módulo/regra emissora — usado em auditoria. */
  source?: string;
}

export type PolicyRule = (ctx: PolicyContext) => PolicyMatch | null;

export interface PolicyDecision {
  effect: "allow" | "deny" | "requireApproval";
  reasons: string[];
  /** True se qualquer regra pediu auditoria forçada. */
  forceAudit: boolean;
  /** Fontes que contribuíram para o resultado. */
  sources: string[];
}

const RULES: PolicyRule[] = [];

export function registerPolicy(rule: PolicyRule): void {
  RULES.push(rule);
}

export function __resetPoliciesForTests(): void {
  RULES.length = 0;
}

export function listRegisteredPolicies(): number {
  return RULES.length;
}

export function evaluatePolicy(ctx: PolicyContext): PolicyDecision {
  const denies: PolicyMatch[] = [];
  const approvals: PolicyMatch[] = [];
  const audits: PolicyMatch[] = [];

  for (const rule of RULES) {
    let m: PolicyMatch | null;
    try {
      m = rule(ctx);
    } catch (err) {
      // Uma rule quebrada não pode derrubar o dispatch — loga e ignora.
       
      console.warn("[policy] rule threw:", err);
      continue;
    }
    if (!m) continue;
    if (m.effect === "deny") denies.push(m);
    else if (m.effect === "requireApproval") approvals.push(m);
    else if (m.effect === "audit") audits.push(m);
    // "allow" explícito não muda o default; existe para documentar intenção.
  }

  if (denies.length > 0) {
    return {
      effect: "deny",
      reasons: denies.map((d) => d.reason ?? "denied by policy"),
      forceAudit: audits.length > 0,
      sources: denies.map((d) => d.source ?? "policy"),
    };
  }
  if (approvals.length > 0) {
    return {
      effect: "requireApproval",
      reasons: approvals.map((a) => a.reason ?? "human approval required"),
      forceAudit: audits.length > 0,
      sources: approvals.map((a) => a.source ?? "policy"),
    };
  }
  return {
    effect: "allow",
    reasons: [],
    forceAudit: audits.length > 0,
    sources: [],
  };
}

/* ------------------------------------------------------------------ */
/* Helpers de conveniência para escrever rules declarativas.          */
/* ------------------------------------------------------------------ */

export const policy = {
  allow: (reason?: string, source?: string): PolicyMatch => ({ effect: "allow", reason, source }),
  deny: (reason: string, source?: string): PolicyMatch => ({ effect: "deny", reason, source }),
  requireApproval: (reason: string, source?: string): PolicyMatch => ({
    effect: "requireApproval",
    reason,
    source,
  }),
  audit: (reason?: string, source?: string): PolicyMatch => ({ effect: "audit", reason, source }),
};

/** Rule builder — casa por capabilityId (glob simples com "*"). */
export function whenCapability(
  pattern: string,
  effect: (ctx: PolicyContext) => PolicyMatch | null,
): PolicyRule {
  const rx = new RegExp("^" + pattern.replace(/[.]/g, "\\.").replace(/\*/g, ".*") + "$");
  return (ctx) => (rx.test(ctx.capability.id) ? effect(ctx) : null);
}

/** Rule builder — casa por conjunto explícito de IDs. */
export function whenCapabilityIn(
  ids: Iterable<string>,
  effect: (ctx: PolicyContext) => PolicyMatch | null,
): PolicyRule {
  const set = new Set(ids);
  return (ctx) => (set.has(ctx.capability.id) ? effect(ctx) : null);
}

/** Rule builder — só dispara quando canal é assistant/mcp (não web). */
export function whenAgentic(rule: PolicyRule): PolicyRule {
  return (ctx) => (ctx.channel === "assistant" || ctx.channel === "mcp" ? rule(ctx) : null);
}

/**
 * Policies core do Lunari — ADR-0009.
 *
 * Bootstrap com regras genéricas que preservam o comportamento atual e
 * absorvem responsabilidades antes espalhadas em `authorize()` +
 * `approvalRegistry`. Módulos podem registrar policies adicionais em
 * seus próprios arquivos `policies/*.ts` (a serem migrados em ondas
 * futuras — modelo estrangulador).
 */

import {
  registerPolicy,
  policy,
  whenCapability,
  type PolicyRule,
} from "./index";
import {
  needsHumanApproval as legacyNeedsApproval,
  isCapabilityAllowedForAI,
} from "@/shared/ai/approvalRegistry";

/** Admin/roles admin passam por qualquer check de permissão. */
const adminBypass: PolicyRule = (ctx) => {
  const u = ctx.user;
  if (!u) return null;
  if (u.permissions.includes("admin") || u.roles.includes("admin")) {
    return policy.allow("admin bypass", "core.adminBypass");
  }
  return null;
};

/** Não autenticado + capability com permissões → deny. */
const requireAuthForPermissioned: PolicyRule = (ctx) => {
  if (ctx.capability.permissions.length === 0) return null;
  if (!ctx.user) {
    return policy.deny(
      "Você precisa estar autenticado para executar essa ação.",
      "core.requireAuth",
    );
  }
  const missing = ctx.capability.permissions.filter(
    (p) => !ctx.user!.permissions.includes(p),
  );
  if (missing.length > 0) {
    return policy.deny(
      "Você não tem permissão para executar essa ação.",
      "core.rbac",
    );
  }
  return null;
};

/**
 * Bloqueia capabilities marcadas como "deny para IA" no approvalRegistry
 * quando o canal é assistant/mcp (nunca afeta web).
 */
const denyAgenticForbidden: PolicyRule = (ctx) => {
  if (ctx.channel !== "assistant" && ctx.channel !== "mcp") return null;
  if (!isCapabilityAllowedForAI(ctx.capability.id)) {
    return policy.deny(
      "Esta capability não está disponível para o assistente.",
      "core.agenticDeny",
    );
  }
  return null;
};

/**
 * Ponte com o `approvalRegistry` legado: qualquer capability marcada
 * como `requireApproval` por um módulo dispara approval no canal
 * assistant/mcp. UI web continua livre (usuário já é o operador).
 */
const legacyApprovalBridge: PolicyRule = (ctx) => {
  if (ctx.channel !== "assistant" && ctx.channel !== "mcp") return null;
  if (legacyNeedsApproval(ctx.capability.id)) {
    return policy.requireApproval(
      "Ação sensível — precisa da sua confirmação.",
      "core.legacyApproval",
    );
  }
  return null;
};

/**
 * Auditoria forçada para qualquer command destrutivo (delete/remove/revoke)
 * — ADR-0012 (audit sink passivo). Complementa o `audit: "on-success"`
 * default de commands garantindo que denies também sejam auditáveis.
 */
const auditDestructive = whenCapability("*.*", (ctx) => {
  if (ctx.capability.kind !== "command") return null;
  if (/(\.delete|\.remove|\.revoke|\.cancel)/.test(ctx.capability.id)) {
    return policy.audit("destructive command", "core.auditDestructive");
  }
  return null;
});

let bootstrapped = false;

export function bootstrapCorePolicies(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  registerPolicy(adminBypass);
  registerPolicy(requireAuthForPermissioned);
  registerPolicy(denyAgenticForbidden);
  registerPolicy(legacyApprovalBridge);
  registerPolicy(auditDestructive);
}

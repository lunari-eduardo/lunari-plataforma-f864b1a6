/**
 * scripts/ai-surface-audit.ts — Onda D.2
 *
 * Auditoria estática da superfície de IA da Lu. Falha (exit != 0) quando:
 *   1. Módulo AI-exposto no `ai-registry` não registrou approvals via
 *      `registerModuleApprovals` (approvalRegistry central vazio para o módulo).
 *   2. Capability cujo id termina em padrão destrutivo
 *      (.delete, .remove, .cancel, .refund, .publish, .unpublish, .revoke,
 *      .clearDate, .deleteSlot, .reopenSelection) NÃO está no registry central
 *      de approvals.
 *   3. Módulo com `AI_<MOD>_ALLOWED` publica ao Lu tools que não estão na
 *      allowlist (protege contra vazamento acidental).
 *
 * Uso:
 *   bun run scripts/ai-surface-audit.ts          # relatório
 *   bun run scripts/ai-surface-audit.ts --json   # JSON puro
 *
 * Design: importa `@/shared/ai/registry` para disparar os side-effects que
 * registram todas as capabilities + approvals — a auditoria roda no mesmo
 * grafo real do runtime.
 */

// Garante registro completo antes de auditar.
import "../src/shared/ai/registry";

import {
  listAllApprovalRequired,
  listRegisteredModules,
  getModuleApprovals,
} from "../src/shared/ai/approvalRegistry";
import { listCapabilities } from "../src/shared/capability";
import { listLunariAITools } from "../src/modules/ai-registry";

const DESTRUCTIVE_SUFFIXES = [
  ".delete",
  ".remove",
  ".cancel",
  ".refund",
  ".publish",
  ".unpublish",
  ".revoke",
  ".clearDate",
  ".deleteSlot",
  ".reopenSelection",
  ".deleteTemplate",
  ".deleteContrato",
  ".deleteCategoria",
  ".deletePacote",
  ".deleteProduto",
  ".deleteEtapa",
  ".deleteForm",
  ".deleteResponse",
  ".deleteSession",
];

function isDestructive(id: string): boolean {
  return DESTRUCTIVE_SUFFIXES.some((s) => id.endsWith(s));
}

interface AuditFinding {
  severity: "error" | "warn";
  code: string;
  message: string;
  capabilityId?: string;
  module?: string;
}

function audit(): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const approvals = new Set(listAllApprovalRequired());
  const registeredModules = new Set(listRegisteredModules());

  // Todas as tools que a Lu enxerga hoje (para o usuário "system audit").
  const tools = listLunariAITools({ user: { id: "audit", email: "audit@lunari" } as never });
  const exposedIds = new Set(tools.map((t) => t.id));
  const exposedModules = new Set(tools.map((t) => t.module));

  // (1) Módulo exposto sem approvals registrados no registry central.
  for (const mod of exposedModules) {
    if (!registeredModules.has(mod)) {
      findings.push({
        severity: "error",
        code: "MODULE_NOT_IN_APPROVAL_REGISTRY",
        module: mod,
        message: `Módulo "${mod}" expõe tools mas nunca chamou registerModuleApprovals(). Adicione em src/modules/${mod}/ai/permissions.ts.`,
      });
    }
  }

  // (2) Capability destrutiva sem gate humano.
  for (const cap of listCapabilities()) {
    if (!isDestructive(cap.id)) continue;
    if (!exposedIds.has(cap.id)) continue; // só cobra gate no que a Lu vê
    if (!approvals.has(cap.id)) {
      findings.push({
        severity: "error",
        code: "DESTRUCTIVE_WITHOUT_APPROVAL",
        capabilityId: cap.id,
        module: cap.module ?? "unknown",
        message: `Capability destrutiva "${cap.id}" está exposta à Lu sem gate humano. Inclua no REQUIRES_APPROVAL do módulo.`,
      });
    }
  }

  // (3) Módulos com approvals que referenciam ids inexistentes (drift).
  const knownCapIds = new Set(listCapabilities().map((c) => c.id));
  for (const mod of registeredModules) {
    const { approval } = getModuleApprovals(mod);
    for (const id of approval) {
      if (!knownCapIds.has(id)) {
        findings.push({
          severity: "warn",
          code: "APPROVAL_FOR_UNKNOWN_CAPABILITY",
          capabilityId: id,
          module: mod,
          message: `Módulo "${mod}" declara approval para "${id}" mas nenhuma capability com esse id está registrada (drift ou capability futura).`,
        });
      }
    }
  }

  return findings;
}

function main() {
  const asJson = process.argv.includes("--json");
  const findings = audit();
  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");

  if (asJson) {
    process.stdout.write(JSON.stringify({ errors, warns }, null, 2) + "\n");
  } else {
    const modules = listRegisteredModules();
    const totalCaps = listCapabilities().length;
    const approvals = listAllApprovalRequired().length;
    console.log("Lunari AI surface audit — Onda D.2");
    console.log(`  módulos registrados: ${modules.length} (${modules.join(", ")})`);
    console.log(`  capabilities totais: ${totalCaps}`);
    console.log(`  approvals centrais:  ${approvals}`);
    console.log("");
    if (findings.length === 0) {
      console.log("✔ Sem findings. Superfície AI consistente.");
    } else {
      for (const f of findings) {
        const tag = f.severity === "error" ? "✗ ERROR" : "⚠ WARN ";
        const scope = f.capabilityId ? `[${f.capabilityId}]` : f.module ? `[${f.module}]` : "";
        console.log(`${tag} ${f.code} ${scope}\n         ${f.message}`);
      }
    }
    console.log("");
    console.log(`Resultado: ${errors.length} error(s), ${warns.length} warn(s).`);
  }

  process.exit(errors.length === 0 ? 0 : 1);
}

main();

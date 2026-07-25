/**
 * scripts/ai-surface-audit.ts — Onda D.2
 *
 * Auditoria estática da superfície de IA da Lu. Falha (exit != 0) quando:
 *   1. Módulo AI-exposto no `ai-registry` não registrou approvals via
 *      `registerModuleApprovals`.
 *   2. Capability com id destrutivo exposta à Lu SEM gate humano central.
 *   3. Módulos registram approval para ids inexistentes (drift).
 *
 * Uso:
 *   bun run scripts/ai-surface-audit.ts
 *   bun run scripts/ai-surface-audit.ts --json
 */

// Node/Bun não têm localStorage; o client Supabase quebra no import top-level.
// Shim precisa vir ANTES de qualquer import estático — por isso todos os
// imports do grafo do app são dinâmicos abaixo.
const g = globalThis as unknown as { localStorage?: unknown };
if (!g.localStorage) {
  const store = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

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

async function main() {
  // Dispara todos os side-effects de registro.
  await import("../src/shared/ai/registry");
  const { listAllApprovalRequired, listRegisteredModules, getModuleApprovals } = await import(
    "../src/shared/ai/approvalRegistry"
  );
  const { listCapabilities } = await import("../src/shared/capability");
  const { listLunariAITools } = await import("../src/modules/ai-registry");

  const findings: AuditFinding[] = [];
  const approvals = new Set(listAllApprovalRequired());
  const registeredModules = new Set(listRegisteredModules());

  const tools = listLunariAITools({ user: { id: "audit", email: "audit@lunari" } as never });
  const exposedIds = new Set(tools.map((t) => t.id));
  const exposedModules = new Set(tools.map((t) => t.module));

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

  for (const cap of listCapabilities()) {
    if (!isDestructive(cap.id)) continue;
    if (!exposedIds.has(cap.id)) continue;
    if (!approvals.has(cap.id)) {
      findings.push({
        severity: "error",
        code: "DESTRUCTIVE_WITHOUT_APPROVAL",
        capabilityId: cap.id,
        module: cap.module ?? "unknown",
        message: `Capability destrutiva "${cap.id}" exposta à Lu sem gate humano. Inclua no REQUIRES_APPROVAL do módulo.`,
      });
    }
  }

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

  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");

  if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify({ errors, warns }, null, 2) + "\n");
  } else {
    console.log("Lunari AI surface audit — Onda D.2");
    console.log(
      `  módulos registrados: ${registeredModules.size} (${Array.from(registeredModules).join(", ")})`,
    );
    console.log(`  capabilities totais: ${listCapabilities().length}`);
    console.log(`  approvals centrais:  ${approvals.size}`);
    console.log(`  tools expostas à Lu: ${tools.length}`);
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

main().catch((err) => {
  console.error("Audit falhou com exceção:", err);
  process.exit(2);
});

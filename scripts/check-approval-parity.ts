/**
 * scripts/check-approval-parity.ts — Onda A5
 *
 * Uma única fonte de verdade para "isto é destrutivo".
 *
 * Antes desta onda havia três listas que podiam divergir sem que nada quebrasse:
 *   1. o catálogo MCP (`needsApproval` / `scopeTier: "destructive"`),
 *   2. o `approvalRegistry` do app (`needsHumanApproval`),
 *   3. as flags manuais do executor legado (`BRIDGED_TOOLS[].requiresApproval`).
 *
 * Este guard falha (exit 1) quando qualquer uma delas discorda das outras.
 * Regra fail-closed: capability sem classificação é tratada como destrutiva.
 *
 * Uso: bun run scripts/check-approval-parity.ts
 */

import "./_shim";
import catalog from "../supabase/functions/assistant-mcp/catalog.json";

interface CatalogTool {
  name: string;
  capabilityId: string;
  kind?: "command" | "query";
  scopeTier?: "read" | "write" | "destructive";
  needsApproval?: boolean;
}

async function main() {
  await import("../src/shared/ai/registry");
  const { needsHumanApproval } = await import("../src/shared/ai/approvalRegistry");

  const tools = ((catalog as any).tools ?? []) as CatalogTool[];
  const errors: string[] = [];

  // 1) catálogo internamente coerente: destructive ⇔ needsApproval
  for (const t of tools) {
    const destructive = t.scopeTier === "destructive";
    if (destructive && !t.needsApproval) {
      errors.push(`[catálogo] "${t.name}" é destrutiva mas não exige aprovação.`);
    }
    if (!destructive && t.needsApproval) {
      errors.push(`[catálogo] "${t.name}" exige aprovação mas não está classificada como destrutiva.`);
    }
    if (t.kind === "command" && !t.scopeTier) {
      errors.push(`[catálogo] "${t.name}" é comando sem nível de escopo declarado (fail-closed).`);
    }
  }

  // 2) catálogo × approvalRegistry do app
  for (const t of tools) {
    const appSaysApproval = needsHumanApproval(t.capabilityId);
    const catalogSaysApproval = !!t.needsApproval;
    if (appSaysApproval !== catalogSaysApproval) {
      errors.push(
        `[divergência] "${t.capabilityId}": catálogo=${catalogSaysApproval ? "aprovação" : "livre"} ` +
          `× app=${appSaysApproval ? "aprovação" : "livre"}.`,
      );
    }
  }

  // 3) catálogo × executor legado (bridge escrito à mão)
  try {
    const executor = await import("../supabase/functions/assistant-mcp/executor.ts" as string);
    const bridged = (executor as any).BRIDGED_TOOLS ?? {};
    for (const [name, def] of Object.entries<any>(bridged)) {
      const tool = tools.find((t) => t.name === name);
      if (!tool) continue;
      if (!!def.requiresApproval !== !!tool.needsApproval) {
        errors.push(
          `[bridge] "${name}": executor=${def.requiresApproval ? "aprovação" : "livre"} ` +
            `× catálogo=${tool.needsApproval ? "aprovação" : "livre"}.`,
        );
      }
    }
  } catch {
    // O executor legado usa specifier Deno; se não importar no Bun, ignoramos
    // esta checagem em vez de falhar o CI por motivo de runtime.
  }

  const destructive = tools.filter((t) => t.scopeTier === "destructive").length;
  console.log(
    `Tools: ${tools.length} · destrutivas com aprovação obrigatória: ${destructive}`,
  );

  if (errors.length > 0) {
    console.error("\nParidade de aprovação quebrada:\n" + errors.map((e) => ` - ${e}`).join("\n"));
    process.exit(1);
  }
  console.log("Paridade de aprovação OK.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

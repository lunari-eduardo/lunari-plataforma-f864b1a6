/**
 * scripts/check-mcp-audience.ts — Rodada A1
 *
 * Guarda de regressão da audiência de capabilities. Falha (exit 1) se:
 *  - algum anel interno vazar para o MCP;
 *  - algum bloqueio individual voltar a ser exposto;
 *  - alguma capability perder a audiência "app";
 *  - as leituras Gallery permitidas sumirem do MCP.
 *
 * Também reimprime a contagem por módulo, para atualizar
 * docs/handoff/MCP_SURFACE_MATRIX.md quando a superfície mudar.
 *
 * Uso: bun run scripts/check-mcp-audience.ts
 */

import "./_shim";

const GALLERY_READS_EXPECTED = [
  "gallery.checkAccess",
  "gallery.listExpiring",
  "gallery.listInSelection",
];

async function main() {
  await import("../src/shared/ai/registry");
  const { listCapabilities } = await import("../src/shared/capability");
  const { MCP_BLOCKED_CAPABILITIES, mcpBlockReason, moduleOf } = await import(
    "../src/shared/capability/audience"
  );

  const caps = listCapabilities();
  const mcp = listCapabilities({ audience: "mcp" });
  const failures: string[] = [];

  for (const c of caps) {
    if (!c.audience.includes("app")) failures.push(`capability sem audiência "app": ${c.id}`);
  }

  for (const c of mcp) {
    const reason = mcpBlockReason(c.id);
    if (reason) failures.push(`exposto ao MCP indevidamente (${reason}): ${c.id}`);
  }

  const mcpIds = new Set(mcp.map((c) => c.id));
  for (const id of MCP_BLOCKED_CAPABILITIES) {
    if (mcpIds.has(id)) failures.push(`capability bloqueada exposta ao MCP: ${id}`);
  }
  for (const id of GALLERY_READS_EXPECTED) {
    if (!mcpIds.has(id)) failures.push(`leitura Gallery permitida sumiu do MCP: ${id}`);
  }

  const byModule = new Map<string, { total: number; mcp: number }>();
  for (const c of caps) {
    const k = moduleOf(c.id);
    const e = byModule.get(k) ?? { total: 0, mcp: 0 };
    e.total += 1;
    if (c.audience.includes("mcp")) e.mcp += 1;
    byModule.set(k, e);
  }

  console.log(`registry: ${caps.length} · mcp: ${mcp.length} · app-only: ${caps.length - mcp.length}`);
  for (const [mod, e] of Array.from(byModule.entries()).sort()) {
    console.log(`  ${mod.padEnd(16)} ${String(e.mcp).padStart(3)}/${e.total}`);
  }

  if (failures.length > 0) {
    console.error("\n✖ audiência inconsistente:");
    for (const f of failures) console.error("  -", f);
    process.exit(1);
  }
  console.log("\n✔ audiência consistente.");
}

main().catch((err) => {
  console.error("check-mcp-audience falhou:", err);
  process.exit(1);
});

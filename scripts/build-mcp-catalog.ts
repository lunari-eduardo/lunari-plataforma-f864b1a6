/**
 * scripts/build-mcp-catalog.ts — Onda F.1
 *
 * Gera um snapshot estático do catálogo MCP do Lunari (tools + manifesto)
 * que é servido pela edge function `assistant-mcp`. Executar sempre que a
 * superfície AI mudar (novas capabilities, mudanças de description, etc.).
 *
 * Uso:
 *   bun run scripts/build-mcp-catalog.ts
 */

// Shim de localStorage — igual ao ai-surface-audit.ts (o client Supabase
// tenta ler no import top-level).
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

async function main() {
  // Dispara todos os side-effects de registro.
  await import("../src/shared/ai/registry");
  const { buildMCPToolsForUser, buildMCPManifest } = await import("../src/shared/ai/mcp");

  // Passa um user stub — a lista aplica permissões por usuário; no catálogo
  // público queremos a superfície completa, e o `hideApprovalRequired` oculta
  // commands destrutivos por default.
  const stubUser = { id: "mcp-catalog", email: "mcp@lunari" } as never;
  const tools = buildMCPToolsForUser({ user: stubUser, hideApprovalRequired: true });
  const manifest = buildMCPManifest(tools);

  const out = {
    generatedAt: new Date().toISOString(),
    manifest,
    tools,
  };

  const path = new URL("../supabase/functions/assistant-mcp/catalog.json", import.meta.url);
  const { writeFile, mkdir } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  await mkdir(dirname(path.pathname), { recursive: true });
  await writeFile(path, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(`✔ MCP catalog escrito em ${path.pathname}`);
  console.log(`  tools: ${tools.length}`);
  console.log(`  manifest: ${manifest.name}@${manifest.version}`);
}

main().catch((err) => {
  console.error("build-mcp-catalog falhou:", err);
  process.exit(1);
});

/**
 * scripts/build-mcp-catalog.ts — Onda F.1 / A3
 *
 * Gera o snapshot estático do catálogo MCP do Lunari (tools + manifesto)
 * servido pela edge function `assistant-mcp`.
 *
 * A3 — o catálogo é DERIVADO, nunca editado à mão:
 *  - saída determinística (tools ordenadas + chaves ordenadas) para diff em CI;
 *  - `catalogHash` (sha256 do conteúdo, sem timestamp) como chave de comparação;
 *  - revalidação fail-closed da audiência: capability bloqueada que escape
 *    aborta o build;
 *  - modo `--check`: gera em memória e falha se divergir do arquivo commitado.
 *
 * Uso:
 *   bun run scripts/build-mcp-catalog.ts
 *   bun run scripts/build-mcp-catalog.ts --check
 */
import "./_shim";

const CHECK_ONLY = process.argv.includes("--check");

/** Serialização estável: objetos com chaves ordenadas, arrays preservados. */
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) out[k] = stable(src[k]);
    return out;
  }
  return value;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function main() {
  // Dispara todos os side-effects de registro.
  await import("../src/shared/ai/registry");
  const { buildMCPToolsForUser, buildMCPManifest } = await import("../src/shared/ai/mcp");
  const { mcpBlockReason } = await import("../src/shared/capability/audience");
  const { tierFor, CORE_MAX_TOOLS } = await import("../src/shared/capability/tiers");

  // Stub de usuário — o catálogo público é a superfície completa filtrada por
  // `audience`, não por permissões individuais.
  const stubUser = { id: "mcp-catalog", email: "mcp@lunari" } as never;
  const tools = buildMCPToolsForUser({ user: stubUser }).slice();

  // Defesa em profundidade: nenhuma capability bloqueada pode chegar aqui,
  // mesmo que alguém declare `audience: ["mcp"]` manualmente.
  const leaked = tools
    .map((t) => ({ id: t.capabilityId, reason: mcpBlockReason(t.capabilityId) }))
    .filter((x) => x.reason);
  if (leaked.length > 0) {
    console.error("✖ capabilities bloqueadas vazaram para o catálogo MCP:");
    for (const l of leaked) console.error(`  - ${l.id} (${l.reason})`);
    process.exit(1);
  }

  // Determinismo: ordena por nome antes de qualquer serialização.
  tools.sort((a, b) => a.name.localeCompare(b.name));
  const manifest = buildMCPManifest(tools);

  // Camada de exposição (core = publicado no manifesto; catalog = sob demanda).
  const tiered = tools.map((t) => ({ ...t, tier: tierFor(t.capabilityId) }));
  const coreCount = tiered.filter((t) => t.tier === "core").length;
  if (coreCount > CORE_MAX_TOOLS) {
    console.error(
      `✖ Núcleo MCP com ${coreCount} capabilities (teto ${CORE_MAX_TOOLS}). ` +
        "Mova algo para o Catálogo em src/shared/capability/tiers.ts.",
    );
    process.exit(1);
  }

  // Índice compacto por domínio — vai no `instructions` para o modelo saber
  // ONDE procurar sem precisar listar nada.
  const byDomain = new Map<string, number>();
  for (const t of tiered) {
    const d = t.capabilityId.split(".")[0];
    byDomain.set(d, (byDomain.get(d) ?? 0) + 1);
  }
  const domainIndex = [...byDomain.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([d, n]) => `${d} (${n})`)
    .join(" · ");

  const missingTransport = tools.filter((t) => !t.transport?.name);
  if (missingTransport.length > 0) {
    console.warn(
      `[mcp-catalog] ${missingTransport.length}/${tools.length} tools ainda sem transport declarado ` +
        `(executadas pelo bridge legado até declararem \`execution\` no defineCapability).`,
    );
  }

  const body = stable({ catalogVersion: 3, manifest: { ...manifest, domainIndex }, tools: tiered });
  const catalogHash = await sha256(JSON.stringify(body));

  const out = {
    generatedAt: new Date().toISOString(),
    catalogHash,
    ...(body as Record<string, unknown>),
  };

  // Sanidade: nenhum schema pode ser o placeholder Zod antigo.
  if (JSON.stringify(out).includes('"$zod"')) {
    throw new Error(
      "Catalog contém placeholder $zod — o conversor Zod → JSON Schema falhou. Verifique src/shared/capability/ai-adapter.ts",
    );
  }

  const url = new URL("../supabase/functions/assistant-mcp/catalog.json", import.meta.url);
  const path = decodeURIComponent(url.pathname);
  const { writeFile, mkdir, readFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");

  if (CHECK_ONLY) {
    let current: {
      catalogVersion?: number;
      manifest?: unknown;
      tools?: { name: string }[];
    } | null = null;
    try {
      current = JSON.parse(await readFile(path, "utf8"));
    } catch {
      current = null;
    }
    // Recalcula o hash A PARTIR DO CONTEÚDO do arquivo — nunca confia no campo
    // `catalogHash` gravado (edição manual do JSON tem que ser detectada).
    const currentHash = current
      ? await sha256(
          JSON.stringify(
            stable({
              catalogVersion: current.catalogVersion,
              manifest: current.manifest,
              tools: current.tools,
            }),
          ),
        )
      : null;
    if (currentHash === catalogHash) {
      console.log(`✔ catálogo em dia (${tools.length} tools · ${catalogHash.slice(0, 12)})`);
      return;
    }

    const currentNames = new Set((current?.tools ?? []).map((t) => t.name));
    const nextNames = new Set(tools.map((t) => t.name));
    const added = [...nextNames].filter((n) => !currentNames.has(n));
    const removed = [...currentNames].filter((n) => !nextNames.has(n));

    console.error("✖ catálogo MCP desatualizado em relação ao registry.");
    console.error(`  arquivo:  ${currentHash?.slice(0, 12) ?? "<ausente>"} · ${currentNames.size} tools`);
    console.error(`  registry: ${catalogHash.slice(0, 12)} · ${nextNames.size} tools`);
    for (const n of added) console.error(`  + ${n}`);
    for (const n of removed) console.error(`  - ${n}`);
    if (added.length === 0 && removed.length === 0) {
      console.error("  (mesmas tools — mudaram descrição, schema, transport ou approval)");
    }
    console.error(
      "\n  Corrija com:\n    bun run mcp:catalog && git add supabase/functions/assistant-mcp/catalog.json",
    );
    process.exit(1);
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(`✔ MCP catalog escrito em ${path}`);
  console.log(`  tools: ${tools.length} (núcleo: ${coreCount} · catálogo: ${tools.length - coreCount})`);
  console.log(`  hash:  ${catalogHash.slice(0, 12)}`);
  console.log(`  manifest: ${manifest.name}@${manifest.version}`);
}

main().catch((err) => {
  console.error("build-mcp-catalog falhou:", err);
  process.exit(1);
});

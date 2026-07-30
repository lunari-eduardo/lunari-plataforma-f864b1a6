/**
 * Valida a superfície MCP exposta a conectores (ChatGPT, Claude) ANTES do deploy.
 *
 * Checa, para as tools curadas em `supabase/functions/assistant-mcp/exposed.ts`:
 *  - nome público bate com `^[a-zA-Z0-9_-]{1,64}$` e é único;
 *  - inputSchema achatado não contém anyOf/oneOf/allOf/not/$ref;
 *  - profundidade do schema <= 6;
 *  - payload total de `tools/list` abaixo do teto prático (~60 KB).
 *
 * Uso: bun run scripts/validate-mcp-surface.ts
 */
import catalog from "../supabase/functions/assistant-mcp/catalog.json" with { type: "json" };
import { EXPOSED_TOOLS, META_TOOL_DEFS } from "../supabase/functions/assistant-mcp/exposed.ts";
import { toPublicName, publicInputSchema } from "../supabase/functions/assistant-mcp/compat.ts";

const NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const FORBIDDEN = ["anyOf", "oneOf", "allOf", "not", "$ref"];
const MAX_DEPTH = 6;
const MAX_BYTES = 60_000;

const errors: string[] = [];

/** Profundidade = níveis de aninhamento de schema (object.properties / array.items). */
function scan(node: any, path: string, depth = 0): number {
  if (!node || typeof node !== "object") return depth;
  for (const k of Object.keys(node)) {
    if (FORBIDDEN.includes(k)) errors.push(`${path}: chave proibida "${k}"`);
  }
  let max = depth;
  for (const [k, v] of Object.entries(node.properties ?? {})) {
    max = Math.max(max, scan(v, `${path}.${k}`, depth + 1));
  }
  if (node.items) max = Math.max(max, scan(node.items, `${path}[]`, depth + 1));
  return max;
}

const byName = new Map<string, any>((catalog as any).tools.map((t: any) => [t.name, t]));
const seen = new Set<string>();
const payload: unknown[] = [];

for (const internal of EXPOSED_TOOLS) {
  const tool = byName.get(internal);
  if (!tool) {
    errors.push(`${internal}: não existe no catálogo (rode bun run mcp:catalog)`);
    continue;
  }
  const pub = toPublicName(internal);
  if (!NAME_RE.test(pub)) errors.push(`${internal}: nome público inválido "${pub}"`);
  if (seen.has(pub)) errors.push(`${internal}: alias duplicado "${pub}"`);
  seen.add(pub);

  const schema = publicInputSchema(tool.inputSchema);
  const depth = scan(schema, pub);
  if (depth > MAX_DEPTH) errors.push(`${pub}: schema com profundidade ${depth} (máx ${MAX_DEPTH})`);

  payload.push({
    name: pub,
    title: tool.title,
    description: tool.description,
    inputSchema: schema,
    annotations: tool.annotations,
  });
}

for (const meta of META_TOOL_DEFS) {
  const pub = toPublicName(meta.name);
  if (!NAME_RE.test(pub)) errors.push(`${meta.name}: nome público inválido "${pub}"`);
  payload.push({ ...meta, name: pub, inputSchema: publicInputSchema(meta.inputSchema) });
}

const bytes = JSON.stringify({ tools: payload }).length;
if (bytes > MAX_BYTES) errors.push(`tools/list com ${bytes} bytes (máx ${MAX_BYTES})`);

console.log(`Tools expostas: ${payload.length} | tools/list: ${(bytes / 1024).toFixed(1)} KB`);
if (errors.length) {
  console.error(`\n${errors.length} problema(s):`);
  for (const e of errors) console.error(` - ${e}`);
  process.exit(1);
}
console.log("Superfície MCP válida para conectores.");

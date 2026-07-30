/**
 * Camada de compatibilidade com conectores MCP (ChatGPT, Claude).
 *
 * Dois ajustes que impedem o handshake de completar mesmo com OAuth OK:
 *
 * 1) NOMES — vários conectores só aceitam `^[a-zA-Z0-9_-]{1,64}$` em
 *    `tools/list`. Os nomes internos do Lunari usam ponto
 *    (`lunari.workflow.listMonth`), então expomos um alias snake-ish
 *    (`lunari_workflow_listMonth`) e traduzimos de volta em `tools/call`.
 *    Os nomes internos continuam válidos (aceitamos os dois).
 *
 * 2) SCHEMAS — `anyOf` / `oneOf` / `allOf` / `not` / `$ref` e aninhamento
 *    profundo quebram o parser de schema de alguns clientes. Achatamos o
 *    JSON Schema exposto para o subconjunto seguro (type/properties/items/
 *    enum/required/description), sem alterar a validação real, que continua
 *    acontecendo no dispatcher/capability.
 */

const MAX_NAME_LEN = 64;

/** Nome interno (com pontos) → nome público aceito por conectores. */
export function toPublicName(internal: string): string {
  const safe = internal.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
  return safe.length <= MAX_NAME_LEN ? safe : safe.slice(0, MAX_NAME_LEN);
}

/** Índice reverso público → interno, construído a partir da lista exposta. */
export function buildAliasIndex(internalNames: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const internal of internalNames) {
    const pub = toPublicName(internal);
    if (!map.has(pub)) map.set(pub, internal);
  }
  return map;
}

const ALLOWED_KEYS = new Set([
  "type",
  "properties",
  "items",
  "required",
  "enum",
  "description",
  "default",
  "additionalProperties",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "format",
]);

const UNION_KEYS = ["anyOf", "oneOf", "allOf"] as const;

const MAX_DEPTH = 5;

function pickUnionBranch(node: Record<string, any>): Record<string, any> | null {
  for (const key of UNION_KEYS) {
    const branches = node[key];
    if (Array.isArray(branches) && branches.length > 0) {
      // Prefere a primeira variante "concreta" (ignora `null` puro).
      const concrete =
        branches.find((b: any) => b && typeof b === "object" && b.type && b.type !== "null") ??
        branches[0];
      const rest = { ...node };
      for (const k of UNION_KEYS) delete rest[k];
      return { ...concrete, ...rest };
    }
  }
  return null;
}

/** Achata um JSON Schema para o subconjunto aceito por conectores MCP. */
export function simplifySchema(schema: unknown, depth = 0): any {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return { type: "string" };
  }
  let node = schema as Record<string, any>;

  const collapsed = pickUnionBranch(node);
  if (collapsed) node = collapsed;
  if (node.$ref || node.not) {
    const clone = { ...node };
    delete clone.$ref;
    delete clone.not;
    node = clone;
  }

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(node)) {
    if (!ALLOWED_KEYS.has(k)) continue;
    out[k] = v;
  }

  const type = Array.isArray(out.type) ? out.type.find((t) => t !== "null") ?? "string" : out.type;
  if (type) out.type = type;

  if (out.type === "object" || out.properties) {
    out.type = "object";
    if (depth >= MAX_DEPTH) {
      // Nível profundo demais: vira objeto livre, o dispatcher valida de verdade.
      return { type: "object", ...(out.description ? { description: out.description } : {}) };
    }
    const props: Record<string, any> = {};
    for (const [k, v] of Object.entries(out.properties ?? {})) {
      props[k] = simplifySchema(v, depth + 1);
    }
    out.properties = props;
    if (Array.isArray(out.required)) {
      out.required = out.required.filter((r: string) => r in props);
      if (out.required.length === 0) delete out.required;
    }
    if (typeof out.additionalProperties !== "boolean") delete out.additionalProperties;
  } else if (out.type === "array") {
    out.items = simplifySchema(out.items, depth + 1);
  } else if (!out.type) {
    out.type = "string";
  }

  return out;
}

/** Garante um inputSchema de objeto válido no topo. */
export function publicInputSchema(schema: unknown): any {
  const simplified = simplifySchema(schema);
  if (simplified.type !== "object") {
    return { type: "object", properties: {}, additionalProperties: false };
  }
  if (!simplified.properties) simplified.properties = {};
  return simplified;
}

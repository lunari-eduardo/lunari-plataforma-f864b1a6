/**
 * Superfície exposta a clientes MCP remotos (ChatGPT, Claude, Cursor…).
 *
 * ARQUITETURA (definitiva, escalável):
 *
 *   Camada 0 — NÚCLEO: as capabilities marcadas `tier: "core"` no catálogo
 *              (política declarativa em src/shared/capability/tiers.ts) que
 *              TAMBÉM têm execução remota real. Só isto entra em `tools/list`.
 *
 *   Camada 1 — CATÁLOGO: todo o resto. Zero custo no handshake; descoberto por
 *              `lunari.tools.search`, detalhado por `lunari.tools.describe` e
 *              executado por `lunari.tools.invoke` — mesmo dispatcher, escopos,
 *              rollout, aprovação e auditoria.
 *
 * Consequência: novas ondas de funcionalidade crescem SÓ o Catálogo. O
 * manifesto só muda por decisão explícita de produto (editar `tiers.ts`).
 */
import { BRIDGED_TOOLS } from "./executor.ts";
import catalog from "./catalog.json" with { type: "json" };

export const META_SEARCH = "lunari.tools.search";
export const META_DESCRIBE = "lunari.tools.describe";
export const META_INVOKE = "lunari.tools.invoke";

const CATALOG_TOOLS = ((catalog as any).tools ?? []) as Array<{ name: string; tier?: string }>;

/**
 * Núcleo publicado = tier "core" ∩ executável remotamente.
 * A interseção evita publicar uma ferramenta que responderia "ainda não
 * habilitada para execução remota".
 */
export const EXPOSED_TOOLS: string[] = CATALOG_TOOLS
  .filter((t) => t.tier === "core" && Object.prototype.hasOwnProperty.call(BRIDGED_TOOLS, t.name))
  .map((t) => t.name);

const EXPOSED_SET = new Set(EXPOSED_TOOLS);

export function isExposed(name: string): boolean {
  return EXPOSED_SET.has(name);
}

/** Total alcançável (núcleo + catálogo) — usado nas descrições das meta-tools. */
export const CATALOG_SIZE = CATALOG_TOOLS.length;

export const META_TOOL_DEFS = [
  {
    name: META_SEARCH,
    title: "Buscar ferramentas do Lunari",
    description:
      `Busca no catálogo completo do Lunari (${CATALOG_SIZE} ferramentas: precificação, configurações, ` +
      "contratos, formulários, galeria, relatórios, diagnósticos). Retorna nomes e resumos, sem schema. " +
      "Use sempre que a ação não estiver entre as ferramentas visíveis.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termo de busca (ex.: 'pacote', 'contrato', 'meta')." },
        domain: { type: "string", description: "Filtra por domínio (ex.: precificacao, configuracoes, contratos)." },
        limit: { type: "number", description: "Máximo de resultados (padrão 15)." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: META_DESCRIBE,
    title: "Detalhar ferramenta do Lunari",
    description:
      "Retorna o schema de entrada completo de UMA ferramenta encontrada em lunari.tools.search. " +
      "Chame antes de executar algo do catálogo.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome exato da ferramenta." },
      },
      required: ["name"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: META_INVOKE,
    title: "Executar ferramenta do Lunari",
    description:
      "Executa qualquer ferramenta do catálogo pelo nome exato. Mesmos escopos, aprovação humana e auditoria.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome exato da ferramenta." },
        arguments: { type: "object", description: "Argumentos da ferramenta.", additionalProperties: true },
        approval_token: { type: "string", description: "Token de aprovação, quando exigido." },
      },
      required: ["name"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
];

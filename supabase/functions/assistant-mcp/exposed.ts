/**
 * Superfície curada exposta a clientes MCP remotos (ChatGPT, Claude).
 *
 * Onda 2 — coerência: a lista visível é DERIVADA da capacidade real de
 * execução (`BRIDGED_TOOLS` em executor.ts). Assim o conector nunca vê uma
 * ferramenta que responderia "ainda não habilitada para execução remota".
 * O catálogo completo (184 tools) continua alcançável via meta-tools
 * (`lunari.tools.search` / `lunari.tools.invoke`), que passam pelo mesmo
 * dispatcher, escopos, rollout, aprovação e auditoria.
 */
import { BRIDGED_TOOLS } from "./executor.ts";

export const META_SEARCH = "lunari.tools.search";
export const META_INVOKE = "lunari.tools.invoke";

/** Tools executáveis remotamente hoje (bridge server-side). */
export const EXPOSED_TOOLS: string[] = Object.keys(BRIDGED_TOOLS);


const EXPOSED_SET = new Set(EXPOSED_TOOLS);

export function isExposed(name: string): boolean {
  return EXPOSED_SET.has(name);
}

export const META_TOOL_DEFS = [
  {
    name: META_SEARCH,
    title: "Buscar ferramentas do Lunari",
    description:
      "Busca no catálogo completo do Lunari (184 ferramentas) por nome, título ou descrição. " +
      "Use quando a ação desejada não estiver na lista visível; depois execute com lunari.tools.invoke.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termo de busca (ex.: 'precificação', 'contrato', 'produto')." },
        limit: { type: "number", description: "Máximo de resultados (padrão 20)." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: META_INVOKE,
    title: "Executar ferramenta do Lunari",
    description:
      "Executa qualquer ferramenta do catálogo completo pelo nome exato (obtido em lunari.tools.search). " +
      "Aplica os mesmos escopos, rollout, aprovação humana e auditoria das ferramentas visíveis.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome exato da ferramenta (ex.: lunari.precificacao.simularPreco)." },
        arguments: { type: "object", description: "Argumentos da ferramenta.", additionalProperties: true },
      },
      required: ["name"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
];

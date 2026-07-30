/**
 * Camadas de exposição de capabilities no MCP — solução arquitetural definitiva
 * para o crescimento da superfície do Lunari.
 *
 * Problema que isto resolve: até aqui, a lista publicada em `tools/list` era
 * DERIVADA de "tudo que o executor sabe executar". Cada onda nova de
 * funcionalidade engordava o manifesto automaticamente, até o conector
 * (ChatGPT) parar de conectar. A visibilidade agora é uma POLÍTICA declarativa,
 * independente da capacidade de execução.
 *
 * Três camadas:
 *  - "core"    → publicado em `tools/list`. Uso recorrente do fotógrafo.
 *  - "catalog" → invisível no handshake, descoberto por `lunari.tools.search`
 *                e executado por `lunari.tools.invoke`. Sem perda de recurso.
 *  - (restrito) → nem entra no catálogo; ver `audience.ts`.
 *
 * Regra de ouro do Núcleo: uma ferramenta só é "core" se for plausível
 * chamá-la SEM pesquisar antes. Tudo que exige contexto de estrutura
 * (configurações, precificação, diagnóstico, manutenção) vive no Catálogo.
 */

export type CapabilityTier = "core" | "catalog";

/**
 * Núcleo curado — o único conjunto publicado no manifesto.
 *
 * Orçamento arquitetural (validado em CI por `scripts/validate-mcp-surface.ts`):
 *  - máx. 30 capabilities core;
 *  - máx. 20 KB de `tools/list` (com as meta-ferramentas incluídas).
 *
 * Adicionar algo aqui é uma decisão de produto, não consequência de uma onda
 * de implementação.
 */
export const CORE_CAPABILITIES: ReadonlySet<string> = new Set([
  // Agenda — rotina diária
  "agenda.appointments.list",
  "agenda.appointments.create",
  "agenda.appointments.reschedule",
  "agenda.availability.findNext",

  // Workflow — coração operacional
  "workflow.search",
  "workflow.getCardBySession",
  "workflow.getSessionFinancials",
  "workflow.pendingPayments",
  "workflow.updateFields",
  "workflow.advanceCard",
  "workflow.addPayment",

  // Clientes
  "clientes.search",
  "clientes.get",
  "clientes.create",

  // Tarefas
  "tasks.list",
  "tasks.create",
  "tasks.complete",

  // Financeiro — o mínimo do dia a dia
  "finance.transaction.create",
  "finance.extrato.summary",

  // Análise de vendas — consulta de rotina (faturamento, ticket médio)
  "workflow.vendas.resumo",


  // Comercial
  "leads.list",
]);

/** Teto duro do Núcleo — o CI falha antes de o manifesto crescer de novo. */
export const CORE_MAX_TOOLS = 30;
/** Teto duro do payload de `tools/list`, em bytes. */
export const TOOLS_LIST_MAX_BYTES = 20_000;
/** Teto de caracteres da `description` publicada no Núcleo. */
export const CORE_DESCRIPTION_MAX = 160;

/** Camada de uma capability. Default fail-safe: catálogo (não polui o handshake). */
export function tierFor(capabilityId: string): CapabilityTier {
  return CORE_CAPABILITIES.has(capabilityId) ? "core" : "catalog";
}

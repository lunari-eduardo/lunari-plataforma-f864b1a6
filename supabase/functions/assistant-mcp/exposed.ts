/**
 * Superfície curada exposta a clientes MCP remotos (ChatGPT, Claude).
 *
 * Motivo: o catálogo completo tem 184 tools (~110 KB em `tools/list`), acima do
 * teto prático dos conectores do ChatGPT — o conector falha logo após o OAuth
 * com "erro de conexão". Aqui listamos um conjunto de alto valor do dia a dia e
 * mantemos o alcance total via meta-tools (`lunari.tools.search` /
 * `lunari.tools.invoke`), que passam pelo MESMO dispatcher, escopos, rollout,
 * aprovação e auditoria.
 */

export const META_SEARCH = "lunari.tools.search";
export const META_INVOKE = "lunari.tools.invoke";

/** Tools curadas — leitura + escritas mais usadas no dia a dia do fotógrafo. */
export const EXPOSED_TOOLS: string[] = [
  // Agenda
  "lunari.agenda.appointments.list",
  "lunari.agenda.appointments.get",
  "lunari.agenda.appointments.create",
  "lunari.agenda.appointments.update",
  "lunari.agenda.availability.findNext",
  "lunari.agenda.slot.check",
  // Clientes
  "lunari.clientes.search",
  "lunari.clientes.list",
  "lunari.clientes.get",
  "lunari.clientes.listSessoes",
  "lunari.clientes.listTransacoes",
  "lunari.clientes.create",
  "lunari.clientes.update",
  "lunari.clientes.addNota",
  // Workflow / sessões
  "lunari.workflow.search",
  "lunari.workflow.listMonth",
  "lunari.workflow.listRange",
  "lunari.workflow.getCardBySession",
  "lunari.workflow.getSessionFinancials",
  "lunari.workflow.pendingPayments",
  "lunari.workflow.metricsForMonth",
  "lunari.workflow.metricsForRange",
  "lunari.workflow.updateFields",
  "lunari.workflow.advanceCard",
  "lunari.workflow.addPayment",
  "lunari.workflow.produto.listBySession",
  // Financeiro
  "lunari.finance.dashboard.kpis",
  "lunari.finance.extrato.list",
  "lunari.finance.extrato.summary",
  "lunari.finance.transaction.create",
  "lunari.finance.transaction.markPaid",
  "lunari.finance.goal.progress",
  "lunari.billing.listSessionPayments",
  "lunari.billing.registerManualPayment",
  // Leads
  "lunari.leads.list",
  "lunari.leads.get",
  "lunari.leads.create",
  "lunari.leads.moveStatus",
  "lunari.leads.addInteracao",
  "lunari.leads.listFollowUpsDue",
  // Tarefas
  "lunari.tasks.list",
  "lunari.tasks.dueOverview",
  "lunari.tasks.create",
  "lunari.tasks.complete",
  // Contratos / formulários (leitura)
  "lunari.contratos.listPendentes",
  "lunari.formularios.listResponses",
];

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

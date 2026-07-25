/**
 * Entry-point público do módulo Clientes (CRM).
 *
 * D.1 — Registra capabilities v1 (list/get/search/listSessoes/listTransacoes,
 * create/update/addNota). O import da superfície `ai/` também dispara o
 * registro central de approvals via `registerModuleApprovals`.
 */
export * from "./ai";
export * from "./application/clientes";

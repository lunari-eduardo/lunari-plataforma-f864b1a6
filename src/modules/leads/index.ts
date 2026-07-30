/**
 * Entry-point público do módulo Leads (funil comercial).
 *
 * B1 — Registra capabilities de leitura (list/get/listStatuses/metrics/
 * listFollowUpsDue/listOrcamentosAgendados) e escrita (create/update/
 * addInteracao/moveStatus/markLost/archive/convertToCliente).
 * O import da superfície `ai/` também dispara o registro central de approvals.
 */
export * from "./ai";
export * from "./domain/types";
export * from "./application/leads";
export * from "./application/mutations";

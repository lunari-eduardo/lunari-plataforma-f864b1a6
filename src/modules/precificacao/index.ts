/**
 * Entry-point público do módulo Precificação (Bloco B2).
 *
 * Leitura e simulação livres; escrita de preço sob aprovação humana.
 * O import da superfície `ai/` também dispara o registro central de approvals.
 */
export * from "./ai";
export * from "./domain/types";
export * from "./domain/calculo";
export * from "./application/leitura";
export * from "./application/simulacao";
export * from "./application/mutations";

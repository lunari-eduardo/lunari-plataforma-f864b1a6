/**
 * Port: ExtratoRepo (view `extrato_unificado`).
 */

import type { LinhaExtrato, ExtratoTipo, ExtratoOrigem, ExtratoStatus } from "@/types/extrato";
import type { RegimeContabil } from "../domain/types";

export interface ListExtratoInput {
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
  regime?: RegimeContabil;
  tipo?: ExtratoTipo | "todos";
  origem?: ExtratoOrigem | "todos";
  status?: ExtratoStatus | "todos";
}

export interface ExtratoPage {
  linhas: LinhaExtrato[];
  totalCount: number;
  totalPages: number;
}

export interface ExtratoSummary {
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
  count: number;
}

export interface ExtratoRepo {
  list(input: ListExtratoInput): Promise<ExtratoPage>;
  summary(input: Omit<ListExtratoInput, "page" | "pageSize">): Promise<ExtratoSummary>;
}

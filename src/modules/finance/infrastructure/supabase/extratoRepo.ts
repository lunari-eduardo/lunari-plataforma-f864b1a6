/**
 * Supabase impl do `ExtratoRepo` (view `extrato_unificado`).
 * Reusa a lógica de mapeamento do hook `useExtratoSupabase`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { LinhaExtrato } from "@/types/extrato";
import type { ExtratoRepo, ExtratoPage, ExtratoSummary, ListExtratoInput } from "../../ports/extratoRepo";
import type { RegimeContabil } from "../../domain/types";

function mapLinha(row: any, regime: RegimeContabil): LinhaExtrato {
  const dataExibida = regime === "competencia" ? row.data_competencia || row.data : row.data;
  return {
    id: `${row.tipo}_${row.id}`,
    data: dataExibida,
    tipo: row.tipo,
    descricao: row.descricao || "Sem descrição",
    origem: row.origem,
    cliente: row.cliente || undefined,
    projeto: row.projeto || undefined,
    categoria: row.categoria || row.categoria_session || undefined,
    parcela:
      row.parcela_atual && row.parcela_total
        ? { atual: row.parcela_atual, total: row.parcela_total }
        : null,
    valor: Number(row.valor) || 0,
    status: row.status,
    observacoes: row.observacoes || undefined,
    cartao: row.cartao || undefined,
    meioPagamento: row.meio_pagamento || undefined,
    referenciaId: row.id,
    referenciaOrigem: row.origem,
    dataCaixa: row.data,
    dataCompetencia: row.data_competencia || row.data,
  } as LinhaExtrato;
}

async function buildQuery(input: ListExtratoInput, opts: { count?: boolean } = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const regime: RegimeContabil = input.regime ?? "caixa";
  const dataColumn = regime === "competencia" ? "data_competencia" : "data";

  let q = supabase
    .from("extrato_unificado")
    .select("*", opts.count ? { count: "estimated" } : undefined)
    .eq("user_id", user.id)
    .order(dataColumn, { ascending: false })
    .order("created_at", { ascending: false });

  if (input.dataInicio) q = q.gte(dataColumn, input.dataInicio);
  if (input.dataFim) q = q.lte(dataColumn, input.dataFim);
  if (input.tipo && input.tipo !== "todos") q = q.eq("tipo", input.tipo);
  if (input.origem && input.origem !== "todos") q = q.eq("origem", input.origem);
  if (input.status && input.status !== "todos") q = q.eq("status", input.status);

  return { q, regime };
}

export const supabaseExtratoRepo: ExtratoRepo = {
  async list(input): Promise<ExtratoPage> {
    const page = input.page ?? 1;
    const pageSize = Math.min(input.pageSize ?? 50, 200);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { q, regime } = await buildQuery(input, { count: true });
    const { data, count, error } = await q.range(from, to);
    if (error) throw error;

    return {
      linhas: (data || []).map((r) => mapLinha(r, regime)),
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  },

  async summary(input): Promise<ExtratoSummary> {
    const { q, regime } = await buildQuery(input);
    const { data, error } = await q.range(0, 999);
    if (error) throw error;
    const linhas = (data || []).map((r) => mapLinha(r, regime));
    let entradas = 0;
    let saidas = 0;
    for (const l of linhas) {
      if (l.tipo === "entrada") entradas += l.valor;
      else saidas += l.valor;
    }
    return {
      totalEntradas: entradas,
      totalSaidas: saidas,
      saldo: entradas - saidas,
      count: linhas.length,
    };
  },
};

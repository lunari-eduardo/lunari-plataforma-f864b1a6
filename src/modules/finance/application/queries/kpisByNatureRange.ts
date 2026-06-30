import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { isOk, ok } from "@/shared/result";
import { supabaseTransactionsRepo } from "../../infrastructure/supabase/transactionsRepo";
import { supabaseItemsRepo } from "../../infrastructure/supabase/itemsRepo";
import { computeKpisByNature } from "../../domain/selectorsByNature";
import { resolveUserId } from "../_auth";

const Input = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();

const BreakdownEntry = z.object({
  natureCode: z.string(),
  label: z.string(),
  total: z.number(),
  count: z.number(),
});

const Output = z.object({
  start: z.string(),
  end: z.string(),
  receita: z.object({
    operacional: z.number(),
    financeira: z.number(),
    total: z.number(),
  }),
  gastos: z.object({
    operacional: z.number(),
    investimentos: z.number(),
    impostos: z.number(),
    proLabore: z.number(),
    distribuicao: z.number(),
    financiamentos: z.number(),
    total: z.number(),
    breakdown: z.array(BreakdownEntry),
  }),
  neutro: z.object({
    transferencias: z.number(),
    aplicacoes: z.number(),
    emprestimos: z.number(),
  }),
  lucroLiquido: z.number(),
  margemLiquida: z.number(),
});

/**
 * Onda D — KPIs por natureza sobre intervalo arbitrário (date range).
 * Usado pelo Dashboard com filtros mês/ano-completo/personalizado.
 */
export const kpisByNatureRange = defineQuery({
  id: "finance.kpi.byNatureRange",
  title: "KPIs por natureza (intervalo)",
  description:
    "Computa receitas, gastos (Operacional/Investimentos/Impostos/Pró-labore/Distribuição/Financiamentos), neutros e lucro líquido para intervalo arbitrário de datas.",
  input: Input,
  output: Output,
  permissions: ["finance:read"],
  sideEffects: [],
  async handler({ start, end }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;

    const [txs, items] = await Promise.all([
      supabaseTransactionsRepo.listByRange(start, end),
      supabaseItemsRepo.listAll(),
    ]);
    const itensById = new Map(items.map((i) => [i.id, i]));
    const kpis = computeKpisByNature(txs, itensById);

    return ok({ start, end, ...kpis });
  },
});

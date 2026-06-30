import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { isOk, ok } from "@/shared/result";
import { supabaseTransactionsRepo } from "../../infrastructure/supabase/transactionsRepo";
import { supabaseItemsRepo } from "../../infrastructure/supabase/itemsRepo";
import { computeKpisByNature } from "../../domain/selectorsByNature";
import { resolveUserId } from "../_auth";

const Input = z.object({
  ano: z.number().int().min(2020).max(2100),
  mes: z.number().int().min(1).max(12),
}).strict();

const BreakdownEntry = z.object({
  natureCode: z.string(),
  label: z.string(),
  total: z.number(),
  count: z.number(),
});

const Output = z.object({
  ano: z.number(),
  mes: z.number(),
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

export const kpisByNature = defineQuery({
  id: "finance.kpi.byNature",
  title: "KPIs financeiros por natureza",
  description:
    "Computa receitas, gastos discriminados (Despesas/Investimentos/Impostos/Pró-labore/etc.), neutros e lucro líquido do mês. Baseado em natureza (independente do nome da categoria).",
  input: Input,
  output: Output,
  permissions: ["finance:read"],
  sideEffects: [],
  async handler({ ano, mes }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;

    const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const lastDay = new Date(ano, mes, 0).getDate();
    const end = `${ano}-${String(mes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const [txs, items] = await Promise.all([
      supabaseTransactionsRepo.listByRange(start, end),
      supabaseItemsRepo.listAll(),
    ]);
    const itensById = new Map(items.map((i) => [i.id, i]));
    const kpis = computeKpisByNature(txs, itensById);

    return ok({ ano, mes, ...kpis });
  },
});

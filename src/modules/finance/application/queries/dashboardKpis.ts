import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { isOk, ok } from "@/shared/result";
import { supabaseTransactionsRepo } from "../../infrastructure/supabase/transactionsRepo";
import { supabaseItemsRepo } from "../../infrastructure/supabase/itemsRepo";
import { computeResumo } from "../../domain/selectors";
import { resolveUserId } from "../_auth";

const Input = z.object({
  ano: z.number().int().min(2020).max(2100),
  mes: z.number().int().min(1).max(12),
}).strict();

const Output = z.object({
  ano: z.number(),
  mes: z.number(),
  receitaOperacional: z.number(),
  totalReceitasExtras: z.number(),
  totalDespesas: z.number(),
  custoTotal: z.number(),
  custoPrevisto: z.number(),
  lucroLiquido: z.number(),
  resultadoMensal: z.number(),
});

export const dashboardKpis = defineQuery({
  id: "finance.dashboard.kpis",
  title: "KPIs do dashboard financeiro",
  description: "Retorna receita, despesa, custo e lucro do mês informado.",
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
    const resumo = computeResumo(txs, itensById);

    return ok({ ano, mes, ...resumo });
  },
});

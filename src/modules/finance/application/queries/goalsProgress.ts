import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { isOk, ok } from "@/shared/result";
import { supabaseGoalsRepo } from "../../infrastructure/supabase/goalsRepo";
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
  metaFaturamento: z.number(),
  metaLucro: z.number(),
  realizadoFaturamento: z.number(),
  realizadoLucro: z.number(),
  progressoFaturamento: z.number(),
  progressoLucro: z.number(),
});

export const goalsProgress = defineQuery({
  id: "finance.goal.progress",
  title: "Progresso de metas do mês",
  description: "Compara realizado vs meta para o mês informado (apenas meta global '__geral__').",
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

    const [goals, txs, items] = await Promise.all([
      supabaseGoalsRepo.listByYear(ano),
      supabaseTransactionsRepo.listByRange(start, end),
      supabaseItemsRepo.listAll(),
    ]);

    const meta = goals.find((g) => g.mes === mes && g.categoria === "__geral__");
    const itensById = new Map(items.map((i) => [i.id, i]));
    const resumo = computeResumo(txs, itensById);

    const metaFat = meta?.metaFaturamento ?? 0;
    const metaLuc = meta?.metaLucro ?? 0;
    const realFat = resumo.receitaOperacional + resumo.totalReceitasExtras;
    const realLuc = resumo.lucroLiquido;

    return ok({
      ano,
      mes,
      metaFaturamento: metaFat,
      metaLucro: metaLuc,
      realizadoFaturamento: realFat,
      realizadoLucro: realLuc,
      progressoFaturamento: metaFat > 0 ? Math.min(100, (realFat / metaFat) * 100) : 0,
      progressoLucro: metaLuc > 0 ? Math.min(100, (realLuc / metaLuc) * 100) : 0,
    });
  },
});

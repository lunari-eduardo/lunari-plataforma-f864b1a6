import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { isOk, ok } from "@/shared/result";
import { supabaseExtratoRepo } from "../../infrastructure/supabase/extratoRepo";
import { resolveUserId } from "../_auth";

const Input = z.object({
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  regime: z.enum(["caixa", "competencia"]).default("caixa"),
  tipo: z.enum(["entrada", "saida", "todos"]).default("todos"),
  origem: z.string().default("todos"),
  status: z.string().default("todos"),
}).strict();

const Output = z.object({
  totalEntradas: z.number(),
  totalSaidas: z.number(),
  saldo: z.number(),
  count: z.number(),
});

export const extratoSummary = defineQuery({
  id: "finance.extrato.summary",
  title: "Resumo do extrato",
  description: "Totais agregados de entradas, saídas e saldo no período/filtros informados.",
  input: Input,
  output: Output,
  permissions: ["finance:read"],
  sideEffects: [],
  async handler(input, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const s = await supabaseExtratoRepo.summary(input as any);
    return ok(s);
  },
});

import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { isOk, ok } from "@/shared/result";
import { supabaseExtratoRepo } from "../../infrastructure/supabase/extratoRepo";
import { resolveUserId } from "../_auth";

const Input = z.object({
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
  regime: z.enum(["caixa", "competencia"]).default("caixa"),
  tipo: z.enum(["entrada", "saida", "todos"]).default("todos"),
  origem: z.string().default("todos"),
  status: z.string().default("todos"),
}).strict();

const Output = z.object({
  linhas: z.array(z.any()),
  totalCount: z.number(),
  totalPages: z.number(),
});

export const listExtrato = defineQuery({
  id: "finance.extrato.list",
  title: "Listar extrato unificado",
  description: "Pagina o extrato unificado (gestão + gallery + cobranças). Default: regime caixa, 50/página.",
  input: Input,
  output: Output,
  permissions: ["finance:read"],
  sideEffects: [],
  async handler(input, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const page = await supabaseExtratoRepo.list(input as any);
    return ok(page);
  },
});

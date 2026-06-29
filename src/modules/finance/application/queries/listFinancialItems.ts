import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { isOk, ok } from "@/shared/result";
import { supabaseItemsRepo } from "../../infrastructure/supabase/itemsRepo";
import { resolveUserId } from "../_auth";

const Grupo = z.enum([
  "Despesa Fixa",
  "Despesa Variável",
  "Investimento",
  "Receita Não Operacional",
  "Receita Operacional",
]);

const Input = z.object({ grupo: Grupo.optional() }).strict();
const Output = z.object({
  items: z.array(z.object({ id: z.string(), nome: z.string(), grupo: Grupo })),
  total: z.number(),
});

export const listFinancialItems = defineQuery({
  id: "finance.item.list",
  title: "Listar subcategorias",
  description:
    "Lista subcategorias financeiras ativas, opcionalmente filtradas por grupo. Use antes de criar item por nome para desambiguar.",
  input: Input,
  output: Output,
  permissions: ["finance:read"],
  sideEffects: [],
  async handler({ grupo }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const rows = grupo
      ? await supabaseItemsRepo.listByGrupo(grupo)
      : await supabaseItemsRepo.listAll();
    const items = rows
      .filter((i) => i.ativo)
      .map((i) => ({ id: i.id, nome: i.nome, grupo: i.grupo }));
    return ok({ items, total: items.length });
  },
});

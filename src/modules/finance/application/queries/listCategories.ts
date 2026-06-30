import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { isOk, ok } from "@/shared/result";
import { supabaseItemsRepo } from "../../infrastructure/supabase/itemsRepo";
import { resolveUserId } from "../_auth";
import { GROUPS } from "../../domain/group";

const Input = z.object({
  groupCode: z.string().optional(),
  natureCode: z.string().optional(),
}).strict();

const CategoryOut = z.object({
  id: z.string(),
  nome: z.string(),
  grupo: z.string(),
  groupCode: z.string().nullable().optional(),
  natureCode: z.string().nullable().optional(),
  isSystem: z.boolean().optional(),
  ativo: z.boolean(),
});
const Output = z.object({ categories: z.array(CategoryOut), total: z.number() });

export const listCategories = defineQuery({
  id: "finance.category.list",
  title: "Listar categorias (subcategorias) do usuário",
  description:
    "Lista subcategorias ativas com vínculo opcional a um grupo. Inclui categorias legadas (sem groupCode). Filtros opcionais por groupCode ou natureCode.",
  input: Input,
  output: Output,
  permissions: ["finance:read"],
  sideEffects: [],
  async handler({ groupCode, natureCode }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;

    const rows = await supabaseItemsRepo.listAll();
    const categories = rows
      .filter((i) => i.ativo)
      .map((i) => {
        const gc = i.groupCode || null;
        const nc = gc && GROUPS[gc as keyof typeof GROUPS]
          ? GROUPS[gc as keyof typeof GROUPS].natureCode
          : null;
        return {
          id: i.id,
          nome: i.nome,
          grupo: i.grupo,
          groupCode: gc,
          natureCode: nc,
          isSystem: !!i.isSystem,
          ativo: i.ativo,
        };
      })
      .filter((c) => (groupCode ? c.groupCode === groupCode : true))
      .filter((c) => (natureCode ? c.natureCode === natureCode : true));

    return ok({ categories, total: categories.length });
  },
});

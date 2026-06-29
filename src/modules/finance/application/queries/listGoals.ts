import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { isOk, ok } from "@/shared/result";
import { supabaseGoalsRepo } from "../../infrastructure/supabase/goalsRepo";
import { resolveUserId } from "../_auth";

const Input = z.object({ ano: z.number().int().min(2020).max(2100) }).strict();
const Output = z.object({ goals: z.array(z.any()), total: z.number() });

export const listGoals = defineQuery({
  id: "finance.goal.list",
  title: "Listar metas do ano",
  description: "Retorna todas as metas mensais configuradas para o ano informado.",
  input: Input,
  output: Output,
  permissions: ["finance:read"],
  sideEffects: [],
  async handler({ ano }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    const goals = await supabaseGoalsRepo.listByYear(ano);
    return ok({ goals, total: goals.length });
  },
});

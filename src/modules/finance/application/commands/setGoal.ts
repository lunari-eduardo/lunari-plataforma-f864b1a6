import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseGoalsRepo } from "../../infrastructure/supabase/goalsRepo";
import { resolveUserId } from "../_auth";

const Input = z.object({
  ano: z.number().int().min(2020).max(2100),
  mes: z.number().int().min(1).max(12),
  categoria: z.string().min(1),
  metaFaturamento: z.number().min(0),
  metaLucro: z.number().min(0),
  source: z.enum(["user", "automation", "ai"]).default("user"),
}).strict();
const Output = z.object({ id: z.string() });

export const setGoal = defineCommand({
  id: "finance.goal.set",
  title: "Definir meta mensal",
  description:
    "Cria ou atualiza meta de faturamento/lucro para um mês. Use categoria '__geral__' para meta global.",
  input: Input,
  output: Output,
  permissions: ["finance:write"],
  sideEffects: ["db:metas_personalizadas", "event:finance.goal.upserted"],
  audit: "on-success",
  async handler({ source, ano, mes, categoria, metaFaturamento, metaLucro }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    try {
      const meta = await supabaseGoalsRepo.set({ ano, mes, categoria, metaFaturamento, metaLucro });
      await ctx.emit("finance.goal.upserted", {
        id: meta.id,
        ano: meta.ano,
        mes: meta.mes,
        categoria: meta.categoria,
        photographerId: auth.value,
        actor: source,
      });
      return ok({ id: meta.id });
    } catch (e) {
      ctx.log.error("falha ao definir meta", { e });
      return err(domainError("EXTERNAL", "Não foi possível salvar a meta.", { cause: e, retriable: true }));
    }
  },
});

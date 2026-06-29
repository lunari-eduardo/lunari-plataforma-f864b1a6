import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseItemsRepo } from "../../infrastructure/supabase/itemsRepo";
import { itemsStore } from "../../presentation/store/itemsStore";
import { resolveUserId } from "../_auth";

const Grupo = z.enum([
  "Despesa Fixa",
  "Despesa Variável",
  "Investimento",
  "Receita Não Operacional",
  "Receita Operacional",
]);

const Input = z.object({
  nome: z.string().min(2).max(60),
  grupo: Grupo,
  source: z.enum(["user", "automation", "ai"]).default("user"),
}).strict();
const Output = z.object({ id: z.string(), nome: z.string(), grupo: Grupo });

export const createFinancialItem = defineCommand({
  id: "finance.item.create",
  title: "Criar subcategoria financeira",
  description:
    "Cria nova subcategoria (item) em um grupo. Idempotente por (user, lower(nome), grupo).",
  input: Input,
  output: Output,
  permissions: ["finance:write"],
  sideEffects: ["db:financial_items", "event:finance.item.created"],
  audit: "on-success",
  async handler({ nome, grupo, source }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    try {
      const item = await supabaseItemsRepo.create(nome, grupo);
      if (ctx.runtime === "client") {
        try { itemsStore.upsert(item); } catch { /* noop */ }
      }
      await ctx.emit("finance.item.created", {
        id: item.id,
        nome: item.nome,
        grupo: item.grupo,
        photographerId: auth.value,
        actor: source,
      });
      return ok({ id: item.id, nome: item.nome, grupo: item.grupo });
    } catch (e) {
      ctx.log.error("falha ao criar subcategoria", { e });
      return err(domainError("EXTERNAL", "Não foi possível criar a subcategoria.", { cause: e, retriable: true }));
    }
  },
});

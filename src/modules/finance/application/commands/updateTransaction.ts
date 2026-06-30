import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseTransactionsRepo } from "../../infrastructure/supabase/transactionsRepo";
import { transactionsStore } from "../../presentation/store/transactionsStore";
import { resolveUserId } from "../_auth";

const Input = z
  .object({
    id: z.string().uuid(),
    valor: z.number().positive().optional(),
    dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dataCompetencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    observacoes: z.string().max(500).nullable().optional(),
    formaPagamento: z
      .enum(["dinheiro", "pix", "transferencia", "boleto", "cartao_debito", "cartao_credito"])
      .nullable()
      .optional(),
    source: z.enum(["user", "automation", "ai"]).default("user"),
  })
  .strict();

const Output = z.object({ id: z.string() });

export const updateTransaction = defineCommand({
  id: "finance.transaction.update",
  title: "Atualizar lançamento",
  description: "Atualiza campos editáveis. Status e valores derivados são imutáveis.",
  input: Input,
  output: Output,
  permissions: ["finance:write"],
  sideEffects: ["db:fin_transactions", "event:finance.transaction.updated"],
  audit: "on-success",
  async handler({ id, source, ...patch }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    try {
      const row = await supabaseTransactionsRepo.update(id, patch);
      if (ctx.runtime === "client") {
        try { transactionsStore.upsert(row); } catch { /* noop */ }
      }
      await ctx.emit("finance.transaction.updated", {
        id,
        changedKeys: Object.keys(patch),
        photographerId: auth.value,
        actor: source,
      });
      return ok({ id });
    } catch (e) {
      ctx.log.error("falha ao atualizar lançamento", { e });
      return err(domainError("EXTERNAL", "Não foi possível atualizar o lançamento.", { cause: e, retriable: true }));
    }
  },
});

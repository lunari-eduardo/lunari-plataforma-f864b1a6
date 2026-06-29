import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseTransactionsRepo } from "../../infrastructure/supabase/transactionsRepo";
import { transactionsStore } from "../../presentation/store/transactionsStore";
import { resolveUserId } from "../_auth";

const Input = z.object({
  id: z.string().uuid(),
  source: z.enum(["user", "automation", "ai"]).default("user"),
}).strict();
const Output = z.object({ id: z.string(), status: z.string() });

export const markTransactionPending = defineCommand({
  id: "finance.transaction.markPending",
  title: "Reabrir lançamento",
  description: "Reabre um lançamento marcado como pago, retornando ao status Faturado.",
  input: Input,
  output: Output,
  permissions: ["finance:write"],
  sideEffects: ["db:fin_transactions", "event:finance.transaction.reopened"],
  audit: "on-success",
  async handler({ id, source }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    try {
      const row = await supabaseTransactionsRepo.markPending(id);
      if (ctx.runtime === "client") {
        try { transactionsStore.upsert(row); } catch { /* noop */ }
      }
      await ctx.emit("finance.transaction.reopened", {
        id,
        photographerId: auth.value,
        actor: source,
      });
      return ok({ id, status: row.status });
    } catch (e) {
      ctx.log.error("falha ao reabrir lançamento", { e });
      return err(domainError("EXTERNAL", "Não foi possível reabrir o lançamento.", { cause: e, retriable: true }));
    }
  },
});

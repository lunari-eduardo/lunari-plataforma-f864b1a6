import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseTransactionsRepo } from "../../infrastructure/supabase/transactionsRepo";
import { transactionsStore } from "../../presentation/store/transactionsStore";
import { resolveUserId } from "../_auth";

const Input = z.object({
  id: z.string().uuid(),
  dataPagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  source: z.enum(["user", "automation", "ai"]).default("user"),
}).strict();
const Output = z.object({ id: z.string(), status: z.string() });

export const markTransactionPaid = defineCommand({
  id: "finance.transaction.markPaid",
  title: "Marcar como pago",
  description: "Marca um lançamento financeiro como Pago.",
  input: Input,
  output: Output,
  permissions: ["finance:write"],
  sideEffects: ["db:fin_transactions", "event:finance.transaction.paid"],
  audit: "on-success",
  async handler({ id, dataPagamento, source }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    try {
      const row = await supabaseTransactionsRepo.markPaid(id, dataPagamento);
      if (ctx.runtime === "client") {
        try { transactionsStore.upsert(row); } catch { /* noop */ }
      }
      await ctx.emit("finance.transaction.paid", {
        id,
        at: dataPagamento ?? new Date().toISOString().slice(0, 10),
        photographerId: auth.value,
        actor: source,
      });
      return ok({ id, status: row.status });
    } catch (e) {
      ctx.log.error("falha ao marcar pago", { e });
      return err(domainError("EXTERNAL", "Não foi possível marcar como pago.", { cause: e, retriable: true }));
    }
  },
});

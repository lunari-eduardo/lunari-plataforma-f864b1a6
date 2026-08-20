import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabaseTransactionsRepo } from "../../infrastructure/supabase/transactionsRepo";
import { transactionsStore } from "../../presentation/store/transactionsStore";
import { resolveUserId } from "../_auth";

const Input = z.object({
  id: z.string().uuid(),
  deleteAllSeries: z.boolean().optional(),
  source: z.enum(["user", "automation", "ai"]).default("user"),
}).strict();
const Output = z.object({ id: z.string() });

export const deleteTransaction = defineCommand({
  id: "finance.transaction.delete",
  title: "Excluir lançamento",
  description: "Remove um lançamento financeiro. Requer aprovação humana quando executado pela IA.",
  input: Input,
  output: Output,
  permissions: ["finance:delete"],
  sideEffects: ["db:fin_transactions", "event:finance.transaction.deleted"],
  needsApproval: true,
  audit: "always",
  async handler({ id, deleteAllSeries, source }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;
    try {
      if (deleteAllSeries) {
        const transacao = await supabaseTransactionsRepo.getById(id);
        if (transacao?.parentId) {
          await supabaseTransactionsRepo.removeByParentId(transacao.parentId);
          // O store precisa invalidar queries, remover do store apenas o ID atual não basta,
          // mas como usamos react-query invalidateAll após onSuccess na view, é seguro ignorar a deleção em massa aqui.
        } else {
          await supabaseTransactionsRepo.remove(id);
        }
      } else {
        await supabaseTransactionsRepo.remove(id);
      }
      
      if (ctx.runtime === "client") {
        try { transactionsStore.remove(id); } catch { /* noop */ }
      }
      await ctx.emit("finance.transaction.deleted", {
        id,
        photographerId: auth.value,
        actor: source,
      });
      return ok({ id });
    } catch (e) {
      ctx.log.error("falha ao excluir lançamento", { e });
      return err(domainError("EXTERNAL", "Não foi possível excluir o lançamento.", { cause: e, retriable: true }));
    }
  },
});

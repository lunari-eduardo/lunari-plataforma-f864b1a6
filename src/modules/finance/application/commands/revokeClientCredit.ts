import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { resolveUserId } from "../_auth";

/**
 * Capability `finance.credit.revoke` — cria lançamento reverso de um crédito.
 * O ledger é append-only: nunca deletamos linhas, sempre lançamos reversa.
 */
const Input = z
  .object({
    ledgerId: z.string().uuid(),
    motivo: z.string().max(240).optional(),
  })
  .strict();

const Output = z.object({ novoLedgerId: z.string() });

export const revokeClientCredit = defineCommand({
  id: "finance.credit.revoke",
  title: "Reverter lançamento de crédito",
  description: "Insere lançamento espelhado que anula um crédito anterior.",
  input: Input,
  output: Output,
  permissions: ["finance:write"],
  sideEffects: [
    "db:cliente_creditos_ledger",
    "event:finance.credit.revoked",
  ],
  audit: "always",
  async handler({ ledgerId, motivo }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;

    // Precisamos do cliente para o evento
    const { data: original } = await supabase
      .from("cliente_creditos_ledger")
      .select("cliente_id, user_id")
      .eq("id", ledgerId)
      .maybeSingle();

    if (!original) {
      return err(
        domainError("NOT_FOUND", "Lançamento não encontrado.", {
          details: { ledgerId },
        }),
      );
    }
    if (original.user_id !== auth.value) {
      return err(domainError("FORBIDDEN", "Sem acesso a este lançamento."));
    }

    const { data, error } = await supabase.rpc("revoke_client_credit", {
      p_ledger_id: ledgerId,
      p_motivo: motivo ?? null,
    });

    if (error) {
      ctx.log.error("revoke_client_credit falhou", { error });
      return err(
        domainError("EXTERNAL", "Não foi possível reverter o crédito.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    const novoLedgerId = String(data);
    await ctx.emit("finance.credit.revoked", {
      ledgerId: novoLedgerId,
      originalLedgerId: ledgerId,
      clienteId: original.cliente_id,
      photographerId: auth.value,
    });

    return ok({ novoLedgerId });
  },
});

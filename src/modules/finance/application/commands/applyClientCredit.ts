import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { resolveUserId } from "../_auth";

/**
 * Capability `finance.credit.apply` — consome crédito do cliente em uma sessão.
 * RPC `apply_client_credit` cria transação `ajuste` e o lançamento de consumo
 * no ledger de forma atômica. Trigger DB recalcula `valor_pago` da sessão.
 */
const Input = z
  .object({
    clienteId: z.string().uuid(),
    sessionId: z.string().min(1),
    valor: z.number().positive(),
  })
  .strict();

const Output = z.object({
  transacaoId: z.string(),
  ledgerId: z.string(),
  valorAplicado: z.number(),
  novoSaldo: z.number(),
});

export const applyClientCredit = defineCommand({
  id: "finance.credit.apply",
  title: "Aplicar crédito na sessão",
  description:
    "Consome crédito do cliente para abater o valor pendente de uma sessão.",
  input: Input,
  output: Output,
  permissions: ["finance:write", "workflow:write"],
  sideEffects: [
    "db:cliente_creditos_ledger",
    "db:clientes_transacoes",
    "db:clientes_sessoes(trigger)",
    "event:finance.credit.applied",
  ],
  audit: "always",
  idempotencyKey: (i) =>
    `finance.credit.apply:${i.sessionId}:${i.valor}:${i.clienteId}`,
  async handler({ clienteId, sessionId, valor }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;

    const { data, error } = await supabase.rpc("apply_client_credit", {
      p_cliente_id: clienteId,
      p_session_id: sessionId,
      p_valor: valor,
    });

    if (error) {
      ctx.log.error("apply_client_credit falhou", { error });
      const msg = error.message || "";
      const code = /Saldo insuficiente/i.test(msg)
        ? "VALIDATION"
        : /já está quitada/i.test(msg)
        ? "VALIDATION"
        : "EXTERNAL";
      return err(
        domainError(code as "VALIDATION" | "EXTERNAL", msg || "Não foi possível aplicar o crédito.", {
          retriable: code === "EXTERNAL",
          cause: error,
        }),
      );
    }

    const payload = (data ?? {}) as {
      transacao_id: string;
      ledger_id: string;
      valor_aplicado: number;
      novo_saldo: number;
    };

    await ctx.emit("finance.credit.applied", {
      ledgerId: payload.ledger_id,
      transacaoId: payload.transacao_id,
      clienteId,
      sessionId,
      valor: Number(payload.valor_aplicado),
      photographerId: auth.value,
    });

    return ok({
      transacaoId: payload.transacao_id,
      ledgerId: payload.ledger_id,
      valorAplicado: Number(payload.valor_aplicado),
      novoSaldo: Number(payload.novo_saldo),
    });
  },
});

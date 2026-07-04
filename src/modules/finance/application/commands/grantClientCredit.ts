import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { resolveUserId } from "../_auth";

/**
 * Capability `finance.credit.grant` — concede crédito manual ao cliente.
 * Usada pelo botão "Adicionar crédito" na ficha do cliente e como wrapper
 * consumido por outros módulos (ex.: estorno → crédito).
 */
const Input = z
  .object({
    clienteId: z.string().uuid(),
    valor: z.number().positive(),
    origem: z
      .enum([
        "ajuste_manual",
        "estorno_para_credito",
        "reconcile_sobra",
      ])
      .default("ajuste_manual"),
    descricao: z.string().max(240).optional(),
    expiraEm: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    sessionOrigem: z.string().optional(),
  })
  .strict();

const Output = z.object({ ledgerId: z.string() });

export const grantClientCredit = defineCommand({
  id: "finance.credit.grant",
  title: "Adicionar crédito ao cliente",
  description:
    "Lança um crédito manual (ou originado por estorno/reconciliação) no ledger do cliente.",
  input: Input,
  output: Output,
  permissions: ["finance:write"],
  sideEffects: [
    "db:cliente_creditos_ledger",
    "event:finance.credit.granted",
  ],
  audit: "always",
  async handler(
    { clienteId, valor, origem, descricao, expiraEm, sessionOrigem },
    ctx,
  ) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;

    const { data, error } = await supabase.rpc("grant_client_credit", {
      p_cliente_id: clienteId,
      p_valor: valor,
      p_origem: origem,
      p_session_origem: sessionOrigem ?? null,
      p_descricao: descricao ?? null,
      p_expira_em: expiraEm ?? null,
      p_transacao_id: null,
    });

    if (error) {
      ctx.log.error("grant_client_credit falhou", { error });
      return err(
        domainError("EXTERNAL", "Não foi possível registrar o crédito.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    const ledgerId = String(data);
    await ctx.emit("finance.credit.granted", {
      ledgerId,
      clienteId,
      valor,
      origem,
      photographerId: auth.value,
    });
    return ok({ ledgerId });
  },
});

import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { PaymentSupabaseService } from "@/services/PaymentSupabaseService";

/**
 * Capability `billing.registerManualPayment`
 *
 * Registra pagamento manual (PIX externo, dinheiro, transferência, etc.)
 * vinculado a uma sessão. Fluxo espelhado do `workflow.addPayment`, mas
 * exposto no namespace `billing` com metadados de meio + escopo mais
 * amigáveis para o Assistente.
 *
 * Trigger DB atualiza `valor_pago` / `status_financeiro`.
 */
const Input = z
  .object({
    sessionId: z.string().min(1),
    valor: z.number().positive(),
    dataPagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    meio: z.enum(["pix", "dinheiro", "transferencia", "cartao_externo", "outro"]),
    escopo: z.enum(["sessao", "fotos_extras", "sessao_e_extras"]).default("sessao"),
    observacao: z.string().max(240).optional(),
  })
  .strict();

const Output = z.object({
  sessionId: z.string(),
  paymentId: z.string(),
  valor: z.number(),
});

const MEIO_LABEL: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  cartao_externo: "Cartão externo",
  outro: "Outro",
};

export const registerManualPayment = defineCommand({
  id: "billing.registerManualPayment",
  title: "Registrar pagamento manual",
  description:
    "Registra pagamento fora do gateway (PIX externo, dinheiro, transferência…) vinculado a uma sessão.",
  input: Input,
  output: Output,
  permissions: ["financeiro:write", "workflow:write"],
  sideEffects: [
    "db:clientes_transacoes",
    "db:clientes_sessoes(trigger)",
    "event:billing.manual_payment_registered",
  ],
  audit: "always",
  needsApproval: true,
  idempotencyKey: (i) =>
    `billing.manual:${i.sessionId}:${i.valor}:${i.dataPagamento}:${i.meio}:${i.escopo}`,
  async handler({ sessionId, valor, dataPagamento, meio, escopo, observacao }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    const binding = await PaymentSupabaseService.getSessionBinding(sessionId);
    if (!binding) {
      return err(domainError("NOT_FOUND", "Sessão não encontrada.", { details: { sessionId } }));
    }

    const label = MEIO_LABEL[meio];
    const escopoTag = escopo === "sessao" ? "" : ` (${escopo.replace("_", " ")})`;
    const desc = observacao?.trim() || `Pagamento ${label}${escopoTag}`;
    const paymentId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const intentKey = `billing.manual:${binding.session_id}:${valor}:${dataPagamento}:${meio}:${escopo}`;

    const okSaved = await PaymentSupabaseService.saveSinglePaymentTracked(
      binding.id,
      paymentId,
      {
        valor,
        data: dataPagamento,
        observacoes: desc,
        forma_pagamento: label,
      },
      { binding, intentKey },
    );

    if (!okSaved) {
      return err(
        domainError("EXTERNAL", "Não foi possível registrar o pagamento.", { retriable: true }),
      );
    }

    await ctx.emit("billing.manual_payment_registered", {
      sessionId: binding.id,
      paymentId,
      valor,
      meio,
      escopo,
      photographerId: userId,
    });

    return ok({ sessionId: binding.id, paymentId, valor });
  },
});

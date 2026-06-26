import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { PaymentSupabaseService } from "@/services/PaymentSupabaseService";

/**
 * Capability `workflow.addPayment`
 *
 * Onda 4d — superfície única para registrar pagamento manual de uma sessão.
 * Aceita tanto UUID (`clientes_sessoes.id`) quanto session_id em texto
 * (`workflow-*`) e delega a escrita ao `PaymentSupabaseService.saveSinglePaymentTracked`,
 * que já implementa:
 *  - resolução de `cliente_id`/`session_id` via `getSessionBinding`
 *  - idempotência por `paymentId` + `intentKey`
 *  - tag `[ID:...]` / `[INTENT:...]` na descrição (rastreio)
 *
 * Trigger DB recalcula `valor_pago`/`status_financeiro`; este caminho NÃO envia
 * esses campos. Use `intentKey` para deduplicar cliques duplos do mesmo valor.
 */

const Input = z.object({
  sessionId: z.string().min(1),
  valor: z.number().int().positive(), // centavos
  dataTransacao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  formaPagamento: z.string().min(1).max(40),
  descricao: z.string().max(200).optional(),
  /** Opcional. Quando ausente, é derivado de (sessionId,valor,data,forma). */
  intentKey: z.string().min(1).max(120).optional(),
  /** Opcional. Quando ausente, é gerado (`cap-<ts>-<rand>`). */
  paymentId: z.string().min(1).max(80).optional(),
});

const Output = z.object({
  sessionId: z.string(),
  paymentId: z.string(),
  valor: z.number(),
});

export const addPayment = defineCommand({
  id: "workflow.addPayment",
  title: "Registrar pagamento manual",
  description:
    "Cria transação manual de pagamento vinculada a uma sessão do Workflow. Aceita UUID ou session_id em texto.",
  input: Input,
  output: Output,
  permissions: ["workflow:write", "financeiro:write"],
  sideEffects: [
    "db:clientes_transacoes",
    "db:clientes_sessoes(trigger)",
    "event:workflow.payment_added",
  ],
  audit: "always",
  idempotencyKey: (i) =>
    i.intentKey ??
    `workflow.addPayment:${i.sessionId}:${i.valor}:${i.dataTransacao}:${i.formaPagamento}`,
  examples: [
    {
      nl: "Registrar pagamento de R$250,00 hoje no PIX para a sessão X",
      input: {
        sessionId: "00000000-0000-0000-0000-000000000000",
        valor: 25000,
        dataTransacao: "2026-06-24",
        formaPagamento: "PIX",
      },
    },
  ],
  async handler(
    { sessionId, valor, dataTransacao, formaPagamento, descricao, intentKey, paymentId },
    ctx,
  ) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) {
      return err(domainError("UNAUTHENTICATED", "Sessão expirada."));
    }

    const binding = await PaymentSupabaseService.getSessionBinding(sessionId);
    if (!binding) {
      return err(
        domainError("NOT_FOUND", "Sessão não encontrada.", { details: { sessionId } }),
      );
    }

    const valorReais = valor / 100;
    const resolvedPaymentId =
      paymentId ??
      `cap-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const resolvedIntent =
      intentKey ??
      `cap:${binding.session_id}:${valor}:${dataTransacao}:${formaPagamento}`;
    const obs = descricao?.trim() || `Pagamento ${formaPagamento}`;

    const success = await PaymentSupabaseService.saveSinglePaymentTracked(
      binding.id,
      resolvedPaymentId,
      {
        valor: valorReais,
        data: dataTransacao,
        observacoes: obs,
        forma_pagamento: formaPagamento,
      },
      { binding, intentKey: resolvedIntent },
    );

    if (!success) {
      ctx.log.error("saveSinglePaymentTracked retornou false", {
        sessionId: binding.session_id,
        paymentId: resolvedPaymentId,
      });
      return err(
        domainError("EXTERNAL", "Não foi possível registrar o pagamento.", {
          retriable: true,
        }),
      );
    }

    await ctx.emit("workflow.payment_added", {
      sessionId: binding.id,
      transactionId: resolvedPaymentId,
      valor: valorReais,
      formaPagamento,
      photographerId: userId,
    });

    return ok({
      sessionId: binding.id,
      paymentId: resolvedPaymentId,
      valor: valorReais,
    });
  },
});

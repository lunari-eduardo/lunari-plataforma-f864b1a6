import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.refundPayment`
 *
 * Estorna um pagamento manual da sessão criando uma transação espelhada
 * (`tipo='estorno'`, valor negativo) — alinhado à memória
 * `Refunds/Estorno Integrity`. Não toca cobranças de gateway (essas têm
 * fluxo próprio em billing).
 *
 * Trigger do banco recalcula `valor_pago`/`status_financeiro` da sessão.
 */

const Input = z.object({
  transactionId: z.string().uuid(),
  motivo: z.string().max(240).optional(),
});

const Output = z.object({
  transactionId: z.string(),
  estornoId: z.string(),
  sessionId: z.string().nullable(),
  valorEstornado: z.number(),
});

export const refundPayment = defineCommand({
  id: "workflow.refundPayment",
  title: "Estornar pagamento manual",
  description:
    "Cria transação de estorno espelhada para um pagamento manual da sessão.",
  input: Input,
  output: Output,
  permissions: ["workflow:write", "financeiro:write"],
  sideEffects: [
    "db:clientes_transacoes",
    "db:clientes_sessoes(trigger)",
    "event:workflow.payment_refunded",
  ],
  audit: "always",
  idempotencyKey: (i) => `workflow.refundPayment:${i.transactionId}`,
  examples: [
    {
      nl: "Estornar o pagamento X com motivo 'cliente desistiu'",
      input: {
        transactionId: "00000000-0000-0000-0000-000000000000",
        motivo: "cliente desistiu",
      },
    },
  ],
  async handler({ transactionId, motivo }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) return err(domainError("UNAUTHENTICATED", "Sessão expirada."));

    const { data: original, error: readErr } = await supabase
      .from("clientes_transacoes")
      .select("id, user_id, cliente_id, session_id, valor, tipo, descricao, forma_pagamento")
      .eq("id", transactionId)
      .maybeSingle();

    if (readErr) {
      ctx.log.error("falha ao ler transação p/ estorno", { readErr });
      return err(
        domainError("EXTERNAL", "Não foi possível ler o pagamento.", {
          retriable: true,
          cause: readErr,
        }),
      );
    }
    if (!original) {
      return err(
        domainError("NOT_FOUND", "Pagamento não encontrado.", { details: { transactionId } }),
      );
    }
    if (original.user_id !== userId) {
      return err(domainError("FORBIDDEN", "Sem acesso a este pagamento."));
    }
    if (original.tipo !== "pagamento") {
      return err(
        domainError("VALIDATION", "Somente pagamentos podem ser estornados.", {
          details: { tipo: original.tipo },
        }),
      );
    }
    if (!original.valor || original.valor <= 0) {
      return err(
        domainError("VALIDATION", "Pagamento sem valor positivo — nada a estornar."),
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const { data: inserted, error: insErr } = await supabase
      .from("clientes_transacoes")
      .insert({
        cliente_id: original.cliente_id,
        session_id: original.session_id,
        user_id: userId,
        valor: -Math.abs(Number(original.valor)),
        data_transacao: today,
        tipo: "estorno",
        descricao: motivo
          ? `Estorno: ${motivo}`
          : `Estorno do pagamento ${transactionId.slice(0, 8)}`,
        forma_pagamento: original.forma_pagamento ?? null,
        updated_by: userId,
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      ctx.log.error("falha ao inserir estorno", { insErr });
      return err(
        domainError("EXTERNAL", "Não foi possível registrar o estorno.", {
          retriable: true,
          cause: insErr,
        }),
      );
    }

    await ctx.emit("workflow.payment_refunded", {
      transactionId,
      estornoId: inserted.id,
      sessionId: original.session_id ?? null,
      valorEstornado: Math.abs(Number(original.valor)),
      photographerId: userId,
    });

    return ok({
      transactionId,
      estornoId: inserted.id,
      sessionId: original.session_id ?? null,
      valorEstornado: Math.abs(Number(original.valor)),
    });
  },
});

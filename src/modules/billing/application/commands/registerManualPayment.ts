import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { PaymentSupabaseService } from "@/services/PaymentSupabaseService";

/**
 * Capability `billing.registerManualPayment`
 *
 * v2 (contrato oficial Gallery↔Studio):
 *  - Escopo `sessao` OU sessão sem galeria vinculada → caminho legado
 *    (só grava clientes_transacoes, trigger recalcula sessão).
 *  - Escopo `fotos_extras` / `sessao_e_extras` COM galeria vinculada →
 *    invoca edge `confirm-payment-manual`, que aplica todas as regras
 *    (2.1..2.4 + finalize_gallery_payment + audit_log). Depois grava
 *    clientes_transacoes ancorado no `cobrancaId` retornado (upsert
 *    idempotente), evitando duplicidade quando Gallery/Studio confirmam
 *    o mesmo pagamento.
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
  alreadyPaid: z.boolean().optional(),
  cancelledPendingIds: z.array(z.string()).optional(),
  syncedGallery: z.boolean().optional(),
});

const MEIO_LABEL: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  cartao_externo: "Cartão externo",
  outro: "Outro",
};

/** Mapeia meio do Studio → metodo_manual esperado pela RPC/Gallery. */
const MEIO_TO_METODO_MANUAL: Record<string, string> = {
  pix: "pix_externo",
  dinheiro: "dinheiro",
  transferencia: "transferencia",
  cartao_externo: "cartao_externo",
  outro: "outro",
};

export const registerManualPayment = defineCommand({
  id: "billing.registerManualPayment",
  title: "Registrar pagamento manual",
  description:
    "Registra pagamento fora do gateway (PIX externo, dinheiro, transferência…) vinculado a uma sessão. Sincroniza galeria quando aplicável.",
  input: Input,
  output: Output,
  permissions: ["financeiro:write", "workflow:write"],
  sideEffects: [
    "db:clientes_transacoes",
    "db:clientes_sessoes(trigger)",
    "db:cobrancas",
    "db:galerias(trigger)",
    "external:confirm-payment-manual",
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
    const metodoManual = MEIO_TO_METODO_MANUAL[meio];
    const escopoTag = escopo === "sessao" ? "" : ` (${escopo.replace("_", " ")})`;
    const descBase = observacao?.trim() || `Pagamento ${label}${escopoTag}`;
    const intentKey = `billing.manual:${binding.session_id}:${valor}:${dataPagamento}:${meio}:${escopo}`;
    const intentMark = `[INTENT:${intentKey}:${escopo}]`;

    // ────────────────────────────────────────────────────────────
    // Caminho 1: extras COM galeria → edge confirm-payment-manual
    // ────────────────────────────────────────────────────────────
    if (escopo === "fotos_extras" || escopo === "sessao_e_extras") {
      const { data: gal } = await supabase
        .from("galerias")
        .select("id")
        .eq("user_id", userId)
        .eq("session_id", binding.session_id)
        .order("finalized_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (gal?.id) {
        const paidAtIso = `${dataPagamento}T12:00:00Z`;
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke(
          "confirm-payment-manual",
          {
            body: {
              cobrancaId: null,
              galleryId: gal.id,
              sessionId: binding.session_id,
              metodoManual,
              valorManual: valor,
              observacao: observacao?.trim() || undefined,
              paidAt: paidAtIso,
              finalidade: escopo === "sessao_e_extras" ? "sessao_e_extras" : "fotos_extras",
              valorExtrasComponente: escopo === "sessao_e_extras" ? valor : undefined,
              source: "studio_workflow",
            },
          },
        );

        if (edgeErr || !edgeData?.success) {
          ctx.log.error("confirm-payment-manual failed", { edgeErr, edgeData });
          return err(
            domainError("EXTERNAL", "Não foi possível registrar o pagamento (galeria).", {
              retriable: true,
              details: { edgeErr: edgeErr?.message, edgeData },
            }),
          );
        }

        const cobrancaId: string = edgeData.cobrancaId;
        const alreadyPaid: boolean = Boolean(edgeData.alreadyPaid);
        const cancelledPendingIds: string[] = edgeData.cancelledPendingIds ?? [];
        const paymentId = `manual-${cobrancaId.slice(0, 8)}`;
        // Marcador [MANUAL] casa com o índice único parcial (evita duplo lançamento).
        const desc = `${descBase} ${intentMark} [MANUAL] [ID:${paymentId}] (cobranca ${cobrancaId})`;

        const okSaved = await PaymentSupabaseService.saveSinglePaymentTracked(
          binding.id,
          paymentId,
          {
            valor,
            data: dataPagamento,
            observacoes: desc,
            forma_pagamento: label,
          },
          { binding, intentKey, cobrancaId },
        );

        if (!okSaved) {
          ctx.log.warn("clientes_transacoes upsert falhou após edge OK", { cobrancaId });
        }

        await ctx.emit("billing.manual_payment_registered", {
          sessionId: binding.id,
          paymentId,
          valor,
          meio,
          escopo,
          photographerId: userId,
          alreadyPaid,
          cancelledPendingIds,
          syncedGallery: true,
        });

        return ok({
          sessionId: binding.id,
          paymentId,
          valor,
          alreadyPaid,
          cancelledPendingIds,
          syncedGallery: true,
        });
      }
      // Sem galeria vinculada → cai no caminho legado abaixo.
    }

    // ────────────────────────────────────────────────────────────
    // Caminho 2 (legado): só sessão (ou extras sem galeria)
    // Grava clientes_transacoes; trigger recalcula clientes_sessoes.
    // ────────────────────────────────────────────────────────────
    const paymentId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const desc = `${descBase} ${intentMark}`;

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
      syncedGallery: false,
    });

    return ok({
      sessionId: binding.id,
      paymentId,
      valor,
      syncedGallery: false,
    });
  },
});

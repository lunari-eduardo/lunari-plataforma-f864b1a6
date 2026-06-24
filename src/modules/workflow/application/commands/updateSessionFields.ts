import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { sessionsRepo } from "@/features/workflow/data";
import { recalcFotosExtras, recalcSessionValorTotal } from "@/features/workflow/domain/pricing";

/**
 * Capability `workflow.updateFields`
 *
 * Atualização parcial e sanitizada de campos de uma sessão (card do Workflow).
 * Substitui o caminho hoje implementado por `pages/Workflow.tsx:updateSession`
 * para edições "simples" (sem recongelamento de regras de pacote/produtos).
 *
 * Regras:
 *  - Bloqueia campos read-only/computados (`status_financeiro`, `valor_pago`,
 *    `clientes`, `pagamentos`, `created_at`, `galerias`, `user_id`, `id`).
 *  - O dono autenticado precisa ser o `user_id` da sessão.
 *  - Idempotência leve por hash dos campos para evitar replays da IA.
 *  - Quando os campos afetam o total (`desconto`, `valor_adicional`,
 *    `produtos_incluidos`), recalcula `valor_total` internamente espelhando
 *    o trigger SQL `recalculate_session_valor_total`, de modo que o Output
 *    devolva o total atualizado para IA/Mobile/edge — o trigger DB continua
 *    sendo a fonte da verdade.
 */

const ForbiddenKeys = new Set([
  "id",
  "user_id",
  "created_at",
  "status_financeiro",
  "valor_pago",
  "clientes",
  "pagamentos",
  "galerias",
]);

const Input = z.object({
  sessionId: z.string().uuid(),
  fields: z
    .record(z.any())
    .refine((obj) => Object.keys(obj).length > 0, "Nenhum campo informado")
    .refine(
      (obj) => !Object.keys(obj).some((k) => ForbiddenKeys.has(k)),
      "Campos read-only/computados não podem ser alterados",
    ),
});

const Output = z.object({
  sessionId: z.string(),
  changedKeys: z.array(z.string()),
  valorTotal: z.number().optional(),
});

function hashFields(fields: Record<string, unknown>): string {
  try {
    const keys = Object.keys(fields).sort();
    return keys.map((k) => `${k}=${JSON.stringify(fields[k])}`).join("|");
  } catch {
    return String(Date.now());
  }
}

const TOTAL_AFFECTING_KEYS = new Set([
  "desconto",
  "valor_adicional",
  "valor_total_foto_extra",
  "valor_base_pacote",
  "produtos_incluidos",
  "qtd_fotos_extra",
  "valor_foto_extra",
]);

export const updateSessionFields = defineCommand({
  id: "workflow.updateFields",
  title: "Atualizar campos da sessão",
  description:
    "Atualiza campos editáveis de uma sessão (card). Bloqueia campos computados.",
  input: Input,
  output: Output,
  permissions: ["workflow:write"],
  sideEffects: ["db:clientes_sessoes", "event:workflow.card_updated"],
  audit: "on-success",
  idempotencyKey: (i) => `workflow.updateFields:${i.sessionId}:${hashFields(i.fields)}`,
  examples: [
    {
      nl: "Aplicar desconto de 50 reais na sessão X",
      input: {
        sessionId: "00000000-0000-0000-0000-000000000000",
        fields: { desconto: 50 },
      },
    },
  ],
  async handler({ sessionId, fields }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) {
      return err(domainError("UNAUTHENTICATED", "Sessão expirada."));
    }

    const current = await sessionsRepo.getById(userId, sessionId);
    if (!current) {
      return err(
        domainError("NOT_FOUND", "Sessão não encontrada.", { details: { sessionId } }),
      );
    }

    // Recálculo opcional — espelha as triggers SQL para que IA/Mobile recebam
    // o `valor_total` final no Output sem depender de round-trip.
    let fieldsToPersist: Record<string, unknown> = { ...fields };
    let computedTotal: number | undefined;

    const touchesTotal = Object.keys(fields).some((k) => TOTAL_AFFECTING_KEYS.has(k));
    if (touchesTotal) {
      const currentAny = current as any;
      const next = { ...currentAny, ...fields } as any;

      const touchedFotoExtra =
        "qtd_fotos_extra" in fields || "valor_foto_extra" in fields;

      if (touchedFotoExtra) {
        const result = recalcFotosExtras({
          qtd: Number(next.qtd_fotos_extra) || 0,
          valorFotoExtra: Number(next.valor_foto_extra) || 0,
          regrasCongeladas: currentAny.regras_congeladas,
          galeriaInfo: {
            galeriaId: currentAny.galeria_id,
            valorTotalVendido: currentAny.galerias?.valor_total_vendido,
            totalFotosExtrasVendidas: currentAny.galerias?.total_fotos_extras_vendidas,
          },
        });
        if (!result.respeitarBanco) {
          fieldsToPersist.valor_total_foto_extra = result.valorTotalFotoExtra;
          next.valor_total_foto_extra = result.valorTotalFotoExtra;
          if (Math.abs(result.valorUnitarioEfetivo - Number(next.valor_foto_extra || 0)) > 0.001) {
            fieldsToPersist.valor_foto_extra = result.valorUnitarioEfetivo;
            next.valor_foto_extra = result.valorUnitarioEfetivo;
          }
        }
      }

      computedTotal = recalcSessionValorTotal({
        valorBasePacote: Number(next.valor_base_pacote) || 0,
        valorTotalFotoExtra: Number(next.valor_total_foto_extra) || 0,
        produtosIncluidos: next.produtos_incluidos ?? [],
        valorAdicional: Number(next.valor_adicional) || 0,
        desconto: Number(next.desconto) || 0,
      });
      fieldsToPersist.valor_total = computedTotal;
    }

    try {
      await sessionsRepo.update(userId, sessionId, fieldsToPersist as any);
    } catch (cause) {
      ctx.log.error("falha ao atualizar sessão", { cause });
      return err(
        domainError("EXTERNAL", "Não foi possível atualizar a sessão.", {
          retriable: true,
          cause,
        }),
      );
    }

    const changedKeys = Object.keys(fieldsToPersist);
    await ctx.emit("workflow.card_updated", {
      sessionId,
      changedKeys,
      photographerId: userId,
    });

    return ok({ sessionId, changedKeys, valorTotal: computedTotal });
  },
});


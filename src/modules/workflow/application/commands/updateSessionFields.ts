import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { sessionsRepo } from "@/features/workflow/data";

/**
 * Capability `workflow.updateFields`
 *
 * Atualização parcial e sanitizada de campos de uma sessão (card do Workflow).
 * Replica o caminho hoje implementado por `pages/Workflow.tsx:updateSession`,
 * removendo a responsabilidade do componente.
 *
 * Regras:
 *  - Bloqueia campos read-only/computados (`status_financeiro`, `valor_pago`,
 *    `clientes`, `pagamentos`, `created_at`, `galerias`, `user_id`, `id`).
 *  - O dono autenticado precisa ser o `user_id` da sessão.
 *  - Idempotência leve por hash dos campos para evitar replays da IA.
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
});

function hashFields(fields: Record<string, unknown>): string {
  try {
    const keys = Object.keys(fields).sort();
    return keys.map((k) => `${k}=${JSON.stringify(fields[k])}`).join("|");
  } catch {
    return String(Date.now());
  }
}

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
      nl: "Aplicar desconto de 50 reais e mudar pacote para 'Premium' na sessão X",
      input: {
        sessionId: "00000000-0000-0000-0000-000000000000",
        fields: { desconto: 5000, pacote: "Premium" },
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

    try {
      await sessionsRepo.update(userId, sessionId, fields);
    } catch (cause) {
      ctx.log.error("falha ao atualizar sessão", { cause });
      return err(
        domainError("EXTERNAL", "Não foi possível atualizar a sessão.", {
          retriable: true,
          cause,
        }),
      );
    }

    const changedKeys = Object.keys(fields);
    await ctx.emit("workflow.card_updated", {
      sessionId,
      changedKeys,
      photographerId: userId,
    });

    return ok({ sessionId, changedKeys });
  },
});

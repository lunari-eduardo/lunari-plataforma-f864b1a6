import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { WorkflowSessionStatusSchema } from "../../domain/types";

const Input = z.object({
  sessionId: z.string().min(1),
  toStatus: WorkflowSessionStatusSchema,
});

const Output = z.object({
  sessionId: z.string(),
  fromStatus: z.string().nullable(),
  toStatus: z.string(),
});

/**
 * Capability `workflow.advanceCard`
 *
 * Move um card do funil para uma nova etapa (`clientes_sessoes.status`).
 * Garante autorização pelo `user_id` da sessão, idempotência por estado
 * destino (evita updates redundantes) e emite `workflow.card_advanced`
 * para Notificações / IA / Analytics reagirem.
 *
 * Regras de negócio:
 *   - O dono autenticado deve ser o `user_id` da sessão.
 *   - Não regride status quando o status atual já é o destino (no-op).
 *   - Validação de etapas permitidas é responsabilidade da UI/IA via
 *     query de etapas (`etapas_trabalho`); aqui aceitamos string livre
 *     por compatibilidade com etapas personalizadas.
 */
export const advanceCard = defineCommand({
  id: "workflow.advanceCard",
  title: "Avançar card do funil",
  description:
    "Atualiza o status de uma sessão (card do Workflow) para uma etapa específica.",
  input: Input,
  output: Output,
  permissions: ["workflow:write"],
  sideEffects: ["db:clientes_sessoes", "event:workflow.card_advanced"],
  audit: "on-success",
  idempotencyKey: (i) => `workflow.advanceCard:${i.sessionId}:${i.toStatus}`,
  examples: [
    {
      nl: "Mover a sessão para a etapa 'Enviado para seleção'",
      input: {
        sessionId: "00000000-0000-0000-0000-000000000000",
        toStatus: "Enviado para seleção",
      },
    },
  ],
  async handler({ sessionId, toStatus }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) {
      return err(domainError("UNAUTHENTICATED", "Sessão expirada."));
    }

    const { data: current, error: readError } = await supabase
      .from("clientes_sessoes")
      .select("id, status, user_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (readError) {
      ctx.log.error("falha ao ler sessão", { readError });
      return err(
        domainError("EXTERNAL", "Não foi possível ler a sessão.", {
          retriable: true,
          cause: readError,
        }),
      );
    }
    if (!current) {
      return err(domainError("NOT_FOUND", "Sessão não encontrada.", { details: { sessionId } }));
    }
    if (current.user_id !== userId) {
      return err(domainError("FORBIDDEN", "Sem acesso a esta sessão."));
    }

    const fromStatus = current.status ?? null;
    if (fromStatus === toStatus) {
      return ok({ sessionId, fromStatus, toStatus });
    }

    const { error: updError } = await supabase
      .from("clientes_sessoes")
      .update({ status: toStatus, updated_by: userId })
      .eq("id", sessionId)
      .eq("user_id", userId);

    if (updError) {
      ctx.log.error("falha ao atualizar status", { updError });
      return err(
        domainError("EXTERNAL", "Não foi possível atualizar a etapa.", {
          retriable: true,
          cause: updError,
        }),
      );
    }

    await ctx.emit("workflow.card_advanced", {
      sessionId,
      fromStatus,
      toStatus,
      photographerId: userId,
    });

    return ok({ sessionId, fromStatus, toStatus });
  },
});

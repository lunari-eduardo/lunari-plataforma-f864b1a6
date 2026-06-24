import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { workflowRpc } from "@/features/workflow/data";

/**
 * Capability `workflow.deleteSession`
 *
 * Excluir/arquivar sessão chamando a RPC atômica
 * `delete_workflow_session_cascade` (cuida de transações, cobranças, sessão
 * e appointment em uma única transação). Substitui o caminho inline hoje
 * em `pages/Workflow.tsx:handleDeleteSession`.
 *
 * Ações suportadas:
 *  - `preserve` — arquiva (soft-delete), mantém histórico
 *  - `refund`   — exclui e cria estornos espelhados das cobranças confirmadas
 *  - `remove`   — exclusão dura (preserva cobranças de gateway por auditoria)
 */

const Input = z.object({
  sessionId: z.string().uuid(),
  action: z.enum(["preserve", "refund", "remove"]),
});

const Output = z.object({
  sessionId: z.string(),
  action: z.enum(["preserve", "refund", "remove"]),
  deletedTransactions: z.number().int().nonnegative(),
  unlinkedCobrancas: z.number().int().nonnegative(),
  deletedSession: z.number().int().nonnegative(),
  deletedAppointment: z.number().int().nonnegative(),
  estornosCriados: z.number().int().nonnegative(),
  softDeleted: z.boolean(),
});

export const deleteSession = defineCommand({
  id: "workflow.deleteSession",
  title: "Excluir/arquivar sessão",
  description:
    "Executa exclusão atômica (RPC) preservando, estornando ou removendo dependências.",
  input: Input,
  output: Output,
  permissions: ["workflow:write", "workflow:delete"],
  sideEffects: [
    "db:clientes_sessoes",
    "db:clientes_transacoes",
    "db:cobrancas",
    "db:appointments",
    "event:workflow.card_deleted",
  ],
  audit: "always",
  idempotencyKey: (i) => `workflow.deleteSession:${i.sessionId}:${i.action}`,
  examples: [
    {
      nl: "Arquivar a sessão X para o histórico",
      input: { sessionId: "00000000-0000-0000-0000-000000000000", action: "preserve" },
    },
  ],
  async handler({ sessionId, action }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) {
      return err(domainError("UNAUTHENTICATED", "Sessão expirada."));
    }

    // Verificação de propriedade antes da RPC (defesa em profundidade — a RPC
    // já valida via RLS, mas evitamos a chamada e retornamos erro claro).
    const { data: owner } = await supabase
      .from("clientes_sessoes")
      .select("user_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (!owner) {
      return err(domainError("NOT_FOUND", "Sessão não encontrada.", { details: { sessionId } }));
    }
    if (owner.user_id !== userId) {
      return err(domainError("FORBIDDEN", "Sem acesso a esta sessão."));
    }

    let result: Awaited<ReturnType<typeof workflowRpc.deleteWorkflowSessionCascade>>;
    try {
      result = await workflowRpc.deleteWorkflowSessionCascade(sessionId, action);
    } catch (cause) {
      ctx.log.error("falha na RPC delete_workflow_session_cascade", { cause });
      return err(
        domainError("EXTERNAL", "Não foi possível excluir a sessão.", {
          retriable: true,
          cause,
        }),
      );
    }

    const deletedSession = result.deleted_session ?? 0;
    if (action !== "preserve" && deletedSession === 0) {
      return err(
        domainError("CONFLICT", "Nada foi excluído. A sessão pode já ter sido removida."),
      );
    }

    await ctx.emit("workflow.card_deleted", {
      sessionId,
      action,
      photographerId: userId,
      estornosCriados: result.estornos_criados ?? 0,
    });

    return ok({
      sessionId,
      action,
      deletedTransactions: result.deleted_transactions ?? 0,
      unlinkedCobrancas: result.unlinked_cobrancas ?? 0,
      deletedSession,
      deletedAppointment: result.deleted_appointment ?? 0,
      estornosCriados: result.estornos_criados ?? 0,
      softDeleted: !!result.soft_deleted,
    });
  },
});

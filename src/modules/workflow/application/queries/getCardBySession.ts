import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { WorkflowCardSchema } from "../../domain/types";

/**
 * Capability `workflow.getCardBySession`
 *
 * Lê um card do funil pelo `sessionId`. Usado por Web/Mobile/IA para
 * obter o estado canônico antes de tomar decisões (avançar etapa,
 * cobrar, notificar). Não emite eventos.
 */
export const getCardBySession = defineQuery({
  id: "workflow.getCardBySession",
  title: "Obter card do funil por sessão",
  description: "Lê o card (sessão) do Workflow pelo ID da sessão.",
  input: z.object({ sessionId: z.string().min(1) }),
  output: WorkflowCardSchema,
  permissions: ["workflow:read"],
  async handler({ sessionId }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) {
      return err(domainError("UNAUTHENTICATED", "Sessão expirada."));
    }

    const { data, error } = await supabase
      .from("clientes_sessoes")
      .select(
        "id, cliente_id, status, pacote, categoria, valor_total, valor_pago, appointment_id, galeria_id, updated_at, user_id",
      )
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      ctx.log.error("falha ao ler sessão", { error });
      return err(
        domainError("EXTERNAL", "Não foi possível ler a sessão.", {
          retriable: true,
          cause: error,
        }),
      );
    }
    if (!data) {
      return err(domainError("NOT_FOUND", "Sessão não encontrada.", { details: { sessionId } }));
    }
    if (data.user_id !== userId) {
      return err(domainError("FORBIDDEN", "Sem acesso a esta sessão."));
    }

    return ok({
      id: data.id,
      clienteId: data.cliente_id ?? null,
      status: data.status ?? null,
      pacote: data.pacote ?? null,
      categoria: data.categoria ?? null,
      valorTotal: data.valor_total == null ? null : Number(data.valor_total),
      valorPago: data.valor_pago == null ? null : Number(data.valor_pago),
      appointmentId: data.appointment_id ?? null,
      galeriaId: data.galeria_id ?? null,
      updatedAt: data.updated_at ?? null,
    });
  },
});

import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.syncFromAgenda`
 *
 * Espelha um `appointments` confirmado como sessão de Workflow. Operação
 * idempotente: se já existir uma sessão vinculada ao mesmo `appointment_id`
 * para o mesmo usuário, devolve essa sessão (com `reused=true`) em vez de
 * duplicar.
 *
 * Substitui a lógica espalhada em `AgendaWorkflowIntegrationService` para o
 * caminho simples (cliente + data/hora + categoria + pacote opcional).
 * Casos complexos (recongelamento de regras, congelamento de preços) ainda
 * passam pelo service legado até a Onda 5.
 *
 * Idempotência por `appointment_id` durante 10min cobre cliques repetidos
 * vindos da IA ou do botão "Sincronizar com Agenda".
 */

const Input = z.object({
  appointmentId: z.string().uuid(),
});

const Output = z.object({
  sessionId: z.string(),
  sessionRowId: z.string(),
  reused: z.boolean(),
});

function makeSessionTextId(dataSessao: string, horaSessao: string): string {
  const compactDate = dataSessao.replace(/-/g, "");
  const compactTime = horaSessao.replace(":", "");
  const rand = Math.random().toString(36).slice(2, 6);
  return `${compactDate}-${compactTime}-${rand}`;
}

export const syncFromAgenda = defineCommand({
  id: "workflow.syncFromAgenda",
  title: "Sincronizar Agenda → Workflow",
  description:
    "Cria (ou reaproveita) uma sessão do Workflow espelhando um agendamento confirmado.",
  input: Input,
  output: Output,
  permissions: ["workflow:write"],
  sideEffects: ["db:clientes_sessoes", "event:workflow.card_updated"],
  audit: "on-success",
  idempotencyKey: (i) => `workflow.syncFromAgenda:${i.appointmentId}`,
  examples: [
    {
      nl: "Espelhar este agendamento como sessão no funil",
      input: { appointmentId: "00000000-0000-0000-0000-000000000000" },
    },
  ],
  async handler({ appointmentId }, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) {
      return err(domainError("UNAUTHENTICATED", "Sessão expirada."));
    }

    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .select(
        "id, user_id, cliente_id, date, time, type, title, description, package_id, status",
      )
      .eq("id", appointmentId)
      .maybeSingle();

    if (apptErr) {
      ctx.log.error("falha ao ler appointment", { apptErr });
      return err(
        domainError("EXTERNAL", "Não foi possível ler o agendamento.", {
          retriable: true,
          cause: apptErr,
        }),
      );
    }
    if (!appt) {
      return err(domainError("NOT_FOUND", "Agendamento não encontrado."));
    }
    if (appt.user_id !== userId) {
      return err(domainError("FORBIDDEN", "Sem acesso a este agendamento."));
    }
    if (!appt.cliente_id) {
      return err(
        domainError(
          "VALIDATION",
          "Agendamento sem cliente vinculado — vincule um cliente antes de sincronizar.",
        ),
      );
    }
    if (appt.status && appt.status !== "confirmado") {
      return err(
        domainError(
          "VALIDATION",
          "Somente agendamentos confirmados podem virar sessão.",
          { details: { status: appt.status } },
        ),
      );
    }

    // Reuso por appointment_id
    const { data: existing } = await supabase
      .from("clientes_sessoes")
      .select("id, session_id")
      .eq("user_id", userId)
      .eq("appointment_id", appointmentId)
      .maybeSingle();

    if (existing) {
      return ok({
        sessionId: existing.session_id,
        sessionRowId: existing.id,
        reused: true,
      });
    }

    const sessionTextId = makeSessionTextId(appt.date, appt.time);

    const { data: inserted, error: insErr } = await supabase
      .from("clientes_sessoes")
      .insert({
        user_id: userId,
        cliente_id: appt.cliente_id,
        appointment_id: appointmentId,
        session_id: sessionTextId,
        data_sessao: appt.date,
        hora_sessao: appt.time,
        categoria: appt.type ?? "Sessão",
        pacote: appt.package_id ?? null,
        descricao: appt.description ?? appt.title ?? null,
        status: "agendado",
        valor_base_pacote: 0,
        valor_total: 0,
        tipo_registro: "workflow",
        updated_by: userId,
      })
      .select("id, session_id")
      .single();

    if (insErr || !inserted) {
      ctx.log.error("falha ao inserir sessão a partir do agendamento", { insErr });
      return err(
        domainError("EXTERNAL", "Não foi possível criar a sessão.", {
          retriable: true,
          cause: insErr,
        }),
      );
    }

    await ctx.emit("workflow.card_updated", {
      sessionId: inserted.id,
      changedKeys: ["__created_from_appointment__"],
      photographerId: userId,
    });

    return ok({
      sessionId: inserted.session_id,
      sessionRowId: inserted.id,
      reused: false,
    });
  },
});

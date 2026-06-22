/**
 * Implementação de AppointmentsRepository — fala direto com Supabase.
 * Onda 7e3: removida a delegação para `SupabaseAgendaAdapter`. Toda a lógica
 * de side-effects (criação de sessão de workflow, sync Google Calendar,
 * estorno/cascade delete) foi portada para cá, preservando o comportamento.
 */
import { supabase } from "@/integrations/supabase/client";
import { generateUniversalSessionId } from "@/types/appointments-supabase";
import { formatCurrency } from "@/utils/financialUtils";
import type {
  Appointment as DomainAppointment,
  DateRange,
  DeletionAction,
  NewAppointment,
} from "../domain/types";
import type { AppointmentsRepository } from "../domain/ports";

// ------------------------------ helpers ------------------------------

async function requireSession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) throw new Error("User not authenticated");
  return data.session;
}

function assertIsoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    console.error("❌ Invalid date format:", value);
    throw new Error("Data inválida. Use formato YYYY-MM-DD");
  }
  return value;
}

function mapRow(row: any): DomainAppointment {
  return {
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    date: row.date, // já vem yyyy-MM-dd do Postgres
    time: row.time,
    type: row.type,
    client: (row.clientes as any)?.nome || row.title,
    status: row.status,
    description: row.description ?? undefined,
    packageId: row.package_id ?? undefined,
    paidAmount: Number(row.paid_amount) || 0,
    email: undefined,
    whatsapp: undefined,
    orcamentoId: row.orcamento_id ?? undefined,
    origem: row.origem ?? undefined,
    clienteId: row.cliente_id ?? undefined,
  };
}

/**
 * Hidrata o appointment recém-criado/atualizado e dispara a criação da
 * sessão de workflow + sync Google Calendar. Idempotente e tolerante a falhas.
 */
async function handleConfirmedSideEffects(appointmentId: string, userId: string) {
  try {
    const { data: fresh, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .eq("user_id", userId)
      .single();

    if (error || !fresh) {
      console.error("❌ [agenda.repo] Não foi possível hidratar appointment:", error);
      return;
    }

    const hydrated = {
      id: fresh.id,
      sessionId: fresh.session_id,
      title: fresh.title,
      date: fresh.date,
      time: fresh.time,
      type: fresh.type,
      client: fresh.title,
      status: fresh.status,
      description: fresh.description || "",
      packageId: fresh.package_id || "",
      paidAmount: Number(fresh.paid_amount) || 0,
      email: "",
      whatsapp: "",
      orcamentoId: fresh.orcamento_id || "",
      origem: fresh.origem,
      clienteId: fresh.cliente_id || "",
      // snake_case para WorkflowSupabaseService
      package_id: fresh.package_id,
      paid_amount: fresh.paid_amount,
      cliente_id: fresh.cliente_id,
    };

    const { WorkflowSupabaseService } = await import("@/services/WorkflowSupabaseService");
    const session = await WorkflowSupabaseService.createSessionFromAppointment(
      hydrated.id,
      hydrated,
    );

    if (session) {
      console.log("🎯 [agenda.repo] Sessão criada com sucesso:", session.id);

      // Patch redundante: corrigir inversão categoria/pacote E valor_base_pacote = 0
      setTimeout(async () => {
        try {
          const { data: checkSession } = await supabase
            .from("clientes_sessoes")
            .select("id, categoria, pacote, valor_base_pacote, appointment_id, user_id")
            .eq("id", session.id)
            .maybeSingle();

          const needsPatch =
            checkSession &&
            hydrated.packageId &&
            (!checkSession.pacote ||
              checkSession.categoria === checkSession.pacote ||
              Number(checkSession.valor_base_pacote) === 0);

          if (!needsPatch) return;

          const { data: pkg } = await supabase
            .from("pacotes")
            .select("nome, valor_base, categoria_id, categorias!inner ( nome )")
            .eq("id", hydrated.packageId)
            .maybeSingle();

          if (pkg) {
            await supabase
              .from("clientes_sessoes")
              .update({
                categoria: (pkg.categorias as any)?.nome || "Sessão",
                pacote: pkg.nome,
                valor_base_pacote: Number(pkg.valor_base) || 0,
              })
              .eq("id", session.id);
            return;
          }

          if (checkSession?.pacote && checkSession.user_id) {
            const { data: pkgByName } = await supabase
              .from("pacotes")
              .select("nome, valor_base, categoria_id, categorias!inner ( nome )")
              .eq("nome", checkSession.pacote)
              .eq("user_id", checkSession.user_id)
              .maybeSingle();

            if (pkgByName) {
              await supabase
                .from("clientes_sessoes")
                .update({
                  categoria: (pkgByName.categorias as any)?.nome || "Sessão",
                  valor_base_pacote: Number(pkgByName.valor_base) || 0,
                })
                .eq("id", session.id);
            }
          }
        } catch (patchError) {
          console.error("⚠️ [agenda.repo] Erro no patch redundante:", patchError);
        }
      }, 1000);

      window.dispatchEvent(
        new CustomEvent("workflow-session-created", {
          detail: {
            sessionId: session.id,
            appointmentId,
            timestamp: new Date().toISOString(),
          },
        }),
      );
    } else {
      // Fallback: tenta de novo daqui a 2s se não houver sessão para o appointment
      setTimeout(async () => {
        const { data: checkSession } = await supabase
          .from("clientes_sessoes")
          .select("id")
          .eq("appointment_id", appointmentId)
          .maybeSingle();

        if (!checkSession) {
          await WorkflowSupabaseService.createSessionFromAppointment(appointmentId, hydrated);
        }
      }, 2000);
    }
  } catch (sessionError) {
    console.error("⚠️ [agenda.repo] Erro ao criar sessão (não fatal):", sessionError);
  }

  // Google Calendar sync — não fatal
  try {
    const { syncAppointmentToGoogleCalendar } = await import("@/services/googleCalendarSync");
    await syncAppointmentToGoogleCalendar(appointmentId, "update");
  } catch (syncError) {
    console.warn("⚠️ [agenda.repo] Google Calendar sync falhou (não fatal):", syncError);
  }
}

// ------------------------------ repo ------------------------------

export class SupabaseAppointmentsRepository implements AppointmentsRepository {
  async listByRange(range: DateRange): Promise<DomainAppointment[]> {
    const session = await requireSession();

    const { data, error } = await supabase
      .from("appointments")
      .select(`*, clientes ( nome )`)
      .eq("user_id", session.user.id)
      .gte("date", range.start)
      .lte("date", range.end)
      .order("date", { ascending: false })
      .order("time", { ascending: true });

    if (error) throw error;
    return (data || []).map(mapRow);
  }

  async getById(id: string): Promise<DomainAppointment | null> {
    const session = await requireSession();

    const { data, error } = await supabase
      .from("appointments")
      .select(`*, clientes ( nome )`)
      .eq("id", id)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapRow(data) : null;
  }

  async create(input: NewAppointment): Promise<DomainAppointment> {
    const session = await requireSession();
    const sessionId = input.sessionId || generateUniversalSessionId("agenda");
    const dateStr = assertIsoDate(input.date);

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        user_id: session.user.id,
        session_id: sessionId,
        title: input.title,
        date: dateStr,
        time: input.time,
        type: input.type,
        status: input.status,
        description: input.description,
        package_id: input.packageId,
        paid_amount: input.paidAmount || 0,
        orcamento_id: input.orcamentoId,
        origem: input.origem || "agenda",
        cliente_id: input.clienteId || null,
      })
      .select(`*, clientes ( nome )`)
      .single();

    if (error) throw error;

    const created = mapRow(data);

    if (created.status === "confirmado") {
      // dispara mas não espera — paridade com o legado (não fatal)
      void handleConfirmedSideEffects(created.id, session.user.id);
    }

    return created;
  }

  async update(id: string, patch: Partial<NewAppointment>): Promise<void> {
    const session = await requireSession();

    const updateData: Record<string, any> = {};
    if (patch.title !== undefined) updateData.title = patch.title;
    if (patch.date !== undefined) updateData.date = assertIsoDate(patch.date);
    if (patch.time !== undefined) updateData.time = patch.time;
    if (patch.type !== undefined) updateData.type = patch.type;
    if (patch.status !== undefined) updateData.status = patch.status;
    if (patch.description !== undefined) updateData.description = patch.description;
    if (patch.packageId !== undefined) updateData.package_id = patch.packageId;
    if (patch.paidAmount !== undefined) updateData.paid_amount = patch.paidAmount;
    if (patch.orcamentoId !== undefined) updateData.orcamento_id = patch.orcamentoId;
    if (patch.origem !== undefined) updateData.origem = patch.origem;
    if (patch.clienteId !== undefined) updateData.cliente_id = patch.clienteId;

    const { error } = await supabase
      .from("appointments")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", session.user.id);

    if (error) throw error;

    if (patch.status === "confirmado") {
      void handleConfirmedSideEffects(id, session.user.id);
    } else if (
      patch.date !== undefined ||
      patch.time !== undefined ||
      patch.title !== undefined ||
      patch.type !== undefined ||
      patch.description !== undefined ||
      patch.clienteId !== undefined
    ) {
      // Mudança relevante em appointment já confirmado — antecipa Google sync
      try {
        const { syncAppointmentToGoogleCalendar } = await import(
          "@/services/googleCalendarSync"
        );
        await syncAppointmentToGoogleCalendar(id, "update");
      } catch (syncError) {
        console.warn("⚠️ [agenda.repo] Google Calendar sync falhou (não fatal):", syncError);
      }
    }
  }

  async delete(id: string, action?: DeletionAction): Promise<void> {
    const session = await requireSession();
    const effectiveAction = action || "remove";

    console.log("🗑️ [DELETE-START]", {
      timestamp: new Date().toISOString(),
      appointmentId: id,
      action: effectiveAction,
    });

    // ============== Ação 'remove': cascade via RPC atômica ==============
    if (effectiveAction === "remove") {
      const { data: appointment } = await supabase
        .from("appointments")
        .select("google_event_id, title")
        .eq("id", id)
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (appointment?.google_event_id) {
        try {
          const { syncAppointmentToGoogleCalendar } = await import(
            "@/services/googleCalendarSync"
          );
          await syncAppointmentToGoogleCalendar(id, "delete");
        } catch (syncError) {
          console.warn(
            "⚠️ [agenda.repo] Google Calendar delete sync falhou (não fatal):",
            syncError,
          );
        }
      }

      const { error } = await supabase.rpc("delete_appointment_cascade", {
        p_appointment_id: id,
        p_keep_payments: false,
      });

      if (error) {
        console.error("❌ [agenda.repo] Erro na RPC delete_appointment_cascade:", error);
        throw error;
      }

      console.log("✅ [DELETE-COMPLETE-ATOMIC]", { timestamp: new Date().toISOString() });
      return;
    }

    // ============== Ação 'refund': estornar pagamentos ==============
    if (effectiveAction === "refund") {
      const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", id)
        .eq("user_id", session.user.id)
        .single();

      if (appointmentError || !appointment) {
        throw appointmentError || new Error("Appointment not found");
      }

      const { data: workflowSession } = await supabase
        .from("clientes_sessoes")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("appointment_id", id)
        .maybeSingle();

      if (workflowSession) {
        const sessionId = workflowSession.session_id;

        const { data: paidTransactions } = await supabase
          .from("clientes_transacoes")
          .select("*")
          .eq("session_id", sessionId)
          .eq("user_id", session.user.id)
          .eq("tipo", "pagamento");

        if (paidTransactions && paidTransactions.length > 0) {
          const refunds = paidTransactions.map((t) => ({
            user_id: session.user.id,
            cliente_id: t.cliente_id,
            session_id: t.session_id,
            valor: t.valor,
            tipo: "estorno" as const,
            data_transacao: new Date().toISOString().split("T")[0],
            descricao: `Estorno: ${t.descricao || "Pagamento"} (agendamento excluído)`,
          }));

          const { error: refundError } = await supabase
            .from("clientes_transacoes")
            .insert(refunds);

          if (refundError) {
            console.error("❌ Erro ao criar estornos:", refundError);
            throw new Error(`Falha ao estornar pagamentos: ${refundError.message}`);
          }
        }

        await supabase
          .from("clientes_sessoes")
          .delete()
          .eq("id", workflowSession.id)
          .eq("user_id", session.user.id);
      }

      if (appointment.google_event_id) {
        try {
          const { syncAppointmentToGoogleCalendar } = await import(
            "@/services/googleCalendarSync"
          );
          await syncAppointmentToGoogleCalendar(id, "delete");
        } catch (syncError) {
          console.warn(
            "⚠️ [agenda.repo] Google Calendar delete sync falhou (não fatal):",
            syncError,
          );
        }
      }

      await supabase
        .from("appointments")
        .delete()
        .eq("id", id)
        .eq("user_id", session.user.id);

      console.log("✅ [DELETE-COMPLETE-REFUND]", { timestamp: new Date().toISOString() });
      return;
    }

    // ============== Ação 'preserve': manter sessão como histórico ==============
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single();

    if (appointmentError || !appointment) {
      console.error("❌ Appointment not found for deletion:", appointmentError);
      throw appointmentError;
    }

    // Resolução de sessão em duas etapas (evita OR perigoso)
    let workflowSession: any = null;
    const { data: sessionByAppointment } = await supabase
      .from("clientes_sessoes")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("appointment_id", id)
      .maybeSingle();

    if (sessionByAppointment) {
      workflowSession = sessionByAppointment;
    } else if (appointment.session_id) {
      const { data: otherAppointments } = await supabase
        .from("appointments")
        .select("id")
        .eq("session_id", appointment.session_id)
        .eq("user_id", session.user.id)
        .neq("id", id)
        .limit(5);

      if (!otherAppointments || otherAppointments.length === 0) {
        const { data: sessionBySessionId } = await supabase
          .from("clientes_sessoes")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("session_id", appointment.session_id)
          .maybeSingle();
        if (sessionBySessionId) workflowSession = sessionBySessionId;
      }
    }

    if (workflowSession) {
      const valorPagoAtual = Number(workflowSession.valor_pago) || 0;

      const { error: updateError } = await supabase
        .from("clientes_sessoes")
        .update({
          appointment_id: null,
          status: "historico",
          valor_total: valorPagoAtual,
          valor_base_pacote: 0,
          valor_total_foto_extra: 0,
          qtd_fotos_extra: 0,
          valor_foto_extra: 0,
          valor_adicional: 0,
          desconto: 0,
          produtos_incluidos: [],
          regras_congeladas: null,
          descricao:
            `${workflowSession.pacote || workflowSession.descricao || ""} (Agendamento cancelado)`.trim(),
          observacoes: workflowSession.observacoes
            ? `${workflowSession.observacoes}\n\n[${new Date().toLocaleDateString()}] Agendamento cancelado - preservado apenas valor pago de ${formatCurrency(valorPagoAtual)}`
            : `[${new Date().toLocaleDateString()}] Agendamento cancelado - preservado apenas valor pago de ${formatCurrency(valorPagoAtual)}`,
          updated_at: new Date().toISOString(),
          updated_by: session.user.id,
        })
        .eq("id", workflowSession.id)
        .eq("user_id", session.user.id);

      if (updateError) {
        console.error("❌ Erro ao marcar sessão como histórico:", updateError);
        throw new Error(`Falha ao preservar histórico: ${updateError.message}`);
      }
    }

    if (appointment.google_event_id) {
      try {
        const { syncAppointmentToGoogleCalendar } = await import(
          "@/services/googleCalendarSync"
        );
        await syncAppointmentToGoogleCalendar(id, "delete");
      } catch (syncError) {
        console.warn(
          "⚠️ [agenda.repo] Google Calendar delete sync falhou (não fatal):",
          syncError,
        );
      }
    }

    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id);

    if (error) throw error;

    console.log("✅ [DELETE-COMPLETE-PRESERVE]", {
      timestamp: new Date().toISOString(),
      appointmentId: id,
    });
  }
}
